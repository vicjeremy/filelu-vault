import { describe, it, expect, beforeAll } from 'vitest';
import { exec } from 'node:child_process';
import { promisify } from 'node:util';
import { join } from 'node:path';
import { existsSync, mkdirSync, writeFileSync } from 'node:fs';

const execAsync = promisify(exec);
const cliPath = join(process.cwd(), 'dist', 'index.js');

describe('CLI Integration', () => {
  beforeAll(async () => {
    // Ensure the project is built before running CLI tests
    await execAsync('npm run build');

    // Create an isolated config directory to avoid messing with user's ~/.filelu-vault
    const testConfigDir = join(process.cwd(), '.test-filelu-vault');
    if (!existsSync(testConfigDir)) mkdirSync(testConfigDir);
    process.env['HOME'] = process.cwd(); // Override HOME so config uses local path
  });

  it('should print help information', async () => {
    const { stdout } = await execAsync(`node ${cliPath} help`);
    expect(stdout).toContain('Usage: vault');
    expect(stdout).toContain('Secure cloud backup from your terminal');
    expect(stdout).toContain('upload [options] <file>');
    expect(stdout).toContain('backup [options] <dir>');
    expect(stdout).toContain('sync [options] <dir>');
  });

  it('should set and show config as JSON', async () => {
    // 1. Set key
    await execAsync(`node ${cliPath} config set-key test-api-key`);
    
    // 2. Show JSON
    const { stdout } = await execAsync(`node ${cliPath} config show --json`);
    const cfg = JSON.parse(stdout);
    
    expect(cfg.hasKey).toBe(true);
    expect(cfg.hasEncKey).toBe(false);
    expect(cfg.maxRetries).toBe(3);
  });
});
