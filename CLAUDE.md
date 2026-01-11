# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

r2up is a CLI tool for uploading files to Cloudflare R2. It compiles to a standalone Bun executable.

## Commands

```bash
# Development
bun run dev                    # Run from source
bun run build                  # Compile to standalone binary (outputs ./r2up)
bun run install-local          # Build and install to ~/.local/bin/r2up

# No test framework is configured
```

## Architecture

Single-file CLI (`src/index.ts`) with three commands:
- `r2up setup` - Interactive credential configuration
- `r2up teardown` - Remove stored credentials
- `r2up <files...>` - Upload files to R2

### Key Implementation Details

**Credential Storage**: Uses `Bun.secrets` API for system keychain integration (macOS Keychain, Windows Credential Manager, libsecret on Linux). Falls back to environment variables (`R2UP_ACCESS_KEY_ID`, `R2UP_SECRET_ACCESS_KEY`, `R2UP_ACCOUNT_ID`, `R2UP_BUCKET`, `R2UP_PUBLIC_URL_BASE`).

**R2 Integration**: Uses Bun's native `S3Client` - no AWS SDK required.

**Standalone Binary**: The figlet font is embedded using Bun's file import attribute (`with { type: "file" }`) so it works in compiled binaries.

**UI**: Uses @clack/prompts for interactive CLI, Catppuccin Frappe color palette for theming.
