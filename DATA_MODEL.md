# FileLu Vault — Data Model

> **Version:** 1.0 | **Last Updated:** 2026-07-09

---

## 1. Overview

FileLu Vault uses **SQLite** (via `better-sqlite3`) to persist local file tracking state. The database is the single source of truth for what has been uploaded, what needs uploading, and the history of upload attempts.

**Database file:** `~/.filelu-vault/vault.db`
**Journal mode:** WAL (Write-Ahead Logging)
**Foreign keys:** Enforced (`PRAGMA foreign_keys = ON`)
**Timestamps:** UTC ISO-8601 strings (`datetime('now')`)

---

## 2. Entity-Relationship Diagram

```
┌──────────────────────┐       ┌──────────────────────┐
│    tracked_files     │       │     backup_jobs       │
├──────────────────────┤       ├──────────────────────┤
│ id (PK)              │       │ id (PK)              │
│ local_path (UNIQUE)  │       │ source_dir           │
│ file_hash            │  N:1  │ status               │
│ file_size            │◄──────│ files_total          │
│ file_code            │       │ files_uploaded        │
│ file_url             │       │ files_skipped         │
│ status               │       │ files_failed          │
│ encrypted            │       │ error_message         │
│ backup_job_id (FK)───│───────│ started_at            │
│ created_at           │       │ completed_at          │
│ updated_at           │       └──────────────────────┘
│ last_synced_at       │
└──────┬───────────────┘
       │ 1:N
       ▼
┌──────────────────────┐
│    upload_logs       │
├──────────────────────┤
│ id (PK)              │
│ tracked_file_id (FK) │
│ attempt_number       │
│ status               │
│ error_message        │
│ upload_server        │
│ duration_ms          │
│ created_at           │
└──────────────────────┘
```

---

## 3. Table Specifications

### 3.1 `tracked_files`

**Purpose:** One row per unique local file path. Tracks hash, upload status, and FileLu file code.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | INTEGER | No | AUTO | Primary key |
| `local_path` | TEXT | No | — | Absolute path on local filesystem (UNIQUE) |
| `file_hash` | TEXT | No | — | SHA-256 hex digest of file contents |
| `file_size` | INTEGER | No | — | File size in bytes |
| `file_code` | TEXT | Yes | NULL | FileLu file code after upload (e.g., `b578rni0e1ka`) |
| `file_url` | TEXT | Yes | NULL | Full URL: `https://filelu.com/<file_code>` |
| `status` | TEXT | No | `'pending'` | One of: `pending`, `uploading`, `uploaded`, `failed`, `deleted` |
| `encrypted` | INTEGER | No | `0` | Boolean: 1 = encrypted before upload, 0 = plaintext |
| `backup_job_id` | INTEGER | Yes | NULL | FK → `backup_jobs.id` |
| `created_at` | TEXT | No | `datetime('now')` | When file was first tracked |
| `updated_at` | TEXT | No | `datetime('now')` | Last modification timestamp |
| `last_synced_at` | TEXT | Yes | NULL | Last successful upload timestamp |

**Indexes:**
- `idx_files_hash` on `file_hash` — dedup lookups
- `idx_files_status` on `status` — pending/failed queries
- `idx_files_path` on `local_path` — path lookups (also UNIQUE constraint)
- `idx_files_backup` on `backup_job_id` — backup job file listing

**Status State Machine:**

```
pending ──► uploading ──► uploaded
   │            │
   │            ▼
   │         failed ──► pending (retry)
   │
   ▼
 deleted
```

### 3.2 `backup_jobs`

**Purpose:** One row per backup execution. Records progress counters for reporting.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | INTEGER | No | AUTO | Primary key |
| `source_dir` | TEXT | No | — | Source directory path |
| `status` | TEXT | No | `'running'` | One of: `running`, `completed`, `failed`, `cancelled` |
| `files_total` | INTEGER | No | `0` | Total files scanned |
| `files_uploaded` | INTEGER | No | `0` | Files successfully uploaded |
| `files_skipped` | INTEGER | No | `0` | Files skipped (dedup) |
| `files_failed` | INTEGER | No | `0` | Files that failed all retries |
| `error_message` | TEXT | Yes | NULL | Error details if status = failed |
| `started_at` | TEXT | No | `datetime('now')` | Job start time |
| `completed_at` | TEXT | Yes | NULL | Job completion time |

