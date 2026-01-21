// src/lib/upload.ts
import type { S3Config } from "./providers.js";
import { getEndpoint } from "./providers.js";

export interface UploadResult {
	filename: string;
	size: number;
	publicUrl: string;
	success: true;
}

export interface UploadError {
	filename: string;
	error: string;
	success: false;
}

export type UploadOutcome = UploadResult | UploadError;

export interface UploadProgress {
	activeFiles: Set<string>;
	completed: number;
	total: number;
}

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes: number): string {
	if (bytes === 0) return "0 B";
	const k = 1024;
	const sizes = ["B", "KB", "MB", "GB"];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

/**
 * Render progress string for spinner
 */
export function renderProgress(progress: UploadProgress): string {
	if (progress.activeFiles.size === 0) {
		return `Uploaded ${progress.completed}/${progress.total} files`;
	}
	const active = [...progress.activeFiles].join(", ");
	return `[${progress.completed}/${progress.total}] ${active}`;
}

/**
 * Concurrency-limited parallel execution
 */
export async function runWithConcurrency<T, R>(
	items: T[],
	limit: number,
	fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
	const results: R[] = new Array(items.length);
	const executing = new Set<Promise<void>>();
	let currentIndex = 0;

	for (const item of items) {
		const index = currentIndex++;
		const promise = fn(item, index).then((result) => {
			results[index] = result;
			executing.delete(promise);
		});
		executing.add(promise);

		if (executing.size >= limit) {
			await Promise.race(executing);
		}
	}

	await Promise.all(executing);
	return results;
}

/**
 * Upload a single file to S3
 */
export async function uploadFile(
	file: { path: string; name: string; size: number },
	config: S3Config,
): Promise<UploadOutcome> {
	try {
		const fileContent = Bun.file(file.path);
		const endpoint = getEndpoint(config);

		const response = await fetch(`s3://${config.bucket}/${file.name}`, {
			method: "PUT",
			body: fileContent.stream(),
			headers: {
				"Content-Disposition": "attachment",
			},
			s3: {
				accessKeyId: config.accessKeyId,
				secretAccessKey: config.secretAccessKey,
				endpoint,
			},
		});

		if (!response.ok) {
			throw new Error(
				`Upload failed: ${response.status} ${response.statusText}`,
			);
		}

		const publicUrl = `${config.publicUrlBase}/${file.name}`;

		return {
			filename: file.name,
			size: file.size,
			publicUrl,
			success: true,
		};
	} catch (err) {
		return {
			filename: file.name,
			error: err instanceof Error ? err.message : String(err),
			success: false,
		};
	}
}
