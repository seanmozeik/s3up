// src/lib/multipart.ts
// S3 Multipart Upload orchestrator

import {
  createProgressState,
  finishProgress,
  type ProgressState,
  updateProgress,
  writeProgress
} from './progress-bar';
import type { S3Config } from './providers';
import { getEndpoint } from './providers';
import { type AwsCredentials, getRegionForSigning, signRequest } from './signing';
import {
  addCompletedPart,
  type CompletedPart,
  createInitialState,
  deleteState,
  hasFileChanged,
  loadState,
  saveState,
  type UploadState
} from './state';

export interface MultipartOptions {
  chunkSize: number;
  connections: number;
}

interface MultipartUploadResult {
  success: true;
  publicUrl: string;
}

interface MultipartUploadError {
  success: false;
  error: string;
}

export type MultipartOutcome = MultipartUploadResult | MultipartUploadError;

// Track abort state for graceful shutdown
let abortController: AbortController | null = null;
let isAborting = false;

/**
 * Get AWS credentials from S3Config
 */
function getCredentials(config: S3Config): AwsCredentials {
  return {
    accessKeyId: config.accessKeyId,
    region: getRegionForSigning(config.provider, config.region),
    secretAccessKey: config.secretAccessKey
  };
}

/**
 * Initiate a multipart upload
 */
async function initiateMultipartUpload(config: S3Config, key: string): Promise<string> {
  const endpoint = getEndpoint(config);
  const url = `${endpoint}/${config.bucket}/${encodeURIComponent(key)}?uploads`;
  const credentials = getCredentials(config);

  const signed = signRequest(
    'POST',
    url,
    {
      'content-type': 'application/octet-stream'
    },
    '',
    credentials
  );

  const response = await fetch(signed.url, {
    headers: signed.headers,
    method: signed.method
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to initiate multipart upload: ${response.status} ${text}`);
  }

  const xml = await response.text();
  const match = xml.match(/<UploadId>([^<]+)<\/UploadId>/);
  if (!match) {
    throw new Error('No UploadId in response');
  }

  return match[1];
}

/**
 * Upload a single part
 */
async function uploadPart(
  config: S3Config,
  key: string,
  uploadId: string,
  partNumber: number,
  body: Uint8Array,
  signal?: AbortSignal
): Promise<CompletedPart> {
  const endpoint = getEndpoint(config);
  const url = `${endpoint}/${config.bucket}/${encodeURIComponent(key)}?partNumber=${partNumber}&uploadId=${encodeURIComponent(uploadId)}`;
  const credentials = getCredentials(config);

  // Include content-type for R2 compatibility
  const signed = signRequest(
    'PUT',
    url,
    { 'content-type': 'application/octet-stream' },
    body,
    credentials
  );

  const response = await fetch(signed.url, {
    body: Buffer.from(body),
    headers: signed.headers,
    method: signed.method,
    signal
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to upload part ${partNumber}: ${response.status} ${text}`);
  }

  const etag = response.headers.get('etag');
  if (!etag) {
    throw new Error(`No ETag for part ${partNumber}`);
  }

  return { etag, partNumber };
}

/**
 * Complete the multipart upload
 */
