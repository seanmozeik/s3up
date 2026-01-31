// src/lib/flags.test.ts
import { describe, expect, test } from 'bun:test';
import { parseGlobalFlags, parseUploadFlags } from './flags';

describe('parseGlobalFlags', () => {
  test('parses --quiet flag', () => {
    const result = parseGlobalFlags(['--quiet', 'file.txt']);
    expect(result.quiet).toBe(true);
  });

  test('parses -q shorthand', () => {
    const result = parseGlobalFlags(['-q', 'file.txt']);
    expect(result.quiet).toBe(true);
  });

  test('parses --ci flag', () => {
    const result = parseGlobalFlags(['--ci', 'file.txt']);
    expect(result.ci).toBe(true);
  });

  test('returns remaining args', () => {
    const result = parseGlobalFlags(['--quiet', '--ci', 'file.txt', 'file2.txt']);
    expect(result.args).toEqual(['file.txt', 'file2.txt']);
  });

  test('handles no flags', () => {
    const result = parseGlobalFlags(['file.txt']);
    expect(result.quiet).toBe(false);
    expect(result.ci).toBe(false);
    expect(result.args).toEqual(['file.txt']);
  });

  test('passes through command-specific flags', () => {
    const result = parseGlobalFlags(['prune', 'backups/', '--keep-last', '7', '--quiet']);
    expect(result.quiet).toBe(true);
    expect(result.args).toEqual(['prune', 'backups/', '--keep-last', '7']);
  });
});

describe('parseUploadFlags', () => {
  test('parses --prefix', () => {
    const result = parseUploadFlags(['--prefix', 'backups/daily', 'file.txt']);
    expect(result.prefix).toBe('backups/daily');
  });

  test('parses --compression', () => {
    const result = parseUploadFlags(['--compression', '9', 'dir/']);
    expect(result.compression).toBe(9);
  });

  test('parses --as', () => {
    const result = parseUploadFlags(['--as', 'backup.tar.gz', 'dir/']);
    expect(result.as).toBe('backup.tar.gz');
  });

  test('parses --fast and --slow', () => {
    expect(parseUploadFlags(['--fast', 'file.txt']).fast).toBe(true);
    expect(parseUploadFlags(['-f', 'file.txt']).fast).toBe(true);
    expect(parseUploadFlags(['--slow', 'file.txt']).slow).toBe(true);
    expect(parseUploadFlags(['-s', 'file.txt']).slow).toBe(true);
  });

  test('returns remaining paths', () => {
    const result = parseUploadFlags(['--prefix', 'x', 'a.txt', 'b.txt']);
    expect(result.paths).toEqual(['a.txt', 'b.txt']);
  });

  test('defaults compression to 6', () => {
    const result = parseUploadFlags(['file.txt']);
    expect(result.compression).toBe(6);
  });
});
