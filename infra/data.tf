# Shared infrastructure this project consumes read-only. There is none left in DNS: the
# makeitmoreinteresting.com hosted zone is this project's own resource (dns.tf), where the
# outright.io zone it used to write into was owned by the central Terraform repository's state.
# The AWS account id is read from the caller rather than written down.

data "aws_caller_identity" "current" {}
