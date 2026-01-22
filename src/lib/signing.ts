// src/lib/signing.ts
// AWS Signature Version 4 signing using Bun's native crypto

export interface AwsCredentials {
	accessKeyId: string;
	secretAccessKey: string;
	region: string;
}

export interface SignedRequest {
	url: string;
	method: string;
	headers: Record<string, string>;
}

/**
 * SHA256 hash of data
 */
function sha256(data: string | Uint8Array): string {
	const hasher = new Bun.CryptoHasher("sha256");
	hasher.update(data);
	return hasher.digest("hex");
}

/**
 * HMAC-SHA256
 */
function hmacSha256(key: string | Uint8Array, data: string): Uint8Array {
	const keyBuffer =
		typeof key === "string" ? new TextEncoder().encode(key) : key;
	const hasher = new Bun.CryptoHasher("sha256", keyBuffer);
	hasher.update(data);
	return new Uint8Array(hasher.digest());
}

/**
 * Get AWS signing key
 */
function getSigningKey(
	secretKey: string,
	dateStamp: string,
	region: string,
	service: string,
): Uint8Array {
	const kDate = hmacSha256(`AWS4${secretKey}`, dateStamp);
	const kRegion = hmacSha256(kDate, region);
	const kService = hmacSha256(kRegion, service);
	const kSigning = hmacSha256(kService, "aws4_request");
	return kSigning;
}

/**
 * Format date for AWS (YYYYMMDD'T'HHMMSS'Z')
 */
function toAmzDate(date: Date): string {
	return date.toISOString().replace(/[:-]|\.\d{3}/g, "");
}

/**
 * Format date stamp (YYYYMMDD)
 */
function toDateStamp(date: Date): string {
	return toAmzDate(date).slice(0, 8);
}

/**
 * Sign an AWS request using SigV4
 */
export function signRequest(
	method: string,
	url: string,
	headers: Record<string, string>,
	body: string | Uint8Array | null,
	credentials: AwsCredentials,
	service = "s3",
): SignedRequest {
	const parsedUrl = new URL(url);
	const now = new Date();
	const amzDate = toAmzDate(now);
	const dateStamp = toDateStamp(now);

	// Ensure host header
	const signedHeaders: Record<string, string> = {
		...headers,
		host: parsedUrl.host,
		"x-amz-date": amzDate,
		"x-amz-content-sha256": body ? sha256(body) : sha256(""),
	};

	// Canonical headers (lowercase, sorted)
	const headerKeys = Object.keys(signedHeaders)
		.map((k) => k.toLowerCase())
		.sort();
	const canonicalHeaders =
		headerKeys
			.map(
				(k) =>
					`${k}:${signedHeaders[k] ?? signedHeaders[Object.keys(signedHeaders).find((h) => h.toLowerCase() === k)!]}`,
			)
			.join("\n") + "\n";
	const signedHeadersStr = headerKeys.join(";");

	// Canonical request
	const canonicalUri = parsedUrl.pathname;
	const canonicalQuerystring = parsedUrl.searchParams.toString();
	const payloadHash = body ? sha256(body) : sha256("");

	const canonicalRequest = [
		method,
		canonicalUri,
		canonicalQuerystring,
		canonicalHeaders,
		signedHeadersStr,
		payloadHash,
	].join("\n");

	// String to sign
	const algorithm = "AWS4-HMAC-SHA256";
	const credentialScope = `${dateStamp}/${credentials.region}/${service}/aws4_request`;
	const stringToSign = [
		algorithm,
		amzDate,
		credentialScope,
		sha256(canonicalRequest),
	].join("\n");

	// Calculate signature
	const signingKey = getSigningKey(
		credentials.secretAccessKey,
		dateStamp,
		credentials.region,
		service,
	);
	const signatureHasher = new Bun.CryptoHasher("sha256", signingKey);
	signatureHasher.update(stringToSign);
	const signature = signatureHasher.digest("hex");

	// Authorization header
	const authorization = `${algorithm} Credential=${credentials.accessKeyId}/${credentialScope}, SignedHeaders=${signedHeadersStr}, Signature=${signature}`;

	return {
		url,
		method,
		headers: {
			...signedHeaders,
			authorization,
		},
	};
}

/**
 * Helper to get region from endpoint for non-AWS providers
 */
export function getRegionForSigning(provider: string, region?: string): string {
	// R2 and other S3-compatible services use 'auto' or a specific region
	if (provider === "r2") return "auto";
	if (provider === "custom") return region ?? "us-east-1";
	return region ?? "us-east-1";
}
