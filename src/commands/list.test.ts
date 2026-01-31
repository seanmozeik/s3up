// src/commands/list.test.ts
import { describe, expect, test } from 'bun:test';
import { formatListOutput } from './list';

describe('formatListOutput', () => {
  const objects = [
    {
      key: 'backups/file1.tar.gz',
      lastModified: new Date('2026-01-28T10:00:00Z'),
      size: 1024000
    },
    {
      key: 'backups/file2.tar.gz',
      lastModified: new Date('2026-01-29T10:00:00Z'),
      size: 2048000
    }
  ];

  test('formats as tab-separated in quiet mode', () => {
    const result = formatListOutput(objects, true, false);
    expect(result).toContain('backups/file1.tar.gz');
    expect(result).toContain('\t');
  });

  test('formats as JSON with --json flag', () => {
    const result = formatListOutput(objects, true, true);
    const lines = result.trim().split('\n');
    expect(lines).toHaveLength(2);
    expect(JSON.parse(lines[0]).key).toBe('backups/file1.tar.gz');
  });
});
