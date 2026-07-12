/**
 * TypeScript interfaces for all SQLite database row shapes.
 * These mirror the schema defined in DATA_MODEL.md §3.
 */

/**
 * Status values for tracked files.
 * State machine: pending → uploading → uploaded
 *                                    → failed (retryable)
 *                        → deleted
 */
export type FileStatus = 'pending' | 'uploading' | 'uploaded' | 'failed' | 'deleted';

/**
 * Status values for backup jobs.
 */
export type BackupJobStatus = 'running' | 'completed' | 'failed' | 'cancelled';

/**
 * Status values for upload log entries.
 */
export type UploadLogStatus = 'success' | 'failed' | 'timeout';

/**
 * Represents a file being tracked for upload/backup/sync.
 * Maps to the `tracked_files` table.
 */
export interface TrackedFile {
  /** Auto-increment primary key (undefined on INSERT) */
  id?: number;
  /** Absolute local filesystem path (UNIQUE) */
  local_path: string;
  /** SHA-256 hex digest of file content */
  file_hash: string;
  /** File size in bytes */
  file_size: number;
  /** FileLu file code after successful upload (null until uploaded) */
  file_code: string | null;
  /** Full FileLu URL (null until uploaded) */
  file_url: string | null;
  /** Current file state */
  status: FileStatus;
  /** Whether the file was encrypted before upload */
  encrypted: boolean;
  /** FK → backup_jobs.id (null for standalone uploads) */
  backup_job_id?: number | null;
  /** UTC ISO-8601 creation timestamp */
  created_at: string;
  /** UTC ISO-8601 last-update timestamp */
  updated_at: string;
  /** UTC ISO-8601 timestamp of last sync (null if never synced) */
  last_synced_at: string | null;
}

/**
 * Represents a backup job (a scan + upload of a directory).
 * Maps to the `backup_jobs` table.
 */
export interface BackupJob {
  /** Auto-increment primary key */
  id?: number;
  /** Absolute path of the directory being backed up */
  source_dir: string;
  /** Current job state */
  status: BackupJobStatus;
  /** Total files discovered in the scan */
  files_total: number;
  /** Files successfully uploaded in this job */
  files_uploaded: number;
  /** Files skipped (unchanged hash) */
  files_skipped: number;
  /** Files that failed to upload */
  files_failed: number;
  /** Error message if job failed */
  error_message?: string | null;
  /** UTC ISO-8601 timestamp when job started */
  started_at: string;
  /** UTC ISO-8601 timestamp when job ended (null if still running) */
  completed_at: string | null;
}

/**
 * Represents a single upload attempt log entry.
 * Maps to the `upload_logs` table.
 */
export interface UploadLog {
  /** Auto-increment primary key */
  id?: number;
  /** FK → tracked_files.id (CASCADE DELETE) */
  tracked_file_id: number;
  /** Attempt number: 1, 2, 3... */
  attempt_number: number;
  /** Outcome of this attempt */
  status: UploadLogStatus;
  /** Error message if attempt failed */
  error_message?: string | null;
  /** Upload server URL used for this attempt */
  upload_server?: string | null;
  /** Duration of the upload attempt in milliseconds */
  duration_ms?: number | null;
  /** UTC ISO-8601 timestamp when attempt was made */
  created_at: string;
}

/**
 * Dashboard statistics returned by Database.getStats().
 */
export interface DashboardStats {
  totalFiles: number;
  uploadedFiles: number;
  pendingFiles: number;
  failedFiles: number;
  totalBytes: number;
  totalJobs: number;
}
