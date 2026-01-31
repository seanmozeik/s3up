// src/commands/upload.ts

import path from 'node:path';
import * as p from '@clack/prompts';
import boxen from 'boxen';

import { createArchive, isDirectory } from '../lib/archive';
import { type GlobalFlags, parseUploadFlags } from '../lib/flags';
import {
  checkResumableUpload,
  cleanupExistingUpload,
  type MultipartOptions,
  uploadMultipart
} from '../lib/multipart';
import { formatBytes, formatUploadError, formatUploadSuccess } from '../lib/output';
import { loadConfig, PROVIDERS, type S3Config } from '../lib/providers';
import {
  renderProgress,
  runWithConcurrency,
  type UploadError,
  type UploadOutcome,
  type UploadProgress,
  type UploadResult,
  uploadFile
} from '../lib/upload';
import { showBanner } from '../ui/banner';
import { boxColors, frappe, theme } from '../ui/theme';

const MULTIPART_THRESHOLD = 100 * 1024 * 1024; // 100MB

const SPEED_PRESETS = {
  default: { chunkSize: 25 * 1024 * 1024, connections: 8 },
  fast: { chunkSize: 5 * 1024 * 1024, connections: 16 },
  slow: { chunkSize: 50 * 1024 * 1024, connections: 4 }
} as const;

interface UploadOptions {
  chunkSize: number;
  connections: number;
  forceFast?: boolean;
}

function getUploadOptions(flags: { fast: boolean; slow: boolean }): UploadOptions {
  if (flags.fast) return { ...SPEED_PRESETS.fast, forceFast: true };
  if (flags.slow) return SPEED_PRESETS.slow;
  return SPEED_PRESETS.default;
}

function displayResults(results: UploadOutcome[], quiet: boolean): void {
  if (quiet) {
    for (const r of results) {
      if (r.success) {
        console.log(formatUploadSuccess(r.filename, r.publicUrl, r.size, true));
      } else {
        console.error(formatUploadError(r.filename, r.error));
      }
    }
    return;
  }

  const successes = results.filter((r): r is UploadResult => r.success);
  const failures = results.filter((r): r is UploadError => !r.success);

  if (successes.length > 0) {
    const content = successes
      .map(
        (r) =>
          `${theme.success('✓')} ${frappe.text(r.filename)} ${theme.dim(`(${formatBytes(r.size)})`)}\n  ${theme.link(r.publicUrl)}`
      )
      .join('\n\n');

    const box = boxen(content, {
      borderColor: boxColors.success,
      borderStyle: 'round',
      padding: { bottom: 0, left: 1, right: 1, top: 0 },
      title: `Uploaded ${successes.length} file${successes.length > 1 ? 's' : ''}`,
      titleAlignment: 'left'
    });
    console.log(box);
  }

  if (failures.length > 0) {
    for (const f of failures) {
      p.log.error(`${f.filename}: ${f.error}`);
    }
  }
}

