# The labels the issue forms in .github/ISSUE_TEMPLATE/ ask for, owned here like the rest of the
# repository (repo.tf) so they exist wherever that configuration is applied rather than depending
# on someone having created them by hand.
#
# A form naming a label the repository does not have is not an error -- GitHub simply files the
# issue without it -- so the forms work before this is ever applied, and the labels start sticking
# once it has been. The repository's own default labels (bug, enhancement and their siblings) are
# not managed here: they were never asked for by anything in this repository.

resource "github_issue_label" "steer" {
  repository  = github_repository.interesting.name
  name        = "steer"
  color       = "8DB8FF"
  description = "A visitor said what this site should do, be, or become next"
}

resource "github_issue_label" "broken" {
  repository  = github_repository.interesting.name
  name        = "broken"
  color       = "FFE7AB"
  description = "Something on the site does not work"
}
