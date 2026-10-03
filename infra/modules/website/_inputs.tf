variable "region" {
  type = string
}

variable "bucket" {
  type = string
}

variable "index_document" {
  type    = string
  default = "index.html"
}

variable "error_document" {
  type    = string
  default = "error.html"
}

variable "aliases" {
  type = list(string)
}

variable "acm_certificate_arn" {
  type = string
}

variable "blacklist_locations" {
  type = list(string)
  default = [
    "CN",
  ]
}

variable "cors_allowed_origins" {
  type    = list(string)
  default = []
}
