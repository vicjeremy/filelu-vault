import { FileLuClient } from '../api/client.js';
import type { UploadResult } from '../api/types.js';
import type { Database } from '../db/database.js';
import { Queries } from '../db/queries.js';
import { hashFile } from '../utils/hash.js';
import { logger } from '../utils/logger.js';
import { statSync } from 'node:fs';

export interface UploadOptions {
  encrypt?: boolean;
  originalPath?: string;
  originalHash?: string;
}

export interface BatchOptions extends UploadOptions {
  concurrency?: number;
}

export interface BatchResult {
  uploaded: number;
  skipped: number;
  failed: number;
}

export class Uploader {
  private client: FileLuClient;
  private db: Database;
  private queries: Queries;

  constructor(client: FileLuClient, db: Database) {
    this.client = client;
    this.db = db;
    this.queries = new Queries(db);
  }

  /**
   * Upload a single file with deduplication check and progress tracking.
   */
  async uploadFile(filePath: string, options?: UploadOptions): Promise<{ status: 'uploaded' | 'skipped', result?: UploadResult }> {
    const dbPath = options?.originalPath || filePath;
    logger.debug(`Hashing file: ${filePath}`);
    const hash = options?.originalHash || await hashFile(filePath);
    const stat = statSync(filePath);
    
    // Check dedup
    const existing = this.queries.checkDedup(dbPath, hash);
    if (existing) {
      logger.debug(`Skipping upload (dedup match): ${dbPath}`);
      return { status: 'skipped' };
    }

    // Get track file id if it exists, otherwise we should insert it
    let fileId: number;
    const stmt = this.db.connection.prepare(`
      INSERT INTO tracked_files (local_path, file_hash, file_size, status, encrypted)
      VALUES (?, ?, ?, 'uploading', ?)
      ON CONFLICT(local_path) DO UPDATE SET
        file_hash = excluded.file_hash,
        file_size = excluded.file_size,
        status = 'uploading',
        encrypted = excluded.encrypted
      RETURNING id
    `);
    const row = stmt.get(dbPath, hash, stat.size, options?.encrypt ? 1 : 0) as { id: number };
    fileId = row.id;

    try {
      logger.debug(`Getting upload server for: ${filePath}`);
      const server = await this.client.getUploadServer();
      
      logger.debug(`Uploading file to ${server.url}`);
      // Log attempt
      this.db.connection.prepare(`
        INSERT INTO upload_logs (tracked_file_id, attempt_number, status, upload_server)
        VALUES (?, 1, 'success', ?)
      `).run(fileId, server.url);

      // In real scenario we could hook up progress bar inside the fetch if supported,
      // but form-data + node-fetch stream doesn't easily expose progress.
      // We will rely on Uploader logging and maybe CLI to show simple progress.
      const result = await this.client.uploadFile(server.url, server.sessId, filePath);

      // Record success
      const fileUrl = `https://filelu.com/${result.file_code}`;
      this.queries.recordUploadSuccess(fileId, result.file_code, fileUrl);
      
      return { status: 'uploaded', result };
    } catch (err) {
      // Record failure
      this.db.connection.prepare(`
        UPDATE tracked_files SET status = 'failed' WHERE id = ?
      `).run(fileId);
      
      const errMsg = err instanceof Error ? err.message : 'Unknown error';
      this.db.connection.prepare(`
        INSERT INTO upload_logs (tracked_file_id, attempt_number, status, error_message)
        VALUES (?, 1, 'failed', ?)
      `).run(fileId, errMsg);

      throw err;
    }
  }

  /**
   * Upload multiple files with concurrency limit.
   */
  async uploadBatch(files: string[], options?: BatchOptions): Promise<BatchResult> {
    const concurrency = Math.min(options?.concurrency || 3, 10);
    const result: BatchResult = { uploaded: 0, skipped: 0, failed: 0 };
    
    let index = 0;
    
    const worker = async () => {
      while (index < files.length) {
        const i = index++;
        const file = files[i];
        
        try {
          const res = await this.uploadFile(file, options);
          if (res.status === 'uploaded') {
            result.uploaded++;
          } else {
            result.skipped++;
          }
        } catch (err) {
          logger.error(`Failed to upload ${file}`, { error: err });
          result.failed++;
        }
      }
    };
    
    const workers = [];
    for (let i = 0; i < concurrency; i++) {
      workers.push(worker());
    }
    
    await Promise.all(workers);
    return result;
  }
}
