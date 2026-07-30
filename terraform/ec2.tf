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
    dnf -y update
    dnf -y install nginx
    systemctl enable --now nginx
    HOSTNAME="$(hostname -f)"
    cat >/usr/share/nginx/html/index.html <<HTML
    <!DOCTYPE html>
    <html>
      <head><title>${local.name_prefix} backend</title></head>
      <body>
        <h1>AWS ALB + EC2 backend</h1>
        <p>Instance: $${HOSTNAME}</p>
        <p>Healthy</p>
      </body>
    </html>
    HTML
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

  ami                    = local.ami_id
  instance_type          = var.instance_type
  subnet_id              = aws_subnet.private[count.index % length(aws_subnet.private)].id
  vpc_security_group_ids = [aws_security_group.ec2.id]
  iam_instance_profile   = aws_iam_instance_profile.ec2.name
  key_name               = var.key_name != "" ? var.key_name : null
  user_data              = local.user_data

  root_block_device {
    volume_type           = "gp3"
    volume_size           = 8
    encrypted             = true
    delete_on_termination = true
  }

  metadata_options {
    http_endpoint               = "enabled"
    http_tokens                 = "required"
    http_put_response_hop_limit = 1
  }

  tags = {
    Name = "ec2-${local.name_prefix}-backend-${count.index + 1}"
    Role = "alb-backend"
  }
}

resource "aws_lb_target_group_attachment" "backend" {
  count = var.instance_count

  target_group_arn = aws_lb_target_group.backend.arn
  target_id        = aws_instance.backend[count.index].id
  port             = var.backend_port
}
