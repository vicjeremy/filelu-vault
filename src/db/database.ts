import SQLite from 'better-sqlite3';
import type { Database as SqliteDatabase } from 'better-sqlite3';
import { existsSync, mkdirSync, chmodSync } from 'node:fs';
import { dirname } from 'node:path';
import { DatabaseError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';

/**
 * FileLu Vault SQLite Database Manager.
 * Handles connections, pragmas, and schema migrations.
 */
export class Database {
  private db: SqliteDatabase | null = null;
  private readonly dbPath: string;

  /**
   * @param dbPath - Absolute path to the SQLite database file. Pass ':memory:' for in-memory DB.
   */
  constructor(dbPath: string) {
    this.dbPath = dbPath;
  }

  /**
   * Get the underlying better-sqlite3 instance.
   * Throws if the database hasn't been initialized.
   */
  get connection(): SqliteDatabase {
    if (!this.db) {
      throw new DatabaseError('Database not initialized. Call init() first.');
    }
    return this.db;
  }

  /**
   * Open the connection, apply pragmas, and run migrations.
   */
  init(): void {
    if (this.db) return; // Already initialized

    try {
      if (this.dbPath !== ':memory:') {
        const dir = dirname(this.dbPath);
        if (!existsSync(dir)) {
          mkdirSync(dir, { recursive: true, mode: 0o700 });
        }
      }

      this.db = new SQLite(this.dbPath);

      // Set owner-only permissions for persistent databases
      if (this.dbPath !== ':memory:') {
        chmodSync(this.dbPath, 0o600);
      }

      this.applyPragmas();
      this.migrate();
      logger.debug('Database initialized successfully', { path: this.dbPath });
    } catch (cause) {
      throw new DatabaseError(`Failed to initialize database at ${this.dbPath}`, { cause: cause as Error });
    }
  }

  /**
   * Close the database connection.
   */
  close(): void {
    if (this.db) {
      this.db.close();
      this.db = null;
      logger.debug('Database connection closed');
    }
  }

  private applyPragmas(): void {
    if (!this.db) return;
    this.db.pragma('journal_mode = WAL');
    this.db.pragma('foreign_keys = ON');
    this.db.pragma('busy_timeout = 5000');
    this.db.pragma('synchronous = NORMAL');
  }

  private migrate(): void {
    if (!this.db) return;

    const currentVersion = this.db.pragma('user_version', { simple: true }) as number;

    if (currentVersion < 1) {
      logger.debug('Running database migration v1');
      this.db.exec(`
        CREATE TABLE tracked_files (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          local_path TEXT NOT NULL UNIQUE,
          file_hash TEXT NOT NULL,
          file_size INTEGER NOT NULL,
          file_code TEXT,
          file_url TEXT,
          status TEXT NOT NULL DEFAULT 'pending',
          encrypted INTEGER NOT NULL DEFAULT 0,
          backup_job_id INTEGER,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          updated_at TEXT NOT NULL DEFAULT (datetime('now')),
          last_synced_at TEXT,
          FOREIGN KEY(backup_job_id) REFERENCES backup_jobs(id) ON DELETE SET NULL
        );

        CREATE TABLE backup_jobs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          source_dir TEXT NOT NULL,
          status TEXT NOT NULL DEFAULT 'running',
          files_total INTEGER NOT NULL DEFAULT 0,
          files_uploaded INTEGER NOT NULL DEFAULT 0,
          files_skipped INTEGER NOT NULL DEFAULT 0,
          files_failed INTEGER NOT NULL DEFAULT 0,
          error_message TEXT,
          started_at TEXT NOT NULL DEFAULT (datetime('now')),
          completed_at TEXT
        );

        CREATE TABLE upload_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          tracked_file_id INTEGER NOT NULL,
          attempt_number INTEGER NOT NULL DEFAULT 1,
          status TEXT NOT NULL,
          error_message TEXT,
          upload_server TEXT,
          duration_ms INTEGER,
          created_at TEXT NOT NULL DEFAULT (datetime('now')),
          FOREIGN KEY(tracked_file_id) REFERENCES tracked_files(id) ON DELETE CASCADE
        );

        CREATE INDEX idx_files_hash ON tracked_files(file_hash);
        CREATE INDEX idx_files_status ON tracked_files(status);
        CREATE INDEX idx_files_path ON tracked_files(local_path);
        CREATE INDEX idx_files_backup ON tracked_files(backup_job_id);
      `);
      this.db.pragma('user_version = 1');
    }
  }
}
