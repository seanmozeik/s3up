# s3up

Upload files to S3-compatible storage. Supports AWS S3, Cloudflare R2, DigitalOcean Spaces, Backblaze B2, and custom endpoints.

## Features

**Simple uploads** — Upload files with a single command. URLs copied to clipboard automatically.

**Directory archiving** — Point at a directory, get a `.tar.gz` uploaded. Uses Bun's native Archive API.

**Multipart uploads** — Files over 100MB are automatically uploaded in parallel chunks with resume support.

**Lifecycle management** — List and prune old backups with `list` and `prune` commands.

**Automation-ready** — Quiet mode (`--quiet`) and CI mode (`--ci`) for scripts and cron jobs.

**Multiple providers** — AWS S3, Cloudflare R2, DigitalOcean Spaces, Backblaze B2, or any S3-compatible endpoint.

**Fast** — Bun. Standalone binary. Native S3 client.

```bash
s3up image.png
s3up ./workspace --prefix backups/daily
s3up list backups/
s3up prune backups/ --keep-last 7
```

## Install

**Homebrew**

```bash
brew install seanmozeik/tap/s3up
```

**From source** (requires [Bun](https://bun.sh))

```bash
git clone https://github.com/mozeik/s3up.git
cd s3up
bun install
bun run build
```

Produces a standalone binary. Move it to your PATH:

```bash
mv s3up ~/.local/bin/
```

## Setup

Run `s3up setup` to configure credentials interactively:

```bash
s3up setup
```

Select your provider and enter credentials. Stored securely in system keychain.

**Environment variable** — For containers/CI, set `S3UP_CONFIG` as JSON:

```bash
export S3UP_CONFIG='{
  "provider": "r2",
  "accessKeyId": "...",
  "secretAccessKey": "...",
  "bucket": "my-bucket",
  "publicUrlBase": "https://cdn.example.com",
  "accountId": "..."
}'
```

## Usage

### Upload

```bash
# Single file
s3up image.png

# Multiple files
s3up *.png

# Directory (auto-tarballed)
s3up ./workspace

# With prefix
s3up backup.sql --prefix db/2026-01-31

# Multiple directories into one tarball
s3up ./workspace ./config --prefix backups

# Custom tarball name
s3up ./workspace --as full-backup.tar.gz
```

**Upload options:**

```
--prefix <path>       Prepend path to uploaded keys
--as <name>           Override tarball filename for directories
--compression <1-12>  Gzip compression level (default: 6)
-f, --fast            Fast network preset (5MB chunks, 16 connections)
-s, --slow            Slow network preset (50MB chunks, 4 connections)
```

### List

```bash
# List all objects
s3up list

# List with prefix
s3up list backups/workspace/

# JSON output
s3up list backups/ --json
```

### Prune

```bash
# Keep last 7 backups
s3up prune backups/workspace/ --keep-last 7

# Delete objects older than 30 days
s3up prune backups/ --older-than 30

# Preview what would be deleted
s3up prune backups/ --keep-last 7 --dry-run
```

**Prune options:**

```
--older-than <days>   Delete objects older than N days
--keep-last <n>       Keep only N most recent objects
--min-age <duration>  Minimum age before deletion (default: 1d)
--dry-run             Show what would be deleted
```

**Safety:** Objects younger than `--min-age` (default 1 day) are never deleted, even if they match other criteria.

### Global Options

```
-q, --quiet    Minimal output for scripting
--ci           Non-interactive mode (fails if prompt required)
-h, --help     Show help
-v, --version  Show version
```

## Automation

Example backup cron script:

```bash
#!/bin/bash
set -e

DATE=$(date +%Y-%m-%d)

# Upload workspace directory
s3up ./workspace --prefix "backups/workspace/${DATE}" --ci -q

# Prune old backups (keep last 14)
s3up prune "backups/workspace/" --keep-last 14 --ci -q

echo "Backup complete: ${DATE}"
```

## Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | General error |
| 2 | Configuration error |
| 3 | Interactive prompt required in --ci mode |
| 4 | Partial failure (some files failed) |

## Providers

| Provider | Configuration |
|----------|---------------|
| AWS S3 | `provider: "aws"`, `region` required |
| Cloudflare R2 | `provider: "r2"`, `accountId` required |
| DigitalOcean Spaces | `provider: "digitalocean"`, `region` required |
| Backblaze B2 | `provider: "backblaze"`, `region` required |
| Custom | `provider: "custom"`, `endpoint` required |

## Development

```bash
bun install
bun run dev           # Run from source
bun run build         # Build standalone binary
bun test              # Run tests
```

## License

MIT
