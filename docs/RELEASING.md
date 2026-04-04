# Releasing

How to create a new release of recon-web.

## Quick start

```bash
./scripts/version -v 1.0.0
```

This will:
1. Update `version` in all `package.json` files
2. Create a release notes template and open your editor
3. Commit the version bump
4. Create git tag `v1.0.0`
5. Push and create a GitHub release
6. CI builds Docker images tagged `v1.0.0` + `latest`

## Usage

```bash
./scripts/version -v <version> [options]
```

| Option | Short | Description |
|--------|-------|-------------|
| `--version` | `-v` | Version number (required, e.g. `1.0.0`) |
| `--description` | `-d` | Short description for auto-generated release notes |
| `--platform` | `-p` | `github` (default) or `gitlab` |
| `--file` | `-f` | Path to custom release notes markdown file |
| `--help` | `-h` | Show help |

## Examples

```bash
# Basic release
./scripts/version -v 1.0.0

# With description (used in auto-generated template)
./scripts/version -v 1.1.0 -d "Add status filters and error codes"

# Release on GitLab instead of GitHub
./scripts/version -v 1.0.0 -p gitlab

# Use a pre-written release notes file
./scripts/version -v 2.0.0 -f docs/migration-v2.md
```

## Release notes

The script looks for release notes in this order:

1. `--file` flag - uses the provided file directly
2. `.releases/<version>.md` - if you prepared notes in advance
3. `.releases/new.md` - renames it to `<version>.md` automatically
4. Creates a template and opens your editor (VS Code, then `$VISUAL`, then `$EDITOR`, then vim)

To prepare release notes before running the script:

```bash
# Option A: write notes for a specific version
vim .releases/1.2.0.md

# Option B: write notes without knowing the version yet
vim .releases/new.md
# The script will rename it when you run ./scripts/version -v 1.2.0
```

### Release notes format

Release notes live in `.releases/<version>.md`. Use this structure:

```markdown
# v1.2.0

Short summary of what this release is about.

## New Handlers

- **Handler Name** — what it does (API key requirement)

## UI Changes

- **Feature** — description

## Bug Fixes

- **Component** — what was fixed

## Docker images

​```bash
docker pull ghcr.io/brunoafk/recon-web/api:v1.2.0
docker pull ghcr.io/brunoafk/recon-web/web:v1.2.0
docker pull ghcr.io/brunoafk/recon-web/cli:v1.2.0
​```
```

## CI Pipeline

CI runs on every push and pull request. Docker images are only pushed to the registry when you manually create a release.

### On push to main (or PR)

```
push to main
   │
   ▼
lint → test → audit → docker build → trivy scan
                                         │
                                         ▼
                                   Images built and scanned
                                   locally — NOT pushed to registry
```

Everything is validated but nothing is published. If any step fails, you see it immediately.

### On release (you create it manually)

```
You create release on GitHub/GitLab UI
   │
   ▼
lint → test → audit → docker build → trivy scan → PUSH to registry
                                                        │
                                                        ▼
                                                  ghcr.io/brunoafk/recon-web/api:v1.2.0
                                                  ghcr.io/brunoafk/recon-web/web:v1.2.0
                                                  ghcr.io/brunoafk/recon-web/cli:v1.2.0
```

Docker images are pushed **only** when you manually publish a release.

### Safety guarantee

| Stage | What it checks | Runs on |
|-------|---------------|---------|
| Lint | ESLint + TypeScript type checking | Always |
| Test | Vitest across all packages | Always |
| Audit | Trivy filesystem scan (CRITICAL + HIGH) | Always |
| Docker Build | All 3 images (api, web, cli) | Always |
| Trivy Scan | Docker image scan (CRITICAL) | Always |
| **Push** | Images pushed to GHCR | **Release only** |

If **any** stage fails, images are **not** pushed. This prevents broken releases.

### GitHub Actions

Triggers in `.github/workflows/ci.yml`:
- `push` to main/master → quality + docker build/scan (no push)
- `pull_request` → quality + docker build/scan (no push)
- `release: [published]` → quality + docker build/scan + **push to GHCR**

Uses `matrix` strategy to build all 3 images in parallel.

### GitLab CI

Triggers in `.gitlab-ci.yml`:
- Every push → quality + docker build/scan (no push)
- Tag matching `v\d+\.\d+\.\d+` → quality + docker build/scan + **push to registry**

### How to create a release

```bash
# 1. Write release notes (optional but recommended)
vim .releases/1.2.0.md

# 2. Commit everything
git add .
git commit -m "release: v1.2.0"
git push origin main

# 3. Create the release on GitHub UI
#    → Go to Releases → Draft a new release
#    → Tag: v1.2.0, Title: v1.2.0
#    → Paste or upload .releases/1.2.0.md content
#    → Publish release

# CI automatically: test → build → scan → push images
```

Or via CLI:

```bash
gh release create v1.2.0 --title "v1.2.0" --notes-file .releases/1.2.0.md
```

## Manual release (local script)

If you prefer to create releases locally (e.g., you need to edit notes interactively):

```bash
./scripts/version -v 1.2.0
```

This combines everything: version bump, editor, commit, tag, push, and release creation. Requires `gh` (GitHub) or `glab` (GitLab) CLI.

## Pre-flight checks

The local script validates before making any changes:

- Working tree must be clean (no uncommitted changes)
- Tag must not already exist
- Repository must have at least one commit
- Release notes file must not be empty

If any check fails, the script exits with a clear error message and no changes are made.

## What happens after release

When you publish a release, CI runs the full pipeline and pushes Docker images:

```bash
docker pull ghcr.io/brunoafk/recon-web/api:v1.0.0
docker pull ghcr.io/brunoafk/recon-web/web:v1.0.0
docker pull ghcr.io/brunoafk/recon-web/cli:v1.0.0
```

Each image is tagged with both the version tag and `:latest`.

Pushes to `main` without a release run lint, tests, audit, and docker build+scan — but images are **not** pushed to the registry.

## Re-releasing a version

If you need to redo a release:

```bash
# Delete the tag locally and remotely
git tag -d v1.0.0
git push origin :refs/tags/v1.0.0

# Delete the GitHub/GitLab release manually, then re-run
./scripts/version -v 1.0.0
```

## Version numbering

The project follows [Semantic Versioning](https://semver.org/):

| Bump | When | Example |
|------|------|---------|
| **Patch** (0.9.0 → 0.9.1) | Bug fixes, test fixes, CI changes | Fix failing tests |
| **Minor** (0.9.0 → 0.10.0) | New handlers, UI features, non-breaking changes | Add SEO handler |
| **Major** (0.9.0 → 1.0.0) | Breaking API changes, database migrations | API v2 |

## Requirements

| Tool | Required for | Install |
|------|-------------|---------|
| `git` | Always | - |
| `npm` | Version bump (local script) | Comes with Node.js |
| `gh` | Creating releases from CLI (optional — can use GitHub UI) | https://cli.github.com |
| `glab` | Creating releases from CLI (optional — can use GitLab UI) | https://gitlab.com/gitlab-org/cli |
| `code` / `vim` | Editing release notes locally | - |

## Checklist

Before releasing:

- [ ] All tests pass locally (`npm test`)
- [ ] Typecheck passes (`npm run typecheck`)
- [ ] Build succeeds (`npm run build`)
- [ ] Release notes written in `.releases/<version>.md`
- [ ] Version number follows semver
- [ ] No uncommitted changes
