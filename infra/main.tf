# interesting — infrastructure
#
# Self-contained Terraform project for https://interesting.outright.io/, built
# the same way BoardingFlow's /infra folder is (which follows FishCareers',
# which follows outrightmental.com's): one project that owns the whole stack
# for one property.
#
# This project owns:
#
#   - The GitHub repository itself (repo.tf) — outrightmental/interesting is a
#     Terraform-managed resource, so the repo's settings can never drift.
#     (The repo pre-existed this configuration; repo.tf adopts it via an
#     import block on the first apply.)
#   - The static website: interesting.outright.io S3 bucket + CloudFront
#     distribution (modules/website, copied from BoardingFlow/infra).
#   - The ACM certificate for interesting.outright.io, DNS-validated in the
#     outright.io hosted zone (which stays owned by the shared infra state and
#     is consumed read-only via data.tf).
#   - The A/AAAA alias records pointing the subdomain at the distribution.
#   - A dedicated deploy IAM user and the GitHub Actions secrets the deploy
#     workflow reads, managed here so the deploy credentials can never drift
#     from the infrastructure.

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.66"
    }
    github = {
      source  = "integrations/github"
      version = "~> 6.2"
    }
  }

  backend "s3" {
    bucket = "outrightmental-terraform-state"
    key    = "interesting.outright.io"
    region = "us-east-1"
  }
}

provider "aws" {
  region = "us-east-1"
}

provider "github" {
  owner = "outrightmental"
}
