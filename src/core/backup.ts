import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import type { Database } from '../db/database.js';
import type { Uploader } from './uploader.js';
import type { Encryptor } from './encryption.js';
import { logger } from '../utils/logger.js';
import { hashFile } from '../utils/hash.js';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';
import { unlinkSync } from 'node:fs';

export interface BackupOptions {
  dryRun?: boolean;
  encrypt?: boolean;
  excludePatterns?: string[];
}

export interface BackupResult {
  jobId?: number;
  sourceDir: string;
  filesTotal: number;
  filesUploaded: number;
  filesSkipped: number;
  filesFailed: number;
}

export class BackupEngine {
  private uploader: Uploader;
  private db: Database;
  private encryptor?: Encryptor;

  constructor(uploader: Uploader, db: Database, encryptor?: Encryptor) {
    this.uploader = uploader;
    this.db = db;
    this.encryptor = encryptor;
  }

  /**
   * Run a backup job on a directory.
   */
  async run(sourceDir: string, options?: BackupOptions): Promise<BackupResult> {
    const excludePatterns = options?.excludePatterns || ['node_modules', '.git', '.DS_Store', 'Thumbs.db', '*.tmp', '*.swp'];
    
    if (options?.encrypt && !this.encryptor) {
      throw new Error('Encryptor not configured but encryption requested');
    }

    logger.info(`Starting backup of ${sourceDir}`);
    if (options?.dryRun) logger.info('--dry-run enabled (no files will be uploaded)');
    if (options?.encrypt) logger.info('--encrypt enabled');

    // 1. Scan directory
    const files = this.scanDir(sourceDir, excludePatterns);
    
    const result: BackupResult = {
      sourceDir,
      filesTotal: files.length,
      filesUploaded: 0,
      filesSkipped: 0,
      filesFailed: 0,
    };

    if (options?.dryRun) {
      logger.info(`Scan complete. Found ${files.length} files to upload.`);
      return result; // Dry run finishes here
    }

    // 2. Create job in DB
    let jobId: number;
    const stmt = this.db.connection.prepare(`
      INSERT INTO backup_jobs (source_dir, files_total)
      VALUES (?, ?)
    `);
    const row = stmt.run(sourceDir, files.length);
    jobId = row.lastInsertRowid as number;
    result.jobId = jobId;

    // 3. Upload files
    for (const filePath of files) {
      let uploadPath = filePath;
      let cleanupPath: string | null = null;

      try {
        const hash = await hashFile(filePath);
        // We no longer need to check dedup here, Uploader will do it if we pass originalPath and originalHash.
        
        if (options?.encrypt) {
          const tempFile = join(tmpdir(), `filelu-enc-${randomBytes(8).toString('hex')}.bin`);
          await this.encryptor!.encryptFile(filePath, tempFile);
          uploadPath = tempFile;
          cleanupPath = tempFile;
        }

        const res = await this.uploader.uploadFile(uploadPath, { 
          encrypt: options?.encrypt,
          originalPath: filePath,
          originalHash: hash
        });
        
        if (res.status === 'uploaded') {
          result.filesUploaded++;
          
          // Link file to backup job
          this.db.connection.prepare(`
            UPDATE tracked_files SET backup_job_id = ? WHERE local_path = ?
          `).run(jobId, filePath);
        } else {
          result.filesSkipped++;
        }
      } catch (err) {
        logger.error(`Failed to process ${filePath}`, { error: err as Error });
        result.filesFailed++;
      } finally {
        if (cleanupPath) {
          try { unlinkSync(cleanupPath); } catch {}
        }
      }

      this.updateJobStats(jobId, result);
    }

    // 4. Complete job
    this.db.connection.prepare(`
      UPDATE backup_jobs 
      SET status = ?, completed_at = datetime('now')
      WHERE id = ?
    `).run(result.filesFailed > 0 ? 'failed' : 'completed', jobId);

    logger.info('Backup complete');
    return result;
  }

  private updateJobStats(jobId: number, stats: BackupResult): void {
    this.db.connection.prepare(`
      UPDATE backup_jobs 
      SET files_uploaded = ?, files_skipped = ?, files_failed = ?
      WHERE id = ?
    `).run(stats.filesUploaded, stats.filesSkipped, stats.filesFailed, jobId);
  }

  private scanDir(dir: string, exclude: string[]): string[] {
    const files: string[] = [];
    
    try {
      const entries = readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.isSymbolicLink()) continue; // Skip symlinks
        
        const name = entry.name;
        if (name.startsWith('.')) continue; // Skip dotfiles

        let skip = false;
        for (const pattern of exclude) {
          if (name === pattern || name.endsWith(pattern.replace('*', ''))) {
            skip = true;
            break;
          }
        }
        if (skip) continue;

        const fullPath = join(dir, name);
        if (entry.isDirectory()) {
          files.push(...this.scanDir(fullPath, exclude));
        } else if (entry.isFile()) {
          const stat = statSync(fullPath);
          if (stat.size === 0) {
            logger.warn(`Skipping 0-byte file: ${fullPath}`);
            continue;
          }
          files.push(fullPath);
        }
      }
    } catch (err) {
      logger.error(`Failed to scan directory ${dir}`, { error: err as Error });
    }
    
    return files;
  }
}
