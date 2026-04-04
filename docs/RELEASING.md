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

## Pre-flight checks

The script validates before making any changes:

- Working tree must be clean (no uncommitted changes)
- Tag must not already exist
- Repository must have at least one commit
- Release notes file must not be empty

If any check fails, the script exits with a clear error message and no changes are made.

## What happens after release

When the version tag is pushed, CI runs the full pipeline:

```
v* tag push -> lint + test + audit -> docker build -> trivy scan -> push
```

Docker images are tagged with both the version and `latest`:

```bash
docker pull ghcr.io/brunoafk/recon-web/api:v1.0.0
docker pull ghcr.io/brunoafk/recon-web/web:v1.0.0
docker pull ghcr.io/brunoafk/recon-web/cli:v1.0.0
```

Pushes to `main` without a tag only run lint, tests, and dependency audit. No Docker images are built or pushed.

## Re-releasing a version

If you need to redo a release:

```bash
# Delete the tag locally and remotely
git tag -d v1.0.0
git push origin :refs/tags/v1.0.0

# Delete the GitHub/GitLab release manually, then re-run
./scripts/version -v 1.0.0
```

## Requirements

| Tool | Required for | Install |
|------|-------------|---------|
| `git` | Always | - |
| `npm` | Version bump | Comes with Node.js |
| `gh` | GitHub releases | https://cli.github.com |
| `glab` | GitLab releases | https://gitlab.com/gitlab-org/cli |
| `code` / `vim` | Editing release notes | - |
