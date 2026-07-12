# FileLu Vault — Bug Log

> AI agents: log every bug you encounter or fix here. Include root cause, not just the symptom.

---

## Format

```markdown
### BUG-NNN: [Short description]
- **Status:** Open / Fixed / Won't Fix
- **Severity:** Critical / High / Medium / Low
- **Found:** YYYY-MM-DD
- **Fixed:** YYYY-MM-DD (if applicable)
- **File:** path/to/affected/file.ts
- **Root Cause:** [Why it happened]
- **Fix:** [What was changed]
- **Regression Test:** [Test file + test name]
```

---

## Active Bugs

_No bugs logged yet — implementation has not started._

---

## Resolved Bugs

_No resolved bugs yet._

---

## Known Risks (Pre-Implementation)

| # | Risk | Severity | Mitigation |
|---|------|----------|-----------|
| R1 | FileLu upload server uses HTTP — data in cleartext | High | Client-side encryption (`--encrypt`) |
| R2 | `sess_id` may expire before large batch completes | Medium | Re-fetch upload server URL on auth failure |
| R3 | `fs.watch` may miss rapid changes on some OS | Medium | Debounce + initial backup on sync start |
| R4 | SQLite lock contention during concurrent uploads | Low | WAL mode + busy_timeout pragma |
| R5 | `better-sqlite3` requires native compilation | Medium | Pre-built binaries cover most platforms |
