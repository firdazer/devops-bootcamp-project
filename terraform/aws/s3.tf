resource "aws_s3_bucket" "project_bucket" {
  bucket         = "devops-bootcamp-project-firdazer"
  force_destroy = true

  tags = {
    Name = "devops-bootcamp-project"
  }
}

resource "aws_s3_bucket_versioning" "project_bucket" {
  bucket = aws_s3_bucket.project_bucket.id

  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "project_bucket" {
  bucket = aws_s3_bucket.project_bucket.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}
