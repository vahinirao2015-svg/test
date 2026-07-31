resource "random_password" "db" {
  length           = 24
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

resource "aws_security_group" "db" {
  name_prefix = "${local.name_prefix}-db-"
  description = "Aurora PostgreSQL access from attendance EC2 backends only"
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

resource "aws_rds_cluster" "attendance" {
  cluster_identifier = "${local.name_prefix}-attendance"
  engine             = "aurora-postgresql"
  engine_mode        = "provisioned"
  engine_version     = var.db_engine_version != "" ? var.db_engine_version : null
  database_name      = var.db_name
  master_username    = var.db_username
  master_password    = random_password.db.result

  db_subnet_group_name   = aws_db_subnet_group.attendance.name
  vpc_security_group_ids = [aws_security_group.db.id]

  storage_encrypted   = true
  deletion_protection = false
  skip_final_snapshot = true
  apply_immediately   = true

  serverlessv2_scaling_configuration {
    min_capacity = var.db_min_capacity
    max_capacity = var.db_max_capacity
  }

  tags = {
    Name = "aurora-${local.name_prefix}-attendance"
  }
}

resource "aws_rds_cluster_instance" "attendance" {
  identifier         = "${local.name_prefix}-attendance-1"
  cluster_identifier = aws_rds_cluster.attendance.id
  instance_class     = "db.serverless"
  engine             = aws_rds_cluster.attendance.engine
  engine_version     = aws_rds_cluster.attendance.engine_version

  publicly_accessible = false

  tags = {
    Name = "aurora-instance-${local.name_prefix}-attendance-1"
  }
}

resource "aws_secretsmanager_secret" "db" {
  name_prefix             = "${local.name_prefix}-attendance-db-"
  description             = "Attendance Aurora PostgreSQL credentials"
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
    host     = aws_rds_cluster.attendance.endpoint
    port     = 5432
    dbname   = var.db_name
    engine   = "postgres"
  })
}
