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