### 3.3 `upload_logs`

**Purpose:** Audit trail of every upload attempt. Enables retry tracking and debugging.

| Column | Type | Nullable | Default | Description |
|--------|------|----------|---------|-------------|
| `id` | INTEGER | No | AUTO | Primary key |
| `tracked_file_id` | INTEGER | No | — | FK → `tracked_files.id` (CASCADE DELETE) |
| `attempt_number` | INTEGER | No | `1` | Which retry attempt (1, 2, 3) |
| `status` | TEXT | No | — | One of: `success`, `failed`, `timeout` |
| `error_message` | TEXT | Yes | NULL | Error details if failed |
| `upload_server` | TEXT | Yes | NULL | Which FileLu server was used |
| `duration_ms` | INTEGER | Yes | NULL | Upload duration in milliseconds |
| `created_at` | TEXT | No | `datetime('now')` | Attempt timestamp |

---

## 4. Common Queries

### Dedup check (is this file already uploaded?)

```sql
SELECT id, file_hash, status, file_code
FROM tracked_files
WHERE local_path = ?
  AND file_hash = ?
  AND status = 'uploaded';
-- Returns row → skip. No row → upload.
```

### Get files needing upload

```sql
SELECT * FROM tracked_files
WHERE status IN ('pending', 'failed')
ORDER BY created_at ASC;
```

### Record successful upload

```sql
UPDATE tracked_files
SET file_code = ?, file_url = ?, status = 'uploaded',
    updated_at = datetime('now'), last_synced_at = datetime('now')
WHERE id = ?;
```

### Dashboard statistics

```sql
SELECT
  COUNT(*) AS total_files,
  COUNT(CASE WHEN status = 'uploaded' THEN 1 END) AS uploaded,
  COUNT(CASE WHEN status = 'pending' THEN 1 END) AS pending,
  COUNT(CASE WHEN status = 'failed' THEN 1 END) AS failed,
  SUM(file_size) AS total_bytes,
  SUM(CASE WHEN status = 'uploaded' THEN file_size ELSE 0 END) AS uploaded_bytes
FROM tracked_files;
```

### Backup job summary

```sql
SELECT source_dir, status, files_total, files_uploaded, files_skipped, files_failed,
  ROUND((julianday(completed_at) - julianday(started_at)) * 86400, 1) AS duration_s
FROM backup_jobs WHERE id = ?;
```

---

## 5. Row-Level Security (RLS)

SQLite doesn't have RLS natively. Instead, security is enforced at the application layer:

| Protection | Implementation |
|-----------|---------------|
| **File permissions** | `vault.db` created with `0600` (owner-only) |
| **No remote access** | SQLite is local — no network exposure |
| **Prepared statements** | All queries parameterized — no SQL injection |
| **No PII exposure** | DB contains file paths and hashes — no passwords or tokens |
| **API key isolation** | API key is in `config.json`, never stored in DB |

---

## 6. Migration Strategy

Migrations use SQLite's `user_version` PRAGMA:

```typescript
function migrate(db: BetterSqlite3.Database): void {
  const current = db.pragma('user_version', { simple: true }) as number;

  if (current < 1) {
    db.exec(`
      CREATE TABLE tracked_files (...);
      CREATE TABLE backup_jobs (...);
      CREATE TABLE upload_logs (...);
      -- indexes
    `);
    db.pragma('user_version = 1');
  }

  // Future migrations:
  // if (current < 2) { db.exec('ALTER TABLE ...'); db.pragma('user_version = 2'); }
}
```

---

## 7. Database Pragmas

Applied on every connection open:

```sql
PRAGMA journal_mode = WAL;       -- concurrent reads + writes
PRAGMA foreign_keys = ON;        -- enforce FK constraints
PRAGMA busy_timeout = 5000;      -- wait 5s on locked DB
PRAGMA synchronous = NORMAL;     -- balance safety + speed
```
