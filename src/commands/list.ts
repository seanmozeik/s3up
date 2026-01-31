// src/commands/list.ts
import * as p from '@clack/prompts';

import { type GlobalFlags, parseListFlags } from '../lib/flags';
import { formatBytes, formatListItem } from '../lib/output';
import { loadConfig } from '../lib/providers';
import { createS3Client, listAllObjects, type S3Object } from '../lib/s3';
import { showBanner } from '../ui/banner';
import { frappe } from '../ui/theme';

export function formatListOutput(objects: S3Object[], quiet: boolean, json: boolean): string {
  return objects.map((o) => formatListItem(o.key, o.size, o.lastModified, quiet, json)).join('\n');
}

export async function list(args: string[], globalFlags: GlobalFlags): Promise<void> {
  const flags = parseListFlags(args);

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
    p.intro(frappe.text(`Listing objects${flags.prefix ? ` with prefix: ${flags.prefix}` : ''}`));
  }

  const client = createS3Client(config);
  const objects = await listAllObjects(client, flags.prefix);

  if (objects.length === 0) {
    if (globalFlags.quiet) {
      // No output for empty results in quiet mode
    } else {
      p.log.info('No objects found');
    }
    process.exit(0);
  }

  // Sort by lastModified descending (newest first)
  objects.sort((a, b) => b.lastModified.getTime() - a.lastModified.getTime());

  const output = formatListOutput(objects, globalFlags.quiet, flags.json);
  console.log(output);

  if (!globalFlags.quiet) {
    const totalSize = objects.reduce((sum, o) => sum + o.size, 0);
    p.outro(frappe.subtext1(`${objects.length} objects (${formatBytes(totalSize)} total)`));
  }

  process.exit(0);
}
