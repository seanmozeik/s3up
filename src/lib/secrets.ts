// src/lib/secrets.ts

const SECRETS_SERVICE = 'com.s3up.cli';
const CONFIG_KEY = 'S3UP_CONFIG';

// In-memory cache to avoid multiple keychain prompts per process
let configCache: string | null | undefined;

/**
 * Get the full config JSON from keychain (single prompt)
 */
export async function getConfigSecret(): Promise<string | null> {
  // Check cache first
  if (configCache !== undefined) {
    return configCache;
  }

  // Check environment variable
  const envValue = process.env[CONFIG_KEY];
  if (envValue) {
    configCache = envValue;
    return envValue;
  }

  // Try system credential store via Bun.secrets
  try {
    const value = await Bun.secrets.get({
      name: CONFIG_KEY,
      service: SECRETS_SERVICE
    });
    configCache = value;
    return value;
  } catch {
    configCache = null;
    return null;
  }
}

/**
 * Store config JSON in system credential store
 */
export async function setConfigSecret(value: string): Promise<void> {
  try {
    await Bun.secrets.set({
      name: CONFIG_KEY,
      service: SECRETS_SERVICE,
      value
    });
    configCache = value;
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    if (process.platform === 'linux' && msg.includes('libsecret')) {
      throw new Error(
        'libsecret not found. Install it with:\n' +
          '  Ubuntu/Debian: sudo apt install libsecret-1-0\n' +
          '  Fedora/RHEL:   sudo dnf install libsecret\n' +
          '  Arch:          sudo pacman -S libsecret\n' +
          'Or use environment variables instead.'
      );
    }
    throw err;
  }
}

/**
 * Delete config from system credential store
 */
export async function deleteConfigSecret(): Promise<boolean> {
  configCache = undefined;
  return await Bun.secrets.delete({
    name: CONFIG_KEY,
    service: SECRETS_SERVICE
  });
}

/**
 * Get the secrets service name (for external tools)
 */
export function getSecretsService(): string {
  return SECRETS_SERVICE;
}
