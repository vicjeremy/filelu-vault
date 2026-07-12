# FileLu Vault — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Build `filelu-vault`, an open-source Node.js CLI tool for secure upload, backup, and sync operations with [FileLu](https://filelu.com) cloud storage.

**Architecture:** TypeScript CLI built on Commander.js, using FileLu's REST API (account info, upload server, file upload). Local SQLite database tracks file state for incremental sync/backup. AES-256 client-side encryption optional before upload.

**Tech Stack:** Node.js 20+, TypeScript 5.x, Commander.js (CLI), better-sqlite3 (local state), node-fetch (HTTP), form-data (multipart), crypto (encryption), vitest (testing), tsup (bundling).

---

## ⛔ MANDATORY: Pre-Flight Documentation Gate

> [!CAUTION]
> **DO NOT write any code, run any commands, or create any files until you have completed EVERY step below.** This gate is non-negotiable. Skipping it is a build-breaking violation.

**Before starting ANY task in this plan, the AI agent MUST:**

- [ ] **Step 0.1:** Read `PRD.md` — understand the north star, MVP features, and what the MVP is NOT
- [ ] **Step 0.2:** Read `ARCHITECTURE.md` — understand tech stack, system layers, directory structure, data flows, and error hierarchy
- [ ] **Step 0.3:** Read `DESIGN.md` — understand terminal colors (ANSI codes), typography, iconography, spacing rules, CLI output patterns, and do's/don'ts
- [ ] **Step 0.4:** Read `PATTERNS.md` — understand all coding standards: TypeScript patterns, error handling, API patterns, DB patterns, file I/O, logging, testing, commits, import order, IDE constraints, and **mandatory pre-execution checks**
- [ ] **Step 0.5:** Read `CONSTRAINTS.md` — understand hard boundaries: allowed deps (only 4 runtime), forbidden libraries, performance targets, security constraints, compatibility, code quality, API constraints, file handling, architecture constraints
- [ ] **Step 0.6:** Read `DATA_MODEL.md` — understand all 3 tables (tracked_files, backup_jobs, upload_logs), ER diagram, column specs, status state machine, common queries, RLS, migration strategy, and pragmas
- [ ] **Step 0.7:** Read `THREAT_MODEL.md` — understand assets, threat actors, attack surfaces, mitigations, authentication, data protection boundaries, and security checklist
- [ ] **Step 0.8:** Read `TESTING.md` — understand testing philosophy, test types (unit/integration/E2E), coverage thresholds per module, test patterns (mock at boundary, in-memory SQLite, fixtures, error assertions, encryption roundtrip), CI/CD pipeline, and AI test generation rules
- [ ] **Step 0.9:** Read `AGENTS.md` — understand communication style, code comment rules, forbidden actions, task tracking requirements, and debugging process
- [ ] **Step 0.10:** Read `DECISIONS.md` — understand all 7 ADRs (SQLite, AES-256-GCM, Commander.js, node-fetch, named exports, raw AES key, minimal deps) and the reasoning behind each
- [ ] **Step 0.11:** Read `MEMORY.md` — check for corrections, user preferences, non-obvious findings (HTTP upload servers, sess_id, storage_left "inf", file_0 field name), and session context
- [ ] **Step 0.12:** Read `BUGS.md` — check for known issues and active bugs
- [ ] **Step 0.13:** Read `AUDIT.md` — understand current build state, what's missing, what's built
- [ ] **Step 0.14:** Read `TODO.md` — understand which tasks are complete, in-progress, or pending
- [ ] **Step 0.15:** Read `DOCUMENTATION.md` — understand the module registry and system documentation
- [ ] **Step 0.16:** Read `IMPLEMENTATION_PLAN.md` (this file) — understand all 10 tasks end-to-end before starting any individual task

> [!WARNING]
> **After reading all files above, confirm understanding by updating `TASK_TODAY.md` with the current session date, focus area, and which task you are starting.** Only then may you proceed to Task 1.

