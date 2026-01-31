export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(1)} GB`;
}

export function formatUploadSuccess(
  filename: string,
  url: string,
  size: number,
  quiet: boolean
): string {
  if (quiet) {
    return `${filename} → ${url} (${formatBytes(size)})`;
  }
  // Normal mode formatting handled by UI layer
  return `${filename} → ${url} (${formatBytes(size)})`;
}

export function formatUploadError(filename: string, error: string): string {
  return `Error: ${filename} - ${error}`;
}

export function formatListItem(
  key: string,
  size: number,
  lastModified: Date,
  quiet: boolean,
  json = false
): string {
  if (json) {
    return JSON.stringify({
      key,
      lastModified: lastModified.toISOString(),
      size
    });
  }

  if (quiet) {
    const sizeStr = formatBytes(size).padStart(10);
    const dateStr = lastModified.toISOString().split('T')[0];
    return `${key}\t${sizeStr}\t${dateStr}`;
  }

  // Normal mode with colors handled by UI layer
  return `${key}\t${formatBytes(size)}\t${lastModified.toISOString()}`;
}

export function formatDeleteSummary(
  count: number,
  totalSize: number,
  dryRun: boolean,
  _quiet: boolean
): string {
  const action = dryRun ? 'Would delete' : 'Deleted';
  return `${action} ${count} objects (${formatBytes(totalSize)})`;
}

export function formatDryRunList(objects: Array<{ key: string; size: number }>): string {
  const lines = objects.map((o) => `  ${o.key} (${formatBytes(o.size)})`);
  return lines.join('\n');
}
