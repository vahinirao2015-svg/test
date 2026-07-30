# Application Load Balancer is the AWS equivalent of Azure Application Gateway:
# Layer-7 HTTP/HTTPS routing with a backend target group (backend pool).

resource "aws_lb" "app" {
  name               = "alb-${local.name_prefix}"
  load_balancer_type = "application"
  internal           = false
  security_groups    = [aws_security_group.alb.id]
  ip_address_type    = "ipv4"

  dynamic "subnet_mapping" {
    for_each = aws_subnet.public
    content {
      subnet_id     = subnet_mapping.value.id
      allocation_id = aws_eip.alb[subnet_mapping.key].id
    }
  }

  enable_deletion_protection = false
  drop_invalid_header_fields = true

  tags = {
    Name = "alb-${local.name_prefix}"
  }
}

resource "aws_lb_target_group" "backend" {
  name     = "tg-${local.name_prefix}-ec2"
  port     = var.backend_port
  protocol = "HTTP"
  vpc_id   = aws_vpc.main.id

  health_check {
    enabled             = true
    path                = var.health_check_path
    protocol            = "HTTP"
    matcher             = "200-399"
    interval            = 30
    timeout             = 5
    healthy_threshold   = 2
    unhealthy_threshold = 3
  }

  deregistration_delay = 30

  tags = {
    Name = "tg-${local.name_prefix}-ec2"
  }
}

resource "aws_lb_listener" "http" {
  load_balancer_arn = aws_lb.app.arn
  port              = 80
  protocol          = "HTTP"

  default_action {
    type             = var.certificate_arn != "" ? "redirect" : "forward"
    target_group_arn = var.certificate_arn != "" ? null : aws_lb_target_group.backend.arn

    dynamic "redirect" {
      for_each = var.certificate_arn != "" ? [1] : []
      content {
        port        = "443"
        protocol    = "HTTPS"
        status_code = "HTTP_301"
      }
    }
  }
}

resource "aws_lb_listener" "https" {
  count = var.certificate_arn != "" ? 1 : 0

  load_balancer_arn = aws_lb.app.arn
  port              = 443
  protocol          = "HTTPS"
  ssl_policy        = "ELBSecurityPolicy-TLS13-1-2-2021-06"
  certificate_arn   = var.certificate_arn

  default_action {
    type             = "forward"
    target_group_arn = aws_lb_target_group.backend.arn
  }
}