### Why This Gate Exists

- Documentation contains **non-obvious API quirks** (HTTP upload servers, `file_0` field name, `sess_id` scope, `"inf"` storage) that will cause bugs if not understood upfront
- `CONSTRAINTS.md` has **forbidden libraries** — installing the wrong dep wastes time
- `PATTERNS.md` has **mandatory coding conventions** — violations require full rewrites
- `DESIGN.md` has **exact ANSI color codes** — wrong terminal output fails review
- `DECISIONS.md` explains **why** choices were made — re-debating settled decisions wastes cycles

---

## Global Constraints

- Node.js ≥ 20, TypeScript strict mode, no `any`, no default exports
- Zero runtime dependencies beyond: `commander`, `better-sqlite3`, `node-fetch`, `form-data`
- API key stored in `~/.filelu-vault/config.json` — never logged, never committed
- All HTTP errors must surface actionable messages (not raw stack traces)
- Every public function has JSDoc (`@param`, `@returns`, `@throws`) + at least one unit test
- Conventional Commits: `feat:`, `fix:`, `test:`, `docs:`, `refactor:`, `chore:`
- Run `npx tsc --noEmit && npx vitest run` before every commit

---

## Project Structure

```
filelu-vault/
├── src/
│   ├── cli/                    # CLI command definitions
│   │   ├── index.ts            # CLI entry point + Commander setup
│   │   ├── upload.ts           # `vault upload` command
│   │   ├── backup.ts           # `vault backup` command
│   │   ├── sync.ts             # `vault sync` command
│   │   ├── status.ts           # `vault status` command
│   │   └── config.ts           # `vault config` command
│   ├── api/                    # FileLu API client
│   │   ├── client.ts           # Core API client (account, server, upload)
│   │   └── types.ts            # API response types
│   ├── core/                   # Business logic
│   │   ├── uploader.ts         # Upload orchestration (hash, dedup, retry)
│   │   ├── backup.ts           # Backup engine (scan, diff, upload)
│   │   ├── sync.ts             # Sync engine (watch, diff, upload)
│   │   └── encryption.ts       # AES-256-GCM client-side encryption
│   ├── db/                     # Local state database
│   │   ├── database.ts         # SQLite setup + migrations
│   │   ├── models.ts           # TypeScript interfaces for DB rows
│   │   └── queries.ts          # Prepared statements
│   ├── config/                 # Configuration management
│   │   ├── store.ts            # Read/write ~/.filelu-vault/config.json
│   │   └── schema.ts           # Config validation + defaults
│   └── utils/                  # Shared utilities
│       ├── logger.ts           # Structured logging
│       ├── hash.ts             # SHA-256 file hashing
│       ├── progress.ts         # Terminal progress bar
│       └── errors.ts           # Custom error classes
├── tests/
│   ├── unit/                   # Unit tests (mocked API)
│   │   ├── api/client.test.ts
│   │   ├── core/uploader.test.ts
│   │   ├── core/backup.test.ts
│   │   ├── core/encryption.test.ts
│   │   ├── db/database.test.ts
│   │   └── config/store.test.ts
│   └── integration/            # Integration tests (real API, CI-only)
│       └── upload.integration.test.ts
├── *.md                        # Documentation suite (UPPERCASE at root)
├── .github/workflows/
│   └── ci.yml                  # GitHub Actions CI
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── .gitignore
├── .env.example
├── LICENSE                     # MIT
└── README.md
```

---

## Task 1: Project Scaffold & Configuration

**Prerequisites:** Pre-Flight Gate (Steps 0.1–0.16) complete.

**Files:**
- Create: `package.json`, `tsconfig.json`, `vitest.config.ts`, `.gitignore`, `.env.example`, `LICENSE`
- Create: `src/config/schema.ts`, `src/config/store.ts`
- Create: `src/utils/errors.ts`, `src/utils/logger.ts`
- Test: `tests/unit/config/store.test.ts`

