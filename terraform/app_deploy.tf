data "archive_file" "attendance_app" {
  type        = "zip"
  source_dir  = "${path.module}/../app"
  output_path = "${path.module}/.build/attendance-app.zip"
  excludes = [
    ".venv",
    ".venv/**",
    "**/__pycache__",
    "**/__pycache__/**",
    "**/*.pyc",
    ".git",
    ".git/**",
  ]
}

resource "random_id" "app_bucket" {
  byte_length = 4
}

resource "aws_s3_bucket" "app" {
  bucket = "${local.name_prefix}-attendance-app-${random_id.app_bucket.hex}"

  tags = {
    Name = "s3-${local.name_prefix}-attendance-app"
  }
}

resource "aws_s3_bucket_public_access_block" "app" {
  bucket = aws_s3_bucket.app.id

  block_public_acls       = true
  block_public_policy     = true
  ignore_public_acls      = true
  restrict_public_buckets = true
}

resource "aws_s3_bucket_server_side_encryption_configuration" "app" {
  bucket = aws_s3_bucket.app.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_s3_object" "attendance_app" {
  bucket                 = aws_s3_bucket.app.id
  key                    = "attendance-app.zip"
  source                 = data.archive_file.attendance_app.output_path
  etag                   = data.archive_file.attendance_app.output_md5
  server_side_encryption = "AES256"
}

resource "random_password" "app_secret" {
  length  = 32
  special = false
}

resource "aws_iam_role_policy" "ec2_app" {
  name_prefix = "${local.name_prefix}-ec2-app-"
  role        = aws_iam_role.ec2.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Sid      = "ReadAttendanceAppPackage"
        Effect   = "Allow"
        Action   = ["s3:GetObject"]
        Resource = ["${aws_s3_bucket.app.arn}/${aws_s3_object.attendance_app.key}"]
      },
      {
        Sid      = "WriteBootstrapLogs"
        Effect   = "Allow"
        Action   = ["s3:PutObject", "s3:GetObject"]
        Resource = ["${aws_s3_bucket.app.arn}/logs/*"]
      },
      {
        Sid      = "ListBootstrapLogs"
        Effect   = "Allow"
        Action   = ["s3:ListBucket"]
        Resource = [aws_s3_bucket.app.arn]
        Condition = {
          StringLike = {
            "s3:prefix" = ["logs", "logs/*"]
          }
        }
      },
      {
        Sid      = "ReadDbSecret"
        Effect   = "Allow"
        Action   = ["secretsmanager:GetSecretValue"]
        Resource = [aws_secretsmanager_secret.db.arn]
      }
    ]
  })
}
