#!/usr/bin/env bun

import * as p from "@clack/prompts";
import boxen from "boxen";
import path from "path";
import pkg from "../package.json" with { type: "json" };

// UI modules
import { showBanner } from "./ui/banner.js";
import { setup } from "./ui/setup.js";
import { frappe, theme, boxColors } from "./ui/theme.js";

// Lib modules
import { copyToClipboard } from "./lib/clipboard.js";
import {
	deleteConfig,
	loadConfig,
	PROVIDERS,
	type S3Config,
} from "./lib/providers.js";
import {
	formatBytes,
	renderProgress,
	runWithConcurrency,
	uploadFile,
	type UploadOutcome,
	type UploadProgress,
	type UploadResult,
	type UploadError,
} from "./lib/upload.js";
import {
	uploadMultipart,
	checkResumableUpload,
	cleanupExistingUpload,
	type MultipartOptions,
} from "./lib/multipart";

// Constants
const MULTIPART_THRESHOLD = 100 * 1024 * 1024; // 100MB

// Speed presets
export const SPEED_PRESETS = {
	fast: { chunkSize: 5 * 1024 * 1024, connections: 16 },
	default: { chunkSize: 25 * 1024 * 1024, connections: 8 },
	slow: { chunkSize: 50 * 1024 * 1024, connections: 4 },
} as const;

export type SpeedPreset = keyof typeof SPEED_PRESETS;

export interface UploadOptions {
	chunkSize: number;
	connections: number;
}

function parseFlags(args: string[]): {
	flags: { fast: boolean; slow: boolean; help: boolean; version: boolean };
	files: string[];
} {
	const flags = {
		fast: args.includes("-f") || args.includes("--fast"),
		slow: args.includes("-s") || args.includes("--slow"),
		help: args.includes("-h") || args.includes("--help"),
		version: args.includes("-v") || args.includes("--version"),
	};
	const files = args.filter((a) => !a.startsWith("-"));
	return { flags, files };
}

function getUploadOptions(flags: {
	fast: boolean;
	slow: boolean;
}): UploadOptions {
	if (flags.fast) return SPEED_PRESETS.fast;
	if (flags.slow) return SPEED_PRESETS.slow;
	return SPEED_PRESETS.default;
}

// ─────────────────────────────────────────────────────────────────────────────
// Teardown Command
// ─────────────────────────────────────────────────────────────────────────────

