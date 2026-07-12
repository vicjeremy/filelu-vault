import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { BackupEngine } from '../../../src/core/backup.js';
import { Uploader } from '../../../src/core/uploader.js';
import { Database } from '../../../src/db/database.js';
import { Encryptor } from '../../../src/core/encryption.js';
import { FileLuClient } from '../../../src/api/client.js';
import { writeFileSync, mkdirSync, symlinkSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

vi.mock('../../../src/core/uploader.js');

describe('BackupEngine', () => {
  let db: Database;
  let uploader: Uploader;
  let backupEngine: BackupEngine;
  let testDir: string;

  beforeEach(() => {
    db = new Database(':memory:');
    db.init();

    uploader = new Uploader({} as FileLuClient, db);
    vi.mocked(uploader.uploadFile).mockResolvedValue({ status: 'uploaded' });

    backupEngine = new BackupEngine(uploader, db);

    // Setup fixture directory
    testDir = join(tmpdir(), 'filelu-test-backup-' + Date.now());
    mkdirSync(testDir, { recursive: true });
    
    // Normal files
    writeFileSync(join(testDir, 'file1.txt'), 'hello');
    writeFileSync(join(testDir, 'file2.jpg'), 'image data');
    
    // Subdir
    mkdirSync(join(testDir, 'subdir'));
    writeFileSync(join(testDir, 'subdir', 'file3.txt'), 'nested');

    // Excluded patterns
    mkdirSync(join(testDir, 'node_modules'));
    writeFileSync(join(testDir, 'node_modules', 'dep.js'), 'code');
    
    mkdirSync(join(testDir, '.git'));
    writeFileSync(join(testDir, '.git', 'config'), 'git config');

    writeFileSync(join(testDir, '.DS_Store'), 'mac junk');
    writeFileSync(join(testDir, 'Thumbs.db'), 'win junk');
    writeFileSync(join(testDir, 'temp.tmp'), 'tmp');

    // Dot file
    writeFileSync(join(testDir, '.hidden'), 'hidden');

    // Empty file
    writeFileSync(join(testDir, 'empty.txt'), '');

    // Symlink
    try {
      symlinkSync(join(testDir, 'file1.txt'), join(testDir, 'symlink.txt'));
    } catch {
      // Ignore if symlink fails (e.g., Windows without admin)
    }
  });

  afterEach(() => {
    db.close();
    rmSync(testDir, { recursive: true, force: true });
    vi.clearAllMocks();
  });

  it('should scan directory and skip excluded patterns', async () => {
    const res = await backupEngine.run(testDir, { dryRun: true });
    
    expect(res.filesTotal).toBe(3); // file1, file2, subdir/file3
    expect(res.filesUploaded).toBe(0); // dry run
  });

  it('should upload files and track in database', async () => {
    const res = await backupEngine.run(testDir);
    
    expect(res.filesTotal).toBe(3);
    expect(res.filesUploaded).toBe(3);
    expect(res.filesSkipped).toBe(0);
    expect(res.filesFailed).toBe(0);
    expect(res.jobId).toBeDefined();

    // Verify DB
    const job = db.connection.prepare('SELECT * FROM backup_jobs WHERE id = ?').get(res.jobId) as any;
    expect(job.status).toBe('completed');
    expect(job.files_uploaded).toBe(3);

    expect(uploader.uploadFile).toHaveBeenCalledTimes(3);
  });

  it('should mark files as skipped if uploader skips them', async () => {
    vi.mocked(uploader.uploadFile).mockResolvedValueOnce({ status: 'skipped' });
    
    const res = await backupEngine.run(testDir);
    
    expect(res.filesUploaded).toBe(2);
    expect(res.filesSkipped).toBe(1);
  });

  it('should support encryption and use Encryptor', async () => {
    const encryptor = new Encryptor(Encryptor.generateKey());
    vi.spyOn(encryptor, 'encryptFile').mockResolvedValue(undefined);
    
    backupEngine = new BackupEngine(uploader, db, encryptor);
    
    await backupEngine.run(testDir, { encrypt: true });
    
    expect(encryptor.encryptFile).toHaveBeenCalledTimes(3);
    expect(uploader.uploadFile).toHaveBeenCalledWith(expect.stringContaining('filelu-enc-'), expect.objectContaining({ encrypt: true }));
  });

  it('should throw if encryption requested but encryptor not provided', async () => {
    await expect(backupEngine.run(testDir, { encrypt: true })).rejects.toThrow('not configured');
  });
});
