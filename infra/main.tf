# interesting — infrastructure
#
# Self-contained Terraform project for https://makeitmoreinteresting.com/,
# built the same way BoardingFlow's /infra folder is (which follows
# FishCareers', which follows outrightmental.com's): one project that owns the
# whole stack for one property.
#
# This project owns:
#
#   - The GitHub repository itself (repo.tf) — outrightmental/interesting is a
#     Terraform-managed resource, so the repo's settings can never drift.
#     (The repo pre-existed this configuration; repo.tf adopts it via an
#     import block on the first apply.)
#   - The makeitmoreinteresting.com hosted zone (dns.tf). The site used to live
#     at interesting.outright.io, a subdomain of a studio-wide zone this
#     project could only read; its own apex domain belongs to the same project
#     as the rest of its stack.
#   - The static website: makeitmoreinteresting.com S3 bucket + CloudFront
#     distribution (modules/website, copied from BoardingFlow/infra).
#   - The ACM certificate for makeitmoreinteresting.com and
#     www.makeitmoreinteresting.com, DNS-validated in that same hosted zone.
#   - The A/AAAA alias records pointing both hostnames at the distribution.
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
    # Renamed with the domain; `terraform init -migrate-state` copies the state
    # the old key held (see the cutover order in README.md).
    key    = "makeitmoreinteresting.com"
    region = "us-east-1"
  }
}

provider "aws" {
  region = "us-east-1"
}

provider "github" {
  owner = "outrightmental"
}
