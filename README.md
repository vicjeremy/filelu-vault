# FileLu Vault

> Secure backup, sync & upload CLI for [FileLu](https://filelu.com) cloud storage.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js](https://img.shields.io/badge/node-%3E%3D20-brightgreen)](https://nodejs.org)

---

## What It Does

Upload files, back up directories, and sync changes to FileLu — all from your terminal, with optional AES-256 encryption.

```bash
vault upload report.pdf                    # Upload → get FileLu URL
vault backup ./project                     # Incremental backup (skips unchanged)
vault sync ./project                       # Watch + auto-upload on changes
vault upload secret.doc --encrypt          # Encrypt before upload
vault status                               # Account info + local stats
```

---

## Features

| Feature | Description |
|---------|-------------|
| **Upload** | Single or batch file upload with progress bars |
| **Backup** | Incremental directory backup — SHA-256 dedup skips unchanged files |
| **Sync** | Real-time filesystem watcher with auto-upload |
| **Encryption** | AES-256-GCM client-side encryption before upload |
| **Dedup** | Hash-based deduplication — never upload the same file twice |
| **Retry** | Exponential backoff on failures (3 attempts) |
| **Parallel** | Configurable concurrent uploads (default: 3) |
| **Dry-Run** | Preview what would be uploaded without doing it |

---

## Quick Start

```bash
# Install
npm install -g filelu-vault

# Configure
vault config set-key YOUR_API_KEY

# Upload
vault upload myfile.txt

# Backup a directory
vault backup ./my-project

# Watch for changes
vault sync ./my-project
```

---

## Documentation

> **AI agents:** Read these docs before writing any code. Start with `AGENTS.md`.

### Strategy & Requirements

| Document | Purpose |
|----------|---------|
| [PRD.md](PRD.md) | Product Requirements — north star, MVP scope, what NOT to build |
| [DECISIONS.md](DECISIONS.md) | Architectural Decision Records — why we chose what we chose |

### Design & Architecture

| Document | Purpose |
|----------|---------|
| [DESIGN.md](DESIGN.md) | Design system — colors, typography, terminal output patterns |
| [ARCHITECTURE.md](ARCHITECTURE.md) | Tech stack, directory structure, data flows, system layers |
| [DATA_MODEL.md](DATA_MODEL.md) | Database tables, relationships, RLS, migration strategy |

### Standards & Constraints

| Document | Purpose |
|----------|---------|
| [PATTERNS.md](PATTERNS.md) | Coding standards — TypeScript, errors, logging, testing, IDE constraints |
| [CONSTRAINTS.md](CONSTRAINTS.md) | Hard boundaries — allowed deps, performance targets, security rules |
| [THREAT_MODEL.md](THREAT_MODEL.md) | Security — threat actors, attack surfaces, mitigations |
| [TESTING.md](TESTING.md) | Testing strategy — patterns, coverage, CI gates |

### Planning & Execution

| Document | Purpose |
|----------|---------|
| [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md) | 10-task checklist with granular steps |
| [TODO.md](TODO.md) | Master task tracker with checkboxes |
| [TASK_TODAY.md](TASK_TODAY.md) | Daily session tracker |

### Operations & Maintenance

| Document | Purpose |
|----------|---------|
| [DOCUMENTATION.md](DOCUMENTATION.md) | Living system docs — module registry, data flows |
| [AUDIT.md](AUDIT.md) | Codebase audit — built vs. planned |
| [BUGS.md](BUGS.md) | Bug log with root cause tracking |
| [MEMORY.md](MEMORY.md) | AI memory — corrections, preferences, findings |

### AI Agent Config

| Document | Purpose |
|----------|---------|
| [AGENTS.md](AGENTS.md) | How AI assistants should behave in this project |

---

## Tech Stack

| Component | Technology |
|-----------|-----------|
| Runtime | Node.js 20+ |
| Language | TypeScript (strict) |
| CLI | Commander.js |
| Database | SQLite (better-sqlite3) |
| HTTP | node-fetch |
| Encryption | AES-256-GCM (Node.js crypto) |
| Testing | Vitest |
| Bundling | tsup |

---

## Security

- API keys stored with `0600` permissions — never logged
- Optional AES-256-GCM encryption before upload
- Streaming encryption — handles large files without memory issues
- Only 4 runtime dependencies — minimal attack surface
- See [THREAT_MODEL.md](THREAT_MODEL.md) for full security analysis

---

## License

MIT — see [LICENSE](LICENSE) for details.
