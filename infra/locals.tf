locals {
  aws_region = "us-east-1"

  # The property's own apex domain. interesting.outright.io was a subdomain of a studio-wide zone
  # owned by the central Terraform state; makeitmoreinteresting.com belongs to this property alone,
  # so this project creates and owns its hosted zone too (dns.tf).
  domain     = "makeitmoreinteresting.com"
  www_domain = "www.makeitmoreinteresting.com"
  bucket     = "makeitmoreinteresting.com"

  # Every hostname the distribution answers to: the apex and www, both serving the same site from
  # the same distribution, so a visitor who types either one lands on it.
  hostnames = [local.domain, local.www_domain]

  github_repo = "interesting"

  # The GA4 property the site reports to. Not a credential — it is readable in every page the
  # deploy publishes — but it is delivered as an Actions secret all the same, so that the one copy
  # of it lives here with the rest of the property and never in the repository's own files.
  # The property outlived the domain change: GA4 measures a stream, not a hostname, so the move to
  # makeitmoreinteresting.com keeps the same measurement ID and only needs the stream's URL updated
  # by hand in the GA4 console.
  ga_measurement_id = "G-P7PXJQT2Z4"
}