export async function upload(args: string[], globalFlags: GlobalFlags): Promise<void> {
  const flags = parseUploadFlags(args);
  const uploadOpts = getUploadOptions(flags);

  // Load config first
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

  const providerInfo = PROVIDERS[config.provider];

  // Separate files and directories
  const files: { path: string; name: string; size: number; blob?: Blob }[] = [];
  const directories: string[] = [];
  const invalidPaths: string[] = [];

  for (const filePath of flags.paths) {
    const absolutePath = path.isAbsolute(filePath) ? filePath : path.join(process.cwd(), filePath);

    if (await isDirectory(absolutePath)) {
      directories.push(absolutePath);
    } else {
      const file = Bun.file(absolutePath);
      const exists = await file.exists();
      if (exists) {
        files.push({
          name: path.basename(absolutePath),
          path: absolutePath,
          size: file.size
        });
      } else {
        invalidPaths.push(filePath);
      }
    }
  }

  // Create tarball from directories if any
  if (directories.length > 0) {
    const archive = await createArchive(directories, {
      compression: flags.compression,
      name: flags.as
    });

    // Add archive as a "file" to upload
    files.push({
      blob: archive.blob,
      name: archive.name,
      path: '', // Will use blob directly
      size: archive.size
    });
  }

  if (!globalFlags.quiet) await showBanner();

  // Report invalid paths
  if (invalidPaths.length > 0 && !globalFlags.quiet) {
    for (const f of invalidPaths) {
      p.log.warn(`Path not found: ${f}`);
    }
  }

  if (files.length === 0) {
    if (globalFlags.quiet) {
      console.error('Error: No valid files to upload');
    } else {
      p.outro(theme.error('No valid files to upload'));
    }
    process.exit(1);
  }

  // Apply prefix to keys
  const getKey = (filename: string): string => {
    if (flags.prefix) {
      const normalizedPrefix = flags.prefix.replace(/^\/+|\/+$/g, '');
      return `${normalizedPrefix}/${filename}`;
    }
    return filename;
  };

  const totalSize = files.reduce((sum, f) => sum + f.size, 0);

  if (!globalFlags.quiet) {
    p.intro(
      frappe.text(
        `Uploading ${files.length} file${files.length > 1 ? 's' : ''} to ${providerInfo.name} (${formatBytes(totalSize)})`
      )
    );
  }

  const results: UploadOutcome[] = [];

  // Separate large and small files
  const threshold = uploadOpts.forceFast ? uploadOpts.chunkSize : MULTIPART_THRESHOLD;
  const largeFiles = files.filter((f) => f.size >= threshold && !f.blob);
  const smallFiles = files.filter((f) => f.size < threshold || f.blob);

  // Handle large files (one at a time for progress)
  for (const file of largeFiles) {
    // Check for resumable upload
    const { canResume, percentComplete } = await checkResumableUpload(file.path);

    if (canResume && !globalFlags.ci) {
      const resume = await p.confirm({
        message: `Resume incomplete upload of ${file.name}? (${percentComplete}% done)`
      });

      if (p.isCancel(resume)) {
        if (!globalFlags.quiet) p.outro(frappe.subtext1('Cancelled'));
        process.exit(0);
      }

      if (!resume) {
        await cleanupExistingUpload(file.path, config);
      }
    } else if (canResume && globalFlags.ci) {
      // In CI mode, always resume
    }

    if (!globalFlags.quiet) {
      console.log(frappe.text(`\nUploading ${file.name} (${formatBytes(file.size)})...`));
    }

    const multipartOptions: MultipartOptions = {
      chunkSize: uploadOpts.chunkSize,
      connections: uploadOpts.connections
    };

    const key = getKey(file.name);
    const result = await uploadMultipart(file.path, config, key, multipartOptions);

    if (result.success) {
      results.push({
        filename: file.name,
        publicUrl: result.publicUrl,
        size: file.size,
        success: true
      });
    } else {
      results.push({
        error: result.error,
        filename: file.name,
        success: false
      });
    }
  }

  // Handle small files (concurrent)
  if (smallFiles.length > 0) {
    const progress: UploadProgress = {
      activeFiles: new Set(),
      completed: 0,
      total: smallFiles.length
    };

    let spinner: ReturnType<typeof p.spinner> | undefined;
    if (!globalFlags.quiet) {
      spinner = p.spinner();
      spinner.start(renderProgress(progress));
    }

    const smallResults = await runWithConcurrency(
      smallFiles,
      uploadOpts.connections,
      async (file) => {
        progress.activeFiles.add(file.name);
        spinner?.message(renderProgress(progress));

        const key = getKey(file.name);

        // Handle blob uploads (from archives)
        let result: UploadOutcome;
        if (file.blob) {
          result = await uploadBlob(file.blob, key, file.name, config);
        } else {
          result = await uploadFile({ ...file, name: key }, config);
        }

        progress.activeFiles.delete(file.name);
        progress.completed++;
        spinner?.message(renderProgress(progress));

        // Fix the filename in result
        if (result.success) {
          return { ...result, filename: file.name };
        }
        return { ...result, filename: file.name };
      }
    );

    spinner?.stop(theme.success(`Uploaded ${progress.completed}/${progress.total} files`));
    results.push(...smallResults);
  }

  if (!globalFlags.quiet) console.log();
  displayResults(results, globalFlags.quiet);

  const successCount = results.filter((r) => r.success).length;
  const failCount = results.filter((r) => !r.success).length;

  if (failCount === 0) {
    if (!globalFlags.quiet) p.outro(theme.success('All files uploaded successfully!'));
    process.exit(0);
  } else if (successCount > 0) {
    if (!globalFlags.quiet) p.outro(theme.warning(`${successCount} uploaded, ${failCount} failed`));
    process.exit(4);
  } else {
    if (!globalFlags.quiet) p.outro(theme.error('All uploads failed'));
    process.exit(1);
  }
}

// Helper to upload a blob (for archives)
async function uploadBlob(
  blob: Blob,
  key: string,
  filename: string,
  config: S3Config
): Promise<UploadOutcome> {
  try {
    const { getEndpoint } = await import('../lib/providers');
    const endpoint = getEndpoint(config);

    const response = await fetch(`s3://${config.bucket}/${key}`, {
      body: blob.stream(),
      headers: {
        'Content-Disposition': 'attachment'
      },
      method: 'PUT',
      s3: {
        accessKeyId: config.accessKeyId,
        endpoint,
        secretAccessKey: config.secretAccessKey
      }
    });

    if (!response.ok) {
      throw new Error(`Upload failed: ${response.status} ${response.statusText}`);
    }

    const publicUrl = `${config.publicUrlBase}/${key}`;

    return {
      filename,
      publicUrl,
      size: blob.size,
      success: true
    };
  } catch (err) {
    return {
      error: err instanceof Error ? err.message : String(err),
      filename,
      success: false
    };
  }
}
