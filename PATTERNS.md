# FileLu Vault — Coding Patterns

> **Version:** 1.0 | **Last Updated:** 2026-07-12
> AI agents: follow these patterns exactly. Do not deviate without explicit approval.

---

## 1. General Rules

- **Language:** TypeScript strict mode — no `any`, no `@ts-ignore`
- **Module system:** ESM (`"type": "module"` in package.json)
- **Exports:** Named exports only — no default exports
- **Naming:** camelCase for functions/variables, PascalCase for types/classes, UPPER_SNAKE for constants
- **File naming:** kebab-case (`upload-engine.ts` not `uploadEngine.ts`) — exception: existing files use single-word names
- **Max file length:** 300 lines — split if longer
- **Functions:** Max 50 lines — extract helpers if longer

---

## 2. TypeScript Patterns

### Use interfaces for data, classes for behavior

```typescript
// ✅ DO: interface for data shapes
interface TrackedFile {
  localPath: string;
  fileHash: string;
  status: FileStatus;
}

// ✅ DO: class for stateful behavior
class Uploader {
  constructor(
    private readonly api: FileLuClient,
    private readonly db: Database,
  ) {}

  async uploadFile(path: string): Promise<UploadResult> { ... }
}
```

### Always define return types explicitly

```typescript
// ✅ DO
function hashFile(path: string): Promise<string> { ... }

// ❌ DON'T
function hashFile(path: string) { ... }  // inferred return type
```

### Use discriminated unions for status

```typescript
// ✅ DO
type FileStatus = 'pending' | 'uploading' | 'uploaded' | 'failed' | 'deleted';

// ❌ DON'T
type FileStatus = string;
```

### Prefer `readonly` by default

```typescript
// ✅ DO
class FileLuClient {
  constructor(private readonly apiKey: string) {}
}
```

---

## 3. Error Handling Patterns

### Always use custom error classes

```typescript
// ✅ DO
throw new ApiError('Authentication failed', 403, 'Wrong auth key', '/api/account/info');

// ❌ DON'T
throw new Error('API error');
```

### Catch at boundaries, not in internals

```typescript
// ✅ DO: catch in CLI layer, let core throw
// src/cli/upload.ts
try {
  await uploader.uploadFile(path);
} catch (error) {
  if (error instanceof ApiError) {
    logger.error(`✗ API error: ${error.message}`);
    process.exit(3);
  }
  throw error;  // unexpected — re-throw
}

// ❌ DON'T: swallow errors in core
// src/core/uploader.ts
try {
  await this.api.uploadFile(...);
} catch { 
  return null;  // silently fails
}
```

### Always chain the `cause`

```typescript
// ✅ DO
throw new UploadError(`Failed to upload ${path}`, { cause: originalError });
```

---

## 4. API Patterns

### All API calls go through `FileLuClient`

```typescript
// ✅ DO: centralized client
const info = await this.api.getAccountInfo();

// ❌ DON'T: raw fetch in business logic
const res = await fetch('https://filelu.com/api/account/info?key=...');
```

### All API calls use GET requests (per FileLu API design)

```typescript
// ✅ DO: GET for account info and upload server
const url = `${BASE_URL}/api/account/info?key=${this.apiKey}`;
const response = await fetch(url);

// Exception: file upload uses POST multipart
```

### Retry with exponential backoff

```typescript
// ✅ DO: always retry server errors
async function withRetry<T>(fn: () => Promise<T>, maxRetries = 3): Promise<T> {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error) {
      if (attempt === maxRetries || !isRetryable(error)) throw error;
      await sleep(Math.min(1000 * 2 ** (attempt - 1), 10000));
    }
  }
  throw new Error('Unreachable');
}
```

---

## 5. Database Patterns

### Use prepared statements — never string interpolation

```typescript
// ✅ DO
const stmt = db.prepare('SELECT * FROM tracked_files WHERE local_path = ?');
const file = stmt.get(path);

// ❌ DON'T
const file = db.exec(`SELECT * FROM tracked_files WHERE local_path = '${path}'`);
```

### Wrap multi-step DB ops in transactions

```typescript
// ✅ DO
const insertBatch = db.transaction((files: TrackedFile[]) => {
  for (const file of files) {
    insertStmt.run(file);
  }
});
insertBatch(files);
```

### All timestamps in UTC ISO-8601

```typescript
// ✅ DO
const now = new Date().toISOString();  // 2026-07-09T05:51:00.000Z

// ❌ DON'T
const now = Date.now();  // unix timestamp number
```

---

## 6. File I/O Patterns

### Use streaming for large files

```typescript
// ✅ DO: streaming hash
const hash = crypto.createHash('sha256');
const stream = fs.createReadStream(filePath);
stream.pipe(hash);

// ❌ DON'T: read entire file into memory
const data = fs.readFileSync(filePath);
const hash = crypto.createHash('sha256').update(data).digest('hex');
```

### Always resolve to absolute paths

```typescript
// ✅ DO
const absPath = path.resolve(inputPath);

// ❌ DON'T: work with relative paths in DB or comparisons
```

### Clean up temp files

```typescript
// ✅ DO
try {
  await encryptFile(input, tempPath);
  await uploadFile(tempPath);
} finally {
  await fs.promises.unlink(tempPath).catch(() => {});
}
```

---

## 7. Logging Patterns

