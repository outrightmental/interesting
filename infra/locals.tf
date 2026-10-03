locals {
  aws_region = "us-east-1"

  domain = "interesting.outright.io"
  bucket = "interesting.outright.io"
  zone   = "outright.io"

  github_repo = "interesting"

  # The GA4 property the site reports to. Not a credential — it is readable in every page the
  # deploy publishes — but it is delivered as an Actions secret all the same, so that the one copy
  # of it lives here with the rest of the property and never in the repository's own files.
  ga_measurement_id = "G-P7PXJQT2Z4"
}
