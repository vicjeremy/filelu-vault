import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { hashFile } from '../../../src/utils/hash.js';
import { UploadError } from '../../../src/utils/errors.js';
import { writeFileSync, unlinkSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { randomBytes } from 'node:crypto';

describe('hashFile', () => {
  const testFilePath = join(tmpdir(), `test-hash-${randomBytes(4).toString('hex')}.txt`);

  afterEach(() => {
    try {
      unlinkSync(testFilePath);
    } catch {
      // Ignore if file doesn't exist
    }
  });

  it('should compute correct SHA-256 hash for a known file', async () => {
    // "Hello, World!" hash is: dffd6021bb2bd5b0af676290809ec3a53191dd81c7f70a4b28688a362182986f
    writeFileSync(testFilePath, 'Hello, World!');
    
    const hash = await hashFile(testFilePath);
    expect(hash).toBe('dffd6021bb2bd5b0af676290809ec3a53191dd81c7f70a4b28688a362182986f');
  });

  it('should throw UploadError if file does not exist', async () => {
    await expect(hashFile('/path/that/definitely/does/not/exist.txt')).rejects.toThrow(UploadError);
  });
});