### Use structured logger — not console.log

```typescript
// ✅ DO
logger.info('Upload complete', { file: path, code: fileCode, duration: ms });

// ❌ DON'T
console.log('uploaded ' + path);
```

### Log levels

| Level | Usage |
|-------|-------|
| `debug` | Internal state, hashes, DB queries |
| `info` | User-facing progress |
| `warn` | Skipped files, expiring premium, permission issues |
| `error` | Failed operations (but don't exit — let CLI decide) |

### Never log secrets

```typescript
// ✅ DO
logger.info('Authenticating', { keyPrefix: apiKey.slice(-4) });

// ❌ DON'T
logger.info('Using key', { key: apiKey });
```

---

## 8. Testing Patterns

### Test file naming mirrors source

```
src/core/uploader.ts       → tests/unit/core/uploader.test.ts
src/api/client.ts          → tests/unit/api/client.test.ts
```

### Use `describe` blocks per method

```typescript
describe('Uploader', () => {
  describe('uploadFile', () => {
    it('should upload and return file code', async () => { ... });
    it('should skip duplicate files', async () => { ... });
    it('should retry on server error', async () => { ... });
  });
});
```

### Mock at boundaries — not internals

```typescript
// ✅ DO: mock the API client
const mockApi = { uploadFile: vi.fn().mockResolvedValue({ fileCode: 'abc' }) };
const uploader = new Uploader(mockApi, mockDb);

// ❌ DON'T: mock fetch globally
vi.mock('node-fetch');
```

---

## 9. Commit Patterns

### Conventional Commits — strictly enforced

```
feat: add incremental backup engine
fix: handle empty file upload gracefully
test: add encryption roundtrip tests
docs: update API reference with retry config
refactor: extract retry logic into withRetry helper
chore: update vitest to 2.1
```

### One logical change per commit

```bash
# ✅ DO
git commit -m "feat: add SHA-256 file hashing utility"
git commit -m "test: add hash utility tests"

# ❌ DON'T
git commit -m "add hashing, encryption, and backup engine"
```

---

## 10. Import Order

```typescript
// 1. Node built-ins
import { createReadStream } from 'node:fs';
import { resolve } from 'node:path';
import { createHash } from 'node:crypto';

// 2. Third-party packages
import { Command } from 'commander';
import Database from 'better-sqlite3';

// 3. Internal — absolute from src root
import { FileLuClient } from '../api/client.js';
import { logger } from '../utils/logger.js';

// 4. Types (type-only imports)
import type { TrackedFile } from '../db/models.js';
```

---

## 11. IDE-Level Constraints

> These rules apply regardless of which editor or AI agent is operating on the codebase.

| Rule | Setting | Enforcement |
|------|---------|-------------|
| **Indentation** | 2 spaces | `.editorconfig` / `tsconfig` |
| **Line endings** | LF (`\n`) | `.editorconfig` / git `core.autocrlf=input` |
| **Max line length** | 100 characters | ESLint `max-len` |
| **Trailing whitespace** | Strip on save | `.editorconfig` |
| **Final newline** | Always | `.editorconfig` |
| **Semicolons** | Always | ESLint `semi: ['error', 'always']` |
| **Quotes** | Single quotes | ESLint `quotes: ['error', 'single']` |
| **Trailing commas** | Always (ES5+) | ESLint `comma-dangle: ['error', 'always-multiline']` |
| **Brace style** | 1TBS (one true brace style) | ESLint `brace-style` |
| **No unused imports** | Error | `@typescript-eslint/no-unused-vars` |
| **No unused locals** | Error | `tsconfig: noUnusedLocals` |
| **Strict null checks** | Enabled | `tsconfig: strictNullChecks` |
| **No implicit any** | Enabled | `tsconfig: noImplicitAny` |

### `.editorconfig`

```ini
root = true

[*]
indent_style = space
indent_size = 2
end_of_line = lf
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true

[*.md]
trim_trailing_whitespace = false
```

---

## 12. Mandatory Pre-Execution Checks

> Run these checks **before** committing, pushing, or claiming a task is complete.

### Checklist (in order)

```bash
# 1. Type check — zero errors
npx tsc --noEmit

# 2. Lint — zero warnings/errors
npx eslint src/ tests/

# 3. Unit tests — all pass
npx vitest run

# 4. Coverage — meets thresholds (≥ 80% lines)
npx vitest run --coverage

# 5. Security audit — zero critical/high
npm audit --audit-level=high

# 6. Build — compiles successfully
npx tsup src/cli/index.ts --format esm --dts --clean
```

### When to Run What

| Trigger | Required Checks |
|---------|----------------|
| Before every commit | Steps 1–3 |
| Before pushing to remote | Steps 1–5 |
| Before claiming task complete | Steps 1–6 |
| Before creating a PR | Steps 1–6 |
| After installing/updating deps | Steps 1, 4, 5 |

### Failure Policy

- **Type errors:** Fix immediately — never commit with type errors
- **Lint errors:** Fix immediately — `npx eslint --fix` for auto-fixable
- **Test failures:** Fix the test or the code — never skip/comment out
- **Coverage drops:** Add tests before merging — coverage must not decrease
- **Audit findings:** Evaluate, update dep, or document exemption in `DECISIONS.md`
- **Build failures:** Fix before merge — CI will block anyway
