// src/ui/setup.ts
import * as p from "@clack/prompts";
import { showBanner } from "./banner.js";
import { frappe, theme } from "./theme.js";
import {
	PROVIDERS,
	saveConfig,
	type Provider,
	type S3Config,
} from "../lib/providers.js";

/**
 * Interactive setup flow for configuring S3 credentials
 */
export async function setup(): Promise<void> {
	await showBanner();
	p.intro(frappe.text("Configure S3 credentials"));

	// Provider selection
	const providerOptions = Object.entries(PROVIDERS).map(([key, info]) => ({
		value: key as Provider,
		label: info.name,
		hint: info.description,
	}));

	const provider = await p.select({
		message: "Select your S3 provider:",
		options: providerOptions,
	});

	if (p.isCancel(provider)) {
		p.outro(frappe.subtext1("Cancelled"));
		process.exit(0);
	}

	const providerInfo = PROVIDERS[provider];
	const config: Partial<S3Config> = { provider };

	// Provider-specific prompts
	if (providerInfo.requiresRegion && providerInfo.regions) {
		const region = await p.select({
			message: `${providerInfo.name} Region:`,
			options: providerInfo.regions.map((r) => ({ value: r, label: r })),
		});

		if (p.isCancel(region)) {
			p.outro(frappe.subtext1("Cancelled"));
			process.exit(0);
		}
		config.region = region;
	} else if (providerInfo.requiresRegion) {
		const region = await p.text({
			message: `${providerInfo.name} Region:`,
			validate: (v) => (v.trim() ? undefined : "Region is required"),
		});

		if (p.isCancel(region)) {
			p.outro(frappe.subtext1("Cancelled"));
			process.exit(0);
		}
		config.region = region.trim();
	}

	if (providerInfo.requiresAccountId) {
		const accountId = await p.text({
			message: "Account ID:",
			validate: (v) => (v.trim() ? undefined : "Account ID is required"),
		});

		if (p.isCancel(accountId)) {
			p.outro(frappe.subtext1("Cancelled"));
			process.exit(0);
		}
		config.accountId = accountId.trim();
	}

	if (providerInfo.requiresEndpoint) {
		const endpoint = await p.text({
			message: "S3 Endpoint URL:",
			validate: (v) => {
				if (!v.trim()) return "Endpoint is required";
				try {
					new URL(v.trim());
					return undefined;
				} catch {
					return "Must be a valid URL";
				}
			},
		});

		if (p.isCancel(endpoint)) {
			p.outro(frappe.subtext1("Cancelled"));
			process.exit(0);
		}
		config.endpoint = endpoint.trim();
	}

	// Common prompts
	const accessKeyId = await p.text({
		message: "Access Key ID:",
		validate: (v) => (v.trim() ? undefined : "Access Key ID is required"),
	});

	if (p.isCancel(accessKeyId)) {
		p.outro(frappe.subtext1("Cancelled"));
		process.exit(0);
	}
	config.accessKeyId = accessKeyId.trim();

	const secretAccessKey = await p.password({
		message: "Secret Access Key:",
		validate: (v) => (v.trim() ? undefined : "Secret Access Key is required"),
	});

	if (p.isCancel(secretAccessKey)) {
		p.outro(frappe.subtext1("Cancelled"));
		process.exit(0);
	}
	config.secretAccessKey = secretAccessKey.trim();

	const bucket = await p.text({
		message: "Bucket name:",
		validate: (v) => (v.trim() ? undefined : "Bucket name is required"),
	});

	if (p.isCancel(bucket)) {
		p.outro(frappe.subtext1("Cancelled"));
		process.exit(0);
	}
	config.bucket = bucket.trim();

	const publicUrlBase = await p.text({
		message: "Public URL base (for generating links):",
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
		p.outro(frappe.subtext1("Cancelled"));
		process.exit(0);
	}
	config.publicUrlBase = publicUrlBase.trim().replace(/\/$/, "");

	// Store secrets
	const s = p.spinner();
	s.start("Storing credentials...");

	try {
		await saveConfig(config as S3Config);
		s.stop(theme.success("Credentials stored securely"));
		p.outro(
			theme.success(
				`Setup complete! Run s3up <files...> to upload to ${providerInfo.name}.`,
			),
		);
	} catch (err) {
		s.stop(theme.error("Failed to store credentials"));
		p.log.error(err instanceof Error ? err.message : String(err));
		process.exit(1);
	}
}
