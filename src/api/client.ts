import { createReadStream, existsSync } from 'node:fs';
import fetch from 'node-fetch';
import FormData from 'form-data';
import { ApiError, UploadError } from '../utils/errors.js';
import { logger } from '../utils/logger.js';
import type {
  AccountInfo,
  AccountInfoResponse,
  UploadServer,
  UploadServerResponse,
  UploadResult,
} from './types.js';

const BASE_URL = 'https://filelu.com';

/**
 * Sleep for the given number of milliseconds.
 * @param ms - Milliseconds to wait
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Determine if an error is retryable (transient server errors only).
 * 4xx errors (except 429) are NOT retried — they indicate a client problem.
 * @param error - The caught error
 * @returns true if the request should be retried
 */
function isRetryable(error: unknown): boolean {
  if (error instanceof ApiError) {
    const code = error.statusCode;
    if (code === undefined) return true; // network error
    return code === 429 || code >= 500;
  }
  return true; // unknown errors → retry
}

/**
 * Retry a function with exponential backoff (100ms → 200ms → 400ms… capped at 10s).
 * @param fn - Async function to retry
 * @param maxRetries - Maximum number of attempts (default: 3)
 * @returns Result of the function
 * @throws Last error after all retries are exhausted
 */
export async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      const retryable = isRetryable(error);
      logger.debug('Request failed', {
        attempt,
        maxRetries,
        retryable,
        error: error instanceof Error ? error.message : String(error),
      });
      if (attempt === maxRetries || !retryable) throw error;
      const delay = Math.min(100 * 2 ** (attempt - 1), 10_000);
      await sleep(delay);
    }
  }
  // This line is unreachable but satisfies TypeScript's control-flow analysis
  throw new ApiError('withRetry exhausted — unreachable');
}

/**
 * Parse a FileLu API JSON response, throwing ApiError on failure.
 * @param response - node-fetch Response object
 * @param endpoint - API endpoint path (for error context)
 * @returns Parsed JSON
 * @throws {ApiError} On non-2xx status or non-JSON body
 */
async function parseApiResponse<T>(
  response: Awaited<ReturnType<typeof fetch>>,
  endpoint: string,
): Promise<T> {
  if (!response.ok) {
    const body = await response.text().catch(() => '');
    throw new ApiError(
      `FileLu API error: ${response.status} ${response.statusText}${body ? ` — ${body}` : ''}`,
      response.status,
      endpoint,
    );
  }

  try {
    return (await response.json()) as T;
  } catch (cause) {
    throw new ApiError(`Failed to parse response from ${endpoint}`, response.status, endpoint, { cause });
  }
}

/**
 * FileLuClient — wraps all FileLu REST API calls.
 * All requests use GET (except file upload which uses POST multipart).
 * API key is never logged — only last 4 chars are used for diagnostics.
 */
export class FileLuClient {
  private readonly apiKey: string;
  private readonly maxRetries: number;

  /**
   * @param apiKey - FileLu API key (never log in full)
   * @param maxRetries - Retry attempts for transient errors (default: 3)
   */
  constructor(apiKey: string, maxRetries = 3) {
    this.apiKey = apiKey;
    this.maxRetries = maxRetries;
    logger.debug('FileLuClient initialized', { keyPrefix: `****${apiKey.slice(-4)}` });
  }

  /**
   * Fetch account information from the FileLu API.
   * @returns Parsed AccountInfo (email, storage, premium expiry)
   * @throws {ApiError} On auth failure (403), network error, or non-JSON response
   */
  async getAccountInfo(): Promise<AccountInfo> {
    const endpoint = '/api/account/info';
    const url = `${BASE_URL}${endpoint}?key=${this.apiKey}`;

    const data = await withRetry(async () => {
      const response = await fetch(url);
      return parseApiResponse<AccountInfoResponse>(response, endpoint);
    }, this.maxRetries);

    if (data.status !== 200) {
      throw new ApiError(
        `Account info failed: ${data.msg}`,
        data.status,
        endpoint,
      );
    }

    return {
      email: data.result.email,
      storageUsed: data.result.storage_used,
      storageLeft: data.result.storage_left,
      premiumExpire: data.result.premium_expire,
    };
  }

  /**
   * Get an upload server URL and session ID from the FileLu API.
   * Note: sess_id is tied to the specific server URL — always use them together.
   * Note: The returned URL uses HTTP, not HTTPS.
   * @returns UploadServer with url and sessId
   * @throws {ApiError} On auth failure or server error
   */
  async getUploadServer(): Promise<UploadServer> {
    const endpoint = '/api/upload/server';
    const url = `${BASE_URL}${endpoint}?key=${this.apiKey}`;

    const data = await withRetry(async () => {
      const response = await fetch(url);
      return parseApiResponse<UploadServerResponse>(response, endpoint);
    }, this.maxRetries);

    if (data.status !== 200) {
      throw new ApiError(
        `Failed to get upload server: ${data.msg}`,
        data.status,
        endpoint,
      );
    }

    logger.debug('Got upload server', { server: data.result });

    return {
      url: data.result,
      sessId: data.sess_id,
    };
  }

  /**
   * Upload a file to a FileLu upload server via POST multipart/form-data.
   * The form field must be named "file_0" — this is a FileLu API requirement.
   * @param serverUrl - Upload server URL from getUploadServer() (HTTP)
   * @param sessId - Session ID from getUploadServer() — must match server URL
   * @param filePath - Absolute path to the file to upload
   * @returns UploadResult with file_code and file_status
   * @throws {UploadError} If file cannot be read
   * @throws {ApiError} On server error or unexpected response format
   */
  async uploadFile(serverUrl: string, sessId: string, filePath: string): Promise<UploadResult> {
    const form = new FormData();
    form.append('sess_id', sessId);
    form.append('utype', 'prem');

    try {
      if (!existsSync(filePath)) {
        throw new UploadError(`File not found: ${filePath}`, filePath);
      }
      form.append('file_0', createReadStream(filePath));
    } catch (cause) {
      if (cause instanceof UploadError) throw cause;
      throw new UploadError(`Cannot read file for upload: ${filePath}`, filePath, { cause });
    }

    logger.debug('Uploading file', { filePath, server: serverUrl });

    const rawResponse = await withRetry(async () => {
      const response = await fetch(serverUrl, {
        method: 'POST',
        body: form,
        headers: form.getHeaders(),
      });

      if (!response.ok) {
        const body = await response.text().catch(() => '');
        throw new ApiError(
          `Upload failed: ${response.status} ${response.statusText}${body ? ` — ${body}` : ''}`,
          response.status,
          serverUrl,
        );
      }

      return response;
    }, this.maxRetries);

    // FileLu returns a JSON array even for single file uploads
    let results: UploadResult[];
    try {
      results = (await rawResponse.json()) as UploadResult[];
    } catch (cause) {
      throw new ApiError('Upload response was not valid JSON', undefined, serverUrl, { cause });
    }

    if (!Array.isArray(results) || results.length === 0) {
      throw new ApiError('Upload response was empty or not an array', undefined, serverUrl);
    }

    const result = results[0];
    if (!result || !result.file_code) {
      throw new ApiError('Upload response missing file_code', undefined, serverUrl);
    }

    logger.debug('Upload successful', { fileCode: result.file_code, status: result.file_status });

    return result;
  }
}
