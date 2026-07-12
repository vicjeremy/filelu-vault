# FileLu Vault — System Documentation

> **Living document.** AI agents: update this file whenever you add, modify, or remove a module.
> This is the canonical reference for how the system works right now.

---

## 1. System Overview

**FileLu Vault** is a Node.js CLI tool for uploading, backing up, and syncing files to [FileLu](https://filelu.com) cloud storage.

**Current Status:** Documentation phase complete. Implementation not started.

**Core Workflow:**
```
Local Files → Hash (SHA-256) → Dedup Check (SQLite) → Encrypt (optional) → Upload (FileLu API) → Record
```

---

## 2. Module Registry

> Update this table whenever a module is created, renamed, or deleted.

| Module | File | Status | Description |
|--------|------|--------|-------------|
| CLI Entry | `src/cli/index.ts` | 🔴 Not built | Commander.js program, subcommand registration |
| Upload Command | `src/cli/upload.ts` | 🔴 Not built | `vault upload <file...>` handler |
| Backup Command | `src/cli/backup.ts` | 🔴 Not built | `vault backup <dir>` handler |
| Sync Command | `src/cli/sync.ts` | 🔴 Not built | `vault sync <dir>` handler |
| Status Command | `src/cli/status.ts` | 🔴 Not built | `vault status` handler |
| Config Command | `src/cli/config.ts` | 🔴 Not built | `vault config <sub>` handler |
| API Client | `src/api/client.ts` | 🔴 Not built | FileLu REST API client |
| API Types | `src/api/types.ts` | 🔴 Not built | Request/response TypeScript types |
| Uploader | `src/core/uploader.ts` | 🔴 Not built | Upload orchestration engine |
| Backup Engine | `src/core/backup.ts` | 🔴 Not built | Incremental backup logic |
| Sync Engine | `src/core/sync.ts` | 🔴 Not built | Filesystem watcher + auto-upload |
| Encryptor | `src/core/encryption.ts` | 🔴 Not built | AES-256-GCM encrypt/decrypt |
| Database | `src/db/database.ts` | 🔴 Not built | SQLite init, migrations |
| DB Models | `src/db/models.ts` | 🔴 Not built | TypeScript interfaces for DB rows |
| DB Queries | `src/db/queries.ts` | 🔴 Not built | Prepared SQL statements |
| Config Store | `src/config/store.ts` | 🔴 Not built | Read/write config.json |
| Config Schema | `src/config/schema.ts` | 🔴 Not built | Config validation + defaults |
| Logger | `src/utils/logger.ts` | 🔴 Not built | Structured logging |
| Hash Util | `src/utils/hash.ts` | 🔴 Not built | SHA-256 file hashing |
| Progress Bar | `src/utils/progress.ts` | 🔴 Not built | Terminal progress bar |
| Error Classes | `src/utils/errors.ts` | 🔴 Not built | Custom error hierarchy |

---

## 3. Data Flow Summary

### Upload: `vault upload file.txt --encrypt`

```
CLI parses args
  → Uploader.uploadFile(path, {encrypt: true})
    → hashFile(path) → SHA-256
    → DB.getFile(path, hash) → dedup check
    → Encryptor.encryptFile(path, tmpPath) → AES-256-GCM
    → API.getUploadServer() → {url, sessId}
    → API.uploadFile(url, sessId, tmpPath) → {fileCode}
    → DB.markUploaded(path, fileCode)
    → cleanup tmpPath
  → CLI prints "✓ Uploaded → https://filelu.com/<code>"
```

### Backup: `vault backup ./project`

```
CLI parses args
  → BackupEngine.run(dir)
    → DB.createBackupJob() → job ID
    → fs.readdir(dir, {recursive}) → file list
    → FOR EACH file (concurrency=3):
        hash → dedup → encrypt? → upload → record
    → DB.completeBackupJob(jobId, counts)
  → CLI prints summary box
```

### Sync: `vault sync ./project`

```
CLI parses args
  → SyncEngine.watch(dir)
    → initial backup(dir)
    → fs.watch(dir, {recursive})
    → ON change: debounce 500ms → upload
    → ON delete: DB.markDeleted(path)
    → ON SIGINT: stop → print stats
```

---

## 4. Configuration

**File:** `~/.filelu-vault/config.json` (permissions: 0600)

```json
{
  "apiKey": "YOUR_API_KEY",
  "dataDir": "~/.filelu-vault",
  "encryptionEnabled": false,
  "encryptionKey": null,
  "maxRetries": 3,
  "concurrency": 3,
  "excludePatterns": ["node_modules/**", ".git/**", ".DS_Store"]
}
```

---

## 5. Database

**File:** `~/.filelu-vault/vault.db`

**Tables:** `tracked_files`, `backup_jobs`, `upload_logs`

See `DATA_MODEL.md` for full schema.

---

## 6. External API

**Base:** `https://filelu.com/api`

| Endpoint | Purpose |
|----------|---------|
| GET `/api/account/info?key=KEY` | Account details |
| GET `/api/upload/server?key=KEY` | Upload server URL + session |
| POST `<upload_url>` (multipart) | File upload |

See `ARCHITECTURE.md` §6 for full details.

---

## 7. Documentation Map

> All documentation lives at the project root.

| File | Purpose |
|------|---------|
| `PRD.md` | Product requirements, MVP scope |
| `DESIGN.md` | Design system, terminal output |
| `ARCHITECTURE.md` | Tech stack, data flows |
| `PATTERNS.md` | Coding standards |
| `CONSTRAINTS.md` | Hard boundaries |
| `DATA_MODEL.md` | Database schema |
| `THREAT_MODEL.md` | Security model |
| `TESTING.md` | Test strategy |
| `IMPLEMENTATION_PLAN.md` | Task breakdown |
| `AGENTS.md` | AI agent rules |
| `AUDIT.md` | Codebase audit |
| `BUGS.md` | Bug log |
| `TASK_TODAY.md` | Daily tracker |
| `TODO.md` | Master task tracker |
| `MEMORY.md` | AI memory |
| `DECISIONS.md` | ADRs |
| `DOCUMENTATION.md` | This file |
| `README.md` | Project overview |

---

## 8. Changelog

| Date | Change | Author |
|------|--------|--------|
| 2026-07-09 | Initial documentation suite created (18 files in docs/) | AI |
| 2026-07-12 | Relocated all docs to project root with UPPERCASE naming | AI |
| — | _Implementation not yet started_ | — |
