#!/usr/bin/env bun

import * as p from "@clack/prompts";
import { S3Client } from "bun";
import boxen from "boxen";
import figlet from "figlet";
import gradient from "gradient-string";
import path from "path";

// Embed font file for Bun standalone executable
// @ts-expect-error - Bun-specific import attribute
import fontPath from "../node_modules/figlet/fonts/ANSI Shadow.flf" with {
	type: "file",
};

// ─────────────────────────────────────────────────────────────────────────────
// Constants
// ─────────────────────────────────────────────────────────────────────────────

const SECRETS_SERVICE = "com.r2up.cli";

// Upload configuration
const DEFAULT_CONCURRENCY = 5; // Default number of parallel uploads

const SECRETS = {
	ACCESS_KEY_ID: "R2UP_ACCESS_KEY_ID",
	SECRET_ACCESS_KEY: "R2UP_SECRET_ACCESS_KEY",
	ACCOUNT_ID: "R2UP_ACCOUNT_ID",
	BUCKET: "R2UP_BUCKET",
	PUBLIC_URL_BASE: "R2UP_PUBLIC_URL_BASE",
} as const;

// ─────────────────────────────────────────────────────────────────────────────
// Theme (Catppuccin Frappe)
// ─────────────────────────────────────────────────────────────────────────────

const palette = {
	mauve: "#ca9ee6",
	pink: "#f4b8e4",
	flamingo: "#eebebe",
	green: "#a6d189",
	red: "#e78284",
	yellow: "#e5c890",
	surface2: "#626880",
};

const ansi = {
	blue: 111,
	green: 150,
	mauve: 183,
	peach: 216,
	pink: 218,
	red: 210,
	surface2: 60,
	subtext1: 146,
	text: 189,
	yellow: 223,
};

function ansiColor(code: number): (text: string) => string {
	return (text: string) => `\x1b[38;5;${code}m${text}\x1b[0m`;
}

const theme = {
	text: ansiColor(ansi.text),
	subtext: ansiColor(ansi.subtext1),
	dim: ansiColor(ansi.surface2),
	success: ansiColor(ansi.green),
	error: ansiColor(ansi.red),
	warning: ansiColor(ansi.yellow),
	info: ansiColor(ansi.blue),
	accent: ansiColor(ansi.mauve),
	link: ansiColor(ansi.peach),
};

const bannerGradient = gradient([
	palette.mauve,
	palette.pink,
	palette.flamingo,
]);

const boxColors = {
	primary: palette.mauve,
	success: palette.green,
	default: palette.surface2,
};

// ─────────────────────────────────────────────────────────────────────────────
// Secret Management
// ─────────────────────────────────────────────────────────────────────────────

async function getSecret(key: string): Promise<string | null> {
	// Check environment variable first
	const envValue = process.env[key];
	if (envValue) return envValue;

	// Try system credential store
	try {
		return await Bun.secrets.get({
			name: key,
			service: SECRETS_SERVICE,
		});
	} catch {
		return null;
	}
}

async function setSecret(key: string, value: string): Promise<void> {
	try {
		await Bun.secrets.set({
			name: key,
			service: SECRETS_SERVICE,
			value,
		});
	} catch (err) {
		const msg = err instanceof Error ? err.message : String(err);
		if (process.platform === "linux" && msg.includes("libsecret")) {
			throw new Error(
				"libsecret not found. Install it with:\n" +
					"  Ubuntu/Debian: sudo apt install libsecret-1-0\n" +
					"  Fedora/RHEL:   sudo dnf install libsecret\n" +
					"  Arch:          sudo pacman -S libsecret\n" +
					"Or use environment variables instead.",
			);
		}
		throw err;
	}
}

async function deleteSecret(key: string): Promise<boolean> {
	return await Bun.secrets.delete({
		name: key,
		service: SECRETS_SERVICE,
	});
}

// ─────────────────────────────────────────────────────────────────────────────
// Banner
// ─────────────────────────────────────────────────────────────────────────────

async function showBanner(): Promise<void> {
	const fontContent = await Bun.file(fontPath).text();
	figlet.parseFont("ANSI Shadow", fontContent);

	const banner = figlet.textSync("R2UP", {
		font: "ANSI Shadow",
		horizontalLayout: "default",
	});

	const indent = "  ";
	const indentedBanner = banner
		.split("\n")
		.map((line) => indent + line)
		.join("\n");

	console.log();
	console.log(bannerGradient(indentedBanner));
	console.log();
}

// ─────────────────────────────────────────────────────────────────────────────
// Configuration
// ─────────────────────────────────────────────────────────────────────────────

interface R2Config {
	accessKeyId: string;
	secretAccessKey: string;
	accountId: string;
	bucket: string;
	publicUrlBase: string;
}

