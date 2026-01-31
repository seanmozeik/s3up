# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

s3up is a CLI tool for uploading files to S3-compatible storage (AWS S3, Cloudflare R2, DigitalOcean Spaces, Backblaze B2, or custom endpoints). It compiles to a standalone Bun executable.

## Commands

```bash
# Development
bun run dev                    # Run from source
bun run build                  # Compile to standalone binary (outputs ./s3up)
bun run install-local          # Build and install to ~/.local/bin/s3up
bun test                       # Run tests
```

## Architecture

Modular CLI with `commands/` for each command, `lib/` for shared logic, and `ui/` for display:

```
src/
├── index.ts              # CLI entry point, thin command router
├── commands/
│   ├── upload.ts         # Upload files/directories
│   ├── list.ts           # List bucket objects
│   └── prune.ts          # Delete old objects
├── lib/
│   ├── archive.ts        # Directory → tar.gz via Bun.Archive
│   ├── flags.ts          # Centralized flag parsing
│   ├── output.ts         # Quiet/normal output formatting
│   ├── s3.ts             # Bun S3Client wrapper (list, delete)
│   ├── secrets.ts        # Secrets management with caching
│   ├── providers.ts      # S3 provider definitions and config
│   ├── upload.ts         # Upload logic with progress tracking
│   ├── multipart.ts      # Multipart upload with resume support
│   └── clipboard.ts      # Cross-platform clipboard utility
└── ui/
    ├── theme.ts          # Catppuccin Frappe colors, ANSI codes
    ├── banner.ts         # Figlet banner with gradient
    └── setup.ts          # Interactive setup flow
```

### CLI Commands

- `s3up <files...>` — Upload files/directories
- `s3up upload <files...>` — Same as above (explicit)
- `s3up list [prefix]` — List objects in bucket
- `s3up prune <prefix>` — Delete old objects
- `s3up setup` — Interactive credential configuration
- `s3up teardown` — Remove stored credentials

### Global Flags

- `--quiet, -q` — Minimal output for scripting
- `--ci` — Non-interactive mode (exit 3 if prompt needed)

### Key Implementation Details

**Credential Storage**: Uses `S3UP_CONFIG` env var (JSON) or `Bun.secrets` API for system keychain. Env var takes precedence.

**S3 Integration**: Uses Bun's native `S3Client` for all operations (upload, list, delete).

**Directory Archiving**: Uses `Bun.Archive` to create gzipped tarballs from directories.

**Fire-and-Forget Uploads**: Uploads start immediately before UI renders for better perceived performance.

**Clipboard**: Auto-copies uploaded URLs to clipboard (cross-platform: pbcopy, xclip, xsel, wl-copy).

**Exit Codes**: 0=success, 1=error, 2=config error, 3=interactive required in CI, 4=partial failure.

**UI**: Uses @clack/prompts for interactive CLI, Catppuccin Frappe color palette for theming.

## Testing

Tests are colocated with source files using Bun's test runner:

```bash
bun test                       # Run all tests
bun test src/lib/flags.test.ts # Run specific test file
```

Test files follow the pattern `*.test.ts` next to their source files.
