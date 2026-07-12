/**
 * Custom error hierarchy for FileLu Vault.
 *
 * Hierarchy:
 *   AppError (base)
 *   ├── ConfigError    — missing/invalid config, bad permissions
 *   ├── ApiError       — HTTP errors, auth failures, timeouts
 *   ├── UploadError    — file-not-found, stream failures
 *   ├── EncryptionError — bad key, corrupt ciphertext, auth tag mismatch
 *   └── DatabaseError  — SQLite errors, migration failures
 */

/**
 * Base error class for all FileLu Vault errors.
 * Always chain the original cause via the `cause` option.
 */
export class AppError extends Error {
  /** Short machine-readable error code (e.g. 'CONFIG_MISSING', 'AUTH_FAILED'). */
  readonly code: string;

  /**
   * @param code - Machine-readable error code
   * @param message - Human-readable description
   * @param options - Optional: { cause: Error } to chain original error
   */
  constructor(code: string, message: string, options?: ErrorOptions) {
    super(message, options);
    this.code = code;
    this.name = this.constructor.name;
    // Ensure stack traces work properly in Node.js
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, this.constructor);
    }
  }
}

/**
 * Thrown for configuration problems: missing config file, invalid schema, bad permissions.
 */
export class ConfigError extends AppError {
  /**
   * @param message - Human-readable description
   * @param options - Optional: { cause: Error }
   */
  constructor(message: string, options?: ErrorOptions) {
    super('CONFIG_ERROR', message, options);
  }
}

/**
 * Thrown for FileLu API errors: HTTP status codes, auth failures, timeouts.
 */
export class ApiError extends AppError {
  /** HTTP status code, if applicable. */
  readonly statusCode?: number;
  /** API endpoint that failed. */
  readonly endpoint?: string;

  /**
   * @param message - Human-readable description
   * @param statusCode - HTTP response status (e.g. 403, 500)
   * @param endpoint - API endpoint path (e.g. '/api/account/info')
   * @param options - Optional: { cause: Error }
   */
  constructor(message: string, statusCode?: number, endpoint?: string, options?: ErrorOptions) {
    super('API_ERROR', message, options);
    this.statusCode = statusCode;
    this.endpoint = endpoint;
  }
}

/**
 * Thrown for upload failures: file not found, stream error, upload rejected.
 */
export class UploadError extends AppError {
  /** Absolute path of the file that failed to upload. */
  readonly filePath?: string;

  /**
   * @param message - Human-readable description
   * @param filePath - Absolute path to the file being uploaded
   * @param options - Optional: { cause: Error }
   */
  constructor(message: string, filePath?: string, options?: ErrorOptions) {
    super('UPLOAD_ERROR', message, options);
    this.filePath = filePath;
  }
}

/**
 * Thrown for encryption/decryption failures: bad key, corrupt ciphertext, auth tag mismatch.
 */
export class EncryptionError extends AppError {
  /**
   * @param message - Human-readable description
   * @param options - Optional: { cause: Error }
   */
  constructor(message: string, options?: ErrorOptions) {
    super('ENCRYPTION_ERROR', message, options);
  }
}

/**
 * Thrown for SQLite/database errors: migration failures, constraint violations, corrupt DB.
 */
export class DatabaseError extends AppError {
  /**
   * @param message - Human-readable description
   * @param options - Optional: { cause: Error }
   */
  constructor(message: string, options?: ErrorOptions) {
    super('DATABASE_ERROR', message, options);
  }
}
