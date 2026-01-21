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

# No test framework is configured
```

## Architecture

Modular CLI with `lib/` for logic and `ui/` for display:

```
src/
├── index.ts              # CLI entry point, command routing
├── lib/
│   ├── secrets.ts        # Secrets management with caching
│   ├── providers.ts      # S3 provider definitions and config
│   ├── upload.ts         # Upload logic with progress tracking
│   └── clipboard.ts      # Cross-platform clipboard utility
└── ui/
    ├── theme.ts          # Catppuccin Frappe colors, ANSI codes
    ├── banner.ts         # Figlet banner with gradient
    └── setup.ts          # Interactive setup flow
```

### Commands

- `s3up setup` - Interactive credential configuration (provider selection + credentials)
- `s3up teardown` - Remove stored credentials
- `s3up <files...>` - Upload files to configured S3 provider

### Supported Providers

- AWS S3
- Cloudflare R2
- DigitalOcean Spaces
- Backblaze B2
- Custom S3-compatible endpoint

### Key Implementation Details

**Credential Storage**: Uses `Bun.secrets` API for system keychain integration with in-memory caching. Environment variables: `S3UP_PROVIDER`, `S3UP_ACCESS_KEY_ID`, `S3UP_SECRET_ACCESS_KEY`, `S3UP_BUCKET`, `S3UP_PUBLIC_URL_BASE`, plus provider-specific: `S3UP_REGION`, `S3UP_ACCOUNT_ID`, `S3UP_ENDPOINT`.

**S3 Integration**: Uses Bun's native S3 support via fetch with `s3://` URLs.

**Fire-and-Forget Uploads**: Uploads start immediately before UI renders for better perceived performance.

**Clipboard**: Auto-copies uploaded URLs to clipboard (cross-platform: pbcopy, xclip, xsel, wl-copy).

**Standalone Binary**: The figlet font is embedded using Bun's file import attribute.

**UI**: Uses @clack/prompts for interactive CLI, Catppuccin Frappe color palette for theming.
