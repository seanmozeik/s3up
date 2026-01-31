// src/lib/s3.test.ts
import { describe, expect, test } from 'bun:test';
import { createS3Client, parseAge } from './s3';

describe('parseAge', () => {
  test('parses days', () => {
    expect(parseAge('1d')).toBe(24 * 60 * 60 * 1000);
    expect(parseAge('7d')).toBe(7 * 24 * 60 * 60 * 1000);
  });

  test('parses hours', () => {
    expect(parseAge('12h')).toBe(12 * 60 * 60 * 1000);
  });

  test('parses minutes', () => {
    expect(parseAge('30m')).toBe(30 * 60 * 1000);
  });

  test('parses zero', () => {
    expect(parseAge('0')).toBe(0);
  });

  test('defaults to days if no unit', () => {
    expect(parseAge('5')).toBe(5 * 24 * 60 * 60 * 1000);
  });
});

describe('createS3Client', () => {
  test('creates client from config', () => {
    const config = {
      accessKeyId: 'test-key',
      bucket: 'test-bucket',
      provider: 'aws' as const,
      publicUrlBase: 'https://cdn.example.com',
      region: 'us-east-1',
      secretAccessKey: 'test-secret'
    };

    const client = createS3Client(config);
    expect(client).toBeDefined();
  });
});
