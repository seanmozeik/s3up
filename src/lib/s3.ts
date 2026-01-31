// src/lib/s3.ts
import { S3Client } from 'bun';
import { getEndpoint, type S3Config } from './providers';

export interface S3Object {
  key: string;
  size: number;
  lastModified: Date;
  etag?: string;
}

export interface ListResult {
  objects: S3Object[];
  isTruncated: boolean;
  nextContinuationToken?: string;
}

export function createS3Client(config: S3Config): S3Client {
  return new S3Client({
    accessKeyId: config.accessKeyId,
    bucket: config.bucket,
    endpoint: getEndpoint(config),
    secretAccessKey: config.secretAccessKey
  });
}

export async function listObjects(
  client: S3Client,
  prefix?: string,
  maxKeys = 1000
): Promise<ListResult> {
  const result = await client.list({
    maxKeys,
    prefix
  });

  const objects: S3Object[] = (result.contents ?? []).map((item) => ({
    etag: item.eTag,
    key: item.key,
    lastModified: new Date(item.lastModified ?? Date.now()),
    size: item.size ?? 0
  }));

  return {
    isTruncated: result.isTruncated ?? false,
    nextContinuationToken: result.nextContinuationToken,
    objects
  };
}

export async function listAllObjects(client: S3Client, prefix?: string): Promise<S3Object[]> {
  const allObjects: S3Object[] = [];
  let continuationToken: string | undefined;
  let hasMore = true;

  while (hasMore) {
    const result = await client.list({
      maxKeys: 1000,
      prefix,
      startAfter: continuationToken
    });

    const objects: S3Object[] = (result.contents ?? []).map((item) => ({
      etag: item.eTag,
      key: item.key,
      lastModified: new Date(item.lastModified ?? Date.now()),
      size: item.size ?? 0
    }));

    allObjects.push(...objects);

    if (result.isTruncated && objects.length > 0) {
      continuationToken = objects[objects.length - 1].key;
    } else {
      hasMore = false;
    }
  }

  return allObjects;
}

export async function deleteObject(client: S3Client, key: string): Promise<void> {
  await client.delete(key);
}

export async function deleteObjects(
  client: S3Client,
  keys: string[]
): Promise<{ deleted: number; errors: string[] }> {
  const errors: string[] = [];
  let deleted = 0;

  for (const key of keys) {
    try {
      await client.delete(key);
      deleted++;
    } catch (err) {
      errors.push(`${key}: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  return { deleted, errors };
}

export function parseAge(age: string): number {
  if (age === '0') return 0;

  const match = age.match(/^(\d+)([dhm])?$/);
  if (!match) return 0;

  const value = parseInt(match[1], 10);
  const unit = match[2] || 'd';

  switch (unit) {
    case 'd':
      return value * 24 * 60 * 60 * 1000;
    case 'h':
      return value * 60 * 60 * 1000;
    case 'm':
      return value * 60 * 1000;
    default:
      return value * 24 * 60 * 60 * 1000;
  }
}
