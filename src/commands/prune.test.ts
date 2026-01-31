// src/commands/prune.test.ts
import { describe, expect, test } from 'bun:test';
import type { S3Object } from '../lib/s3';
import { filterObjectsForPrune } from './prune';

describe('filterObjectsForPrune', () => {
  const now = new Date('2026-01-31T12:00:00Z').getTime();

  const objects: S3Object[] = [
    {
      key: 'backups/file1.tar.gz',
      lastModified: new Date('2026-01-30T12:00:00Z'),
      size: 1000
    }, // 1 day old
    {
      key: 'backups/file2.tar.gz',
      lastModified: new Date('2026-01-29T12:00:00Z'),
      size: 2000
    }, // 2 days old
    {
      key: 'backups/file3.tar.gz',
      lastModified: new Date('2026-01-28T12:00:00Z'),
      size: 3000
    }, // 3 days old
    {
      key: 'backups/file4.tar.gz',
      lastModified: new Date('2026-01-20T12:00:00Z'),
      size: 4000
    }, // 11 days old
    {
      key: 'backups/file5.tar.gz',
      lastModified: new Date('2026-01-10T12:00:00Z'),
      size: 5000
    } // 21 days old
  ];

  test('filters by --older-than', () => {
    const result = filterObjectsForPrune(objects, {
      minAge: '0',
      now,
      olderThan: 10
    });
    expect(result.map((o) => o.key)).toEqual(['backups/file4.tar.gz', 'backups/file5.tar.gz']);
  });

  test('filters by --keep-last', () => {
    const result = filterObjectsForPrune(objects, {
      keepLast: 2,
      minAge: '0',
      now
    });
    // Keeps 2 newest, deletes rest
    expect(result.map((o) => o.key)).toEqual([
      'backups/file3.tar.gz',
      'backups/file4.tar.gz',
      'backups/file5.tar.gz'
    ]);
  });

  test('respects --min-age default (1d)', () => {
    const result = filterObjectsForPrune(objects, {
      keepLast: 1,
      minAge: '1d',
      now
    });
    // file1 is only 1 day old, protected by min-age
    expect(result.map((o) => o.key)).not.toContain('backups/file1.tar.gz');
  });

  test('combines --older-than and --keep-last (both must match)', () => {
    const result = filterObjectsForPrune(objects, {
      keepLast: 3,
      minAge: '0',
      now,
      olderThan: 2
    });
    // Must be older than 2 days AND not in top 3
    // Top 3: file1, file2, file3
    // Older than 2 days: file3, file4, file5
    // Both: file4, file5
    expect(result.map((o) => o.key)).toEqual(['backups/file4.tar.gz', 'backups/file5.tar.gz']);
  });
});
