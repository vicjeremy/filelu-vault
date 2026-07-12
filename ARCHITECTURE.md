# FileLu Vault — Architecture

> **Version:** 1.0 | **Last Updated:** 2026-07-09

---

## 1. Tech Stack

| Layer | Technology | Version | Why |
|-------|-----------|---------|-----|
| **Runtime** | Node.js | ≥ 20 LTS | Native ESM, crypto, fs.watch |
| **Language** | TypeScript | 5.x | Strict mode, type safety |
| **CLI** | Commander.js | 12.x | Zero-config, 50M+ weekly downloads |
| **Database** | SQLite (better-sqlite3) | 11.x | Atomic writes, WAL, single file |
| **HTTP** | node-fetch | 3.x | ESM-native, web-standards FormData |
| **Multipart** | form-data | 4.x | Multipart/form-data for uploads |
| **Encryption** | Node.js crypto | built-in | AES-256-GCM, zero dependencies |
| **Testing** | Vitest | 2.x | Fast, ESM-native, TS support |
| **Bundling** | tsup | 8.x | Zero-config TS bundler |
| **Linting** | ESLint | 9.x | Flat config, TS support |

---

## 2. System Architecture

```
┌─────────────────────────────────────────────────────┐
│                    CLI Layer                         │
│  src/cli/                                            │
│  Commander.js: upload, backup, sync, status, config  │
│  Responsibility: parse args, format output, exit     │
└──────────────────────┬──────────────────────────────┘
                       │ calls
┌──────────────────────▼──────────────────────────────┐
│                   Core Layer                         │
│  src/core/                                           │
│  Uploader │ BackupEngine │ SyncEngine │ Encryptor    │
│  Responsibility: orchestrate business logic          │
└──────┬────────────┬──────────────┬──────────────────┘
       │            │              │
┌──────▼────┐ ┌─────▼─────┐ ┌─────▼─────┐
│ API Layer │ │  DB Layer  │ │  Utils    │
│ src/api/  │ │  src/db/   │ │ src/utils/│
│ FileLu    │ │  SQLite    │ │ hash/log/ │
│ REST API  │ │  state     │ │ progress  │
└───────────┘ └────────────┘ └───────────┘
```

### Layer Rules

| Layer | Can Call | Cannot Call |
|-------|---------|-------------|
| CLI | Core, Config | DB, API directly |
| Core | API, DB, Utils | CLI |
| API | Utils | Core, DB, CLI |
| DB | Utils | Core, API, CLI |
| Utils | Nothing | Everything above |

---

## 3. Directory Structure

```
filelu-vault/
├── src/
│   ├── cli/                    # CLI command definitions
│   │   ├── index.ts            # Entry point + Commander program
│   │   ├── upload.ts           # vault upload <file...>
│   │   ├── backup.ts           # vault backup <dir>
│   │   ├── sync.ts             # vault sync <dir>
│   │   ├── status.ts           # vault status
│   │   └── config.ts           # vault config <subcommand>
│   ├── api/                    # FileLu API client
│   │   ├── client.ts           # HTTP methods: getAccountInfo, getUploadServer, uploadFile
│   │   └── types.ts            # API request/response TypeScript types
│   ├── core/                   # Business logic engines
│   │   ├── uploader.ts         # Upload orchestration (hash → dedup → encrypt → upload → record)
│   │   ├── backup.ts           # Backup engine (scan → diff → batch upload)
│   │   ├── sync.ts             # Sync engine (fs.watch → debounce → backup)
│   │   └── encryption.ts       # AES-256-GCM streaming encrypt/decrypt
│   ├── db/                     # Local state persistence
│   │   ├── database.ts         # SQLite connection, init, migrations
│   │   ├── models.ts           # TypeScript interfaces for DB rows
│   │   └── queries.ts          # Prepared SQL statements
│   ├── config/                 # Configuration management
│   │   ├── store.ts            # Read/write ~/.filelu-vault/config.json
│   │   └── schema.ts           # Config validation + defaults
│   └── utils/                  # Shared stateless utilities
│       ├── logger.ts           # Structured logging (debug/info/warn/error)
│       ├── hash.ts             # SHA-256 streaming file hash
│       ├── progress.ts         # Terminal progress bar
│       └── errors.ts           # Custom error class hierarchy
├── tests/
│   ├── unit/                   # Fast, mocked, run on every commit
│   │   ├── api/client.test.ts
│   │   ├── core/uploader.test.ts
│   │   ├── core/backup.test.ts
│   │   ├── core/encryption.test.ts
│   │   ├── db/database.test.ts
│   │   └── config/store.test.ts
│   └── integration/            # Slow, real API, CI-only
│       └── upload.integration.test.ts
├── *.md                        # Documentation suite (UPPERCASE at root)
├── .github/workflows/          # CI/CD
│   └── ci.yml
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── .gitignore
├── .env.example
├── AGENTS.md                   # AI agent instructions
├── LICENSE                     # MIT
└── README.md
```

