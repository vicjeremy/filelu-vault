import { watch, type FSWatcher, statSync, readdirSync, existsSync } from 'node:fs';
import { join, resolve } from 'node:path';
import type { Database } from '../db/database.js';
import type { BackupEngine } from './backup.js';
import { logger } from '../utils/logger.js';
import type { Uploader } from './uploader.js';
import type { Encryptor } from './encryption.js';
import { hashFile } from '../utils/hash.js';
import { randomBytes } from 'node:crypto';
import { tmpdir } from 'node:os';
import { unlinkSync } from 'node:fs';

export interface SyncOptions {
  encrypt?: boolean;
  excludePatterns?: string[];
  debounceMs?: number;
}

export class SyncEngine {
  private uploader: Uploader;
  private db: Database;
  private encryptor?: Encryptor;
  private watchers: Map<string, FSWatcher> = new Map();
  private pendingUploads: Map<string, NodeJS.Timeout> = new Map();
  private isRunning: boolean = false;

  constructor(uploader: Uploader, db: Database, encryptor?: Encryptor) {
    this.uploader = uploader;
    this.db = db;
    this.encryptor = encryptor;
  }

  /**
   * Start syncing a directory. Will automatically perform an initial scan/backup.
   */
  async start(sourceDir: string, backupEngine: BackupEngine, options?: SyncOptions): Promise<void> {
    if (this.isRunning) return;
    this.isRunning = true;
    
    const absPath = resolve(sourceDir);
    logger.info(`Starting sync on ${absPath}`);

    if (options?.encrypt && !this.encryptor) {
      throw new Error('Encryptor not configured but encryption requested');
    }

    // 1. Initial backup sync
    logger.info('Performing initial sync scan...');
    await backupEngine.run(absPath, options);
    
    // 2. Setup watchers
    const excludePatterns = options?.excludePatterns || ['node_modules', '.git', '.DS_Store', 'Thumbs.db', '*.tmp', '*.swp'];
    this.watchDirRecursive(absPath, absPath, excludePatterns, options);

    // 3. Graceful shutdown handlers (will be registered by CLI, but we expose stop)
  }

  stop(): void {
    if (!this.isRunning) return;
    this.isRunning = false;
    logger.info('Stopping sync engine...');
    
    // Clear all watchers
    for (const watcher of this.watchers.values()) {
      watcher.close();
    }
    this.watchers.clear();

    // Clear debounced timeouts
    for (const timeout of this.pendingUploads.values()) {
      clearTimeout(timeout);
    }
    this.pendingUploads.clear();
  }

  private watchDirRecursive(rootDir: string, currentDir: string, exclude: string[], options?: SyncOptions): void {
    if (!this.isRunning || !existsSync(currentDir)) return;

    try {
      const watcher = watch(currentDir, (_, filename) => {
        if (!filename) return;
        const fullPath = join(currentDir, filename);
        this.handleWatchEvent(fullPath, exclude, options);
      });
      
      watcher.on('error', (err) => {
        logger.error(`Watcher error on ${currentDir}`, { error: err as Error });
      });

      this.watchers.set(currentDir, watcher);

      // Recursively watch subdirectories
      const entries = readdirSync(currentDir, { withFileTypes: true });
      for (const entry of entries) {
        const name = entry.name;
        if (entry.isSymbolicLink() || name.startsWith('.')) continue;

        let skip = false;
        for (const pattern of exclude) {
          if (name === pattern || name.endsWith(pattern.replace('*', ''))) {
            skip = true;
            break;
          }
        }
        
        if (!skip && entry.isDirectory()) {
          this.watchDirRecursive(rootDir, join(currentDir, name), exclude, options);
        }
      }
    } catch (err) {
      logger.error(`Failed to watch directory ${currentDir}`, { error: err as Error });
    }
  }

  private handleWatchEvent(filePath: string, exclude: string[], options?: SyncOptions): void {
    const name = basename(filePath);
    if (name.startsWith('.')) return; // skip dotfiles

    for (const pattern of exclude) {
      if (name === pattern || name.endsWith(pattern.replace('*', ''))) {
        return; // skip excluded
      }
    }

    const debounceMs = options?.debounceMs ?? 1000;

    // Clear existing timeout for this file
    if (this.pendingUploads.has(filePath)) {
      clearTimeout(this.pendingUploads.get(filePath));
    }

    // Debounce
    const timeout = setTimeout(() => {
      this.pendingUploads.delete(filePath);
      this.processFileChange(filePath, options).catch(err => {
        logger.error(`Failed to process sync event for ${filePath}`, { error: err as Error });
      });
    }, debounceMs);

    this.pendingUploads.set(filePath, timeout);
  }

  private async processFileChange(filePath: string, options?: SyncOptions): Promise<void> {
    if (!this.isRunning) return;

    // Check if file was deleted
    if (!existsSync(filePath)) {
      logger.info(`Detected deletion: ${filePath}`);
      this.db.connection.prepare(`
        UPDATE tracked_files SET status = 'deleted' WHERE local_path = ?
      `).run(filePath);
      return;
    }

    const stat = statSync(filePath);
    if (stat.isDirectory()) {
      // New directory added, we need to watch it
      if (!this.watchers.has(filePath)) {
        logger.info(`Detected new directory: ${filePath}`);
        const excludePatterns = options?.excludePatterns || ['node_modules', '.git', '.DS_Store', 'Thumbs.db', '*.tmp', '*.swp'];
        // Assume rootDir doesn't need to be perfectly mapped for the recursive watcher inside handleWatchEvent
        this.watchDirRecursive(filePath, filePath, excludePatterns, options); 
      }
      return;
    }

    if (stat.size === 0) return; // Skip 0 byte files
    
    // File was added or changed
    logger.info(`Detected change: ${filePath}`);

    let uploadPath = filePath;
    let cleanupPath: string | null = null;
    const hash = await hashFile(filePath);

    try {
      if (options?.encrypt) {
        const tempFile = join(tmpdir(), `filelu-enc-${randomBytes(8).toString('hex')}.bin`);
        await this.encryptor!.encryptFile(filePath, tempFile);
        uploadPath = tempFile;
        cleanupPath = tempFile;
      }

      await this.uploader.uploadFile(uploadPath, { 
        encrypt: options?.encrypt,
        originalPath: filePath,
        originalHash: hash
      });
      
      logger.info(`Successfully synced ${filePath}`);
    } finally {
      if (cleanupPath) {
        try { unlinkSync(cleanupPath); } catch {}
      }
    }
  }
}

// Helper since node:path basename is tricky to import correctly if we want to avoid multiple imports
function basename(p: string): string {
  const parts = p.split(/[/\\]/);
  return parts[parts.length - 1];
}