**Produces:**
- `ConfigStore.load(): VaultConfig` — reads `~/.filelu-vault/config.json`
- `ConfigStore.save(config: VaultConfig): void`
- `AppError`, `ApiError`, `ConfigError`, `UploadError`, `EncryptionError`, `DatabaseError`
- `logger.info()`, `logger.error()`, `logger.debug()`, `logger.warn()`

- [ ] Step 1: Initialize npm project

```bash
npm init -y
npm install commander better-sqlite3 node-fetch form-data
npm install -D typescript @types/node @types/better-sqlite3 vitest tsup eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin
```

- [ ] Step 2: Create `tsconfig.json` (strict, ES2022, NodeNext, outDir: dist)

```json
{
  "compilerOptions": {
    "strict": true,
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "outDir": "dist",
    "rootDir": "src",
    "declaration": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "esModuleInterop": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist", "tests"]
}
```

- [ ] Step 3: Create `vitest.config.ts` (per `TESTING.md` §3 coverage thresholds)
- [ ] Step 4: Create `.gitignore` (node_modules, dist, *.db, *.db-wal, config.json, .env)
- [ ] Step 5: Create `.env.example` with placeholder key
- [ ] Step 6: Create `LICENSE` (MIT)
- [ ] Step 7: Write `VaultConfig` interface in `src/config/schema.ts`

```typescript
export interface VaultConfig {
  apiKey: string;
  dataDir: string;             // default: ~/.filelu-vault
  encryptionEnabled: boolean;  // default: false
  encryptionKey?: string;      // AES-256 key, base64 encoded
  maxRetries: number;          // default: 3
  concurrency: number;         // default: 3
  excludePatterns: string[];   // default: ['node_modules/**', '.git/**', '.DS_Store']
}
```

- [ ] Step 8: Write `ConfigStore` class in `src/config/store.ts` (load, save, chmod 0600)
- [ ] Step 9: Write error class hierarchy in `src/utils/errors.ts` (per `ARCHITECTURE.md` §8)

```typescript
// AppError (code: string, message: string, cause?: Error)
// ├── ConfigError       — missing config, invalid schema, bad permissions
// ├── ApiError          — HTTP errors, auth failures, timeouts
// ├── UploadError       — file not found, upload stream failures
// ├── EncryptionError   — bad key, corrupt ciphertext, auth tag mismatch
// └── DatabaseError     — SQLite errors, migration failures
```

- [ ] Step 10: Write structured logger in `src/utils/logger.ts` (respects NO_COLOR + !isTTY, per `DESIGN.md` §2)
- [ ] Step 11: Write failing tests for ConfigStore (TDD per `TESTING.md` §6)
- [ ] Step 12: Run tests → verify pass: `npx vitest run`
- [ ] Step 13: Type check → verify clean: `npx tsc --noEmit`
- [ ] Step 14: Commit: `feat: project scaffold and config management`

---

## Task 2: FileLu API Client

**Prerequisites:** Task 1 complete.

**Files:**
- Create: `src/api/types.ts`, `src/api/client.ts`
- Test: `tests/unit/api/client.test.ts`

**Consumes:** ConfigStore, AppError, ApiError
**Produces:**
- `FileLuClient.getAccountInfo(): Promise<AccountInfo>`
- `FileLuClient.getUploadServer(): Promise<UploadServer>`
- `FileLuClient.uploadFile(url: string, sessId: string, filePath: string): Promise<UploadResult>`
- `withRetry<T>(fn, maxRetries): Promise<T>` — exponential backoff helper

- [ ] Step 1: Define API response types in `src/api/types.ts`

