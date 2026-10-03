# Shared infrastructure this project consumes read-only. The outright.io
# hosted zone is owned by the central terraform repository's state; this
# project only writes the interesting. records + cert-validation records
# into it.

data "aws_caller_identity" "current" {}

data "aws_route53_zone" "outright-io" {
  name         = "${local.zone}."
  private_zone = false
}
