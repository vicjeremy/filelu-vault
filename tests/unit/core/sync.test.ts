import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { EventEmitter } from 'node:events';

const mockWatcher = new EventEmitter();
(mockWatcher as any).close = vi.fn();

vi.mock('node:fs', async (importOriginal) => {
  const actual: any = await importOriginal();
  return {
    ...actual,
    watch: vi.fn((path, listener) => {
      if (typeof listener === 'function') {
        mockWatcher.on('change', listener);
      }
      return mockWatcher;
    }),
    existsSync: vi.fn(() => true),
    readdirSync: vi.fn(() => []),
    statSync: vi.fn(() => ({ isDirectory: () => false, size: 100 })),
  };
});

import { SyncEngine } from '../../../src/core/sync.js';
import { Uploader } from '../../../src/core/uploader.js';
import { Database } from '../../../src/db/database.js';
import { BackupEngine } from '../../../src/core/backup.js';
import { FileLuClient } from '../../../src/api/client.js';
import * as fs from 'node:fs';
import * as hashModule from '../../../src/utils/hash.js';

vi.mock('../../../src/core/uploader.js');
vi.mock('../../../src/core/backup.js');

describe('SyncEngine', () => {
  let db: Database;
  let uploader: Uploader;
  let backupEngine: BackupEngine;
  let syncEngine: SyncEngine;
  
  beforeEach(() => {
    db = new Database(':memory:');
    db.init();

    uploader = new Uploader({} as FileLuClient, db);
    vi.mocked(uploader.uploadFile).mockResolvedValue({ status: 'uploaded' });

    backupEngine = new BackupEngine(uploader, db);
    vi.mocked(backupEngine.run).mockResolvedValue({
      sourceDir: '/test', filesTotal: 0, filesUploaded: 0, filesSkipped: 0, filesFailed: 0
    });

    syncEngine = new SyncEngine(uploader, db);
    
    vi.mocked(fs.watch).mockClear();
    vi.mocked(fs.existsSync).mockClear();
    vi.mocked(fs.readdirSync).mockClear();
    vi.mocked(fs.statSync).mockClear();
    (mockWatcher as any).close.mockClear();
    mockWatcher.removeAllListeners();
    
    vi.spyOn(hashModule, 'hashFile').mockResolvedValue('fakehash');
    vi.spyOn(hashModule, 'hashFile').mockResolvedValue('fakehash');
    
    vi.useFakeTimers();
  });

  afterEach(() => {
    syncEngine.stop();
    db.close();
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should run initial backup and start watching on start', async () => {
    await syncEngine.start('/test-dir', backupEngine);
    
    expect(backupEngine.run).toHaveBeenCalledWith(expect.stringContaining('test-dir'), undefined);
    expect(fs.watch).toHaveBeenCalled();
  });

  it('should debounce file changes and upload', async () => {
    await syncEngine.start('/test-dir', backupEngine);

    // Emit file change
    mockWatcher.emit('change', 'change', 'file.txt');
    
    // Uploader shouldn't be called immediately due to debounce
    expect(uploader.uploadFile).not.toHaveBeenCalled();

    // Fast-forward time
    await vi.runAllTimersAsync();

    // Now it should be called
    expect(uploader.uploadFile).toHaveBeenCalledWith(expect.stringContaining('file.txt'), expect.any(Object));
  });

  it('should skip excluded files', async () => {
    await syncEngine.start('/test-dir', backupEngine, { excludePatterns: ['*.tmp'] });

    mockWatcher.emit('change', 'change', 'ignored.tmp');
    await vi.runAllTimersAsync();

    expect(uploader.uploadFile).not.toHaveBeenCalled();
  });

  it('should mark deleted files in DB', async () => {
    // Insert a file into DB first
    const path = require('node:path').join('/test-dir', 'deleted.txt');
    db.connection.prepare("INSERT INTO tracked_files (local_path, file_hash, file_size, status) VALUES (?, 'hash', 100, 'uploaded')").run(path);

    await syncEngine.start('/test-dir', backupEngine);

    // Simulate file deletion
    vi.mocked(fs.existsSync).mockImplementation((p: any) => {
      if (p === path) return false;
      return true;
    });

    mockWatcher.emit('change', 'rename', 'deleted.txt');
    await vi.runAllTimersAsync();

    // Verify DB update
    const fileInDb = db.connection.prepare('SELECT status FROM tracked_files WHERE local_path = ?').get(path) as any;
    expect(fileInDb.status).toBe('deleted');
    expect(uploader.uploadFile).not.toHaveBeenCalled(); // No upload for deletes
  });

  it('should gracefully shutdown and clear watchers/timers', async () => {
    await syncEngine.start('/test-dir', backupEngine);
    expect(fs.watch).toHaveBeenCalled();
    
    syncEngine.stop();
    expect((mockWatcher as any).close).toHaveBeenCalled();

    // Emitting event after stop should do nothing
    mockWatcher.emit('change', 'change', 'file.txt');
    await vi.runAllTimersAsync();
    
    expect(uploader.uploadFile).not.toHaveBeenCalled();
  });
});
