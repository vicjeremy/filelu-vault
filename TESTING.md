# FileLu Vault — Testing Strategy

> **Version:** 1.0 | **Last Updated:** 2026-07-09

---

## 1. Testing Philosophy

- **Test behavior, not implementation** — tests should survive refactors
- **Mock at boundaries** — mock API client and DB, not internal functions
- **Fast by default** — unit tests run in < 5s total
- **Coverage is a floor, not a ceiling** — ≥ 80% lines, but test critical paths first

---

## 2. Test Types

### Unit Tests

**Location:** `tests/unit/`
**Runner:** Vitest
**Mocking:** `vi.fn()`, `vi.mock()`
**When:** Every commit, every PR, every CI run

| Module | Test File | What's Tested |
|--------|-----------|---------------|
| `src/config/store.ts` | `tests/unit/config/store.test.ts` | Load, save, validation, permissions |
| `src/api/client.ts` | `tests/unit/api/client.test.ts` | API calls, retry logic, error mapping |
| `src/core/uploader.ts` | `tests/unit/core/uploader.test.ts` | Upload, dedup, batch, retry |
| `src/core/backup.ts` | `tests/unit/core/backup.test.ts` | Scan, diff, incremental logic |
| `src/core/encryption.ts` | `tests/unit/core/encryption.test.ts` | Encrypt, decrypt, roundtrip, tamper |
| `src/db/database.ts` | `tests/unit/db/database.test.ts` | CRUD, migrations, queries |
| `src/utils/hash.ts` | `tests/unit/utils/hash.test.ts` | SHA-256 correctness |

### Integration Tests

**Location:** `tests/integration/`
**Runner:** Vitest with `--project integration`
**When:** CI only (requires real API key via `FILELU_API_KEY` env var)

| Test File | What's Tested |
|-----------|---------------|
| `upload.integration.test.ts` | Real upload to FileLu → verify file code returned |

### E2E Test Scenarios

**Location:** Manual or scripted in `tests/e2e/`
**When:** Pre-release only

| # | Scenario | Steps | Expected |
|---|----------|-------|----------|
| E1 | First-time setup | `vault config set-key <key>` → `vault status` | Config created, account info shown |
| E2 | Single upload | `vault upload test.txt` | File uploaded, URL printed |
| E3 | Dedup skip | Upload same file twice | Second run prints "⊘ Skipped" |
| E4 | Encrypted upload | `vault upload secret.txt --encrypt` | File encrypted, then uploaded |
| E5 | Directory backup | `vault backup ./test-dir` | All new files uploaded |
| E6 | Incremental backup | Backup → modify 1 file → backup again | Only modified file uploaded |
| E7 | Dry-run | `vault backup ./test-dir --dry-run` | Lists files, uploads nothing |
| E8 | Sync watch | `vault sync ./dir` → edit a file → Ctrl+C | File auto-uploaded within 2s |
| E9 | Error recovery | Kill during backup → run backup again | Resumes from where it left off |
| E10 | Invalid key | `vault config set-key invalid` → `vault status` | Auth error message, exit code 3 |

---

## 3. Coverage Thresholds

```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      thresholds: {
        lines: 80,
        functions: 80,
        branches: 75,
        statements: 80,
      },
      include: ['src/**/*.ts'],
      exclude: ['src/cli/**'],  // CLI is thin — covered by E2E
    },
  },
});
```

| Module | Min Coverage | Rationale |
|--------|-------------|-----------|
| `src/api/` | 90% | Critical path — auth, upload, retry |
| `src/core/` | 85% | Business logic — dedup, backup, encryption |
| `src/db/` | 80% | State management — queries, migrations |
| `src/config/` | 80% | Config load/save/validate |
| `src/utils/` | 75% | Utilities — hash, logger |
| `src/cli/` | exempt | Thin wrapper — covered by E2E scenarios |

---

## 4. Test Patterns

### Pattern: Mock at Boundary

```typescript
// ✅ DO: mock the injected dependency
const mockApi = {
  getUploadServer: vi.fn().mockResolvedValue({ url: 'http://test.com', sessId: 'abc' }),
  uploadFile: vi.fn().mockResolvedValue({ fileCode: 'xyz', fileStatus: 'OK' }),
};
const uploader = new Uploader(mockApi as any, mockDb);

// ❌ DON'T: mock global fetch
vi.mock('node-fetch');
```

### Pattern: In-Memory SQLite

```typescript
// ✅ Use :memory: for fast, isolated DB tests
const db = new Database(':memory:');
db.init();  // runs migrations

afterEach(() => {
  db.exec('DELETE FROM tracked_files');
  db.exec('DELETE FROM backup_jobs');
});
```

### Pattern: Fixture Files

```typescript
// ✅ Use temp directories for file-based tests
import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';

const testDir = mkdtempSync(path.join(tmpdir(), 'vault-test-'));
writeFileSync(path.join(testDir, 'file1.txt'), 'hello');
writeFileSync(path.join(testDir, 'file2.txt'), 'world');
```

### Pattern: Error Assertions

```typescript
// ✅ Assert specific error type and message
await expect(client.getAccountInfo()).rejects.toThrow(ApiError);
await expect(client.getAccountInfo()).rejects.toMatchObject({
  statusCode: 403,
  message: expect.stringContaining('Authentication'),
});
```

### Pattern: Encryption Roundtrip

```typescript
it('should encrypt and decrypt to identical content', async () => {
  const original = Buffer.from('sensitive data');
  writeFileSync(inputPath, original);
  
  await encryptor.encryptFile(inputPath, encPath);
  await encryptor.decryptFile(encPath, decPath);
  
  const decrypted = readFileSync(decPath);
  expect(decrypted).toEqual(original);
});

it('should reject tampered ciphertext', async () => {
  await encryptor.encryptFile(inputPath, encPath);
  
  // Tamper: flip one byte
  const data = readFileSync(encPath);
  data[20] ^= 0xff;
  writeFileSync(encPath, data);
  
  await expect(encryptor.decryptFile(encPath, decPath))
    .rejects.toThrow(EncryptionError);
});
```

---

## 5. CI/CD Pipeline

### GitHub Actions Workflow

```yaml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ${{ matrix.os }}
    strategy:
      matrix:
        os: [ubuntu-latest, macos-latest, windows-latest]
        node: [20, 22]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '${{ matrix.node }}', cache: npm }
      - run: npm ci
      - run: npx tsc --noEmit          # Type check
      - run: npx vitest run --coverage  # Unit tests
      - run: npm audit --audit-level=high
      - run: npx tsup src/cli/index.ts --format esm --dts --clean  # Build
```

### CI Gates (must pass before merge)

| Gate | Command | Threshold |
|------|---------|-----------|
| Type check | `tsc --noEmit` | 0 errors |
| Unit tests | `vitest run` | 100% pass |
| Coverage | `vitest run --coverage` | ≥ 80% lines |
| Security | `npm audit --audit-level=high` | 0 high/critical |
| Build | `tsup` | Compiles successfully |

---

## 6. How AI Should Generate Tests

When implementing a new feature:

1. **Write the test first** — TDD: describe expected behavior before implementation
2. **One `describe` block per class/function** — mirror the source structure
3. **Name tests as sentences** — `it('should skip files with matching hash', ...)`
4. **Test the happy path first** — then edge cases, then error cases
5. **Never test private methods** — test through the public API
6. **Keep tests independent** — no shared mutable state between `it` blocks
7. **Use `beforeEach` for setup** — not `before` (avoid shared state)
8. **Assert specific values** — not just "truthy" or "defined"
