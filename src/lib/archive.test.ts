// src/lib/archive.test.ts
import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdir, rm } from 'node:fs/promises';
import path from 'node:path';
import { createArchive, generateArchiveName } from './archive';

describe('generateArchiveName', () => {
  test('generates name from single directory', () => {
    const name = generateArchiveName(['/path/to/workspace']);
    expect(name).toMatch(/^workspace-\d{4}-\d{2}-\d{2}\.tar\.gz$/);
  });

  test('generates name from multiple directories using first', () => {
    const name = generateArchiveName(['/path/to/workspace', '/path/to/config']);
    expect(name).toMatch(/^workspace-\d{4}-\d{2}-\d{2}\.tar\.gz$/);
  });

  test('uses override name when provided', () => {
    const name = generateArchiveName(['/path/to/workspace'], 'backup.tar.gz');
    expect(name).toBe('backup.tar.gz');
  });

  test('adds .tar.gz if missing from override', () => {
    const name = generateArchiveName(['/path/to/workspace'], 'backup');
    expect(name).toBe('backup.tar.gz');
  });
});

describe('createArchive', () => {
  const testDir = '/tmp/s3up-archive-test';
  const subDir1 = path.join(testDir, 'workspace');
  const subDir2 = path.join(testDir, 'config');

  beforeAll(async () => {
    await mkdir(subDir1, { recursive: true });
    await mkdir(subDir2, { recursive: true });
    await Bun.write(path.join(subDir1, 'file1.txt'), 'content1');
    await Bun.write(path.join(subDir2, 'file2.txt'), 'content2');
  });

  afterAll(async () => {
    await rm(testDir, { force: true, recursive: true });
  });

  test('creates archive from single directory', async () => {
    const result = await createArchive([subDir1], { compression: 6 });
    expect(result.blob).toBeDefined();
    expect(result.blob.size).toBeGreaterThan(0);
    expect(result.name).toMatch(/^workspace-\d{4}-\d{2}-\d{2}\.tar\.gz$/);
  });

  test('creates archive from multiple directories', async () => {
    const result = await createArchive([subDir1, subDir2], { compression: 6 });
    expect(result.blob).toBeDefined();
    expect(result.blob.size).toBeGreaterThan(0);
  });

  test('uses custom name', async () => {
    const result = await createArchive([subDir1], {
      compression: 6,
      name: 'custom-backup.tar.gz'
    });
    expect(result.name).toBe('custom-backup.tar.gz');
  });
});
