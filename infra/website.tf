# The static site: a dedicated DNS-validated certificate covering the apex and www, the S3 +
# CloudFront website module, and the alias records pointing both hostnames at the distribution.

resource "aws_acm_certificate" "interesting" {
  domain_name = local.domain
  # www is served from the same distribution, so it is a SAN on the same certificate rather than
  # a second certificate. Apex and www get one validation record each, with distinct names — the
  # collision a wildcard SAN would cause in the for_each below cannot happen here.
  subject_alternative_names = [local.www_domain]
  validation_method         = "DNS"

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
  zone_id         = aws_route53_zone.primary.zone_id
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
  aliases             = local.hostnames
  # CloudFront answers a 403/404 from the origin with site/error.html, as a 404 —
  # replacing the site/404.html copy the GitHub Pages deploy used to make.
  error_document = "error.html"
}

# One alias record per hostname per address family: four records, all four pointing at the
# distribution itself rather than at an address, so the apex can be aliased at all.
resource "aws_route53_record" "site" {
  for_each = {
    for pair in setproduct(local.hostnames, ["A", "AAAA"]) :
    "${pair[0]}-${lower(pair[1])}" => { name = pair[0], type = pair[1] }
  }

  name            = each.value.name
  type            = each.value.type
  zone_id         = aws_route53_zone.primary.zone_id
  allow_overwrite = true # upsert-adopt, so a retried partial apply converges

  alias {
    name                   = module.website.domain_name
    zone_id                = module.website.hosted_zone_id
    evaluate_target_health = false
  }
}
