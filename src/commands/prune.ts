// src/commands/prune.ts
import * as p from '@clack/prompts';

import { type GlobalFlags, parsePruneFlags } from '../lib/flags';
import { formatBytes, formatDeleteSummary, formatDryRunList } from '../lib/output';
import { loadConfig } from '../lib/providers';
import { createS3Client, deleteObjects, listAllObjects, parseAge, type S3Object } from '../lib/s3';
import { showBanner } from '../ui/banner';
import { frappe, theme } from '../ui/theme';

export interface PruneFilterOptions {
  olderThan?: number;
  keepLast?: number;
  minAge: string;
  now?: number;
}

export function filterObjectsForPrune(
  objects: S3Object[],
  options: PruneFilterOptions
): S3Object[] {
  const now = options.now ?? Date.now();
  const minAgeMs = parseAge(options.minAge);

  // Sort by lastModified descending (newest first)
  const sorted = [...objects].sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());

  // Build set of protected keys (top N newest)
  const protectedKeys = new Set<string>();
  if (options.keepLast) {
    for (let i = 0; i < Math.min(options.keepLast, sorted.length); i++) {
      protectedKeys.add(sorted[i].key);
    }
  }

  return sorted.filter((obj) => {
    const age = now - obj.lastModified.getTime();

    // Must be older than min-age
    if (age <= minAgeMs) return false;

    // Must not be in protected set (keep-last)
    if (protectedKeys.has(obj.key)) return false;

    // Must be older than --older-than days
    if (options.olderThan !== undefined) {
      const olderThanMs = options.olderThan * 24 * 60 * 60 * 1000;
      if (age <= olderThanMs) return false;
    }

    return true;
  });
}

export async function prune(args: string[], globalFlags: GlobalFlags): Promise<void> {
  const flags = parsePruneFlags(args);

  // Validate required prefix
  if (!flags.prefix) {
    console.error('Error: prefix is required for prune command');
    console.error('Usage: s3up prune <prefix> --keep-last <n> | --older-than <days>');
    process.exit(1);
  }

  // Validate at least one filter
  if (flags.olderThan === undefined && flags.keepLast === undefined) {
    console.error('Error: at least one of --older-than or --keep-last is required');
    process.exit(1);
  }

  const config = await loadConfig();
  if (!config) {
    if (globalFlags.ci) {
      console.error('Error: S3UP_CONFIG not set and --ci prevents interactive setup');
      process.exit(2);
    }
    if (!globalFlags.quiet) await showBanner();
    p.log.error('S3 not configured. Run: s3up setup');
    process.exit(2);
  }

  if (!globalFlags.quiet) {
    await showBanner();
    p.intro(frappe.text(`Pruning objects with prefix: ${flags.prefix}`));
  }

  const client = createS3Client(config);
  const objects = await listAllObjects(client, flags.prefix);

  if (objects.length === 0) {
    if (globalFlags.quiet) {
      console.log('0 objects deleted');
    } else {
      p.log.info('No objects found matching prefix');
    }
    process.exit(0);
  }

  const toDelete = filterObjectsForPrune(objects, {
    keepLast: flags.keepLast,
    minAge: flags.minAge,
    olderThan: flags.olderThan
  });

  if (toDelete.length === 0) {
    if (globalFlags.quiet) {
      console.log('0 objects deleted');
    } else {
      p.log.info('No objects match deletion criteria');
    }
    process.exit(0);
  }

  const totalSize = toDelete.reduce((sum, o) => sum + o.size, 0);

  // Dry run mode
  if (flags.dryRun) {
    console.log(formatDeleteSummary(toDelete.length, totalSize, true, globalFlags.quiet));
    if (!globalFlags.quiet) {
      console.log(formatDryRunList(toDelete));
    }
    process.exit(0);
  }

  // Confirm deletion in interactive mode
  if (!globalFlags.ci && !globalFlags.quiet) {
    console.log(formatDryRunList(toDelete));
    const confirm = await p.confirm({
      message: `Delete ${toDelete.length} objects (${formatBytes(totalSize)})?`
    });

    if (p.isCancel(confirm) || !confirm) {
      p.outro(frappe.subtext1('Cancelled'));
      process.exit(0);
    }
  }

  // Perform deletion
  const spinner = globalFlags.quiet ? undefined : p.spinner();
  spinner?.start(`Deleting ${toDelete.length} objects...`);

  const { deleted, errors } = await deleteObjects(
    client,
    toDelete.map((o) => o.key)
  );

  if (errors.length > 0) {
    spinner?.stop(theme.warning(`Deleted ${deleted}/${toDelete.length} objects`));
    for (const err of errors) {
      console.error(`Error: ${err}`);
    }
    process.exit(4);
  }

  spinner?.stop(theme.success(`Deleted ${deleted} objects`));
  console.log(formatDeleteSummary(deleted, totalSize, false, globalFlags.quiet));

  process.exit(0);
}
