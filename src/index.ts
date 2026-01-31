#!/usr/bin/env bun

import * as p from '@clack/prompts';
import pkg from '../package.json' with { type: 'json' };
import { list } from './commands/list';
import { prune } from './commands/prune';
import { upload } from './commands/upload';
import { parseGlobalFlags } from './lib/flags';
import { deleteConfig } from './lib/providers';
import { showBanner } from './ui/banner';
import { setup } from './ui/setup';
import { frappe, theme } from './ui/theme';

// ─────────────────────────────────────────────────────────────────────────────
// Teardown Command
// ─────────────────────────────────────────────────────────────────────────────

async function teardown(): Promise<void> {
  await showBanner();
  p.intro(frappe.text('Remove stored credentials'));

  const confirm = await p.confirm({
    message: 'Remove all stored S3 credentials?'
  });

  if (p.isCancel(confirm) || !confirm) {
    p.outro(frappe.subtext1('Cancelled'));
    process.exit(0);
  }

  const s = p.spinner();
  s.start('Removing credentials...');

  try {
    const removed = await deleteConfig();
    s.stop(theme.success(`Removed ${removed} credential(s)`));
    p.outro(frappe.subtext1('Done'));
  } catch (err) {
    s.stop(theme.error('Failed to remove credentials'));
    p.log.error(err instanceof Error ? err.message : String(err));
    process.exit(1);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Help
// ─────────────────────────────────────────────────────────────────────────────

async function showHelp(): Promise<void> {
  await showBanner();
  console.log(frappe.text('Usage:'));
  console.log(
    `  ${theme.accent('s3up')} ${theme.dim('[options]')} ${frappe.text('<files...>')}       Upload files`
  );
  console.log(
    `  ${theme.accent('s3up upload')} ${theme.dim('[options]')} ${frappe.text('<files...>')}  Upload files`
  );
  console.log(
    `  ${theme.accent('s3up list')} ${theme.dim('[prefix]')}                   List bucket objects`
  );
  console.log(
    `  ${theme.accent('s3up prune')} ${frappe.text('<prefix>')} ${theme.dim('[options]')}     Delete old objects`
  );
  console.log(`  ${theme.accent('s3up setup')}                           Configure credentials`);
  console.log(`  ${theme.accent('s3up teardown')}                        Remove credentials`);
  console.log();
  console.log(frappe.text('Global options:'));
  console.log(`  ${theme.accent('-q, --quiet')}    Minimal output for scripting`);
  console.log(`  ${theme.accent('--ci')}           Non-interactive mode`);
  console.log(`  ${theme.accent('-h, --help')}     Show this help message`);
  console.log(`  ${theme.accent('-v, --version')}  Show version number`);
  console.log();
  console.log(frappe.text('Upload options:'));
  console.log(`  ${theme.accent('--prefix <path>')}       Prepend path to uploaded keys`);
  console.log(`  ${theme.accent('--as <name>')}           Override tarball filename`);
  console.log(`  ${theme.accent('--compression <1-12>')}  Gzip level (default: 6)`);
  console.log(
    `  ${theme.accent('-f, --fast')}            Fast network (5MB chunks, 16 connections)`
  );
  console.log(
    `  ${theme.accent('-s, --slow')}            Slow network (50MB chunks, 4 connections)`
  );
  console.log();
  console.log(frappe.text('List options:'));
  console.log(`  ${theme.accent('--json')}         Output as JSON (one object per line)`);
  console.log();
  console.log(frappe.text('Prune options:'));
  console.log(`  ${theme.accent('--older-than <days>')}   Delete objects older than N days`);
  console.log(`  ${theme.accent('--keep-last <n>')}       Keep only N most recent objects`);
  console.log(`  ${theme.accent('--min-age <duration>')}  Minimum age to delete (default: 1d)`);
  console.log(`  ${theme.accent('--dry-run')}             Show what would be deleted`);
  console.log();
  console.log(frappe.text('Examples:'));
  console.log(`  ${theme.dim('s3up image.png')}                         Upload single file`);
  console.log(`  ${theme.dim('s3up *.png')}                             Upload multiple files`);
  console.log(
    `  ${theme.dim('s3up ./workspace --prefix backups')}      Upload directory as tarball`
  );
  console.log(`  ${theme.dim('s3up list backups/')}                     List objects with prefix`);
  console.log(`  ${theme.dim('s3up prune backups/ --keep-last 7')}      Keep last 7 backups`);
  console.log();
  console.log(frappe.subtext0('Files ≥100MB automatically use chunked parallel upload.'));
  console.log(frappe.subtext0('Directories are automatically archived as .tar.gz files.'));
  console.log();
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
  const args = Bun.argv.slice(2);
  const globalFlags = parseGlobalFlags(args);

  // Handle --version anywhere
  if (globalFlags.version) {
    console.log(`s3up v${pkg.version}`);
    process.exit(0);
  }

  // Handle --help anywhere
  if (globalFlags.help) {
    await showHelp();
    process.exit(0);
  }

  const command = globalFlags.args[0];
  const commandArgs = globalFlags.args.slice(1);

  switch (command) {
    case 'setup':
      await setup();
      break;

    case 'teardown':
      await teardown();
      break;

    case 'upload':
      await upload(commandArgs, globalFlags);
      break;

    case 'list':
      await list(commandArgs, globalFlags);
      break;

    case 'prune':
      await prune(commandArgs, globalFlags);
      break;

    case undefined:
      await showHelp();
      break;

    default:
      // Treat as file paths for upload (backwards compatible)
      await upload([command, ...commandArgs], globalFlags);
      break;
  }
}

main().catch((err) => {
  console.error(theme.error(err instanceof Error ? err.message : String(err)));
  process.exit(1);
});