```typescript
export interface AccountInfoResponse {
  msg: string;
  status: number;
  server_time: string;
  result: {
    email: string;
    storage_used: string | null;   // null for some premium accounts
    premium_expire: string;
    storage_left: string;          // "inf" for premium — handle as special case
  };
}

export interface UploadServerResponse {
  status: number;
  sess_id: string;               // tied to specific upload server URL — must use together
  result: string;                // upload URL (HTTP, not HTTPS!)
  msg: string;
  server_time: string;
}

export interface UploadResult {
  file_code: string;             // e.g., "b578rni0e1ka"
  file_status: string;
}
// Note: upload response is a JSON array even for single files: [{file_code, file_status}]
// Note: upload field name must be "file_0" — not "file" or "upload"
```

- [ ] Step 2: Implement `withRetry<T>(fn, maxRetries)` helper (per `PATTERNS.md` §4)
- [ ] Step 3: Implement `FileLuClient` constructor (apiKey — never log it, per `CONSTRAINTS.md` §3)
- [ ] Step 4: Implement `getAccountInfo()` — GET `/api/account/info?key=KEY`
- [ ] Step 5: Implement `getUploadServer()` — GET `/api/upload/server?key=KEY`
- [ ] Step 6: Implement `uploadFile()` — POST multipart with form-data (field: `file_0`, type: `utype=prem`)
- [ ] Step 7: Write unit tests with mocked fetch (success, 403 auth failure, 500 server error, retry, timeout)
- [ ] Step 8: Run tests → verify pass: `npx vitest run`
- [ ] Step 9: Type check: `npx tsc --noEmit`
- [ ] Step 10: Commit: `feat: FileLu API client with retry logic`

---

## Task 3: Database Layer

**Prerequisites:** Task 1 complete.

**Files:**
- Create: `src/db/models.ts`, `src/db/database.ts`, `src/db/queries.ts`
- Test: `tests/unit/db/database.test.ts`

**Produces:**
- `Database.init(): void` — creates tables + runs migrations
- `Database.upsertFile(file: TrackedFile): void`
- `Database.getFile(path: string): TrackedFile | null`
- `Database.getFilesForBackup(dir: string): TrackedFile[]`
- `Database.markUploaded(path: string, fileCode: string): void`
- `Database.getStats(): DashboardStats`

- [ ] Step 1: Define models in `src/db/models.ts` (per `DATA_MODEL.md` §3)

```typescript
export interface TrackedFile {
  id?: number;
  local_path: string;             // absolute path (UNIQUE)
  file_hash: string;              // SHA-256 hex digest
  file_size: number;              // bytes
  file_code: string | null;       // FileLu file code after upload
  file_url: string | null;        // https://filelu.com/<file_code>
  status: 'pending' | 'uploading' | 'uploaded' | 'failed' | 'deleted';
  encrypted: boolean;
  backup_job_id?: number | null;  // FK → backup_jobs.id
  created_at: string;             // UTC ISO-8601
  updated_at: string;
  last_synced_at: string | null;
}

export interface BackupJob {
  id?: number;
  source_dir: string;
  status: 'running' | 'completed' | 'failed' | 'cancelled';
  files_total: number;
  files_uploaded: number;
  files_skipped: number;
  files_failed: number;
  error_message?: string | null;
  started_at: string;
  completed_at: string | null;
}

export interface UploadLog {
  id?: number;
  tracked_file_id: number;        // FK → tracked_files.id (CASCADE DELETE)
  attempt_number: number;         // 1, 2, 3
  status: 'success' | 'failed' | 'timeout';
  error_message?: string | null;
  upload_server?: string | null;
  duration_ms?: number | null;
  created_at: string;
}
```

- [ ] Step 2: Implement `Database` class with SQLite init + WAL pragma in `src/db/database.ts` (per `DATA_MODEL.md` §7 pragmas)
- [ ] Step 3: Implement migration system (PRAGMA user_version, per `DATA_MODEL.md` §6)
- [ ] Step 4: Write migration 1: CREATE all 3 tables + all indexes (per `DATA_MODEL.md` §3)
- [ ] Step 5: Implement prepared queries in `src/db/queries.ts` (per `DATA_MODEL.md` §4 common queries)
- [ ] Step 6: Write tests with in-memory SQLite (`:memory:`) — CRUD, migration, dedup query, stats query
- [ ] Step 7: Run tests → verify pass: `npx vitest run`
- [ ] Step 8: Type check: `npx tsc --noEmit`
- [ ] Step 9: Commit: `feat: SQLite state database with file tracking`

