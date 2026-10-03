# CloudFront distribution in front of the S3 website endpoint — mirrored from
# BoardingFlow/infra/modules/website.

resource "aws_cloudfront_distribution" "distribution" {
  enabled             = true
  is_ipv6_enabled     = true
  comment             = length(var.aliases) > 0 ? var.aliases[0] : var.bucket
  default_root_object = var.index_document
  http_version        = "http2"
  price_class         = "PriceClass_100"
  aliases             = var.aliases

  origin {
    # AWS Cloudfront won't properly resolve /index.html files unless the full region is specified here:
    domain_name = "${var.bucket}.s3-website-${var.region}.amazonaws.com"
    origin_id   = "s3-origin"
    origin_path = ""
    custom_origin_config {
      http_port              = 80
      https_port             = 443
      origin_protocol_policy = "http-only"
      origin_ssl_protocols = [
        "TLSv1",
        "TLSv1.1",
        "TLSv1.2"
      ]
    }
  }

  default_cache_behavior {
    allowed_methods = [
      "GET",
      "HEAD",
    ]
    cached_methods = [
      "GET",
      "HEAD"
    ]
    target_origin_id = "s3-origin"

    forwarded_values {
      query_string = false
      cookies {
        forward = "none"
      }
      headers = length(var.cors_allowed_origins) > 0 ? ["Origin", "Access-Control-Request-Method", "Access-Control-Request-Headers"] : []
    }

    viewer_protocol_policy = "redirect-to-https"
    min_ttl                = 0
    default_ttl            = 3600
    max_ttl                = 86400
  }

  restrictions {
    geo_restriction {
      # CloudFront rejects an empty location list, so an empty blacklist means
      # no restriction at all rather than an apply that cannot succeed.
      restriction_type = length(var.blacklist_locations) > 0 ? "blacklist" : "none"
      locations        = var.blacklist_locations
    }
  }

  viewer_certificate {
    acm_certificate_arn      = var.acm_certificate_arn
    ssl_support_method       = "sni-only"
    minimum_protocol_version = "TLSv1.2_2019"
  }
}
