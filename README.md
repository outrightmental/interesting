[![Deploy site to GitHub Pages](https://github.com/outrightmental/interesting/actions/workflows/pages.yml/badge.svg)](https://github.com/outrightmental/interesting/actions/workflows/pages.yml)
[![Make the website more interesting](https://github.com/outrightmental/interesting/actions/workflows/make-interesting.yml/badge.svg)](https://github.com/outrightmental/interesting/actions/workflows/make-interesting.yml)
[![pages-build-deployment](https://github.com/outrightmental/interesting/actions/workflows/pages/pages-build-deployment/badge.svg)](https://github.com/outrightmental/interesting/actions/workflows/pages/pages-build-deployment)
[![Test](https://github.com/outrightmental/interesting/actions/workflows/test.yml/badge.svg)](https://github.com/outrightmental/interesting/actions/workflows/test.yml)

# interesting
recursively iterate the most interesting possible website

## How it works

- **`/site`** — the static website, published to GitHub Pages by
  [`.github/workflows/pages.yml`](.github/workflows/pages.yml). `error.html` is also served as the
  Pages `404.html`.
- **Daily AI iteration** — [`.github/workflows/make-interesting.yml`](.github/workflows/make-interesting.yml)
  runs on a daily cron (or manually via *Run workflow*). It picks a random model from
  [GitHub Copilot](https://docs.github.com/copilot), reached through the
  [Copilot CLI](https://docs.github.com/copilot/how-tos/copilot-cli) and billed to a GitHub Copilot
  subscription (see [Setup](#setup)), gives it the mission **"make the website more interesting"**,
  commits the result and redeploys the site. If a model is unavailable or returns an unusable
  answer, up to two other random models are tried.
- **Only flagship models** — the random pick draws from a list of large, top-tier models (see
  [Which models](#which-models)); small and mid-tier models are never picked.

### Silo

The AI can only ever modify `/site`:

1. The model has no tools or shell: the Copilot CLI runs in an empty directory with every tool
   disabled, so the model only returns JSON describing files to write/delete. If the model ever
   manages to use a tool, the run stops and nothing is applied.
2. [`.github/scripts/make_interesting.py`](.github/scripts/make_interesting.py) rejects any path
   that is absolute, contains `..`/hidden segments or anything but lowercase letters, digits, `.`,
   `_` and `-`, resolves outside `/site` (including via symlinks) or has a non-static file type.
   It never deletes `index.html`/`error.html`, never touches a file the model was not shown, and
   applies an answer whole or not at all.
3. The workflow fails if anything outside `/site` changed, and only stages `site/` for commit.
   The model's one-line summary is stripped to plain text before it reaches the commit message.

### Which models

The random pick only ever draws from large, flagship models: the top tier of each provider that
Copilot offers, listed as `MODELS` in
[`.github/scripts/make_interesting.py`](.github/scripts/make_interesting.py).

- **Small models are never picked at random.** Besides not being on the list, any model whose id
  contains a small or mid-tier name is refused: `haiku` and `sonnet`, and their equivalents at
  other providers such as `mini`, `nano`, `luna`, `terra`, `flash`, `lite`, `fast`, `small`,
  `medium`, `micro` and `phi` (the full set is `SMALL_MODEL_MARKERS`).
- **Changing the pool** needs no code change: set the repository variable `MODEL_POOL` to a
  comma-separated list of Copilot model ids. Small models in that list are still refused.
- **Naming a model yourself**, through the *Run workflow* form, is not a random pick: the model is
  used as asked, with a warning in the log if it is a small one.
- Models that Copilot has retired or that the account cannot use are skipped automatically.

### Setup

- *Settings → Pages → Source*: **GitHub Actions**.
- Actions must be allowed to push to the default branch (the daily commit uses `GITHUB_TOKEN`).
- GitHub Copilot must accept the workflow's requests. Either of these works:
  - **Personal plan:** add a repository secret named `COPILOT_GITHUB_TOKEN` holding a fine-grained
    personal access token with the account permission **Copilot Requests**. Usage is billed to that
    user's Copilot plan.
  - **Organization:** in the organization's *Settings → Copilot → Policies*, enable **Copilot CLI**
    and **Allow use of Copilot CLI billed to the organization**. No secret is needed: the workflow's
    own token is accepted through its `copilot-requests: write` permission, and usage is billed to
    the organization.

### Development

[`.github/scripts/test_make_interesting.py`](.github/scripts/test_make_interesting.py) tests the
script without calling any model, and runs on every pull request:

```bash
python3 -m unittest discover -s .github/scripts -v
```

To try a real run without touching the repository's site, point the script at a copy (this needs a
logged-in `copilot` CLI):

```bash
cp -R site /tmp/site-copy && SITE_DIR=/tmp/site-copy python3 .github/scripts/make_interesting.py
```
