# FileLu Vault — AI Memory

> AI agents: this file stores dynamic context, corrections, and learned preferences.
> Update this file whenever you learn something non-obvious that future sessions need to know.

---

## Corrections

_No corrections logged yet._

Format:
```markdown
### YYYY-MM-DD: [What was wrong]
- **Wrong:** [What I did incorrectly]
- **Correct:** [What should have been done]
- **Why:** [Root cause of the mistake]
```

---

## User Preferences

| Preference | Value | Learned On |
|-----------|-------|-----------|
| Documentation framework | Full suite (PRD, design, arch, patterns, constraints, etc.) | 2026-07-09 |
| Agent instructions | Detailed AGENTS.md at project root | 2026-07-09 |
| Code style | TypeScript strict, no `any`, named exports only | 2026-07-09 |
| Testing | TDD, mock at boundaries, ≥80% coverage | 2026-07-09 |
| Commits | Conventional Commits, one change per commit | 2026-07-09 |

---

## Non-Obvious Findings

| # | Finding | Context | Date |
|---|---------|---------|------|
| 1 | FileLu upload URLs use HTTP, not HTTPS | Upload server returns `http://` URLs — encryption is essential | 2026-07-09 |
| 2 | `sess_id` is tied to specific upload server URL | Must use the sess_id with the URL it was issued from | 2026-07-09 |
| 3 | `storage_used` can be `null` | Premium accounts may return null for storage_used | 2026-07-09 |
| 4 | `storage_left` returns `"inf"` as string | Not a number — must handle as special case | 2026-07-09 |
| 5 | Upload response is a JSON array | Even for single file, response is `[{file_code, file_status}]` | 2026-07-09 |
| 6 | File field must be `file_0` | Not `file`, not `upload` — specifically `file_0` | 2026-07-09 |

---

## Architecture Decisions Deferred

| Decision | Options Considered | Status |
|----------|-------------------|--------|
| Password-based key derivation | PBKDF2, scrypt, argon2 vs raw key | Deferred to v2 |
| File versioning | Keep all versions vs latest only | Deferred — latest only in v1 |
| .vaultignore support | Glob patterns vs regex | Deferred to v2 |

---

## Session Context

| Key | Value |
|-----|-------|
| Last session | 2026-07-09 |
| Last task completed | Documentation phase (all docs) |
| Next task | Implementation Task 1: Project Scaffold |
| Blockers | None |
