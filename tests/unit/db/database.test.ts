import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Database } from '../../../src/db/database.js';
import { Queries } from '../../../src/db/queries.js';
import { DatabaseError } from '../../../src/utils/errors.js';

describe('Database Layer', () => {
  let db: Database;
  let queries: Queries;

  beforeEach(() => {
    db = new Database(':memory:');
    db.init();
    queries = new Queries(db);
  });

  afterEach(() => {
    db.close();
  });

  describe('Database', () => {
    it('should throw if connection accessed before init', () => {
      const uninitDb = new Database(':memory:');
      expect(() => uninitDb.connection).toThrow(DatabaseError);
    });

    it('should initialize and apply migrations', () => {
      const currentVersion = db.connection.pragma('user_version', { simple: true });
      expect(currentVersion).toBe(1);

      // Verify tables exist
      const tables = db.connection.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name IN ('tracked_files', 'backup_jobs', 'upload_logs')").all();
      expect(tables.length).toBe(3);
    });

    it('should close connection gracefully', () => {
      db.close();
      expect(() => db.connection).toThrow(DatabaseError);
    });
  });

  describe('Queries', () => {
    beforeEach(() => {
      // Seed data
      db.connection.prepare(`
        INSERT INTO tracked_files (local_path, file_hash, file_size, status)
        VALUES ('/test/file1.txt', 'hash1', 100, 'pending')
      `).run();
      db.connection.prepare(`
        INSERT INTO tracked_files (local_path, file_hash, file_size, status, file_code, file_url)
        VALUES ('/test/file2.txt', 'hash2', 200, 'uploaded', 'code2', 'http://filelu.com/code2')
      `).run();
    });

    describe('checkDedup', () => {
      it('should return undefined if file not uploaded', () => {
        const result = queries.checkDedup('/test/file1.txt', 'hash1');
        expect(result).toBeUndefined();
      });

      it('should return file info if file is uploaded and hashes match', () => {
        const result = queries.checkDedup('/test/file2.txt', 'hash2');
        expect(result).toBeDefined();
        expect(result?.file_hash).toBe('hash2');
        expect(result?.status).toBe('uploaded');
        expect(result?.file_code).toBe('code2');
      });

      it('should return undefined if hashes do not match', () => {
        const result = queries.checkDedup('/test/file2.txt', 'hash3');
        expect(result).toBeUndefined();
      });
    });

    describe('getPendingFiles', () => {
      it('should return only pending and failed files', () => {
        const files = queries.getPendingFiles();
        expect(files.length).toBe(1);
        expect(files[0].local_path).toBe('/test/file1.txt');
      });
    });

    describe('recordUploadSuccess', () => {
      it('should update file status to uploaded', () => {
        const file = db.connection.prepare("SELECT id FROM tracked_files WHERE local_path = '/test/file1.txt'").get() as { id: number };
        
        queries.recordUploadSuccess(file.id, 'code1', 'http://filelu.com/code1');
        
        const updated = db.connection.prepare("SELECT status, file_code, file_url FROM tracked_files WHERE id = ?").get(file.id) as any;
        expect(updated.status).toBe('uploaded');
        expect(updated.file_code).toBe('code1');
        expect(updated.file_url).toBe('http://filelu.com/code1');
      });
    });

    describe('getDashboardStats', () => {
      it('should return correct aggregates', () => {
        const stats = queries.getDashboardStats();
        expect(stats.totalFiles).toBe(2);
        expect(stats.uploadedFiles).toBe(1);
        expect(stats.pendingFiles).toBe(1);
        expect(stats.failedFiles).toBe(0);
        expect(stats.totalBytes).toBe(300);
        expect(stats.totalJobs).toBe(0);
      });
    });

    describe('getBackupJobSummary', () => {
      it('should return correct job summary', () => {
        const info = db.connection.prepare(`
          INSERT INTO backup_jobs (source_dir, status, files_total, started_at)
          VALUES ('/test/dir', 'running', 5, datetime('now', '-1 hour'))
        `).run();

        const summary = queries.getBackupJobSummary(info.lastInsertRowid as number);
        expect(summary).toBeDefined();
        expect(summary?.source_dir).toBe('/test/dir');
        expect(summary?.status).toBe('running');
        expect(summary?.files_total).toBe(5);
        expect(summary?.duration_s).toBeGreaterThanOrEqual(3600); // at least 1 hour in seconds
      });
    });
  });
});
