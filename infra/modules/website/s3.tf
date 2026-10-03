# Static website bucket — public-read, website-configured, mirrored from
# BoardingFlow/infra/modules/website (itself copied from FishCareers, which
# follows outrightmental.com).
#
# The website configuration is what serves the error document: a request for a
# key that is not in the bucket gets `error_document` back with a 404, which
# CloudFront passes on to the visitor. No separate 404.html copy is needed.

resource "aws_s3_bucket" "website_bucket" {
  bucket = var.bucket
}

resource "aws_s3_bucket_website_configuration" "public_bucket_website_configuration" {
  bucket = aws_s3_bucket.website_bucket.bucket
  index_document {
    suffix = var.index_document
  }
  error_document {
    key = var.error_document
  }
}

resource "aws_s3_bucket_cors_configuration" "website_cors" {
  count  = length(var.cors_allowed_origins) > 0 ? 1 : 0
  bucket = aws_s3_bucket.website_bucket.bucket

  cors_rule {
    allowed_headers = ["*"]
    allowed_methods = ["GET", "HEAD"]
    allowed_origins = var.cors_allowed_origins
    expose_headers  = ["ETag", "Content-Length", "Content-Type"]
    max_age_seconds = 3600
  }
}

resource "aws_s3_bucket_acl" "public_bucket_acl" {
  bucket = aws_s3_bucket.website_bucket.bucket
  acl    = "public-read"
  depends_on = [
    aws_s3_bucket_ownership_controls.website_ownership_controls,
    aws_s3_bucket_public_access_block.website_public_access_block,
  ]
}

resource "aws_s3_bucket_ownership_controls" "website_ownership_controls" {
  bucket = aws_s3_bucket.website_bucket.bucket
  rule {
    object_ownership = "BucketOwnerPreferred"
  }
}

resource "aws_s3_bucket_public_access_block" "website_public_access_block" {
  bucket = aws_s3_bucket.website_bucket.bucket

  block_public_acls       = false
  block_public_policy     = false
  ignore_public_acls      = false
  restrict_public_buckets = false
}

resource "aws_s3_bucket_policy" "public_bucket_policy" {
  bucket = aws_s3_bucket.website_bucket.bucket
  policy = data.aws_iam_policy_document.public_bucket_policy_document.json
  depends_on = [
    aws_s3_bucket_ownership_controls.website_ownership_controls,
    aws_s3_bucket_public_access_block.website_public_access_block,
  ]
}

data "aws_iam_policy_document" "public_bucket_policy_document" {
  version   = "2008-10-17"
  policy_id = "${var.bucket}-policy"
  statement {
    sid    = "PublicReadGetObject"
    effect = "Allow"
    principals {
      identifiers = ["*"]
      type        = "*"
    }
    actions = [
      "s3:GetObject",
    ]
    resources = [
      "arn:aws:s3:::${var.bucket}",
      "arn:aws:s3:::${var.bucket}/*",
    ]
  }
}
