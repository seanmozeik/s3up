// src/lib/state.ts
// Manages .s3up state files for resumable uploads

import path from "path";

export interface CompletedPart {
	partNumber: number;
	etag: string;
}

export interface UploadState {
	version: 1;
	uploadId: string;
	bucket: string;
	key: string;
	fileSize: number;
	fileModified: number;
	chunkSize: number;
	totalParts: number;
	completedParts: CompletedPart[];
	createdAt: number;
	provider: string;
	endpoint: string;
}

/**
 * Get the state file path for a given file
 */
export function getStateFilePath(filePath: string): string {
	const dir = path.dirname(filePath);
	const name = path.basename(filePath);
	return path.join(dir, `.${name}.s3up`);
}

/**
 * Load state from file, returns null if not found or invalid
 */
export async function loadState(filePath: string): Promise<UploadState | null> {
	const stateFile = getStateFilePath(filePath);
	const file = Bun.file(stateFile);

	if (!(await file.exists())) {
		return null;
	}

	try {
		const content = await file.text();
		const state = JSON.parse(content) as UploadState;

		// Validate version
		if (state.version !== 1) {
			return null;
		}

		return state;
	} catch {
		// Corrupted state file
		return null;
	}
}

/**
 * Save state to file
 */
export async function saveState(
	filePath: string,
	state: UploadState,
): Promise<void> {
	const stateFile = getStateFilePath(filePath);
	await Bun.write(stateFile, JSON.stringify(state, null, 2));
}

/**
 * Delete state file
 */
export async function deleteState(filePath: string): Promise<void> {
	const stateFile = getStateFilePath(filePath);
	const file = Bun.file(stateFile);

	if (await file.exists()) {
		await Bun.write(stateFile, ""); // Clear content
		const fs = await import("fs/promises");
		await fs.unlink(stateFile);
	}
}

/**
 * Add a completed part to state and save
 */
export async function addCompletedPart(
	filePath: string,
	state: UploadState,
	part: CompletedPart,
): Promise<void> {
	// Check if part already exists
	const existing = state.completedParts.findIndex(
		(p) => p.partNumber === part.partNumber,
	);
	if (existing >= 0) {
		state.completedParts[existing] = part;
	} else {
		state.completedParts.push(part);
	}

	// Keep sorted by part number
	state.completedParts.sort((a, b) => a.partNumber - b.partNumber);

	await saveState(filePath, state);
}

/**
 * Check if file has changed since state was created
 */
export async function hasFileChanged(
	filePath: string,
	state: UploadState,
): Promise<boolean> {
	const file = Bun.file(filePath);
	const stat = await file.stat();

	return (
		file.size !== state.fileSize || stat.mtime.getTime() !== state.fileModified
	);
}

/**
 * Create initial state for a new upload
 */
export function createInitialState(
	uploadId: string,
	bucket: string,
	key: string,
	fileSize: number,
	fileModified: number,
	chunkSize: number,
	provider: string,
	endpoint: string,
): UploadState {
	const totalParts = Math.ceil(fileSize / chunkSize);

	return {
		version: 1,
		uploadId,
		bucket,
		key,
		fileSize,
		fileModified,
		chunkSize,
		totalParts,
		completedParts: [],
		createdAt: Date.now(),
		provider,
		endpoint,
	};
}
