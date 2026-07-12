import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, existsSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { ConfigStore } from '../../../src/config/store.js';
import type { VaultConfig } from '../../../src/config/schema.js';

describe('ConfigStore', () => {
  let testDir: string;
  let configPath: string;
  let store: ConfigStore;

  beforeEach(() => {
    testDir = mkdtempSync(join(tmpdir(), 'vault-test-'));
    configPath = join(testDir, 'config.json');
    store = new ConfigStore(configPath);
  });

  afterEach(() => {
    rmSync(testDir, { recursive: true, force: true });
  });

  // ──────────────────────────────────────────────
  // exists()
  // ──────────────────────────────────────────────
  describe('exists', () => {
    it('should return false when config file does not exist', () => {
      expect(store.exists()).toBe(false);
    });

    it('should return true after saving a config', () => {
      const config = ConfigStore.createDefault('test-api-key');
      store.save(config);
      expect(store.exists()).toBe(true);
    });
  });

  // ──────────────────────────────────────────────
  // createDefault()
  // ──────────────────────────────────────────────
  describe('createDefault', () => {
    it('should create config with provided API key', () => {
      const config = ConfigStore.createDefault('my-key-123');
      expect(config.apiKey).toBe('my-key-123');
    });

    it('should apply default values', () => {
      const config = ConfigStore.createDefault('key');
      expect(config.encryptionEnabled).toBe(false);
      expect(config.maxRetries).toBe(3);
      expect(config.concurrency).toBe(3);
      expect(config.excludePatterns).toContain('node_modules/**');
    });

    it('should not include encryptionKey by default', () => {
      const config = ConfigStore.createDefault('key');
      expect(config.encryptionKey).toBeUndefined();
    });
  });

  // ──────────────────────────────────────────────
  // save()
  // ──────────────────────────────────────────────
  describe('save', () => {
    it('should write a valid JSON file', () => {
      const config = ConfigStore.createDefault('save-test-key');
      store.save(config);
      const raw = JSON.parse(readFileSync(configPath, 'utf-8')) as unknown;
      expect(raw).toMatchObject({ apiKey: 'save-test-key' });
    });

    it('should create parent directories if they do not exist', () => {
      const deepPath = join(testDir, 'a', 'b', 'c', 'config.json');
      const deepStore = new ConfigStore(deepPath);
      deepStore.save(ConfigStore.createDefault('key'));
      expect(existsSync(deepPath)).toBe(true);
    });

    it('should set file permissions to 0600', () => {
      const config = ConfigStore.createDefault('perm-test-key');
      store.save(config);
      const mode = statSync(configPath).mode;
      // 0o100600 = regular file (0o100000) + 0600 permissions
      expect(mode & 0o777).toBe(0o600);
    });

    it('should overwrite existing config on second save', () => {
      store.save(ConfigStore.createDefault('key-v1'));
      const updated: VaultConfig = { ...ConfigStore.createDefault('key-v2') };
      store.save(updated);
      const loaded = store.load();
      expect(loaded.apiKey).toBe('key-v2');
    });
  });

  // ──────────────────────────────────────────────
  // load()
  // ──────────────────────────────────────────────
  describe('load', () => {
    it('should throw when config file does not exist', () => {
      expect(() => store.load()).toThrow(/ConfigError/);
    });

    it('should return valid config after save', () => {
      const config = ConfigStore.createDefault('load-test-key');
      store.save(config);
      const loaded = store.load();
      expect(loaded.apiKey).toBe('load-test-key');
      expect(loaded.maxRetries).toBe(3);
    });

    it('should throw ConfigError on malformed JSON', () => {
      writeFileSync(configPath, '{ not valid json }', 'utf-8');
      expect(() => store.load()).toThrow(/ConfigError/);
    });

    it('should throw ConfigError when apiKey is missing', () => {
      writeFileSync(configPath, JSON.stringify({ dataDir: '/tmp' }), 'utf-8');
      expect(() => store.load()).toThrow(/ConfigError/);
    });

    it('should throw ConfigError when apiKey is empty string', () => {
      writeFileSync(configPath, JSON.stringify({ apiKey: '' }), 'utf-8');
      expect(() => store.load()).toThrow(/ConfigError/);
    });

    it('should load encryptionKey when present', () => {
      const config: VaultConfig = {
        ...ConfigStore.createDefault('enc-key'),
        encryptionEnabled: true,
        encryptionKey: 'base64encodedkey==',
      };
      store.save(config);
      const loaded = store.load();
      expect(loaded.encryptionKey).toBe('base64encodedkey==');
      expect(loaded.encryptionEnabled).toBe(true);
    });

    it('should throw when encryptionEnabled=true but no encryptionKey', () => {
      const raw = { apiKey: 'k', encryptionEnabled: true };
      writeFileSync(configPath, JSON.stringify(raw), 'utf-8');
      expect(() => store.load()).toThrow(/ConfigError/);
    });

    it('should apply defaults for missing optional fields', () => {
      writeFileSync(configPath, JSON.stringify({ apiKey: 'minimal' }), 'utf-8');
      const loaded = store.load();
      expect(loaded.maxRetries).toBe(3);
      expect(loaded.concurrency).toBe(3);
    });

    it('should preserve custom concurrency value', () => {
      const config: VaultConfig = { ...ConfigStore.createDefault('key'), concurrency: 7 };
      store.save(config);
      const loaded = store.load();
      expect(loaded.concurrency).toBe(7);
    });
  });
});
