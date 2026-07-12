import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Encryptor } from '../../../src/core/encryption.js';
import { EncryptionError } from '../../../src/utils/errors.js';
import { writeFileSync, readFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';

describe('Encryptor', () => {
  const testFiles: string[] = [];
  let encryptor: Encryptor;

  beforeEach(() => {
    const key = Encryptor.generateKey();
    encryptor = new Encryptor(key);
  });

  afterEach(() => {
    testFiles.forEach(f => {
      try { unlinkSync(f); } catch {}
    });
    testFiles.length = 0;
  });

  function getTempPath(suffix: string): string {
    const p = join(tmpdir(), `test-enc-${randomBytes(4).toString('hex')}-${suffix}`);
    testFiles.push(p);
    return p;
  }

  describe('generateKey', () => {
    it('should generate a 32-byte (256-bit) base64 key', () => {
      const key = Encryptor.generateKey();
      const buf = Buffer.from(key, 'base64');
      expect(buf.length).toBe(32);
    });
  });

  describe('constructor', () => {
    it('should throw EncryptionError on invalid key length', () => {
      expect(() => new Encryptor('short_key')).toThrow(EncryptionError);
    });
  });

  describe('encryptFile and decryptFile (roundtrip)', () => {
    it('should encrypt and decrypt a file identically', async () => {
      const plainText = 'This is a secret payload. Hello world!';
      const plainFile = getTempPath('plain.txt');
      const encFile = getTempPath('enc.bin');
      const decFile = getTempPath('dec.txt');

      writeFileSync(plainFile, plainText);

      await encryptor.encryptFile(plainFile, encFile);
      await encryptor.decryptFile(encFile, decFile);

      const decryptedText = readFileSync(decFile, 'utf8');
      expect(decryptedText).toBe(plainText);
    });

    it('should work with large payload', async () => {
      const largeBuffer = randomBytes(1024 * 1024 * 2); // 2MB
      const plainFile = getTempPath('plain_large.bin');
      const encFile = getTempPath('enc_large.bin');
      const decFile = getTempPath('dec_large.bin');

      writeFileSync(plainFile, largeBuffer);

      await encryptor.encryptFile(plainFile, encFile);
      await encryptor.decryptFile(encFile, decFile);

      const decryptedBuffer = readFileSync(decFile);
      expect(decryptedBuffer.equals(largeBuffer)).toBe(true);
    });
  });

  describe('tamper resistance', () => {
    it('should throw EncryptionError if ciphertext is modified (auth tag failure)', async () => {
      const plainText = 'Tamper test content';
      const plainFile = getTempPath('plain.txt');
      const encFile = getTempPath('enc.bin');
      const decFile = getTempPath('dec.txt');

      writeFileSync(plainFile, plainText);
      await encryptor.encryptFile(plainFile, encFile);

      // Tamper with the encrypted file (flip one byte in the middle)
      const encBuffer = readFileSync(encFile);
      encBuffer[encBuffer.length - 20] ^= 1; // Change a bit in ciphertext
      writeFileSync(encFile, encBuffer);

      await expect(encryptor.decryptFile(encFile, decFile)).rejects.toThrow(EncryptionError);
    });

    it('should throw EncryptionError if auth tag is tampered', async () => {
      const plainText = 'Tag tamper test';
      const plainFile = getTempPath('plain.txt');
      const encFile = getTempPath('enc.bin');
      const decFile = getTempPath('dec.txt');

      writeFileSync(plainFile, plainText);
      await encryptor.encryptFile(plainFile, encFile);

      // Tamper with the auth tag (last 16 bytes)
      const encBuffer = readFileSync(encFile);
      encBuffer[encBuffer.length - 1] ^= 1;
      writeFileSync(encFile, encBuffer);

      await expect(encryptor.decryptFile(encFile, decFile)).rejects.toThrow(EncryptionError);
    });

    it('should throw EncryptionError if file is too small', async () => {
      const smallFile = getTempPath('small.bin');
      writeFileSync(smallFile, 'too_small'); // < 28 bytes
      
      const decFile = getTempPath('dec.txt');
      await expect(encryptor.decryptFile(smallFile, decFile)).rejects.toThrow(EncryptionError);
    });
  });
});
