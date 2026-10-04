# The hosted zone for makeitmoreinteresting.com, owned here.
#
# interesting.outright.io lived in a zone this project only read: outright.io is a studio-wide
# zone with many properties in it, owned by the central Terraform state, and this project wrote
# one subdomain's records into it. makeitmoreinteresting.com is an apex domain with nothing in it
# but this site, so the zone belongs to the same project as the rest of the stack.
#
# The zone has to exist, and the registrar has to be pointing the domain's nameservers at it,
# before anything else here can be applied: ACM validates the certificate by resolving a record in
# this zone over public DNS, so an undelegated zone makes `aws_acm_certificate_validation` wait
# until it times out. `terraform output route53_name_servers` prints the four to give the
# registrar; see the cutover order in README.md.
resource "aws_route53_zone" "primary" {
  name    = local.domain
  comment = "makeitmoreinteresting.com — owned by outrightmental/interesting (infra/dns.tf)"
}
