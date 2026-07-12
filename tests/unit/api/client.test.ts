import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { FileLuClient, withRetry } from '../../../src/api/client.js';
import { ApiError, UploadError } from '../../../src/utils/errors.js';

// ─────────────────────────────────────────────────────────────
// Helper: create a minimal mock Response
// ─────────────────────────────────────────────────────────────
function mockResponse(
  status: number,
  body: unknown,
  ok?: boolean,
): { ok: boolean; status: number; statusText: string; json: () => Promise<unknown>; text: () => Promise<string> } {
  return {
    ok: ok ?? (status >= 200 && status < 300),
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    json: () => Promise.resolve(body),
    text: () => Promise.resolve(typeof body === 'string' ? body : JSON.stringify(body)),
  };
}

// ─────────────────────────────────────────────────────────────
// Mock node-fetch at module level
// ─────────────────────────────────────────────────────────────
vi.mock('node-fetch', () => ({
  default: vi.fn(),
}));

// Import the mocked fetch
import fetch from 'node-fetch';
const mockFetch = vi.mocked(fetch);

describe('withRetry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('should return immediately on success', async () => {
    const fn = vi.fn().mockResolvedValue('ok');
    const result = await withRetry(fn, 3);
    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should retry on retryable error and succeed', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new ApiError('Server error', 500))
      .mockResolvedValueOnce('ok');

    let result: unknown;
    const run = async (): Promise<void> => {
      result = await withRetry(fn, 3);
    };

    const runPromise = run();
    await vi.runAllTimersAsync();
    await runPromise;

    expect(result).toBe('ok');
    expect(fn).toHaveBeenCalledTimes(2);
  });

  it('should not retry on 403 auth error', async () => {
    const fn = vi.fn().mockRejectedValueOnce(new ApiError('Auth failed', 403));
    await expect(withRetry(fn, 3)).rejects.toThrow(ApiError);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('should throw after exhausting max retries', async () => {
    const fn = vi.fn()
      .mockRejectedValueOnce(new ApiError('Server error', 500))
      .mockRejectedValueOnce(new ApiError('Server error', 500))
      .mockRejectedValueOnce(new ApiError('Server error', 500));

    let caughtError: unknown;
    const run = async (): Promise<void> => {
      try {
        await withRetry(fn, 3);
      } catch (e) {
        caughtError = e;
      }
    };

    const runPromise = run();
    await vi.runAllTimersAsync();
    await runPromise;

    expect(caughtError).toBeInstanceOf(ApiError);
    expect(fn).toHaveBeenCalledTimes(3);
  });
});