async function teardown(): Promise<void> {
	await showBanner();
	p.intro(frappe.text("Remove stored credentials"));

	const confirm = await p.confirm({
		message: "Remove all stored S3 credentials?",
	});

	if (p.isCancel(confirm) || !confirm) {
		p.outro(frappe.subtext1("Cancelled"));
		process.exit(0);
	}

	const s = p.spinner();
	s.start("Removing credentials...");

	try {
		const removed = await deleteConfig();
		s.stop(theme.success(`Removed ${removed} credential(s)`));
		p.outro(frappe.subtext1("Done"));
	} catch (err) {
		s.stop(theme.error("Failed to remove credentials"));
		p.log.error(err instanceof Error ? err.message : String(err));
		process.exit(1);
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// Display Results
// ─────────────────────────────────────────────────────────────────────────────

function displayResults(results: UploadOutcome[]): void {
	const successes = results.filter((r): r is UploadResult => r.success);
	const failures = results.filter((r): r is UploadError => !r.success);

	if (successes.length > 0) {
		const content = successes
			.map(
				(r) =>
					`${theme.success("✓")} ${frappe.text(r.filename)} ${theme.dim(`(${formatBytes(r.size)})`)}\n  ${theme.link(r.publicUrl)}`,
			)
			.join("\n\n");

		const box = boxen(content, {
			borderColor: boxColors.success,
			borderStyle: "round",
			padding: { top: 0, bottom: 0, left: 1, right: 1 },
			title: `Uploaded ${successes.length} file${successes.length > 1 ? "s" : ""}`,
			titleAlignment: "left",
		});
		console.log(box);
	}

	if (failures.length > 0) {
		for (const f of failures) {
			p.log.error(`${f.filename}: ${f.error}`);
		}
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// Upload Command
// ─────────────────────────────────────────────────────────────────────────────

async function uploadFiles(
	filePaths: string[],
	options: UploadOptions,
): Promise<void> {
	// Load config first (before banner for fire-and-forget)
	const config = await loadConfig();
	if (!config) {
		await showBanner();
		p.log.error("S3 not configured. Run: s3up setup");
		process.exit(1);
	}

	const providerInfo = PROVIDERS[config.provider];

	// Validate files exist
	const validFiles: { path: string; name: string; size: number }[] = [];
	const invalidFiles: string[] = [];

	for (const filePath of filePaths) {
		const absolutePath = path.isAbsolute(filePath)
			? filePath
			: path.join(process.cwd(), filePath);

		const file = Bun.file(absolutePath);
		const exists = await file.exists();

		if (exists) {
			validFiles.push({
				path: absolutePath,
				name: path.basename(absolutePath),
				size: file.size,
			});
		} else {
			invalidFiles.push(filePath);
		}
	}

	// Show banner
	await showBanner();

	// Report invalid files
	if (invalidFiles.length > 0) {
		for (const f of invalidFiles) {
			p.log.warn(`File not found: ${f}`);
		}
	}

	if (validFiles.length === 0) {
		p.outro(theme.error("No valid files to upload"));
		process.exit(1);
	}

	// Separate large and small files
	const largeFiles = validFiles.filter((f) => f.size >= MULTIPART_THRESHOLD);
	const smallFiles = validFiles.filter((f) => f.size < MULTIPART_THRESHOLD);

	const totalSize = validFiles.reduce((sum, f) => sum + f.size, 0);
	p.intro(
		frappe.text(
			`Uploading ${validFiles.length} file${validFiles.length > 1 ? "s" : ""} to ${providerInfo.name} (${formatBytes(totalSize)})`,
		),
	);

	const results: UploadOutcome[] = [];

	// Handle large files first (one at a time for clear progress)
	for (const file of largeFiles) {
		// Check for resumable upload
		const { canResume, percentComplete } = await checkResumableUpload(
			file.path,
		);

		if (canResume) {
			const resume = await p.confirm({
				message: `Resume incomplete upload of ${file.name}? (${percentComplete}% done)`,
			});

			if (p.isCancel(resume)) {
				p.outro(frappe.subtext1("Cancelled"));
				process.exit(0);
			}

			if (!resume) {
				// User chose to start fresh
				await cleanupExistingUpload(file.path, config);
			}
		}

		console.log(
			frappe.text(`\nUploading ${file.name} (${formatBytes(file.size)})...`),
		);

		const multipartOptions: MultipartOptions = {
			chunkSize: options.chunkSize,
			connections: options.connections,
		};

		const result = await uploadMultipart(
			file.path,
			config,
			file.name,
			multipartOptions,
		);

		if (result.success) {
			results.push({
				filename: file.name,
				size: file.size,
				publicUrl: result.publicUrl,
				success: true,
			});
		} else {
			results.push({
				filename: file.name,
				error: result.error,
				success: false,
			});
		}
	}

	// Handle small files (concurrent, existing behavior)
	if (smallFiles.length > 0) {
		const progress: UploadProgress = {
			activeFiles: new Set(),
			completed: 0,
			total: smallFiles.length,
		};

		const spinner = p.spinner();
		spinner.start(renderProgress(progress));

		const smallResults = await runWithConcurrency(
			smallFiles,
			options.connections,
			async (file) => {
				progress.activeFiles.add(file.name);
				spinner.message(renderProgress(progress));

				const result = await uploadFile(file, config);

				progress.activeFiles.delete(file.name);
				progress.completed++;
				spinner.message(renderProgress(progress));

				return result;
			},
		);

		spinner.stop(
			theme.success(`Uploaded ${progress.completed}/${progress.total} files`),
		);

		results.push(...smallResults);
	}

	console.log();
	displayResults(results);

	// Copy URLs to clipboard
	const urls = results
		.filter((r): r is UploadResult => r.success)
		.map((r) => r.publicUrl);
	if (urls.length > 0) {
		const copied = await copyToClipboard(urls.join("\n"));
		if (copied) {
			p.log.success(
				urls.length === 1
					? "Copied URL to clipboard"
					: `Copied ${urls.length} URLs to clipboard`,
			);
		}
	}

	const successCount = results.filter((r) => r.success).length;
	const failCount = results.filter((r) => !r.success).length;

	if (failCount === 0) {
		p.outro(theme.success("All files uploaded successfully!"));
	} else if (successCount > 0) {
		p.outro(theme.warning(`${successCount} uploaded, ${failCount} failed`));
		process.exit(1);
	} else {
		p.outro(theme.error("All uploads failed"));
		process.exit(1);
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// Help
// ─────────────────────────────────────────────────────────────────────────────

async function showHelp(): Promise<void> {
	await showBanner();
	console.log(frappe.text("Usage:"));
	console.log(
		`  ${theme.accent("s3up")} ${theme.dim("[options]")} ${frappe.text("<files...>")}    Upload files`,
	);
	console.log(
		`  ${theme.accent("s3up setup")}                        Configure credentials`,
	);
	console.log(
		`  ${theme.accent("s3up teardown")}                     Remove credentials`,
	);
	console.log();
	console.log(frappe.text("Options:"));
	console.log(
		`  ${theme.accent("-f, --fast")}     5MB chunks, 16 connections (fast network)`,
	);
	console.log(
		`  ${theme.accent("-s, --slow")}     50MB chunks, 4 connections (unstable network)`,
	);
	console.log(`  ${theme.accent("-h, --help")}     Show this help message`);
	console.log(`  ${theme.accent("-v, --version")}  Show version number`);
	console.log();
	console.log(frappe.text("Examples:"));
	console.log(
		`  ${theme.dim("s3up image.png")}              Upload single file`,
	);
	console.log(
		`  ${theme.dim("s3up *.png")}                  Upload multiple files`,
	);
	console.log(
		`  ${theme.dim("s3up video.mp4 -f")}           Upload large file (fast mode)`,
	);
	console.log(
		`  ${theme.dim("s3up backup.tar.gz -s")}       Upload on slow connection`,
	);
	console.log();
	console.log(
		frappe.subtext0("Files ≥100MB automatically use chunked parallel upload."),
	);
	console.log();
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
	const args = Bun.argv.slice(2);
	const command = args[0];

	// Handle --version anywhere
	if (args.includes("-v") || args.includes("--version")) {
		console.log(`s3up v${pkg.version}`);
		process.exit(0);
	}

	// Handle --help anywhere
	if (args.includes("-h") || args.includes("--help")) {
		await showHelp();
		process.exit(0);
	}

	if (command === "setup") {
		await setup();
	} else if (command === "teardown") {
		await teardown();
	} else if (!command) {
		await showHelp();
	} else {
		const { flags, files } = parseFlags(args);
		const options = getUploadOptions(flags);
		await uploadFiles(files, options);
	}
}

main().catch((err) => {
	console.error(theme.error(err instanceof Error ? err.message : String(err)));
	process.exit(1);
});
