#!/usr/bin/env node

import { Command } from 'commander';
import { resolve, join } from 'node:path';
import { ConfigStore } from '../config/store.js';
import { Database } from '../db/database.js';
import { FileLuClient } from '../api/client.js';
import { Uploader } from '../core/uploader.js';
import { Encryptor } from '../core/encryption.js';
import { BackupEngine } from '../core/backup.js';
import { SyncEngine } from '../core/sync.js';
import { logger } from '../utils/logger.js';
import { ProgressBar } from '../utils/progress.js';
import { existsSync, statSync } from 'node:fs';

const program = new Command();
const configStore = new ConfigStore();

function getDeps() {
  const cfg = configStore.load();
  if (!cfg.apiKey) {
    console.error('\x1b[1m\x1b[31m✗ Authentication failed: API key not set\x1b[0m');
    console.error('  Run `vault config set-key <your-key>` to set a valid key.');
    process.exit(1);
  }
  
  const db = new Database(join(cfg.dataDir, 'vault.db'));
  db.init();
  
  const client = new FileLuClient(cfg.apiKey, cfg.maxRetries);
  const uploader = new Uploader(client, db);
  let encryptor: Encryptor | undefined;
  
  if (cfg.encryptionEnabled && cfg.encryptionKey) {
    encryptor = new Encryptor(cfg.encryptionKey);
  }
  
  const backupEngine = new BackupEngine(uploader, db, encryptor);
  const syncEngine = new SyncEngine(uploader, db, encryptor);
  
  return { db, client, uploader, encryptor, backupEngine, syncEngine };
}

function handleGlobalOptions(options: { verbose?: boolean; json?: boolean }) {
  if (options.verbose) {
    logger.setLevel('debug');
  }
}

program
  .name('vault')
  .description('Secure cloud backup from your terminal')
  .version('1.0.0')
  .option('--verbose', 'Enable verbose logging')
  .option('--json', 'Output results as JSON')
  .hook('preAction', (thisCommand) => {
    handleGlobalOptions(thisCommand.opts());
  });

const configCmd = program.command('config').description('Manage configuration');

configCmd
  .command('set-key <key>')
  .description('Set your FileLu API key')
  .action((key: string) => {
    let cfg;
    if (configStore.exists()) {
      cfg = configStore.load();
      cfg.apiKey = key;
    } else {
      cfg = ConfigStore.createDefault(key);
    }
    configStore.save(cfg);
    console.log('\x1b[32m✓ API key saved securely\x1b[0m');
  });

configCmd
  .command('show')
  .description('Show current configuration state')
  .action(() => {
    const cfg = configStore.load();
    const hasKey = !!cfg.apiKey;
    const hasEncKey = !!cfg.encryptionKey;
    
    if (program.opts().json) {
      console.log(JSON.stringify({ hasKey, hasEncKey, maxRetries: cfg.maxRetries }, null, 2));
      return;
    }
    
    console.log(`\x1b[1m\x1b[34m╔══ Configuration ══╗\x1b[0m`);
    console.log(`  API Key:    ${hasKey ? '****' + cfg.apiKey.slice(-4) : 'Not set'}`);
    console.log(`  Encryption: ${cfg.encryptionEnabled ? 'Enabled' : 'Disabled'}`);
    console.log(`  Retries:    ${cfg.maxRetries}`);
    console.log();
  });

