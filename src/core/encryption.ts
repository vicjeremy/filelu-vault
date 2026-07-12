import { randomBytes, createCipheriv, createDecipheriv } from 'node:crypto';
import { createReadStream, createWriteStream, statSync } from 'node:fs';
import { pipeline } from 'node:stream/promises';
import { EncryptionError } from '../utils/errors.js';

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

export class Encryptor {
  private key: Buffer;

  /**
   * Initialize Encryptor with a base64 encoded AES-256 key.
   */
  constructor(base64Key: string) {
    this.key = Buffer.from(base64Key, 'base64');
    if (this.key.length !== 32) {
      throw new EncryptionError('Invalid key length. Must be 256 bits (32 bytes).');
    }
  }

  /**
   * Generate a secure random 256-bit key for AES-256-GCM.
   * @returns Base64 encoded string.
   */
  static generateKey(): string {
    return randomBytes(32).toString('base64');
  }

  /**
   * Encrypt a file using AES-256-GCM.
   * Output format: [IV (12 bytes)] [Ciphertext] [AuthTag (16 bytes)]
   */
  async encryptFile(inputPath: string, outputPath: string): Promise<void> {
    const iv = randomBytes(IV_LENGTH);
    const cipher = createCipheriv(ALGORITHM, this.key, iv);

    const inputStream = createReadStream(inputPath);
    const outputStream = createWriteStream(outputPath);

    try {
      // Write IV first
      outputStream.write(iv);

      await pipeline(inputStream, cipher, outputStream, { end: false });

      // Append Auth Tag and wait for write to finish
      const authTag = cipher.getAuthTag();
      await new Promise<void>((resolve, reject) => {
        outputStream.on('finish', resolve);
        outputStream.on('error', reject);
        outputStream.end(authTag);
      });
    } catch (err) {
      throw new EncryptionError(`Failed to encrypt file: ${inputPath}`, { cause: err as Error });
    }
  }

  /**
   * Decrypt a file using AES-256-GCM.
   * Expects format: [IV (12 bytes)] [Ciphertext] [AuthTag (16 bytes)]
   */
  async decryptFile(inputPath: string, outputPath: string): Promise<void> {
    const stat = statSync(inputPath);
    if (stat.size < IV_LENGTH + AUTH_TAG_LENGTH) {
      throw new EncryptionError(`File too small to be a valid encrypted payload: ${inputPath}`);
    }

    const ciphertextEnd = stat.size - AUTH_TAG_LENGTH - 1;
    const authTagStart = stat.size - AUTH_TAG_LENGTH;

    // 1. Read IV
    const iv = await this.readExactBytes(inputPath, 0, IV_LENGTH - 1);
    
    // 2. Read Auth Tag
    const authTag = await this.readExactBytes(inputPath, authTagStart, stat.size - 1);

    // 3. Decrypt Ciphertext
    const decipher = createDecipheriv(ALGORITHM, this.key, iv);
    decipher.setAuthTag(authTag);

    const inputStream = createReadStream(inputPath, { start: IV_LENGTH, end: ciphertextEnd });
    const outputStream = createWriteStream(outputPath);

    try {
      await pipeline(inputStream, decipher, outputStream);
    } catch (err) {
      throw new EncryptionError('Decryption failed or invalid authentication tag', { cause: err as Error });
    }
  }

  private readExactBytes(filePath: string, start: number, end: number): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const stream = createReadStream(filePath, { start, end });
      const chunks: Buffer[] = [];
      stream.on('data', (chunk) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk as string));
      });
      stream.on('end', () => resolve(Buffer.concat(chunks)));
      stream.on('error', reject);
    });
  }
}
