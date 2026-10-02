# interesting
recursively iterate the most interesting possible website

## How it works

- **`/site`** — the static website, published to GitHub Pages by
  [`.github/workflows/pages.yml`](.github/workflows/pages.yml). `error.html` is also served as the
  Pages `404.html`.
- **Daily AI iteration** — [`.github/workflows/make-interesting.yml`](.github/workflows/make-interesting.yml)
  runs on a daily cron (or manually via *Run workflow*). It picks a random model from
  [GitHub Models](https://docs.github.com/github-models) (billed to this account's GitHub AI
  subscription via the workflow's `models: read` token), gives it the mission
  **"make the website more interesting"**, commits the result and redeploys the site.

### Silo

The AI can only ever modify `/site`:

1. The model has no tools or shell; it only returns JSON describing files to write/delete.
2. [`.github/scripts/make_interesting.py`](.github/scripts/make_interesting.py) rejects any path
   that is absolute, contains `..`/hidden segments, resolves outside `/site` (including via
   symlinks) or has a non-static file type, and never deletes `index.html`/`error.html`.
3. The workflow fails if anything outside `/site` changed, and only stages `site/` for commit.

### Setup

- *Settings → Pages → Source*: **GitHub Actions**.
- Actions must be allowed to push to the default branch (the daily commit uses `GITHUB_TOKEN`).
- GitHub Models must be enabled for the account/organization.
