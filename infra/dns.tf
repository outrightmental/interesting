# The hosted zone for makeitmoreinteresting.com, owned here.
#
# interesting.outright.io lived in a zone this project only read: outright.io is a studio-wide
# zone with many properties in it, owned by the central Terraform state, and this project wrote
# one subdomain's records into it. makeitmoreinteresting.com is an apex domain with nothing in it
# but this site, so the zone belongs to the same project as the rest of the stack.
#
# The zone has to exist, and the registration has to be pointing the domain's nameservers at it,
# before anything else here can be applied: ACM validates the certificate by resolving a record in
# this zone over public DNS, so an undelegated zone makes `aws_acm_certificate_validation` wait
# until it times out. The pointing is the registered domain below; see the cutover order in
# README.md.
resource "aws_route53_zone" "primary" {
  name    = local.domain
  comment = "makeitmoreinteresting.com — owned by outrightmental/interesting (infra/dns.tf)"
}

# The registration's half of the delegation. makeitmoreinteresting.com is registered with Amazon
# Registrar in this same account, so the nameservers it gives the .com registry are set here, from
# the zone above, rather than copied across by hand.
#
# Registering a domain with Route 53 also creates a hosted zone of its own and points the
# registration at that one. Left that way, every record in this project lands in a zone public DNS
# never asks, and no plan shows it, because nothing here held the registration's nameservers.
# Owning them turns that drift into a diff.
#
# This adopts the registration rather than registering anything, and a destroy only drops it from
# state. Its privacy, auto-renew and transfer-lock arguments all default to on, and adopting
# enforces whatever they say: privacy and auto-renew are on already, and transfer_lock is set to
# match the registration as it stands, so adopting it changes the nameservers and nothing else.
resource "aws_route53domains_registered_domain" "primary" {
  domain_name   = local.domain
  transfer_lock = false

  dynamic "name_server" {
    for_each = aws_route53_zone.primary.name_servers
    content {
      name = name_server.value
    }
  }
}

# Mail -------------------------------------------------------------------------------------------
# webmaster@ and support@makeitmoreinteresting.com forward to charneykaye@gmail.com (issue #107).
# The forwarding is Mailbot's (https://github.com/outrightmental/mailbot): its routing table,
# src/forwarder/config.json, lists the two addresses in its existing Operations and Support
# mailboxes, and its Terraform derives the SES receipt rule for this domain from that table. What
# lives here is the domain's half, kept with the zone it is published in: the SES identity that
# lets SES receive for the domain at all, the records Mailbot publishes for the domains it manages
# (DKIM and a custom MAIL FROM), and the MX that sends the domain's mail to SES. This is the one
# state that writes the domain's MX, so Mailbot's own switchboard (`mx_enabled_domains`) must never
# list it. See "Mail" in README.md for the order of the two applies.
#
# Only the two routed addresses are delivered. Mail to any other address on the domain matches no
# receipt rule in the account, and SES rejects it with a clean "address does not exist" bounce.

# Verifying the domain is what lets SES receive for it: mail to an unverified domain is refused.
# It also authorizes sending From any address on it, which the forwarder only does with Mailbot's
# relay switched off.
resource "aws_ses_domain_identity" "primary" {
  domain = local.domain
}

resource "aws_route53_record" "ses_verification" {
  zone_id = aws_route53_zone.primary.zone_id
  name    = "_amazonses.${local.domain}"
  type    = "TXT"
  ttl     = 600
  records = [aws_ses_domain_identity.primary.verification_token]
}

# Holds the apply until SES has resolved the record above, the way the certificate's validation
# does in website.tf, so an apply that succeeds has left a domain SES will receive for rather than
# one still pending.
resource "aws_ses_domain_identity_verification" "primary" {
  domain     = aws_ses_domain_identity.primary.domain
  depends_on = [aws_route53_record.ses_verification]
}

# Easy DKIM: three CNAMEs, so mail SES sends as the domain is signed by it.
resource "aws_ses_domain_dkim" "primary" {
  domain = aws_ses_domain_identity.primary.domain
}

resource "aws_route53_record" "ses_dkim" {
  count   = 3
  zone_id = aws_route53_zone.primary.zone_id
  name    = "${aws_ses_domain_dkim.primary.dkim_tokens[count.index]}._domainkey.${local.domain}"
  type    = "CNAME"
  ttl     = 600
  records = ["${aws_ses_domain_dkim.primary.dkim_tokens[count.index]}.dkim.amazonses.com"]
}

# A custom MAIL FROM, so SPF passes under the domain's own name. It is scoped to mail.<domain> and
# never touches the apex, where the site's alias records and the MX below live.
resource "aws_ses_domain_mail_from" "primary" {
  domain           = aws_ses_domain_identity.primary.domain
  mail_from_domain = "mail.${local.domain}"
}

resource "aws_route53_record" "ses_mail_from_mx" {
  zone_id = aws_route53_zone.primary.zone_id
  name    = aws_ses_domain_mail_from.primary.mail_from_domain
  type    = "MX"
  ttl     = 600
  records = ["10 feedback-smtp.${local.aws_region}.amazonses.com"]
}

resource "aws_route53_record" "ses_mail_from_spf" {
  zone_id = aws_route53_zone.primary.zone_id
  name    = aws_ses_domain_mail_from.primary.mail_from_domain
  type    = "TXT"
  ttl     = 600
  records = ["v=spf1 include:amazonses.com ~all"]
}

# The domain's inbound MX: SES receiving, in the region where the account's receipt rule set and
# Mailbot's rules live. The value and TTL are the ones Mailbot's switchboard gives every domain it
# serves.
resource "aws_route53_record" "mx" {
  zone_id = aws_route53_zone.primary.zone_id
  name    = local.domain
  type    = "MX"
  ttl     = 300
  records = ["10 inbound-smtp.${local.aws_region}.amazonaws.com"]
}
