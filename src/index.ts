#!/usr/bin/env bun

import * as p from "@clack/prompts";
import boxen from "boxen";
import path from "path";

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

// Constants
const DEFAULT_CONCURRENCY = 5;

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

async function uploadFiles(filePaths: string[]): Promise<void> {
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

	// Fire off uploads immediately (fire-and-forget start)
	const progress: UploadProgress = {
		activeFiles: new Set(),
		completed: 0,
		total: validFiles.length,
	};

	let spinner: ReturnType<typeof p.spinner> | null = null;

	const uploadPromise =
		validFiles.length > 0
			? runWithConcurrency(validFiles, DEFAULT_CONCURRENCY, async (file) => {
					progress.activeFiles.add(file.name);
					spinner?.message(renderProgress(progress));

					const result = await uploadFile(file, config);

					progress.activeFiles.delete(file.name);
					progress.completed++;
					spinner?.message(renderProgress(progress));

					return result;
				})
			: Promise.resolve([]);

	// Show banner while uploads already running
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

	// Show upload progress
	const totalSize = validFiles.reduce((sum, f) => sum + f.size, 0);
	p.intro(
		frappe.text(
			`Uploading ${validFiles.length} file${validFiles.length > 1 ? "s" : ""} to ${providerInfo.name} (${formatBytes(totalSize)})`,
		),
	);

	spinner = p.spinner();
	spinner.start(renderProgress(progress));

	// Wait for uploads to complete
	const results = await uploadPromise;

	spinner.stop(
		theme.success(`Uploaded ${progress.completed}/${progress.total} files`),
	);

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
		`  ${theme.accent("s3up setup")}         Configure S3 credentials`,
	);
	console.log(
		`  ${theme.accent("s3up teardown")}      Remove stored credentials`,
	);
	console.log(`  ${theme.accent("s3up <files...>")}    Upload files to S3`);
	console.log();
	console.log(frappe.text("Supported providers:"));
	for (const [key, info] of Object.entries(PROVIDERS)) {
		console.log(`  ${theme.dim(key.padEnd(12))} ${frappe.subtext1(info.name)}`);
	}
	console.log();
	console.log(frappe.text("Examples:"));
	console.log(
		`  ${theme.dim("s3up image.png")}                  Upload single file`,
	);
	console.log(
		`  ${theme.dim("s3up *.png")}                      Upload multiple files`,
	);
	console.log(
		`  ${theme.dim("s3up docs/report.pdf assets/*")}   Upload from paths`,
	);
	console.log();
}

// ─────────────────────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────────────────────

async function main() {
	const args = Bun.argv.slice(2);
	const command = args[0];

	if (command === "setup") {
		await setup();
	} else if (command === "teardown") {
		await teardown();
	} else if (command === "--help" || command === "-h" || !command) {
		await showHelp();
	} else {
		await uploadFiles(args);
	}
}

main().catch((err) => {
	console.error(theme.error(err instanceof Error ? err.message : String(err)));
	process.exit(1);
});
