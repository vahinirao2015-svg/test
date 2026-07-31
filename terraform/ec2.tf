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

  user_data = <<-EOF
    #!/bin/bash
    set -euo pipefail
    exec > >(tee /var/log/attendance-bootstrap.log | logger -t user-data -s 2>/dev/console) 2>&1

    dnf -y update
    dnf -y install python3 python3-pip python3-virtualenv unzip
    command -v aws >/dev/null 2>&1 || dnf -y install awscli-2 || dnf -y install aws-cli || dnf -y install awscli

    APP_DIR=/opt/attendance
    mkdir -p "$${APP_DIR}"
    aws s3 cp "s3://${aws_s3_bucket.app.id}/${aws_s3_object.attendance_app.key}" /tmp/attendance-app.zip
    unzip -o /tmp/attendance-app.zip -d "$${APP_DIR}"

    python3 -m venv "$${APP_DIR}/.venv"
    "$${APP_DIR}/.venv/bin/pip" install --upgrade pip
    "$${APP_DIR}/.venv/bin/pip" install -r "$${APP_DIR}/requirements.txt"

    cat >/etc/systemd/system/attendance.service <<UNIT
[Unit]
Description=Daymark attendance web app
After=network-online.target
Wants=network-online.target

[Service]
Type=simple
WorkingDirectory=/opt/attendance
Environment=AWS_REGION=${var.aws_region}
Environment=AWS_DEFAULT_REGION=${var.aws_region}
Environment=DB_SECRET_ARN=${aws_secretsmanager_secret.db.arn}
Environment=APP_NAME=${var.app_name}
Environment=SECRET_KEY=${random_password.app_secret.result}
ExecStart=/opt/attendance/.venv/bin/gunicorn -b 0.0.0.0:${var.backend_port} --workers 2 --timeout 120 wsgi:app
Restart=always
RestartSec=5

[Install]
WantedBy=multi-user.target
UNIT

    systemctl daemon-reload
    systemctl enable --now attendance.service
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
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 1
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
