import { existsSync, mkdirSync, readFileSync, writeFileSync, chmodSync } from 'node:fs';
import { dirname } from 'node:path';
import { validateConfig, DEFAULT_CONFIG } from './schema.js';
import type { VaultConfig } from './schema.js';

/** Default config file location. */
const DEFAULT_CONFIG_PATH = `${process.env['HOME'] ?? '~'}/.filelu-vault/config.json`;

/**
 * ConfigStore — reads and writes the vault configuration file.
 * Config is stored at ~/.filelu-vault/config.json with mode 0600.
 */
export class ConfigStore {
  private readonly configPath: string;

  /**
   * @param configPath - Absolute path to config.json. Defaults to ~/.filelu-vault/config.json.
   */
  constructor(configPath: string = DEFAULT_CONFIG_PATH) {
    this.configPath = configPath;
  }

  /**
   * Load configuration from disk. Throws ConfigError if file is missing or invalid.
   * @returns Validated VaultConfig
   * @throws {Error} ConfigError if file doesn't exist or fails validation
   */
  load(): VaultConfig {
    if (!existsSync(this.configPath)) {
      throw new Error(
        `ConfigError: No config found at ${this.configPath}. Run \`vault config set-key <key>\` first.`,
      );
    }

    let raw: unknown;
    try {
      const content = readFileSync(this.configPath, 'utf-8');
      raw = JSON.parse(content);
    } catch (cause) {
      throw new Error(`ConfigError: Failed to parse config at ${this.configPath}`, { cause });
    }

    try {
      return validateConfig(raw);
    } catch (cause) {
      throw new Error(`ConfigError: Invalid config at ${this.configPath}`, { cause });
    }
  }

  /**
   * Save configuration to disk with mode 0600 (owner read/write only).
   * Creates the parent directory if it doesn't exist.
   * @param config - The VaultConfig to persist
   * @throws {Error} ConfigError if write fails
   */
  save(config: VaultConfig): void {
    const dir = dirname(this.configPath);

    if (!existsSync(dir)) {
      mkdirSync(dir, { recursive: true, mode: 0o700 });
    }

    try {
      writeFileSync(this.configPath, JSON.stringify(config, null, 2), { encoding: 'utf-8', mode: 0o600 });
      // Explicitly chmod in case the file already existed with wrong permissions
      chmodSync(this.configPath, 0o600);
    } catch (cause) {
      throw new Error(`ConfigError: Failed to write config to ${this.configPath}`, { cause });
    }
  }

  /**
   * Check whether a config file exists on disk.
   * @returns true if config.json exists
   */
  exists(): boolean {
    return existsSync(this.configPath);
  }

  /**
   * Create a new config with only the API key set, using all other defaults.
   * @param apiKey - FileLu API key
   * @returns A new VaultConfig with defaults applied
   */
  static createDefault(apiKey: string): VaultConfig {
    return {
      apiKey,
      ...DEFAULT_CONFIG,
    };
  }
}
