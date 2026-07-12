import { createReadStream, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { UploadError } from './errors.js';

/**
 * Computes the SHA-256 hash of a file using streams to avoid loading
 * the entire file into memory.
 * 
 * @param filePath - Absolute path to the file to hash
 * @returns A promise that resolves to the hex-encoded SHA-256 hash
 * @throws {UploadError} if the file cannot be read
 */
export function hashFile(filePath: string): Promise<string> {
  return new Promise((resolve, reject) => {
    if (!existsSync(filePath)) {
      return reject(new UploadError(`File not found: ${filePath}`, filePath));
    }

    const hash = createHash('sha256');
    const stream = createReadStream(filePath);

    stream.on('data', (chunk) => {
      hash.update(chunk);
    });

    stream.on('end', () => {
      resolve(hash.digest('hex'));
    });

    stream.on('error', (err) => {
      reject(new UploadError(`Failed to read file for hashing: ${filePath}`, filePath, { cause: err }));
    });
  });
}