describe('FileLuClient', () => {
  let client: FileLuClient;

  beforeEach(() => {
    vi.useFakeTimers();
    client = new FileLuClient('test-api-key-1234', 3);
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  // ──────────────────────────────────────────────
  // getAccountInfo()
  // ──────────────────────────────────────────────
  describe('getAccountInfo', () => {
    it('should return parsed account info on success', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(200, {
        msg: 'OK',
        status: 200,
        server_time: '2026-07-12T00:00:00Z',
        result: {
          email: 'user@example.com',
          storage_used: '1073741824',
          storage_left: 'inf',
          premium_expire: '2027-01-01',
        },
      }) as never);

      const info = await client.getAccountInfo();
      expect(info.email).toBe('user@example.com');
      expect(info.storageLeft).toBe('inf');
      expect(info.storageUsed).toBe('1073741824');
      expect(info.premiumExpire).toBe('2027-01-01');
    });

    it('should handle null storage_used for premium accounts', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(200, {
        msg: 'OK',
        status: 200,
        server_time: '2026-07-12T00:00:00Z',
        result: {
          email: 'premium@example.com',
          storage_used: null,
          storage_left: 'inf',
          premium_expire: '2027-01-01',
        },
      }) as never);

      const info = await client.getAccountInfo();
      expect(info.storageUsed).toBeNull();
    });

    it('should throw ApiError on 403', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(403, 'Wrong auth key', false) as never);
      await expect(client.getAccountInfo()).rejects.toThrow(ApiError);
    });

    it('should include statusCode 403 in ApiError', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(403, 'Wrong auth key', false) as never);
      await expect(client.getAccountInfo()).rejects.toMatchObject({
        statusCode: 403,
      });
    });

    it('should throw ApiError on 500 and retry 3 times', async () => {
      const err500 = mockResponse(500, 'Server error', false) as never;
      mockFetch.mockResolvedValueOnce(err500);
      mockFetch.mockResolvedValueOnce(err500);
      mockFetch.mockResolvedValueOnce(err500);

      let caughtError: unknown;
      const run = async (): Promise<void> => {
        try { await client.getAccountInfo(); } catch (e) { caughtError = e; }
      };
      const runPromise = run();
      await vi.runAllTimersAsync();
      await runPromise;

      expect(caughtError).toBeInstanceOf(ApiError);
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });

    it('should not include API key in error messages', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(403, 'Wrong auth key', false) as never);

      try {
        await client.getAccountInfo();
      } catch (error) {
        if (error instanceof Error) {
          expect(error.message).not.toContain('test-api-key-1234');
        }
      }
    });
  });

  // ──────────────────────────────────────────────
  // getUploadServer()
  // ──────────────────────────────────────────────
  describe('getUploadServer', () => {
    it('should return server url and sessId', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(200, {
        status: 200,
        sess_id: 'abc123session',
        result: 'http://upload.filelu.com/',
        msg: 'OK',
        server_time: '2026-07-12T00:00:00Z',
      }) as never);

      const server = await client.getUploadServer();
      expect(server.url).toBe('http://upload.filelu.com/');
      expect(server.sessId).toBe('abc123session');
    });

    it('should throw ApiError when status != 200 in body', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(200, {
        status: 403,
        sess_id: '',
        result: '',
        msg: 'Wrong key',
        server_time: '',
      }) as never);

      await expect(client.getUploadServer()).rejects.toThrow(ApiError);
    });

    it('should throw ApiError on HTTP 500', async () => {
      const err500 = mockResponse(500, 'error', false) as never;
      mockFetch.mockResolvedValueOnce(err500);
      mockFetch.mockResolvedValueOnce(err500);
      mockFetch.mockResolvedValueOnce(err500);

      let caughtError: unknown;
      const run = async (): Promise<void> => {
        try { await client.getUploadServer(); } catch (e) { caughtError = e; }
      };
      const runPromise = run();
      await vi.runAllTimersAsync();
      await runPromise;

      expect(caughtError).toBeInstanceOf(ApiError);
    });
  });

  // ──────────────────────────────────────────────
  // uploadFile()
  // ──────────────────────────────────────────────
  describe('uploadFile', () => {
    let testDir: string;
    let testFile: string;

    beforeEach(() => {
      testDir = mkdtempSync(join(tmpdir(), 'vault-api-test-'));
      testFile = join(testDir, 'test.txt');
      writeFileSync(testFile, 'hello world');
    });

    afterEach(() => {
      rmSync(testDir, { recursive: true, force: true });
    });

    it('should upload and return file_code from array response', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(200, [
        { file_code: 'b578rni0e1ka', file_status: 'OK' },
      ]) as never);

      const result = await client.uploadFile('http://upload.filelu.com/', 'sess123', testFile);
      expect(result.file_code).toBe('b578rni0e1ka');
      expect(result.file_status).toBe('OK');
    });

    it('should throw UploadError if file does not exist', async () => {
      // Client checks existsSync before creating the stream
      await expect(
        client.uploadFile('http://upload.filelu.com/', 'sess123', '/nonexistent/definitely/not/there.txt'),
      ).rejects.toThrow(UploadError);
    });

    it('should throw ApiError on upload server 500', async () => {
      const err500 = mockResponse(500, 'error', false) as never;
      mockFetch.mockResolvedValueOnce(err500);
      mockFetch.mockResolvedValueOnce(err500);
      mockFetch.mockResolvedValueOnce(err500);

      let caughtError: unknown;
      const run = async (): Promise<void> => {
        try { await client.uploadFile('http://upload.filelu.com/', 'sess123', testFile); } catch (e) { caughtError = e; }
      };
      const runPromise = run();
      await vi.runAllTimersAsync();
      await runPromise;

      expect(caughtError).toBeInstanceOf(ApiError);
    });

    it('should throw ApiError on empty response array', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(200, []) as never);
      await expect(
        client.uploadFile('http://upload.filelu.com/', 'sess123', testFile),
      ).rejects.toThrow(ApiError);
    });

    it('should throw ApiError on missing file_code in response', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(200, [{ file_status: 'OK' }]) as never);
      await expect(
        client.uploadFile('http://upload.filelu.com/', 'sess123', testFile),
      ).rejects.toThrow(ApiError);
    });

    it('should throw ApiError when response is not an array', async () => {
      mockFetch.mockResolvedValueOnce(mockResponse(200, { file_code: 'abc' }) as never);
      await expect(
        client.uploadFile('http://upload.filelu.com/', 'sess123', testFile),
      ).rejects.toThrow(ApiError);
    });
  });
});
