# Dedicated deploy credentials for the GitHub Actions workflow (S3 sync +
# CloudFront invalidation), scoped to exactly this bucket and this
# distribution. A single apply rotates them end to end (see github.tf).

resource "aws_iam_user" "deploy" {
  name = "interesting-outright-io-deploy"
}

resource "aws_iam_access_key" "deploy" {
  user = aws_iam_user.deploy.name
}

resource "aws_iam_user_policy" "deploy" {
  name = "interesting-outright-io-deploy"
  user = aws_iam_user.deploy.name

  policy = jsonencode({
    "Version" : "2012-10-17",
    "Statement" : [
      {
        Sid    = "ListBucket",
        Effect = "Allow",
        Action = [
          "s3:ListBucket",
          "s3:GetBucketLocation",
        ],
        Resource = [
          module.website.arn,
        ]
      },
      {
        Sid    = "ModifyObjects",
        Effect = "Allow",
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:DeleteObject",
          "s3:PutObjectAcl",
          "s3:GetObjectAcl",
        ],
        Resource = [
          "${module.website.arn}/*",
        ]
      },
      {
        Sid    = "CreateInvalidations",
        Effect = "Allow",
        Action = [
          "cloudfront:CreateInvalidation",
        ],
        Resource = [
          "arn:aws:cloudfront::${data.aws_caller_identity.current.account_id}:distribution/${module.website.cdn_id}",
        ]
      }
    ]
  })
}