program
  .command('upload <file>')
  .description('Upload a single file')
  .option('-e, --encrypt', 'Encrypt the file before uploading')
  .action(async (file: string, options: { encrypt?: boolean }) => {
    const isJson = program.opts().json;
    try {
      const { uploader, encryptor } = getDeps();
      const absPath = resolve(file);
      
      if (!existsSync(absPath) || !statSync(absPath).isFile()) {
        throw new Error(`File not found or is a directory: ${file}`);
      }

      if (options.encrypt && !encryptor) {
        throw new Error('Encryption requested but no key is configured. Run `vault config generate-key` first.');
      }

      let pb: ProgressBar | undefined;
      if (!isJson) {
        pb = new ProgressBar(`Uploading ${file}`, 100);
        pb.start();
        pb.update(50);
      }

      const res = await uploader.uploadFile(absPath, { encrypt: options.encrypt });
      
      if (pb) pb.stop();

      if (isJson) {
        console.log(JSON.stringify(res, null, 2));
      } else {
        if (res.status === 'skipped') {
          console.log(`\x1b[36m⊘ Skipped (already uploaded)\x1b[0m ${file}`);
        } else {
          console.log(`\x1b[32m✓ Uploaded\x1b[0m ${file} → https://filelu.com/${res.result?.file_code}`);
        }
      }
    } catch (err: any) {
      if (isJson) {
        console.error(JSON.stringify({ error: err.message }));
      } else {
        console.error(`\x1b[1m\x1b[31m✗ Upload failed:\x1b[0m ${err.message}`);
      }
      process.exit(1);
    }
  });

program
  .command('backup <dir>')
  .description('Backup a directory to FileLu')
  .option('--dry-run', 'Scan and hash files, but do not upload')
  .option('-e, --encrypt', 'Encrypt files before uploading')
  .action(async (dir: string, options: { dryRun?: boolean; encrypt?: boolean }) => {
    const isJson = program.opts().json;
    try {
      const { backupEngine, encryptor } = getDeps();
      const absDir = resolve(dir);
      
      if (!existsSync(absDir) || !statSync(absDir).isDirectory()) {
        throw new Error(`Directory not found: ${dir}`);
      }

      if (options.encrypt && !encryptor) {
        throw new Error('Encryption requested but no key is configured.');
      }

      const res = await backupEngine.run(absDir, options);
      
      if (isJson) {
        console.log(JSON.stringify(res, null, 2));
      } else {
        if (options.dryRun) {
          console.log(`\x1b[36mDry Run Complete\x1b[0m: Found ${res.filesTotal} files to upload.`);
        } else {
          console.log(`\x1b[1m\x1b[34m╔══════════════════════════════════════════╗\x1b[0m`);
          console.log(`\x1b[1m\x1b[34m║         Backup Complete                  ║\x1b[0m`);
          console.log(`\x1b[1m\x1b[34m╠══════════════════════════════════════════╣\x1b[0m`);
          console.log(`\x1b[1m\x1b[34m║\x1b[0m  Source:    ${dir.padEnd(28)}\x1b[1m\x1b[34m║\x1b[0m`);
          console.log(`\x1b[1m\x1b[34m║\x1b[0m  Uploaded: ${String(res.filesUploaded).padEnd(3)} │ Skipped: ${String(res.filesSkipped).padEnd(11)}\x1b[1m\x1b[34m║\x1b[0m`);
          console.log(`\x1b[1m\x1b[34m║\x1b[0m  Failed:   ${String(res.filesFailed).padEnd(27)}\x1b[1m\x1b[34m║\x1b[0m`);
          console.log(`\x1b[1m\x1b[34m╚══════════════════════════════════════════╝\x1b[0m`);
        }
      }
    } catch (err: any) {
      if (isJson) {
        console.error(JSON.stringify({ error: err.message }));
      } else {
        console.error(`\x1b[1m\x1b[31m✗ Backup failed:\x1b[0m ${err.message}`);
      }
      process.exit(1);
    }
  });

