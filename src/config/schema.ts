/**
 * VaultConfig — runtime configuration schema for FileLu Vault.
 * Stored at ~/.filelu-vault/config.json (mode 0600).
 */
export interface VaultConfig {
  /** FileLu API key — never log or display in full. */
  apiKey: string;
  /** Absolute path to data directory. Default: ~/.filelu-vault */
  dataDir: string;
  /** Enable AES-256-GCM client-side encryption before upload. Default: false */
  encryptionEnabled: boolean;
  /** Base64-encoded 32-byte AES-256 key. Required when encryptionEnabled is true. */
  encryptionKey?: string;
  /** Number of retry attempts on transient errors. Default: 3 */
  maxRetries: number;
  /** Max concurrent uploads. Default: 3. Max: 10. */
  concurrency: number;
  /** Glob patterns for files/directories to exclude from backup/sync. */
  excludePatterns: string[];
}

/** Default configuration values. API key must be set by the user via `vault config set-key`. */
export const DEFAULT_CONFIG: Omit<VaultConfig, 'apiKey'> = {
  dataDir: `${process.env['HOME'] ?? '~'}/.filelu-vault`,
  encryptionEnabled: false,
  maxRetries: 3,
  concurrency: 3,
  excludePatterns: ['node_modules/**', '.git/**', '.DS_Store', 'Thumbs.db', '*.tmp', '*.swp'],
};

/**
 * Validate a config object, throwing ConfigError on missing required fields or invalid values.
 * @param config - Raw parsed config object (unknown shape from JSON.parse)
 * @returns Validated VaultConfig
 * @throws {ConfigError} If required fields are missing or values are out of range
 */
export function validateConfig(config: unknown): VaultConfig {
  if (typeof config !== 'object' || config === null) {
    throw new Error('ConfigError: config must be a JSON object');
  }

  const raw = config as Record<string, unknown>;

  if (typeof raw['apiKey'] !== 'string' || raw['apiKey'].trim() === '') {
    throw new Error('ConfigError: apiKey is required and must be a non-empty string');
  }

  const merged: VaultConfig = {
    apiKey: raw['apiKey'] as string,
    dataDir: typeof raw['dataDir'] === 'string' ? raw['dataDir'] : DEFAULT_CONFIG.dataDir,
    encryptionEnabled: typeof raw['encryptionEnabled'] === 'boolean'
      ? raw['encryptionEnabled']
      : DEFAULT_CONFIG.encryptionEnabled,
    maxRetries: typeof raw['maxRetries'] === 'number' && raw['maxRetries'] > 0
      ? raw['maxRetries']
      : DEFAULT_CONFIG.maxRetries,
    concurrency: typeof raw['concurrency'] === 'number' && raw['concurrency'] > 0 && raw['concurrency'] <= 10
      ? raw['concurrency']
      : DEFAULT_CONFIG.concurrency,
    excludePatterns: Array.isArray(raw['excludePatterns'])
      ? (raw['excludePatterns'] as string[])
      : DEFAULT_CONFIG.excludePatterns,
  };

  if (raw['encryptionKey'] !== undefined) {
    if (typeof raw['encryptionKey'] !== 'string') {
      throw new Error('ConfigError: encryptionKey must be a base64 string');
    }
    merged.encryptionKey = raw['encryptionKey'] as string;
  }

  if (merged.encryptionEnabled && !merged.encryptionKey) {
    throw new Error('ConfigError: encryptionKey is required when encryptionEnabled is true');
  }

  return merged;
}
