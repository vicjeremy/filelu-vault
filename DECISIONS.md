# FileLu Vault — Architectural Decision Records

> Record every significant design choice here. Future developers (human or AI) should understand not just *what* was decided, but *why*.

---

## Format

```markdown
### ADR-NNN: [Decision Title]
- **Date:** YYYY-MM-DD
- **Status:** Accepted / Superseded / Deprecated
- **Context:** [Why this decision was needed]
- **Decision:** [What was chosen]
- **Alternatives Considered:** [What else was evaluated]
- **Consequences:** [Trade-offs and implications]
```

---

### ADR-001: Use SQLite for Local State

- **Date:** 2026-07-09
- **Status:** Accepted
- **Context:** Need to track which files have been uploaded, their hashes, and backup job history. Options: JSON file, flat files, SQLite, or no persistence.
- **Decision:** SQLite via `better-sqlite3`
- **Alternatives Considered:**
  - JSON file: no atomic writes, corrupt on crash, slow for 10K+ files
  - No persistence: lose all state on restart, re-upload everything
  - LevelDB: extra dependency, less query flexibility
- **Consequences:** Adds native compilation dependency; WAL mode gives concurrent reads; single file is easy to back up; migrations needed for schema changes.

---

### ADR-002: AES-256-GCM for Client-Side Encryption

- **Date:** 2026-07-09
- **Status:** Accepted
- **Context:** FileLu upload servers use HTTP — files transit in cleartext. Need optional client-side encryption.
- **Decision:** AES-256-GCM with random IV per file, streaming implementation
- **Alternatives Considered:**
  - AES-256-CBC: No authentication — vulnerable to padding oracle attacks
  - ChaCha20-Poly1305: Not available in Node.js crypto without additional deps
  - GPG/age: External tool dependency
- **Consequences:** Random IV per file prevents pattern analysis; auth tag provides integrity; streaming avoids loading large files into memory; no key rotation in v1.

---

### ADR-003: Commander.js over Alternatives

- **Date:** 2026-07-09
- **Status:** Accepted
- **Context:** Need a CLI framework for subcommand parsing, help generation, and option handling.
- **Decision:** Commander.js
- **Alternatives Considered:**
  - yargs: More complex API, heavier
  - oclif: Framework-level — too heavy for a simple CLI
  - meow: Minimal but no subcommand support
  - No framework: Would need to parse process.argv manually
- **Consequences:** Zero-config setup; built-in help; 50M+ weekly downloads (battle-tested); no framework lock-in.

---

### ADR-004: node-fetch over Axios

- **Date:** 2026-07-09
- **Status:** Accepted
- **Context:** Need HTTP client for REST API calls and multipart upload.
- **Decision:** node-fetch v3 (ESM)
- **Alternatives Considered:**
  - Axios: Larger bundle, more features than needed
  - undici: Lower-level, Node.js built-in but API is less stable
  - Native fetch (Node 18+): Experimental in Node 18, stable in 21+ — but we support Node 20 where global fetch exists
- **Consequences:** Small bundle; web-standards API; FormData support for multipart; ESM-only in v3.

> **Note:** Could switch to native `fetch` (available in Node 20) in a future version to eliminate this dependency.

---

### ADR-005: Named Exports Only — No Default Exports

- **Date:** 2026-07-09
- **Status:** Accepted
- **Context:** Default exports cause confusion in large codebases — names diverge at import sites, refactoring tools break, auto-imports are ambiguous.
- **Decision:** Named exports exclusively across all source files.
- **Alternatives Considered:**
  - Default exports: Convention in some React ecosystems, but not relevant here
  - Mixed: Inconsistent, confusing
- **Consequences:** Every import is explicit; IDE auto-imports work reliably; grep for symbol names works across codebase.

---

### ADR-006: Raw AES Key (Not Password-Derived) in v1

- **Date:** 2026-07-09
- **Status:** Accepted (with future improvement planned)
- **Context:** Password-based key derivation (PBKDF2, scrypt, argon2) is more user-friendly but adds complexity.
- **Decision:** Store raw AES-256 key (base64) in config file for v1.
- **Alternatives Considered:**
  - PBKDF2: Requires salt storage, iteration count tuning
  - scrypt/argon2: Requires additional native dependencies
  - Key file: Separate key file — more complexity for v1
- **Consequences:** Users must back up the key themselves; no "forgot password" recovery; simpler implementation; planned improvement for v2.

---

### ADR-007: Minimal Dependencies (4 Runtime)

- **Date:** 2026-07-09
- **Status:** Accepted
- **Context:** Every dependency is an attack surface and a maintenance burden. Balance functionality vs. supply chain risk.
- **Decision:** Limit to 4 runtime dependencies: commander, better-sqlite3, node-fetch, form-data.
- **Alternatives Considered:**
  - More deps (chalk, ora, winston, zod, etc.): More features but more risk
  - Zero deps: Would need to implement CLI parsing, HTTP client, SQLite binding from scratch
- **Consequences:** Small attack surface; fast install; manual ANSI color codes (10 lines vs chalk dependency); manual validation (vs zod).
