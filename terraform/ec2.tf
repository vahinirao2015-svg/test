data "aws_ami" "amazon_linux" {
  count = var.ami_id == "" ? 1 : 0

  most_recent = true
  owners      = ["amazon"]

  filter {
    name   = "name"
    values = ["al2023-ami-*-x86_64"]
  }

  filter {
    name   = "virtualization-type"
    values = ["hvm"]
  }

  filter {
    name   = "state"
    values = ["available"]
  }
}

locals {
  ami_id = var.ami_id != "" ? var.ami_id : data.aws_ami.amazon_linux[0].id

  # Bootstrap must be resilient: a failed dnf package name previously aborted
  # user-data before gunicorn started, leaving ALB targets unhealthy (502).
  user_data = <<-EOF
    #!/bin/bash
    set -uo pipefail
    exec > >(tee /var/log/attendance-bootstrap.log | logger -t user-data -s 2>/dev/console) 2>&1

    echo "Starting Daymark bootstrap"

    # Do not fail the whole bootstrap on optional package names / update noise.
    dnf -y update || echo "dnf update failed (continuing)"
    dnf -y install python3 python3-pip unzip || dnf -y install python3 unzip
    if ! command -v aws >/dev/null 2>&1; then
      dnf -y install awscli-2 || dnf -y install aws-cli || dnf -y install awscli || true
    fi

    # Wait for instance profile credentials (IAM eventual consistency + IMDSv2).
    for i in $(seq 1 30); do
      TOKEN=$(curl -fsS -X PUT "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 21600" 2>/dev/null || true)
      if [ -n "$${TOKEN}" ]; then
        CREDS=$(curl -fsS -H "X-aws-ec2-metadata-token: $${TOKEN}" http://169.254.169.254/latest/meta-data/iam/security-credentials/ 2>/dev/null || true)
      else
        CREDS=$(curl -fsS http://169.254.169.254/latest/meta-data/iam/security-credentials/ 2>/dev/null || true)
      fi
      if [ -n "$${CREDS}" ]; then
        echo "Instance profile is available"
        break
      fi
      echo "Waiting for instance profile ($i/30)"
      sleep 2
    done

    APP_DIR=/opt/attendance
    mkdir -p "$${APP_DIR}"

    DOWNLOAD_OK=0
    for i in $(seq 1 20); do
      if aws s3 cp "s3://${aws_s3_bucket.app.id}/${aws_s3_object.attendance_app.key}" /tmp/attendance-app.zip; then
        DOWNLOAD_OK=1
        break
      fi
      echo "S3 download failed ($i/20); retrying"
      sleep 3
    done
    if [ "$${DOWNLOAD_OK}" -ne 1 ]; then
      echo "FATAL: could not download app package from S3"
      exit 1
    fi
    unzip -o /tmp/attendance-app.zip -d "$${APP_DIR}"

    python3 -m venv "$${APP_DIR}/.venv"
    "$${APP_DIR}/.venv/bin/pip" install --upgrade pip
    "$${APP_DIR}/.venv/bin/pip" install -r "$${APP_DIR}/requirements.txt"

    umask 077
    cat >/etc/attendance.env <<ENV
AWS_REGION=${var.aws_region}
AWS_DEFAULT_REGION=${var.aws_region}
DB_SECRET_ARN=${aws_secretsmanager_secret.db.arn}
APP_NAME=${var.app_name}
SECRET_KEY=${random_password.app_secret.result}
ENV
    chmod 600 /etc/attendance.env

    cat >/etc/systemd/system/attendance.service <<'UNIT'
[Unit]
Description=Daymark attendance web app
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=/opt/attendance
EnvironmentFile=/etc/attendance.env
ExecStart=/opt/attendance/.venv/bin/gunicorn -b 0.0.0.0:BACKEND_PORT --workers 2 --timeout 120 --access-logfile - --error-logfile - wsgi:app
Restart=always
RestartSec=3

[Install]
WantedBy=multi-user.target
UNIT
    sed -i "s/BACKEND_PORT/${var.backend_port}/" /etc/systemd/system/attendance.service

    systemctl daemon-reload
    systemctl enable --now attendance.service

    # Confirm the process is listening before finishing user-data.
    for i in $(seq 1 60); do
      if curl -fsS "http://127.0.0.1:${var.backend_port}/health" >/dev/null 2>&1; then
        echo "Attendance app is healthy on :${var.backend_port}"
        exit 0
      fi
      echo "Waiting for local /health ($i/60)"
      systemctl is-active --quiet attendance.service || systemctl restart attendance.service || true
      sleep 2
    done

    echo "Bootstrap finished but /health not yet OK; dumping service logs"
    systemctl status attendance.service --no-pager || true
    journalctl -u attendance.service -n 120 --no-pager || true
    exit 0
  EOF
}

resource "aws_iam_role" "ec2" {
  name_prefix = "${local.name_prefix}-ec2-"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "ec2.amazonaws.com"
        }
      }
    ]
  })

  tags = {
    Name = "role-${local.name_prefix}-ec2"
  }
}

resource "aws_iam_role_policy_attachment" "ssm" {
  role       = aws_iam_role.ec2.name
  policy_arn = "arn:aws:iam::aws:policy/AmazonSSMManagedInstanceCore"
}

resource "aws_iam_instance_profile" "ec2" {
  name_prefix = "${local.name_prefix}-ec2-"
  role        = aws_iam_role.ec2.name
}

resource "aws_instance" "backend" {
  count = var.instance_count

  ami                         = local.ami_id
  instance_type               = var.instance_type
  subnet_id                   = aws_subnet.private[count.index % length(aws_subnet.private)].id
  vpc_security_group_ids      = [aws_security_group.ec2.id]
  iam_instance_profile        = aws_iam_instance_profile.ec2.name
  key_name                    = var.key_name != "" ? var.key_name : null
  user_data                   = local.user_data
  user_data_replace_on_change = true

  root_block_device {
    volume_type           = "gp3"
    volume_size           = var.root_volume_size
    encrypted             = true
    delete_on_termination = true
  }

  metadata_options {
    http_endpoint = "enabled"
    http_tokens   = "required"
    # Hop limit 2 helps awscli/SSM agent reliably use IMDSv2.
    http_put_response_hop_limit = 2
  }

  depends_on = [
    aws_nat_gateway.main,
    aws_s3_object.attendance_app,
    aws_secretsmanager_secret_version.db,
    aws_db_instance.attendance,
    aws_iam_role_policy.ec2_app,
  ]

  tags = {
    Name = "ec2-${local.name_prefix}-backend-${count.index + 1}"
    Role = "attendance-backend"
  }
}

resource "aws_lb_target_group_attachment" "backend" {
  count = var.instance_count

  target_group_arn = aws_lb_target_group.backend.arn
  target_id        = aws_instance.backend[count.index].id
  port             = var.backend_port
}