---

## Task 4: Upload Engine

**Prerequisites:** Tasks 2 and 3 complete.

**Files:**
- Create: `src/core/uploader.ts`, `src/utils/hash.ts`, `src/utils/progress.ts`
- Test: `tests/unit/core/uploader.test.ts`, `tests/unit/utils/hash.test.ts`

**Consumes:** FileLuClient, Database, logger
**Produces:**
- `hashFile(filePath: string): Promise<string>` — streaming SHA-256
- `Uploader.uploadFile(filePath: string, options?: UploadOptions): Promise<UploadResult>`
- `Uploader.uploadBatch(files: string[], options?: BatchOptions): Promise<BatchResult>`

- [ ] Step 1: Implement streaming SHA-256 hash in `src/utils/hash.ts` (per `PATTERNS.md` §6 — use streams, not readFileSync)
- [ ] Step 2: Write hash tests (known file → known hash)
- [ ] Step 3: Implement progress bar in `src/utils/progress.ts` (per `DESIGN.md` §5 — 40 chars, respects !isTTY)
- [ ] Step 4: Implement `Uploader` class: hash → dedup check → getServer → upload → record in DB
- [ ] Step 5: Implement `uploadBatch` with semaphore concurrency (default 3, max 10 per `CONSTRAINTS.md` §2)
- [ ] Step 6: Write unit tests (mock API + DB): upload success, dedup skip, retry on 500, batch concurrency
- [ ] Step 7: Run tests → verify pass: `npx vitest run`
- [ ] Step 8: Type check: `npx tsc --noEmit`
- [ ] Step 9: Commit: `feat: upload engine with dedup, retry, and progress`

---

## Task 5: Client-Side Encryption

**Prerequisites:** Task 1 complete.

**Files:**
- Create: `src/core/encryption.ts`
- Test: `tests/unit/core/encryption.test.ts`

**Produces:**
- `Encryptor.encryptFile(inputPath: string, outputPath: string): Promise<void>`
- `Encryptor.decryptFile(inputPath: string, outputPath: string): Promise<void>`
- `Encryptor.generateKey(): string` — returns base64 AES-256 key

- [ ] Step 1: Implement `generateKey()` → `crypto.randomBytes(32).toString('base64')` (per `THREAT_MODEL.md` §3.4)
- [ ] Step 2: Implement streaming `encryptFile()` — AES-256-GCM, random 12-byte IV, 16-byte auth tag (per `THREAT_MODEL.md` §3.4 file format: `[IV 12B][Ciphertext][AuthTag 16B]`)
- [ ] Step 3: Implement streaming `decryptFile()` — read IV, decrypt, verify auth tag
- [ ] Step 4: Write roundtrip test: encrypt → decrypt → diff → identical (per `TESTING.md` §4)
- [ ] Step 5: Write tamper test: modify 1 byte of ciphertext → decrypt throws `EncryptionError` (per `TESTING.md` §4)
- [ ] Step 6: Run tests → verify pass: `npx vitest run`
- [ ] Step 7: Type check: `npx tsc --noEmit`
- [ ] Step 8: Commit: `feat: AES-256-GCM client-side encryption`

---

## Task 6: Backup Engine

**Prerequisites:** Tasks 4 and 5 complete.

**Files:**
- Create: `src/core/backup.ts`
- Test: `tests/unit/core/backup.test.ts`

**Consumes:** Uploader, Database, Encryptor, hashFile
**Produces:**
- `BackupEngine.run(sourceDir: string, options?: BackupOptions): Promise<BackupResult>`
- `BackupEngine.status(sourceDir: string): BackupStatus`