async function completeMultipartUpload(
  config: S3Config,
  key: string,
  uploadId: string,
  parts: CompletedPart[]
): Promise<void> {
  const endpoint = getEndpoint(config);
  const url = `${endpoint}/${config.bucket}/${encodeURIComponent(key)}?uploadId=${encodeURIComponent(uploadId)}`;
  const credentials = getCredentials(config);

  // Build completion XML
  const partsXml = parts
    .sort((a, b) => a.partNumber - b.partNumber)
    .map((p) => `<Part><PartNumber>${p.partNumber}</PartNumber><ETag>${p.etag}</ETag></Part>`)
    .join('');
  const body = `<?xml version="1.0" encoding="UTF-8"?><CompleteMultipartUpload>${partsXml}</CompleteMultipartUpload>`;

  const signed = signRequest(
    'POST',
    url,
    {
      'content-type': 'application/xml'
    },
    body,
    credentials
  );

  const response = await fetch(signed.url, {
    body,
    headers: signed.headers,
    method: signed.method
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(`Failed to complete multipart upload: ${response.status} ${text}`);
  }
}

/**
 * Abort a multipart upload
 */
async function abortMultipartUpload(
  config: S3Config,
  key: string,
  uploadId: string
): Promise<void> {
  const endpoint = getEndpoint(config);
  const url = `${endpoint}/${config.bucket}/${encodeURIComponent(key)}?uploadId=${encodeURIComponent(uploadId)}`;
  const credentials = getCredentials(config);

  const signed = signRequest('DELETE', url, {}, null, credentials);

  try {
    const response = await fetch(signed.url, {
      headers: signed.headers,
      method: signed.method
    });

    // 204 or 404 are both acceptable
    if (!response.ok && response.status !== 404) {
      console.warn(`Warning: Failed to abort upload: ${response.status}`);
    }
  } catch {
    // Ignore abort errors
  }
}

/**
 * List parts for an existing upload (to verify state)
 */
async function listParts(
  config: S3Config,
  key: string,
  uploadId: string
): Promise<CompletedPart[]> {
  const endpoint = getEndpoint(config);
  const url = `${endpoint}/${config.bucket}/${encodeURIComponent(key)}?uploadId=${encodeURIComponent(uploadId)}`;
  const credentials = getCredentials(config);

  const signed = signRequest('GET', url, {}, null, credentials);

  const response = await fetch(signed.url, {
    headers: signed.headers,
    method: signed.method
  });

  if (!response.ok) {
    if (response.status === 404) {
      return []; // Upload expired or doesn't exist
    }
    throw new Error(`Failed to list parts: ${response.status}`);
  }

  const xml = await response.text();
  const parts: CompletedPart[] = [];

  // Parse parts from XML
  const partMatches = xml.matchAll(
    /<Part>[\s\S]*?<PartNumber>(\d+)<\/PartNumber>[\s\S]*?<ETag>([^<]+)<\/ETag>[\s\S]*?<\/Part>/g
  );
  for (const match of partMatches) {
    parts.push({
      etag: match[2],
      partNumber: parseInt(match[1], 10)
    });
  }

  return parts;
}

/**
 * Run parallel part uploads with concurrency limit
 */
async function uploadPartsInParallel(
  config: S3Config,
  filePath: string,
  state: UploadState,
  progress: ProgressState,
  connections: number
): Promise<CompletedPart[]> {
  const file = Bun.file(filePath);
  const completedPartNumbers = new Set(state.completedParts.map((p) => p.partNumber));
  const pendingParts: number[] = [];

  // Build list of parts to upload
  for (let i = 1; i <= state.totalParts; i++) {
    if (!completedPartNumbers.has(i)) {
      pendingParts.push(i);
    }
  }

  // Update progress with already completed parts
  progress.completedParts = state.completedParts.length;
  progress.bytesUploaded = state.completedParts.reduce((sum, p) => {
    const partSize =
      p.partNumber < state.totalParts
        ? state.chunkSize
        : state.fileSize - (state.totalParts - 1) * state.chunkSize;
    return sum + partSize;
  }, 0);

  const allParts = [...state.completedParts];
  const executing = new Set<Promise<void>>();

  abortController = new AbortController();

  for (const partNumber of pendingParts) {
    if (isAborting) break;

    const start = (partNumber - 1) * state.chunkSize;
    const end = Math.min(start + state.chunkSize, state.fileSize);
    const partSize = end - start;

    const uploadPromise = (async () => {
      try {
        // Read chunk from file
        const chunk = await file.slice(start, end).arrayBuffer();
        const body = new Uint8Array(chunk);

        // Upload part
        const part = await uploadPart(
          config,
          state.key,
          state.uploadId,
          partNumber,
          body,
          abortController?.signal
        );

        // Save to state immediately
        await addCompletedPart(filePath, state, part);
        allParts.push(part);

        // Update progress
        updateProgress(progress, partSize);
        writeProgress(progress);
      } catch (err) {
        if (!isAborting) {
          throw err;
        }
      }
    })();

    executing.add(uploadPromise);
    uploadPromise.finally(() => executing.delete(uploadPromise));

    // Limit concurrency
    if (executing.size >= connections) {
      await Promise.race(executing);
    }
  }

  // Wait for remaining uploads
  await Promise.all(executing);

  return allParts;
}

/**
 * Setup SIGINT handler for graceful abort
 */
export function setupAbortHandler(_filePath: string, state: UploadState | null): void {
  const handler = async () => {
    if (isAborting) {
      process.exit(1);
    }

    isAborting = true;
    console.log('\n\nInterrupted! Saving progress...');

    if (abortController) {
      abortController.abort();
    }

    // Wait a moment for in-flight requests
    await new Promise((r) => setTimeout(r, 1000));

    if (state) {
      console.log(`Upload paused at ${state.completedParts.length}/${state.totalParts} parts.`);
      console.log('Run the same command to resume.');
    }

    process.exit(0);
  };

  process.on('SIGINT', handler);
}

/**
 * Main multipart upload function
 */
export async function uploadMultipart(
  filePath: string,
  config: S3Config,
  key: string,
  options: MultipartOptions
): Promise<MultipartOutcome> {
  const file = Bun.file(filePath);
  const stat = await file.stat();
  const fileSize = file.size;
  const fileModified = stat.mtime.getTime();
  const endpoint = getEndpoint(config);

  let state = await loadState(filePath);

  // Check if we can resume
  if (state) {
    // Check if file changed
    if (await hasFileChanged(filePath, state)) {
      state = null; // Force fresh start
    }
  }

  // Initialize progress
  const totalParts = Math.ceil(fileSize / options.chunkSize);
  const progress = createProgressState(key, totalParts, fileSize);

  try {
    if (!state) {
      // Start new upload
      const uploadId = await initiateMultipartUpload(config, key);
      state = createInitialState(
        uploadId,
        config.bucket,
        key,
        fileSize,
        fileModified,
        options.chunkSize,
        config.provider,
        endpoint
      );
      await saveState(filePath, state);
    } else {
      // Resuming - verify parts still exist on S3
      const remoteParts = await listParts(config, key, state.uploadId);
      if (remoteParts.length === 0 && state.completedParts.length > 0) {
        // Upload expired, start fresh
        await deleteState(filePath);
        const uploadId = await initiateMultipartUpload(config, key);
        state = createInitialState(
          uploadId,
          config.bucket,
          key,
          fileSize,
          fileModified,
          options.chunkSize,
          config.provider,
          endpoint
        );
        await saveState(filePath, state);
      }
    }

    // Setup abort handler
    setupAbortHandler(filePath, state);

    // Show initial progress bar
    writeProgress(progress);

    // Upload all parts
    const allParts = await uploadPartsInParallel(
      config,
      filePath,
      state,
      progress,
      options.connections
    );

    if (isAborting) {
      return { error: 'Upload interrupted', success: false };
    }

    finishProgress();

    // Complete the upload
    await completeMultipartUpload(config, key, state.uploadId, allParts);

    // Clean up state file
    await deleteState(filePath);

    const publicUrl = `${config.publicUrlBase}/${key}`;
    return { publicUrl, success: true };
  } catch (err) {
    finishProgress();
    return {
      error: err instanceof Error ? err.message : String(err),
      success: false
    };
  }
}

/**
 * Check if there's a resumable upload and prompt user
 */
export async function checkResumableUpload(filePath: string): Promise<{
  canResume: boolean;
  state: UploadState | null;
  percentComplete: number;
}> {
  const state = await loadState(filePath);

  if (!state) {
    return { canResume: false, percentComplete: 0, state: null };
  }

  // Check if file has changed
  if (await hasFileChanged(filePath, state)) {
    return { canResume: false, percentComplete: 0, state };
  }

  const percentComplete = Math.round((state.completedParts.length / state.totalParts) * 100);

  return { canResume: true, percentComplete, state };
}

/**
 * Abort and clean up an existing upload
 */
export async function cleanupExistingUpload(filePath: string, config: S3Config): Promise<void> {
  const state = await loadState(filePath);

  if (state) {
    await abortMultipartUpload(config, state.key, state.uploadId);
    await deleteState(filePath);
  }
}
