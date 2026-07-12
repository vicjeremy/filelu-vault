import { stdout, stderr, env } from 'node:process';

/**
 * Log levels in ascending severity.
 * Controlled by NO_COLOR and isTTY for ANSI output per DESIGN.md §2.
 */
type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/** ANSI color codes — only emitted when stdout isTTY and NO_COLOR is unset. */
const ANSI = {
  reset: '\x1b[0m',
  dim: '\x1b[2m',
  cyan: '\x1b[36m',
  yellow: '\x1b[33m',
  red: '\x1b[31m',
  gray: '\x1b[90m',
} as const;

/** Minimum log level. Defaults to 'info'; set to 'debug' via --verbose flag. */
let currentLevel: LogLevel = 'info';

const LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

/**
 * Check whether color output is enabled.
 * Respects NO_COLOR env var and stream.isTTY.
 */
function useColor(stream: NodeJS.WriteStream): boolean {
  return stream.isTTY === true && !env['NO_COLOR'];
}

/**
 * Format a timestamp as HH:MM:SS (UTC) for log prefix.
 */
function timestamp(): string {
  return new Date().toISOString().slice(11, 19);
}

/**
 * Format structured metadata as key=value pairs.
 * @param meta - Optional metadata object to serialize
 */
function formatMeta(meta?: Record<string, unknown>): string {
  if (!meta || Object.keys(meta).length === 0) return '';
  const pairs = Object.entries(meta)
    .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
    .join(' ');
  return ` ${pairs}`;
}

/**
 * Write a log entry to the appropriate stream.
 * @param level - Log level
 * @param message - Human-readable message
 * @param meta - Optional structured metadata (never include secrets)
 */
function log(level: LogLevel, message: string, meta?: Record<string, unknown>): void {
  if (LEVELS[level] < LEVELS[currentLevel]) return;

  const stream = level === 'error' ? stderr : stdout;
  const color = useColor(stream);
  const ts = timestamp();
  const metaStr = formatMeta(meta);

  let prefix: string;
  let line: string;

  switch (level) {
    case 'debug':
      prefix = color ? `${ANSI.gray}[${ts} DBG]${ANSI.reset}` : `[${ts} DBG]`;
      line = color ? `${prefix} ${ANSI.dim}${message}${ANSI.reset}${metaStr}` : `${prefix} ${message}${metaStr}`;
      break;
    case 'info':
      prefix = color ? `${ANSI.cyan}[${ts} INF]${ANSI.reset}` : `[${ts} INF]`;
      line = `${prefix} ${message}${metaStr}`;
      break;
    case 'warn':
      prefix = color ? `${ANSI.yellow}[${ts} WRN]${ANSI.reset}` : `[${ts} WRN]`;
      line = color ? `${prefix} ${ANSI.yellow}${message}${ANSI.reset}${metaStr}` : `${prefix} ${message}${metaStr}`;
      break;
    case 'error':
      prefix = color ? `${ANSI.red}[${ts} ERR]${ANSI.reset}` : `[${ts} ERR]`;
      line = color ? `${prefix} ${ANSI.red}${message}${ANSI.reset}${metaStr}` : `${prefix} ${message}${metaStr}`;
      break;
  }

  stream.write(line + '\n');
}

/**
 * Structured logger for FileLu Vault.
 * Uses logger.info/warn/error/debug — never console.log in src/.
 *
 * @example
 * logger.info('Upload complete', { file: '/home/user/photo.jpg', code: 'abc123' });
 * logger.error('Auth failed', { endpoint: '/api/account/info' });
 */
export const logger = {
  /**
   * Debug-level log. Only shown when verbose mode is enabled.
   * @param message - Message text
   * @param meta - Optional structured metadata
   */
  debug(message: string, meta?: Record<string, unknown>): void {
    log('debug', message, meta);
  },

  /**
   * Info-level log. Standard user-facing progress messages.
   * @param message - Message text
   * @param meta - Optional structured metadata
   */
  info(message: string, meta?: Record<string, unknown>): void {
    log('info', message, meta);
  },

  /**
   * Warning-level log. Skipped files, expiring premium, permission issues.
   * @param message - Message text
   * @param meta - Optional structured metadata
   */
  warn(message: string, meta?: Record<string, unknown>): void {
    log('warn', message, meta);
  },

  /**
   * Error-level log. Written to stderr. Does not call process.exit — CLI decides.
   * @param message - Message text
   * @param meta - Optional structured metadata
   */
  error(message: string, meta?: Record<string, unknown>): void {
    log('error', message, meta);
  },

  /**
   * Set the minimum log level. Call with 'debug' when --verbose flag is passed.
   * @param level - Minimum level to emit
   */
  setLevel(level: LogLevel): void {
    currentLevel = level;
  },

  /**
   * Get the current log level.
   * @returns Current LogLevel
   */
  getLevel(): LogLevel {
    return currentLevel;
  },
};
