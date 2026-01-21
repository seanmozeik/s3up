// src/lib/secrets.ts

const SECRETS_SERVICE = "com.s3up.cli";

// In-memory cache to avoid multiple keychain prompts per process
const secretsCache = new Map<string, string | null>();

/**
 * Get secret from environment or system credential store
 * Uses Bun.secrets for cross-platform support:
 * - macOS: Keychain
 * - Linux: libsecret (GNOME Keyring, KWallet)
 * - Windows: Credential Manager
 */
export async function getSecret(key: string): Promise<string | null> {
	// 1. Check cache first (avoids multiple keychain prompts)
	if (secretsCache.has(key)) {
		return secretsCache.get(key) ?? null;
	}

	// 2. Check environment variable
	const envValue = process.env[key];
	if (envValue) {
		return envValue;
	}

	// 3. Try system credential store via Bun.secrets
	try {
		const value = await Bun.secrets.get({
			name: key,
			service: SECRETS_SERVICE,
		});
		secretsCache.set(key, value);
		return value;
	} catch {
		secretsCache.set(key, null);
		return null;
	}
}

/**
 * Store secret in system credential store
 */
export async function setSecret(key: string, value: string): Promise<void> {
	try {
		await Bun.secrets.set({
			name: key,
			service: SECRETS_SERVICE,
			value,
		});
		secretsCache.set(key, value);
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

/**
 * Delete secret from system credential store
 * Returns true if deleted, false if not found
 */
export async function deleteSecret(key: string): Promise<boolean> {
	secretsCache.delete(key);
	return await Bun.secrets.delete({
		name: key,
		service: SECRETS_SERVICE,
	});
}

/**
 * Get the secrets service name (for external tools)
 */
export function getSecretsService(): string {
	return SECRETS_SERVICE;
}
