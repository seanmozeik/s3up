// src/lib/output.test.ts
import { describe, expect, test } from 'bun:test';
import { formatBytes, formatDeleteSummary, formatListItem, formatUploadSuccess } from './output';

describe('formatBytes', () => {
  test('formats bytes', () => {
    expect(formatBytes(500)).toBe('500 B');
  });

  test('formats kilobytes', () => {
    expect(formatBytes(1024)).toBe('1.0 KB');
    expect(formatBytes(1536)).toBe('1.5 KB');
  });

  test('formats megabytes', () => {
    expect(formatBytes(1024 * 1024)).toBe('1.0 MB');
    expect(formatBytes(2.5 * 1024 * 1024)).toBe('2.5 MB');
  });

  test('formats gigabytes', () => {
    expect(formatBytes(1024 * 1024 * 1024)).toBe('1.0 GB');
  });
});

describe('formatUploadSuccess (quiet mode)', () => {
  test('formats single file upload', () => {
    const result = formatUploadSuccess(
      'backup.tar.gz',
      'https://cdn.example.com/backup.tar.gz',
      2500000,
      true
    );
    expect(result).toBe('backup.tar.gz → https://cdn.example.com/backup.tar.gz (2.4 MB)');
  });
});

describe('formatListItem (quiet mode)', () => {
  test('formats list item with tabs', () => {
    const result = formatListItem(
      'backups/file.tar.gz',
      47395635,
      new Date('2026-01-28T03:00:05Z'),
      true
    );
    expect(result).toContain('backups/file.tar.gz');
    expect(result).toContain('45.2 MB');
    expect(result).toContain('2026-01-28');
  });

  test('formats list item as JSON', () => {
    const result = formatListItem(
      'backups/file.tar.gz',
      47395635,
      new Date('2026-01-28T03:00:05Z'),
      true,
      true
    );
    const parsed = JSON.parse(result);
    expect(parsed.key).toBe('backups/file.tar.gz');
    expect(parsed.size).toBe(47395635);
  });
});

describe('formatDeleteSummary', () => {
  test('formats deletion summary', () => {
    const result = formatDeleteSummary(3, 138200000, false, true);
    expect(result).toBe('Deleted 3 objects (131.8 MB)');
  });

  test('formats dry-run summary', () => {
    const result = formatDeleteSummary(3, 138200000, true, true);
    expect(result).toContain('Would delete 3 objects');
  });
});
