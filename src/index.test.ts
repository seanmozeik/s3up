// src/index.test.ts
import { describe, expect, test } from 'bun:test';
import { $ } from 'bun';

describe('s3up CLI', () => {
  test('--version shows version', async () => {
    const result = await $`bun run src/index.ts --version`.text();
    expect(result).toMatch(/^s3up v\d+\.\d+\.\d+/);
  });

  test('--help shows help', async () => {
    const result = await $`bun run src/index.ts --help`.text();
    expect(result).toContain('Usage:');
    expect(result).toContain('upload');
    expect(result).toContain('list');
    expect(result).toContain('prune');
  });

  test('-h shows help', async () => {
    const result = await $`bun run src/index.ts -h`.text();
    expect(result).toContain('Usage:');
  });

  test('-v shows version', async () => {
    const result = await $`bun run src/index.ts -v`.text();
    expect(result).toMatch(/^s3up v\d+\.\d+\.\d+/);
  });

  test('no args shows help', async () => {
    const result = await $`bun run src/index.ts`.text();
    expect(result).toContain('Usage:');
  });
});

describe('s3up upload validation', () => {
  test('exits with error when file not found', async () => {
    const proc = $`bun run src/index.ts upload nonexistent-file-12345.txt --ci`.nothrow();
    const result = await proc;
    // Should fail with exit code 1 (no valid files)
    expect(result.exitCode).toBe(1);
  });
});

describe('s3up prune validation', () => {
  test('requires at least one filter', async () => {
    const proc = $`bun run src/index.ts prune backups/`.nothrow();
    const result = await proc;
    expect(result.exitCode).toBe(1);
    expect(result.stderr.toString()).toContain('--older-than or --keep-last');
  });
});
