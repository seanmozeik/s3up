// src/lib/archive.ts

import { readdir, stat } from 'node:fs/promises';
import path from 'node:path';

export interface ArchiveOptions {
  compression: number;
  name?: string;
}

export interface ArchiveResult {
  blob: Blob;
  name: string;
  size: number;
}

export function generateArchiveName(directories: string[], override?: string): string {
  if (override) {
    return override.endsWith('.tar.gz') ? override : `${override}.tar.gz`;
  }

  const firstName = path.basename(directories[0]);
  const date = new Date().toISOString().split('T')[0];
  return `${firstName}-${date}.tar.gz`;
}

async function collectFiles(
  dirPath: string,
  baseName: string
): Promise<Record<string, Uint8Array>> {
  const files: Record<string, Uint8Array> = {};

  async function walk(currentPath: string, relativePath: string): Promise<void> {
    const entries = await readdir(currentPath, { withFileTypes: true });

    for (const entry of entries) {
      const fullPath = path.join(currentPath, entry.name);
      const archivePath = path.join(relativePath, entry.name);

      if (entry.isDirectory()) {
        await walk(fullPath, archivePath);
      } else if (entry.isFile()) {
        const content = await Bun.file(fullPath).bytes();
        files[archivePath] = content;
      }
    }
  }

  await walk(dirPath, baseName);
  return files;
}

export async function createArchive(
  directories: string[],
  options: ArchiveOptions
): Promise<ArchiveResult> {
  const allFiles: Record<string, Uint8Array> = {};

  // Collect files from all directories
  for (const dir of directories) {
    const baseName = path.basename(dir);
    const dirFiles = await collectFiles(dir, baseName);
    Object.assign(allFiles, dirFiles);
  }

  // Create tarball using Bun.Archive
  const archive = new Bun.Archive(allFiles, {
    compress: 'gzip',
    level: options.compression
  });

  const blob = await archive.blob();
  const name = generateArchiveName(directories, options.name);

  return {
    blob,
    name,
    size: blob.size
  };
}

export async function isDirectory(filePath: string): Promise<boolean> {
  try {
    const stats = await stat(filePath);
    return stats.isDirectory();
  } catch {
    return false;
  }
}
