resource "random_password" "db" {
  length           = 24
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

resource "aws_security_group" "db" {
  name_prefix = "${local.name_prefix}-db-"
  description = "RDS PostgreSQL access from attendance EC2 backends only"
  vpc_id      = aws_vpc.main.id

  ingress {
    description     = "PostgreSQL from EC2 backends"
    from_port       = 5432
    to_port         = 5432
    protocol        = "tcp"
    security_groups = [aws_security_group.ec2.id]
  }

  egress {
    description = "Allow all outbound"
    from_port   = 0
    to_port     = 0
    protocol    = "-1"
    cidr_blocks = ["0.0.0.0/0"]
  }

  tags = {
    Name = "sg-${local.name_prefix}-db"
  }

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_db_subnet_group" "attendance" {
  name       = "${local.name_prefix}-attendance"
  subnet_ids = aws_subnet.private[*].id

  tags = {
    Name = "dbsubnet-${local.name_prefix}-attendance"
  }
}

# Use RDS PostgreSQL (not Aurora). Free-plan AWS accounts reject standard
# Aurora CreateDBCluster unless WithExpressConfiguration is used, and Express
# clusters are outside the VPC so private EC2 backends cannot use them.
resource "aws_db_instance" "attendance" {
  identifier = "${local.name_prefix}-attendance"

  engine                = "postgres"
  engine_version        = var.db_engine_version != "" ? var.db_engine_version : null
  instance_class        = var.db_instance_class
  allocated_storage     = var.db_allocated_storage
  max_allocated_storage = var.db_max_allocated_storage
  storage_type          = "gp3"
  storage_encrypted     = true

  db_name  = var.db_name
  username = var.db_username
  password = random_password.db.result

  db_subnet_group_name   = aws_db_subnet_group.attendance.name
  vpc_security_group_ids = [aws_security_group.db.id]
  publicly_accessible    = false
  multi_az               = false
  availability_zone      = local.azs[0]

  backup_retention_period = 1
  deletion_protection     = false
  skip_final_snapshot     = true
  apply_immediately       = true

  # Avoid long-lived automated upgrades delaying destroy/replace in labs.
  auto_minor_version_upgrade = true

  tags = {
    Name = "rds-${local.name_prefix}-attendance"
  }
}

resource "aws_secretsmanager_secret" "db" {
  name_prefix             = "${local.name_prefix}-attendance-db-"
  description             = "Attendance RDS PostgreSQL credentials"
  recovery_window_in_days = 0

  tags = {
    Name = "secret-${local.name_prefix}-attendance-db"
  }
}

resource "aws_secretsmanager_secret_version" "db" {
  secret_id = aws_secretsmanager_secret.db.id
  secret_string = jsonencode({
    username = var.db_username
    password = random_password.db.result
    host     = aws_db_instance.attendance.address
    port     = aws_db_instance.attendance.port
    dbname   = var.db_name
    engine   = "postgres"
  })
}
