# FileLu Vault — Product Requirements Document (PRD)

> **Version:** 1.0 | **Last Updated:** 2026-07-09 | **Status:** Draft

---

## 1. North Star

**One-line vision:** Give developers a single CLI command to encrypt and back up any file to FileLu cloud storage — no GUI, no configuration wizard, no vendor lock-in.

---

## 2. Problem Statement

Developers and power users need a scriptable, secure way to push files to FileLu cloud storage. The current workflow is manual: copy an API key, curl an upload server URL, post a file, track whether it worked. There is no official CLI, no local state tracking, no encryption, no incremental backup.

**Pain points:**
- No CLI tool exists for FileLu — only raw REST API
- No deduplication — re-uploading identical files wastes bandwidth
- No client-side encryption — files transit over HTTP in cleartext on upload servers
- No backup resume — interrupted uploads must restart from scratch
- No audit trail — no local record of what was uploaded and when

---

## 3. Target Users

| Persona | Description | Primary Need |
|---------|-------------|-------------|
| **Developer** | Uses terminal daily, wants scriptable cloud backup | `vault backup ./project` in cron |
| **DevOps Engineer** | Automates server backups | Non-interactive CLI, exit codes, logs |
| **Privacy-Conscious User** | Wants encryption before cloud upload | Client-side AES-256-GCM |
| **Power User** | Manages large file collections | Parallel uploads, dedup, progress bars |

---

## 4. MVP Features (v1.0)

| # | Feature | Priority | Description |
|---|---------|----------|-------------|
| F1 | **Single-file upload** | P0 | `vault upload file.txt` → uploaded to FileLu, URL returned |
| F2 | **Batch upload** | P0 | `vault upload *.jpg` → parallel upload with progress |
| F3 | **Incremental backup** | P0 | `vault backup ./dir` → only upload new/changed files |
| F4 | **Config management** | P0 | `vault config set-key <key>` → secure storage |
| F5 | **Account status** | P1 | `vault status` → show account info + local stats |
| F6 | **Client-side encryption** | P1 | `--encrypt` flag → AES-256-GCM before upload |
| F7 | **Real-time sync** | P1 | `vault sync ./dir` → watch + auto-upload on change |
| F8 | **Dry-run mode** | P2 | `--dry-run` → show what would happen without doing it |
| F9 | **Retry with backoff** | P0 | Auto-retry failed uploads (3 attempts, exponential backoff) |
| F10 | **SHA-256 dedup** | P0 | Skip files already uploaded with same hash |

---

## 5. What the MVP Is NOT

> [!CAUTION]
> These are explicitly out of scope for v1.0. Do not build them.

- ❌ **Download/restore** — no pulling files back from FileLu
- ❌ **GUI / web dashboard** — CLI only
- ❌ **Folder management on FileLu** — no organizing into remote folders
- ❌ **Selective sync / .vaultignore** — all files in dir are backed up
- ❌ **Multi-account support** — one API key at a time
- ❌ **File sharing / link management** — just upload, get URL
- ❌ **Compression before upload** — encrypt only, no gzip/zstd
- ❌ **Scheduled backups** — use cron externally
- ❌ **Mobile or desktop app** — Node.js CLI only
- ❌ **File versioning** — latest version only (overwrite by hash)

---

## 6. Success Metrics

| Metric | Target | How Measured |
|--------|--------|-------------|
| **Upload reliability** | 99% success rate | upload_logs table: success / total |
| **Backup speed** | Skip unchanged files in < 50ms each | Hash comparison benchmark |
| **Dedup effectiveness** | 0 duplicate uploads | DB query: no duplicate file_hash with status=uploaded |
| **Encryption correctness** | 100% roundtrip fidelity | Automated test: encrypt → decrypt → diff |
| **Test coverage** | > 80% line coverage | vitest --coverage |
| **Install-to-first-upload** | < 3 minutes | Manual timing |

---

## 7. User Stories

### Upload
```
AS A developer
I WANT TO upload a file from my terminal
SO THAT I get a shareable FileLu URL without opening a browser

Acceptance: `vault upload report.pdf` → prints https://filelu.com/<code>
```

### Backup
```
AS A developer
I WANT TO back up a project directory incrementally
SO THAT only changed files are uploaded, saving time and bandwidth

Acceptance: First run uploads 100 files. Second run (no changes) uploads 0.
```

### Encryption
```
AS A privacy-conscious user
I WANT TO encrypt files before they leave my machine
SO THAT even FileLu cannot read my data

Acceptance: `vault upload secret.doc --encrypt` → file on server is AES-256-GCM encrypted
```

### Sync
```
AS A developer
I WANT TO watch a directory for changes
SO THAT edits are automatically backed up in real-time

Acceptance: `vault sync ./project` → edit a file → file uploaded within 2s
```

---

## 8. Competitive Landscape

| Tool | FileLu Support | Encryption | Incremental | CLI | Open Source |
|------|---------------|------------|-------------|-----|-------------|
| rclone | ❌ | ✅ | ✅ | ✅ | ✅ |
| restic | ❌ | ✅ | ✅ | ✅ | ✅ |
| duplicati | ❌ | ✅ | ✅ | ❌ (GUI) | ✅ |
| **FileLu Vault** | ✅ | ✅ | ✅ | ✅ | ✅ |

**Differentiator:** Only tool with native FileLu API integration.

---

## 9. Constraints & Assumptions

- FileLu API is stable and rate limits are reasonable
- Upload server URLs use HTTP (not HTTPS) — client-side encryption mitigates this
- `sess_id` from upload server is single-use per batch
- No official FileLu SDK exists — we consume raw REST endpoints
- Premium accounts have unlimited storage (`storage_left: "inf"`)
- File codes are permanent and don't expire for premium accounts

---

## 10. Release Plan

| Phase | Scope | Timeline |
|-------|-------|----------|
| **Alpha** | Core upload + config + tests | Week 1 |
| **Beta** | Backup + encryption + sync | Week 2 |
| **v1.0** | Polish, docs, GitHub publish | Week 3 |
| **v1.1** | Bug fixes from community feedback | Week 4+ |