---

## 4. Database Schema

### Overview

- **Engine:** SQLite 3 via `better-sqlite3`
- **Location:** `~/.filelu-vault/vault.db`
- **Journal:** WAL mode (concurrent reads + writes)
- **Encoding:** UTF-8

### Tables

#### `tracked_files` — One row per unique local file path

```sql
CREATE TABLE tracked_files (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  local_path      TEXT    NOT NULL UNIQUE,
  file_hash       TEXT    NOT NULL,                -- SHA-256 hex digest
  file_size       INTEGER NOT NULL,                -- bytes
  file_code       TEXT,                            -- FileLu code (null = not uploaded)
  file_url        TEXT,                            -- https://filelu.com/<code>
  status          TEXT    NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','uploading','uploaded','failed','deleted')),
  encrypted       INTEGER NOT NULL DEFAULT 0,
  backup_job_id   INTEGER REFERENCES backup_jobs(id),
  created_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  updated_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  last_synced_at  TEXT
);

CREATE INDEX idx_files_hash   ON tracked_files(file_hash);
CREATE INDEX idx_files_status ON tracked_files(status);
CREATE INDEX idx_files_path   ON tracked_files(local_path);
```

#### `backup_jobs` — One row per backup execution

```sql
CREATE TABLE backup_jobs (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  source_dir      TEXT    NOT NULL,
  status          TEXT    NOT NULL DEFAULT 'running'
                  CHECK (status IN ('running','completed','failed','cancelled')),
  files_total     INTEGER NOT NULL DEFAULT 0,
  files_uploaded  INTEGER NOT NULL DEFAULT 0,
  files_skipped   INTEGER NOT NULL DEFAULT 0,
  files_failed    INTEGER NOT NULL DEFAULT 0,
  error_message   TEXT,
  started_at      TEXT    NOT NULL DEFAULT (datetime('now')),
  completed_at    TEXT
);
```

#### `upload_logs` — Audit trail for each upload attempt

```sql
CREATE TABLE upload_logs (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  tracked_file_id INTEGER NOT NULL REFERENCES tracked_files(id) ON DELETE CASCADE,
  attempt_number  INTEGER NOT NULL DEFAULT 1,
  status          TEXT    NOT NULL CHECK (status IN ('success','failed','timeout')),
  error_message   TEXT,
  upload_server   TEXT,
  duration_ms     INTEGER,
  created_at      TEXT    NOT NULL DEFAULT (datetime('now'))
);
```

### Entity Relationships

```
tracked_files 1──N upload_logs     (each file has N upload attempts)
tracked_files N──1 backup_jobs     (each backup job contains N files)
```

### Migration Strategy

