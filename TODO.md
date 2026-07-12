# FileLu Vault — TODO / Task Tracker

> AI agents: update checkboxes as you complete work. Use `[/]` for in-progress.

---

## Phase 0: Documentation ✅

- [x] PRD (`PRD.md`)
- [x] Design System (`DESIGN.md`)
- [x] Architecture (`ARCHITECTURE.md`)
- [x] Coding Patterns (`PATTERNS.md`)
- [x] Constraints (`CONSTRAINTS.md`)
- [x] Data Model (`DATA_MODEL.md`)
- [x] Threat Model (`THREAT_MODEL.md`)
- [x] Implementation Plan (`IMPLEMENTATION_PLAN.md`)
- [x] Testing Strategy (`TESTING.md`)
- [x] AGENTS.md (root)
- [x] Audit (`AUDIT.md`)
- [x] Bug Log (`BUGS.md`)
- [x] Daily Tasks (`TASK_TODAY.md`)
- [x] Memory (`MEMORY.md`)
- [x] Decisions (`DECISIONS.md`)
- [x] Documentation (`DOCUMENTATION.md`)
- [x] README.md (root)
- [x] TODO (`TODO.md`)

---

## Phase 1: Foundation (Tasks 1-3)

- [x] **Task 1: Project Scaffold**
  - [x] package.json + dependencies
  - [x] tsconfig.json
  - [x] vitest.config.ts
  - [x] .gitignore, .env.example, LICENSE
  - [x] Config schema + store
  - [x] Error classes
  - [x] Logger
  - [x] Config tests

- [x] **Task 2: API Client**
  - [x] API types
  - [x] withRetry helper
  - [x] FileLuClient class
  - [x] API client tests

- [x] **Task 3: Database Layer**
  - [x] DB models
  - [x] SQLite init + migrations
  - [x] Prepared queries
  - [x] Database tests

---

## Phase 2: Core Features (Tasks 4-7)

- [x] **Task 4: Upload Engine**
  - [x] SHA-256 file hash
  - [x] Progress bar
  - [x] Uploader class (hash → dedup → upload → record)
  - [x] Batch upload with concurrency
  - [x] Upload tests

- [x] **Task 5: Encryption**
  - [x] Key generation
  - [x] AES-256-GCM encrypt (streaming)
  - [x] AES-256-GCM decrypt (streaming)
  - [x] Roundtrip + tamper tests

- [x] **Task 6: Backup Engine**
  - [x] Directory scan
  - [x] Incremental diff + upload
  - [x] Backup job tracking
  - [x] Dry-run mode
  - [x] Backup tests

- [x] **Task 7: Sync Engine**
  - [x] fs.watch wrapper
  - [x] Debounce logic
  - [x] Change/delete handling
  - [x] Graceful shutdown

---

## Phase 3: CLI & Polish (Tasks 8-10)

- [x] **Task 8: CLI Commands**
  - [x] Entry point (Commander)
  - [x] `vault config set-key / show`
  - [x] `vault upload`
  - [x] `vault backup`
  - [x] `vault sync`
  - [x] `vault status`
  - [x] `--verbose`, `--json` flags

- [x] **Task 9: Testing & CI**
  - [x] Integration tests
  - [x] GitHub Actions CI
  - [x] Coverage ≥ 80%
  - [x] Type check passes

- [x] **Task 10: Documentation & Publish**
  - [x] Update README with real examples
  - [x] Create CHANGELOG.md
  - [x] Final architecture docs (DOCUMENTATION.md)
  - [x] (Optional) Write `npm publish` workflow

---

## Phase 4: Future Expansion (API Driven)

See [ROADMAP.md](./ROADMAP.md) for the complete list of upcoming features, including:
- File & Folder Management (list, rename, move, delete)
- Remote URL Uploads
- Secure Sharing & Password Protection
- Direct Downloads
