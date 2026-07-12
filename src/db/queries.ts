import type { Database } from './database.js';
import type { TrackedFile, BackupJob, DashboardStats } from './models.js';

export class Queries {
  private db: Database;

  constructor(db: Database) {
    this.db = db;
  }

  /**
   * Check if a file is already uploaded based on path and hash.
   */
  checkDedup(localPath: string, fileHash: string): Pick<TrackedFile, 'id' | 'file_hash' | 'status' | 'file_code'> | undefined {
    const stmt = this.db.connection.prepare(`
      SELECT id, file_hash, status, file_code
      FROM tracked_files
      WHERE local_path = ?
        AND file_hash = ?
        AND status = 'uploaded';
    `);
    return stmt.get(localPath, fileHash) as Pick<TrackedFile, 'id' | 'file_hash' | 'status' | 'file_code'> | undefined;
  }

  /**
   * Get all files that need to be uploaded.
   */
  getPendingFiles(): TrackedFile[] {
    const stmt = this.db.connection.prepare(`
      SELECT * FROM tracked_files
      WHERE status IN ('pending', 'failed')
      ORDER BY created_at ASC;
    `);
    return stmt.all() as TrackedFile[];
  }

  /**
   * Record a successful upload for a file.
   */
  recordUploadSuccess(id: number, fileCode: string, fileUrl: string): void {
    const stmt = this.db.connection.prepare(`
      UPDATE tracked_files
      SET file_code = ?, file_url = ?, status = 'uploaded',
          updated_at = datetime('now'), last_synced_at = datetime('now')
      WHERE id = ?;
    `);
    stmt.run(fileCode, fileUrl, id);
  }

  /**
   * Fetch aggregate statistics for the dashboard.
   */
  getDashboardStats(): DashboardStats {
    const stmt = this.db.connection.prepare(`
      SELECT
        COUNT(*) AS totalFiles,
        COUNT(CASE WHEN status = 'uploaded' THEN 1 END) AS uploadedFiles,
        COUNT(CASE WHEN status = 'pending' THEN 1 END) AS pendingFiles,
        COUNT(CASE WHEN status = 'failed' THEN 1 END) AS failedFiles,
        COALESCE(SUM(file_size), 0) AS totalBytes,
        (SELECT COUNT(*) FROM backup_jobs) AS totalJobs
      FROM tracked_files;
    `);
    return stmt.get() as DashboardStats;
  }

  /**
   * Get summary for a specific backup job.
   */
  getBackupJobSummary(id: number): Pick<BackupJob, 'source_dir' | 'status' | 'files_total' | 'files_uploaded' | 'files_skipped' | 'files_failed'> & { duration_s: number } | undefined {
    const stmt = this.db.connection.prepare(`
      SELECT source_dir, status, files_total, files_uploaded, files_skipped, files_failed,
        ROUND((julianday(COALESCE(completed_at, datetime('now'))) - julianday(started_at)) * 86400, 1) AS duration_s
      FROM backup_jobs WHERE id = ?;
    `);
    return stmt.get(id) as Pick<BackupJob, 'source_dir' | 'status' | 'files_total' | 'files_uploaded' | 'files_skipped' | 'files_failed'> & { duration_s: number } | undefined;
  }
}
