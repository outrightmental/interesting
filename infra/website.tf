# The static site: a dedicated DNS-validated certificate, the S3 + CloudFront
# website module, and the alias records pointing the subdomain at the
# distribution.

resource "aws_acm_certificate" "interesting" {
  domain_name       = local.domain
  validation_method = "DNS"

  lifecycle {
    create_before_destroy = true
  }
}

resource "aws_route53_record" "cert_validation" {
  for_each = {
    for dvo in aws_acm_certificate.interesting.domain_validation_options : dvo.domain_name => {
      name   = dvo.resource_record_name
      record = dvo.resource_record_value
      type   = dvo.resource_record_type
    }
  }

  allow_overwrite = true
  name            = each.value.name
  records         = [each.value.record]
  ttl             = 60
  type            = each.value.type
  zone_id         = data.aws_route53_zone.outright-io.zone_id
}

resource "aws_acm_certificate_validation" "interesting" {
  certificate_arn         = aws_acm_certificate.interesting.arn
  validation_record_fqdns = [for record in aws_route53_record.cert_validation : record.fqdn]
}

module "website" {
  source              = "./modules/website"
  bucket              = local.bucket
  region              = local.aws_region
  acm_certificate_arn = aws_acm_certificate_validation.interesting.certificate_arn
  aliases             = [local.domain]
  # CloudFront answers a 403/404 from the origin with site/error.html, as a 404 —
  # replacing the site/404.html copy the GitHub Pages deploy used to make.
  error_document = "error.html"
}

resource "aws_route53_record" "interesting-a" {
  name            = local.domain
  type            = "A"
  zone_id         = data.aws_route53_zone.outright-io.zone_id
  allow_overwrite = true # upsert-adopt, so a retried partial apply converges

  alias {
    name                   = module.website.domain_name
    zone_id                = module.website.hosted_zone_id
    evaluate_target_health = false
  }
}

resource "aws_route53_record" "interesting-aaaa" {
  name            = local.domain
  type            = "AAAA"
  zone_id         = data.aws_route53_zone.outright-io.zone_id
  allow_overwrite = true # upsert-adopt, so a retried partial apply converges

  alias {
    name                   = module.website.domain_name
    zone_id                = module.website.hosted_zone_id
    evaluate_target_health = false
  }
}
