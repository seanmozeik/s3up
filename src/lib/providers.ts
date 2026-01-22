// src/lib/providers.ts
import {
	getConfigSecret,
	setConfigSecret,
	deleteConfigSecret,
} from "./secrets.js";

export type Provider = "aws" | "r2" | "digitalocean" | "backblaze" | "custom";

export interface ProviderInfo {
	name: string;
	description: string;
	requiresRegion: boolean;
	requiresAccountId: boolean;
	requiresEndpoint: boolean;
	regions?: string[];
}

export const PROVIDERS: Record<Provider, ProviderInfo> = {
	aws: {
		name: "AWS S3",
		description: "Amazon Web Services S3",
		requiresRegion: true,
		requiresAccountId: false,
		requiresEndpoint: false,
		regions: [
			"us-east-1",
			"us-east-2",
			"us-west-1",
			"us-west-2",
			"eu-west-1",
			"eu-west-2",
			"eu-west-3",
			"eu-central-1",
			"eu-north-1",
			"ap-northeast-1",
			"ap-northeast-2",
			"ap-northeast-3",
			"ap-southeast-1",
			"ap-southeast-2",
			"ap-south-1",
			"sa-east-1",
			"ca-central-1",
		],
	},
	r2: {
		name: "Cloudflare R2",
		description: "Cloudflare R2 Storage",
		requiresRegion: false,
		requiresAccountId: true,
		requiresEndpoint: false,
	},
	digitalocean: {
		name: "DigitalOcean Spaces",
		description: "DigitalOcean Spaces Object Storage",
		requiresRegion: true,
		requiresAccountId: false,
		requiresEndpoint: false,
		regions: ["nyc3", "ams3", "sgp1", "fra1", "sfo2", "sfo3", "blr1", "syd1"],
	},
	backblaze: {
		name: "Backblaze B2",
		description: "Backblaze B2 Cloud Storage",
		requiresRegion: true,
		requiresAccountId: false,
		requiresEndpoint: false,
		regions: [
			"us-west-000",
			"us-west-001",
			"us-west-002",
			"us-west-004",
			"eu-central-003",
		],
	},
	custom: {
		name: "Custom S3",
		description: "Custom S3-compatible endpoint (MinIO, etc.)",
		requiresRegion: false,
		requiresAccountId: false,
		requiresEndpoint: true,
	},
};

export interface S3Config {
	provider: Provider;
	accessKeyId: string;
	secretAccessKey: string;
	bucket: string;
	publicUrlBase: string;
	region?: string;
	accountId?: string;
	endpoint?: string;
}

/**
 * Get the S3 endpoint URL for a provider
 */
export function getEndpoint(config: S3Config): string {
	switch (config.provider) {
		case "aws":
			return `https://s3.${config.region}.amazonaws.com`;
		case "r2":
			return `https://${config.accountId}.r2.cloudflarestorage.com`;
		case "digitalocean":
			return `https://${config.region}.digitaloceanspaces.com`;
		case "backblaze":
			return `https://s3.${config.region}.backblazeb2.com`;
		case "custom":
			return config.endpoint!;
		default:
			throw new Error(`Unknown provider: ${config.provider}`);
	}
}

/**
 * Load config from secrets/environment (single keychain prompt)
 */
export async function loadConfig(): Promise<S3Config | null> {
	const json = await getConfigSecret();
	if (!json) {
		return null;
	}

	try {
		const config = JSON.parse(json) as S3Config;

		// Validate required fields
		if (
			!config.provider ||
			!config.accessKeyId ||
			!config.secretAccessKey ||
			!config.bucket ||
			!config.publicUrlBase
		) {
			return null;
		}

		return config;
	} catch {
		return null;
	}
}

/**
 * Save config to secrets (single keychain entry)
 */
export async function saveConfig(config: S3Config): Promise<void> {
	await setConfigSecret(JSON.stringify(config));
}

/**
 * Delete all stored config
 */
export async function deleteConfig(): Promise<number> {
	const deleted = await deleteConfigSecret();
	return deleted ? 1 : 0;
}