program
  .command('sync <dir>')
  .description('Continuously sync a directory to FileLu')
  .option('-e, --encrypt', 'Encrypt files before uploading')
  .action(async (dir: string, options: { encrypt?: boolean }) => {
    const isJson = program.opts().json;
    try {
      const { syncEngine, backupEngine, encryptor } = getDeps();
      const absDir = resolve(dir);
      
      if (!existsSync(absDir) || !statSync(absDir).isDirectory()) {
        throw new Error(`Directory not found: ${dir}`);
      }

      if (options.encrypt && !encryptor) {
        throw new Error('Encryption requested but no key is configured.');
      }

      if (!isJson) {
        console.log(`\x1b[36m⟳ Starting sync for ${dir}...\x1b[0m`);
        console.log(`Press Ctrl+C to stop.`);
      }

      await syncEngine.start(absDir, backupEngine, options);
      
      process.on('SIGINT', () => {
        if (!isJson) console.log('\n\x1b[36mShutting down sync gracefully...\x1b[0m');
        syncEngine.stop();
        process.exit(0);
      });
      
    } catch (err: any) {
      if (isJson) {
        console.error(JSON.stringify({ error: err.message }));
      } else {
        console.error(`\x1b[1m\x1b[31m✗ Sync failed:\x1b[0m ${err.message}`);
      }
      process.exit(1);
    }
  });

program
  .command('status')
  .description('View vault status and local database stats')
  .action(async () => {
    const isJson = program.opts().json;
    try {
      const { db, client } = getDeps();
      const account = await client.getAccountInfo();
      const stats = db.connection.prepare(`
        SELECT 
          COUNT(id) as total,
          SUM(CASE WHEN status = 'uploaded' THEN 1 ELSE 0 END) as uploaded,
          SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed,
          SUM(CASE WHEN status = 'uploading' THEN 1 ELSE 0 END) as pending
        FROM tracked_files
      `).get() as any;

      if (isJson) {
        console.log(JSON.stringify({ account, localStats: stats }, null, 2));
      } else {
        const isPremium = account.premiumExpire !== '';
        console.log(`\x1b[1m\x1b[34m╔══════════════════════════════════════════╗\x1b[0m`);
        console.log(`\x1b[1m\x1b[34m║           FileLu Vault Status            ║\x1b[0m`);
        console.log(`\x1b[1m\x1b[34m╠══════════════════════════════════════════╣\x1b[0m`);
        console.log(`\x1b[1m\x1b[34m║\x1b[0m  Account:  ${account.email.padEnd(28)}\x1b[1m\x1b[34m║\x1b[0m`);
        console.log(`\x1b[1m\x1b[34m║\x1b[0m  Plan:     ${(isPremium ? 'Premium' : 'Free').padEnd(28)}\x1b[1m\x1b[34m║\x1b[0m`);
        const storageUsed = account.storageUsed ? (Number(account.storageUsed) / 1024 / 1024 / 1024).toFixed(2) : '0.00';
        console.log(`\x1b[1m\x1b[34m║\x1b[0m  Storage:  ${storageUsed} GB / ${account.storageLeft === 'inf' ? '∞' : account.storageLeft}\x1b[1m\x1b[34m║\x1b[0m`);
        console.log(`\x1b[1m\x1b[34m╠══════════════════════════════════════════╣\x1b[0m`);
        console.log(`\x1b[1m\x1b[34m║\x1b[0m  Local:    ${String(stats.total || 0).padEnd(4)} tracked │ ${String(stats.uploaded || 0).padEnd(4)} synced  \x1b[1m\x1b[34m║\x1b[0m`);
        console.log(`\x1b[1m\x1b[34m║\x1b[0m  Pending:  ${String(stats.pending || 0).padEnd(4)}         │ Failed: ${String(stats.failed || 0).padEnd(3)}  \x1b[1m\x1b[34m║\x1b[0m`);
        console.log(`\x1b[1m\x1b[34m╚══════════════════════════════════════════╝\x1b[0m`);
      }
    } catch (err: any) {
      if (isJson) {
        console.error(JSON.stringify({ error: err.message }));
      } else {
        console.error(`\x1b[1m\x1b[31m✗ Status failed:\x1b[0m ${err.message}`);
      }
      process.exit(1);
    }
  });

program.parse();
