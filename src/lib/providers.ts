// src/lib/providers.ts
import { getSecret, setSecret, deleteSecret } from "./secrets.js";

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

// Secret keys
const SECRETS = {
	PROVIDER: "S3UP_PROVIDER",
	ACCESS_KEY_ID: "S3UP_ACCESS_KEY_ID",
	SECRET_ACCESS_KEY: "S3UP_SECRET_ACCESS_KEY",
	BUCKET: "S3UP_BUCKET",
	PUBLIC_URL_BASE: "S3UP_PUBLIC_URL_BASE",
	REGION: "S3UP_REGION",
	ACCOUNT_ID: "S3UP_ACCOUNT_ID",
	ENDPOINT: "S3UP_ENDPOINT",
} as const;

export { SECRETS };

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
 * Load config from secrets/environment
 */
export async function loadConfig(): Promise<S3Config | null> {
	const [
		provider,
		accessKeyId,
		secretAccessKey,
		bucket,
		publicUrlBase,
		region,
		accountId,
		endpoint,
	] = await Promise.all([
		getSecret(SECRETS.PROVIDER),
		getSecret(SECRETS.ACCESS_KEY_ID),
		getSecret(SECRETS.SECRET_ACCESS_KEY),
		getSecret(SECRETS.BUCKET),
		getSecret(SECRETS.PUBLIC_URL_BASE),
		getSecret(SECRETS.REGION),
		getSecret(SECRETS.ACCOUNT_ID),
		getSecret(SECRETS.ENDPOINT),
	]);

	if (
		!provider ||
		!accessKeyId ||
		!secretAccessKey ||
		!bucket ||
		!publicUrlBase
	) {
		return null;
	}

	return {
		provider: provider as Provider,
		accessKeyId,
		secretAccessKey,
		bucket,
		publicUrlBase,
		region: region ?? undefined,
		accountId: accountId ?? undefined,
		endpoint: endpoint ?? undefined,
	};
}

/**
 * Save config to secrets
 */
export async function saveConfig(config: S3Config): Promise<void> {
	await Promise.all([
		setSecret(SECRETS.PROVIDER, config.provider),
		setSecret(SECRETS.ACCESS_KEY_ID, config.accessKeyId),
		setSecret(SECRETS.SECRET_ACCESS_KEY, config.secretAccessKey),
		setSecret(SECRETS.BUCKET, config.bucket),
		setSecret(SECRETS.PUBLIC_URL_BASE, config.publicUrlBase),
		config.region
			? setSecret(SECRETS.REGION, config.region)
			: Promise.resolve(),
		config.accountId
			? setSecret(SECRETS.ACCOUNT_ID, config.accountId)
			: Promise.resolve(),
		config.endpoint
			? setSecret(SECRETS.ENDPOINT, config.endpoint)
			: Promise.resolve(),
	]);
}

/**
 * Delete all stored config
 */
export async function deleteConfig(): Promise<number> {
	const results = await Promise.all(
		Object.values(SECRETS).map((key) => deleteSecret(key)),
	);
	return results.filter(Boolean).length;
}