```typescript
// Migrations keyed by version number, applied sequentially on startup
const MIGRATIONS: Record<number, string> = {
  1: `CREATE TABLE tracked_files (...); CREATE TABLE backup_jobs (...); CREATE TABLE upload_logs (...);`,
  // Future: 2: `ALTER TABLE tracked_files ADD COLUMN folder_id TEXT;`
};
```

---

## 5. Data Flows

### Upload Flow

```
[User: vault upload file.txt --encrypt]
    │
    ▼
[CLI] parse args
    │
    ▼
[Uploader] hashFile(file.txt) → SHA-256
    │
    ▼
[DB] SELECT WHERE local_path=? AND file_hash=? AND status='uploaded'
    │
    ├── found → SKIP (dedup) → print "⊘ Skipped"
    │
    └── not found ──▼
                [Encryptor] AES-256-GCM → tmp/file.txt.enc  (if --encrypt)
                    │
                    ▼
                [API] GET /api/upload/server → {url, sess_id}
                    │
                    ▼
                [API] POST url (multipart: sess_id + file) → {file_code}
                    │
                    ▼
                [DB] INSERT/UPDATE tracked_files (status='uploaded', file_code)
                    │
                    ▼
                [CLI] print "✓ Uploaded → https://filelu.com/<code>"
```

### Backup Flow

```
[User: vault backup ./project]
    │
    ▼
[CLI] parse args
    │
    ▼
[BackupEngine] CREATE backup_job (status='running')
    │
    ▼
[BackupEngine] fs.readdir(./project, {recursive}) → file list
    │
    ▼
[BackupEngine] FOR EACH file (concurrency=3):
    │   hash → dedup check → encrypt? → upload → record
    │
    ▼
[BackupEngine] UPDATE backup_job (status='completed', counts)
    │
    ▼
[CLI] print summary box
```

### Sync Flow

```
[User: vault sync ./project]
    │
    ▼
[CLI] parse args
    │
    ▼
[SyncEngine] run initial backup (bring cloud up to date)
    │
    ▼
[SyncEngine] fs.watch(./project, {recursive})
    │
    ├── ON file change → debounce(500ms) → upload changed file
    ├── ON file delete → DB mark status='deleted'
    └── ON SIGINT → stop watcher → print stats → exit(0)
```

---

## 6. External Integrations

### FileLu REST API

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/account/info?key=KEY` | GET | Account details |
| `/api/upload/server?key=KEY` | GET | Get upload URL + session |
| `<upload_url>` | POST (multipart) | Upload file binary |

**Base URL:** `https://filelu.com`
**Auth:** API key as query param (`key=`) or POST body
**Upload servers:** HTTP (not HTTPS) — varies per request

### Local Filesystem

| Path | Purpose |
|------|---------|
| `~/.filelu-vault/config.json` | API key, settings (0600 perms) |
| `~/.filelu-vault/vault.db` | SQLite state database |
| `~/.filelu-vault/vault.db-wal` | WAL journal |
| `~/.filelu-vault/tmp/` | Temp encrypted files (cleaned after upload) |

---

## 7. Configuration Schema

```typescript
interface VaultConfig {
  apiKey: string;              // FileLu API key
  dataDir: string;             // default: ~/.filelu-vault
  encryptionEnabled: boolean;  // default: false
  encryptionKey?: string;      // AES-256 key, base64 encoded
  maxRetries: number;          // default: 3
  concurrency: number;         // default: 3
  excludePatterns: string[];   // default: ['node_modules/**', '.git/**', '.DS_Store']
}
```

---

## 8. Error Hierarchy

```
AppError (code: string, message: string, cause?: Error)
├── ConfigError       — missing config, invalid schema, bad permissions
├── ApiError          — HTTP errors, auth failures, timeouts
├── UploadError       — file not found, upload stream failures
├── EncryptionError   — bad key, corrupt ciphertext, auth tag mismatch
└── DatabaseError     — SQLite errors, migration failures
```

Exit codes: `0` = success, `1` = general, `2` = config, `3` = API, `4` = upload