- [ ] Step 1: Implement recursive directory scan (skip excluded patterns per `CONSTRAINTS.md` §7: node_modules, .git, .DS_Store, Thumbs.db, *.tmp, *.swp, symlinks, hidden files, 0-byte files)
- [ ] Step 2: Implement hash → dedup check → upload pipeline
- [ ] Step 3: Implement backup job tracking (create → update counts → complete, per `DATA_MODEL.md` §3.2)
- [ ] Step 4: Implement `--dry-run` mode (scan + hash + print, no upload)
- [ ] Step 5: Implement `--encrypt` integration (encrypt to `~/.filelu-vault/tmp/` → upload → cleanup in `finally` block per `PATTERNS.md` §6)
- [ ] Step 6: Write tests with fixture directories (new files, changed files, unchanged files, excluded patterns)
- [ ] Step 7: Run tests → verify pass: `npx vitest run`
- [ ] Step 8: Type check: `npx tsc --noEmit`
- [ ] Step 9: Commit: `feat: incremental backup engine`

---

## Task 7: Sync Engine

**Prerequisites:** Task 6 complete.

**Files:**
- Create: `src/core/sync.ts`

**Consumes:** BackupEngine, Database
**Produces:**
- `SyncEngine.watch(dir: string): void` — starts fs.watch
- `SyncEngine.stop(): void`

- [ ] Step 1: Implement fs.watch wrapper with recursive option (known risk: `BUGS.md` R3 — may miss rapid changes on some OS)
- [ ] Step 2: Implement debounce logic (500ms per file path)
- [ ] Step 3: Handle file change → trigger upload
- [ ] Step 4: Handle file delete → mark `status='deleted'` in DB
- [ ] Step 5: Handle SIGINT → graceful stop + print stats (per `DESIGN.md` §6 backup summary format)
- [ ] Step 6: Manual test with temp directory
- [ ] Step 7: Commit: `feat: real-time sync with filesystem watcher`

---

## Task 8: CLI Commands

**Prerequisites:** Tasks 1–7 complete.

**Files:**
- Create: `src/cli/index.ts`, `src/cli/upload.ts`, `src/cli/backup.ts`, `src/cli/sync.ts`, `src/cli/status.ts`, `src/cli/config.ts`

**Consumes:** All core modules

- [ ] Step 1: Create CLI entry point in `src/cli/index.ts`

```typescript
#!/usr/bin/env node
import { Command } from 'commander';
const program = new Command();
program
  .name('filelu-vault')
  .description('Secure backup, sync & upload tool for FileLu cloud storage')
  .version('1.0.0');
// register subcommands...
program.parse();
```

- [ ] Step 2: Implement `vault config set-key <key>` command (save with 0600 perms)
- [ ] Step 3: Implement `vault config show` command (mask API key: `****<last4>`)
- [ ] Step 4: Implement `vault upload <file...>` command with `--encrypt` flag (output per `DESIGN.md` §6)
- [ ] Step 5: Implement `vault backup <dir>` command with `--encrypt` and `--dry-run` (summary box per `DESIGN.md` §6)
- [ ] Step 6: Implement `vault sync <dir>` command with `--encrypt`
- [ ] Step 7: Implement `vault status` command (account info + local stats, per `DESIGN.md` §6 status format)
- [ ] Step 8: Add `--verbose` global flag → set logger to debug level
- [ ] Step 9: Add `--json` global flag → machine-readable output (no ANSI per `DESIGN.md` §7)
- [ ] Step 10: Test each command manually against verification table below
- [ ] Step 11: Commit: `feat: CLI commands for upload, backup, sync, status, config`

---

## Task 9: Testing & CI

**Prerequisites:** Tasks 1–8 complete.

