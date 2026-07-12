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

- [ ] **Task 6: Backup Engine**
  - [ ] Directory scan
  - [ ] Incremental diff + upload
  - [ ] Backup job tracking
  - [ ] Dry-run mode
  - [ ] Backup tests

- [ ] **Task 7: Sync Engine**
  - [ ] fs.watch wrapper
  - [ ] Debounce logic
  - [ ] Change/delete handling
  - [ ] Graceful shutdown

---

## Phase 3: CLI & Polish (Tasks 8-10)

- [ ] **Task 8: CLI Commands**
  - [ ] Entry point (Commander)
  - [ ] vault config set-key / show
  - [ ] vault upload
  - [ ] vault backup
  - [ ] vault sync
  - [ ] vault status
  - [ ] --verbose, --json flags

- [ ] **Task 9: Testing & CI**
  - [ ] Integration tests
  - [ ] GitHub Actions CI
  - [ ] Coverage ≥ 80%
  - [ ] Type check passes

- [ ] **Task 10: Documentation & Publish**
  - [ ] Update README with real examples
  - [ ] SECURITY.md (root)
  - [ ] CONTRIBUTING.md
  - [ ] GitHub release v1.0.0