async function loadConfig(): Promise<R2Config | null> {
	const [accessKeyId, secretAccessKey, accountId, bucket, publicUrlBase] =
		await Promise.all([
			getSecret(SECRETS.ACCESS_KEY_ID),
			getSecret(SECRETS.SECRET_ACCESS_KEY),
			getSecret(SECRETS.ACCOUNT_ID),
			getSecret(SECRETS.BUCKET),
			getSecret(SECRETS.PUBLIC_URL_BASE),
		]);

	if (
		!accessKeyId ||
		!secretAccessKey ||
		!accountId ||
		!bucket ||
		!publicUrlBase
	) {
		return null;
	}

	return { accessKeyId, secretAccessKey, accountId, bucket, publicUrlBase };
}

// ─────────────────────────────────────────────────────────────────────────────
// Setup Command
// ─────────────────────────────────────────────────────────────────────────────

async function setup(): Promise<void> {
	await showBanner();
	p.intro(theme.text("Configure Cloudflare R2 credentials"));

	// Account ID
	const accountId = await p.text({
		message: "Cloudflare Account ID:",
		validate: (v) => (v.trim() ? undefined : "Account ID is required"),
	});
	if (p.isCancel(accountId)) {
		p.outro(theme.subtext("Cancelled"));
		process.exit(0);
	}

	// Access Key ID
	const accessKeyId = await p.text({
		message: "R2 Access Key ID:",
		validate: (v) => (v.trim() ? undefined : "Access Key ID is required"),
	});
	if (p.isCancel(accessKeyId)) {
		p.outro(theme.subtext("Cancelled"));
		process.exit(0);
	}

	// Secret Access Key
	const secretAccessKey = await p.password({
		message: "R2 Secret Access Key:",
		validate: (v) => (v.trim() ? undefined : "Secret Access Key is required"),
	});
	if (p.isCancel(secretAccessKey)) {
		p.outro(theme.subtext("Cancelled"));
		process.exit(0);
	}

	// Bucket name
	const bucket = await p.text({
		message: "R2 Bucket name:",
		validate: (v) => (v.trim() ? undefined : "Bucket name is required"),
	});
	if (p.isCancel(bucket)) {
		p.outro(theme.subtext("Cancelled"));
		process.exit(0);
	}

	// Public URL base
	const publicUrlBase = await p.text({
		message: "Public URL base (r2.dev or custom domain):",
		validate: (v) => {
			if (!v.trim()) return "Public URL base is required";
			try {
				new URL(v.trim());
				return undefined;
			} catch {
				return "Must be a valid URL";
			}
		},
	});
	if (p.isCancel(publicUrlBase)) {
		p.outro(theme.subtext("Cancelled"));
		process.exit(0);
	}

	// Store secrets
	const s = p.spinner();
	s.start("Storing credentials...");

	try {
		await Promise.all([
			setSecret(SECRETS.ACCOUNT_ID, accountId.trim()),
			setSecret(SECRETS.ACCESS_KEY_ID, accessKeyId.trim()),
			setSecret(SECRETS.SECRET_ACCESS_KEY, secretAccessKey.trim()),
			setSecret(SECRETS.BUCKET, bucket.trim()),
			setSecret(
				SECRETS.PUBLIC_URL_BASE,
				publicUrlBase.trim().replace(/\/$/, ""),
			),
		]);
		s.stop(theme.success("Credentials stored securely"));
		p.outro(theme.success("Setup complete! Run r2up <files...> to upload."));
	} catch (err) {
		s.stop(theme.error("Failed to store credentials"));
		p.log.error(err instanceof Error ? err.message : String(err));
		process.exit(1);
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// Teardown Command
// ─────────────────────────────────────────────────────────────────────────────

async function teardown(): Promise<void> {
	await showBanner();
	p.intro(theme.text("Remove stored credentials"));

	const confirm = await p.confirm({
		message: "Remove all stored R2 credentials?",
	});

	if (p.isCancel(confirm) || !confirm) {
		p.outro(theme.subtext("Cancelled"));
		process.exit(0);
	}

	const s = p.spinner();
	s.start("Removing credentials...");

	try {
		const results = await Promise.all(
			Object.values(SECRETS).map((key) => deleteSecret(key)),
		);
		const removed = results.filter(Boolean).length;
		s.stop(theme.success(`Removed ${removed} credential(s)`));
		p.outro(theme.subtext("Done"));
	} catch (err) {
		s.stop(theme.error("Failed to remove credentials"));
		p.log.error(err instanceof Error ? err.message : String(err));
		process.exit(1);
	}
}

// ─────────────────────────────────────────────────────────────────────────────
// Upload Utilities
// ─────────────────────────────────────────────────────────────────────────────

interface UploadResult {
	filename: string;
	size: number;
	publicUrl: string;
	success: true;
}

interface UploadError {
	filename: string;
	error: string;
	success: false;
}

type UploadOutcome = UploadResult | UploadError;

function formatBytes(bytes: number): string {
	if (bytes === 0) return "0 B";
	const k = 1024;
	const sizes = ["B", "KB", "MB", "GB"];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

// Concurrency-limited parallel execution
async function runWithConcurrency<T, R>(
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

// Progress state for parallel uploads
interface UploadProgress {
	activeFiles: Set<string>;
	completed: number;
	total: number;
}

function renderProgress(progress: UploadProgress): string {
	if (progress.activeFiles.size === 0) {
		return `Uploaded ${progress.completed}/${progress.total} files`;
	}
	const active = [...progress.activeFiles].join(", ");
	return `[${progress.completed}/${progress.total}] ${active}`;
}

function displayResults(results: UploadOutcome[]): void {
	const successes = results.filter((r): r is UploadResult => r.success);
	const failures = results.filter((r): r is UploadError => !r.success);

	if (successes.length > 0) {
		const content = successes
			.map(
				(r) =>
					`${theme.success("✓")} ${theme.text(r.filename)} ${theme.dim(`(${formatBytes(r.size)})`)}\n  ${theme.link(r.publicUrl)}`,
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
	await showBanner();

	// Load config
	const config = await loadConfig();
	if (!config) {
		p.log.error("R2 not configured. Run: r2up setup");
		process.exit(1);
	}

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

	// Show what we're uploading
	const totalSize = validFiles.reduce((sum, f) => sum + f.size, 0);
	p.intro(
		theme.text(
			`Uploading ${validFiles.length} file${validFiles.length > 1 ? "s" : ""} (${formatBytes(totalSize)})`,
		),
	);

	// Create S3 client
	const client = new S3Client({
		accessKeyId: config.accessKeyId,
		secretAccessKey: config.secretAccessKey,
		bucket: config.bucket,
		endpoint: `https://${config.accountId}.r2.cloudflarestorage.com`,
	});

	// Progress tracking
	const progress: UploadProgress = {
		activeFiles: new Set(),
		completed: 0,
		total: validFiles.length,
	};

	// Single spinner for all uploads
	const s = p.spinner();
	s.start(renderProgress(progress));

	// Upload function for each file
	const uploadSingleFile = async (file: {
		path: string;
		name: string;
		size: number;
	}): Promise<UploadOutcome> => {
		progress.activeFiles.add(file.name);
		s.message(renderProgress(progress));

		try {
			const fileContent = Bun.file(file.path);
			await client.write(file.name, fileContent);

			const publicUrl = `${config.publicUrlBase}/${file.name}`;
			progress.activeFiles.delete(file.name);
			progress.completed++;
			s.message(renderProgress(progress));

			return {
				filename: file.name,
				size: file.size,
				publicUrl,
				success: true,
			};
		} catch (err) {
			progress.activeFiles.delete(file.name);
			progress.completed++;
			s.message(renderProgress(progress));

			return {
				filename: file.name,
				error: err instanceof Error ? err.message : String(err),
				success: false,
			};
		}
	};

	// Upload files in parallel with concurrency limit
	const results = await runWithConcurrency(
		validFiles,
		DEFAULT_CONCURRENCY,
		uploadSingleFile,
	);

	s.stop(
		theme.success(`Uploaded ${progress.completed}/${progress.total} files`),
	);

	console.log();
	displayResults(results);

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
	console.log(theme.text("Usage:"));
	console.log(
		`  ${theme.accent("r2up setup")}         Configure R2 credentials`,
	);
	console.log(
		`  ${theme.accent("r2up teardown")}      Remove stored credentials`,
	);
	console.log(`  ${theme.accent("r2up <files...>")}    Upload files to R2`);
	console.log();
	console.log(theme.text("Examples:"));
	console.log(
		`  ${theme.dim("r2up image.png")}                  Upload single file`,
	);
	console.log(
		`  ${theme.dim("r2up *.png")}                      Upload multiple files`,
	);
	console.log(
		`  ${theme.dim("r2up docs/report.pdf assets/*")}   Upload from paths`,
	);
	console.log();
	console.log(theme.text("Auto-delete / TTL:"));
	console.log(
		`  ${theme.subtext("R2 supports automatic file deletion via Object Lifecycle rules.")}`,
	);
	console.log(
		`  ${theme.subtext("Configure in Cloudflare Dashboard: R2 > [bucket] > Settings > Object lifecycle rules")}`,
	);
	console.log(
		`  ${theme.link("https://developers.cloudflare.com/r2/buckets/object-lifecycles/")}`,
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
		// Treat all args as file paths
		await uploadFiles(args);
	}
}

main().catch((err) => {
	console.error(theme.error(err instanceof Error ? err.message : String(err)));
	process.exit(1);
});