**Files:**
- Create: `.github/workflows/ci.yml`
- Create: `tests/integration/upload.integration.test.ts`
- Verify: All test files exist and pass

- [ ] Step 1: Write integration test `tests/integration/upload.integration.test.ts` (real API key via `FILELU_API_KEY` env var)
- [ ] Step 2: Create GitHub Actions CI per `TESTING.md` §5 (test, lint, typecheck, build on ubuntu/macos/windows × Node 20/22)
- [ ] Step 3: Run full test suite: `npx vitest run --coverage`
- [ ] Step 4: Verify coverage ≥ 80% per module thresholds in `TESTING.md` §3 (api: 90%, core: 85%, db: 80%)
- [ ] Step 5: Run `npx tsc --noEmit` → zero errors
- [ ] Step 6: Run `npm audit --audit-level=high` → zero critical/high
- [ ] Step 7: Run security checklist from `THREAT_MODEL.md` §6
- [ ] Step 8: Commit: `test: complete test suite and CI pipeline`

---

## Task 10: Documentation & GitHub Publish

**Prerequisites:** Task 9 complete + all tests green.

**Files:**
- Update: all root `*.md` files
- Create: `SECURITY.md` (repo root), `CONTRIBUTING.md`
- Update: `README.md`

- [ ] Step 1: Update `README.md` with actual install/usage examples (real output, not placeholders)
- [ ] Step 2: Write `SECURITY.md` in repo root (vulnerability disclosure, per `THREAT_MODEL.md` §7)
- [ ] Step 3: Write `CONTRIBUTING.md`
- [ ] Step 4: Update `DOCUMENTATION.md` with final system state — all modules `🟢 Built`
- [ ] Step 5: Update `AUDIT.md` with final audit results
- [ ] Step 6: Update `TODO.md` — mark all tasks complete
- [ ] Step 7: `git push origin main`
- [ ] Step 8: Create GitHub release v1.0.0
- [ ] Step 9: Verify CI passes on GitHub
- [ ] Step 10: Commit: `docs: final documentation and GitHub publish`

---

## Verification Plan

### Automated

```bash
npx tsc --noEmit             # zero type errors
npx eslint src/ tests/       # zero lint errors
npx vitest run --coverage    # target: ≥80% coverage
npm audit --audit-level=high # zero critical/high vulns
npx tsup src/cli/index.ts --format esm --dts --clean  # builds successfully
```

### Manual

| Command | Expected |
|---------|----------|
| `vault config set-key <key>` | Config file created at `~/.filelu-vault/config.json`, 0600 perms |
| `vault config show` | Config displayed with masked API key |
| `vault status` | Account info + local stats in formatted box |
| `vault upload test.txt` | File uploaded, URL printed: `✓ Uploaded → https://filelu.com/<code>` |
| `vault upload test.txt` (again) | Skipped: `⊘ Skipped (unchanged)` |
| `vault upload secret.txt --encrypt` | Encrypted upload with `🔒` indicator |
| `vault backup ./test-dir` | Uploads new files, skips unchanged, prints summary box |
| `vault backup ./test-dir` (again) | All skipped — zero uploads |
| `vault backup ./test-dir --dry-run` | Lists files, uploads nothing |
| `vault sync ./test-dir` | Watches; edit a file → auto-uploaded within 2s; Ctrl+C → stats |

### Security Verification (per `THREAT_MODEL.md` §6)

- [ ] API key never appears in stdout, stderr, or log files
- [ ] `config.json` created with `chmod 0600`
- [ ] `vault.db` created with `chmod 0600`
- [ ] Encryption roundtrip: encrypt → decrypt → `diff` → identical
- [ ] Auth tag tamper: modify 1 byte → decrypt throws
- [ ] Path traversal: `../../etc/passwd` → rejected
- [ ] SQL injection: path with `'; DROP TABLE --` → safely parameterized
- [ ] Empty file (0 bytes) → skipped, no crash
- [ ] File > 1GB → streaming, no OOM
