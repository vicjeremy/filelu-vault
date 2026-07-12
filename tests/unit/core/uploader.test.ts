import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Uploader } from '../../../src/core/uploader.js';
import { FileLuClient } from '../../../src/api/client.js';
import { Database } from '../../../src/db/database.js';
import { writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';
import { ApiError } from '../../../src/utils/errors.js';

vi.mock('../../../src/api/client.js');

describe('Uploader', () => {
  let db: Database;
  let client: FileLuClient;
  let uploader: Uploader;
  const testFiles: string[] = [];

  beforeEach(() => {
    db = new Database(':memory:');
    db.init();
    
    // Setup client mock
    client = new FileLuClient('test-key', 3);
    vi.mocked(client.getUploadServer).mockResolvedValue({
      status: 200,
      sessId: 'sess123',
      url: 'http://upload.test.com/',
      msg: 'OK',
      server_time: '2026'
    });
    vi.mocked(client.uploadFile).mockResolvedValue({
      file_code: 'abc',
      file_status: 'OK'
    });

    uploader = new Uploader(client, db);
  });

  afterEach(() => {
    db.close();
    testFiles.forEach(f => {
      try { unlinkSync(f); } catch {}
    });
    testFiles.length = 0;
    vi.clearAllMocks();
  });

  function createTestFile(content: string): string {
    const p = join(tmpdir(), `test-up-${randomBytes(4).toString('hex')}.txt`);
    writeFileSync(p, content);
    testFiles.push(p);
    return p;
  }

  describe('uploadFile', () => {
    it('should upload a new file and record success in db', async () => {
      const p = createTestFile('hello uploader');
      const res = await uploader.uploadFile(p);
      
      expect(res.status).toBe('uploaded');
      expect(res.result?.file_code).toBe('abc');
      
      // Verify db
      const fileInDb = db.connection.prepare('SELECT * FROM tracked_files WHERE local_path = ?').get(p) as any;
      expect(fileInDb.status).toBe('uploaded');
      expect(fileInDb.file_code).toBe('abc');
    });

    it('should skip upload if file is already uploaded with same hash (dedup)', async () => {
      const p = createTestFile('hello dedup');
      
      // Upload first time
      await uploader.uploadFile(p);
      expect(client.uploadFile).toHaveBeenCalledTimes(1);
      
      // Upload second time
      const res2 = await uploader.uploadFile(p);
      expect(res2.status).toBe('skipped');
      expect(client.uploadFile).toHaveBeenCalledTimes(1); // not called again
    });

    it('should retry on failure handled by client, but Uploader handles client throwing error', async () => {
      const p = createTestFile('hello fail');
      
      vi.mocked(client.uploadFile).mockRejectedValueOnce(new ApiError('Upload Failed', 500));
      
      await expect(uploader.uploadFile(p)).rejects.toThrow(ApiError);
      
      // Verify db status is failed
      const fileInDb = db.connection.prepare('SELECT * FROM tracked_files WHERE local_path = ?').get(p) as any;
      expect(fileInDb.status).toBe('failed');
      
      // Verify log
      const logs = db.connection.prepare('SELECT * FROM upload_logs WHERE tracked_file_id = ?').all(fileInDb.id);
      expect(logs.length).toBeGreaterThan(0);
      expect((logs[logs.length - 1] as any).status).toBe('failed');
    });
  });

  describe('uploadBatch', () => {
    it('should process multiple files respecting concurrency limits', async () => {
      const p1 = createTestFile('file1');
      const p2 = createTestFile('file2');
      const p3 = createTestFile('file3');
      const p4 = createTestFile('file4');
      
      const res = await uploader.uploadBatch([p1, p2, p3, p4], { concurrency: 2 });
      
      expect(res.uploaded).toBe(4);
      expect(res.skipped).toBe(0);
      expect(res.failed).toBe(0);
      expect(client.uploadFile).toHaveBeenCalledTimes(4);
    });

    it('should handle partial failures in batch', async () => {
      const p1 = createTestFile('file1');
      const p2 = createTestFile('file2');
      const p3 = createTestFile('file3');
      
      vi.mocked(client.uploadFile).mockImplementation(async (url, sess, path) => {
        if (path === p2) throw new Error('fail');
        return { file_code: 'code', file_status: 'OK' };
      });
      
      const res = await uploader.uploadBatch([p1, p2, p3], { concurrency: 2 });
      
      expect(res.uploaded).toBe(2);
      expect(res.skipped).toBe(0);
      expect(res.failed).toBe(1);
    });
  });
});
