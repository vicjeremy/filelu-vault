# AGENTS.md — AI Agent Instructions for FileLu Vault

> This file governs how AI coding assistants (Cursor, Claude Code, Gemini, etc.) behave when working on this project.

---

## Identity

You are working on **FileLu Vault** — a Node.js CLI tool for secure upload, backup, and sync with FileLu cloud storage.

---

## Before Writing Any Code

1. **Read the docs first.** All documentation is at the project root:
   - `PRD.md` — what to build and what NOT to build
   - `ARCHITECTURE.md` — tech stack, directory structure, data flows
   - `PATTERNS.md` — coding standards (follow exactly)
   - `CONSTRAINTS.md` — hard boundaries (do not violate)
   - `DESIGN.md` — terminal output formatting
   - `DATA_MODEL.md` — database schema
   - `THREAT_MODEL.md` — security requirements
   - `TESTING.md` — how to write and structure tests
   - `IMPLEMENTATION_PLAN.md` — task breakdown with checkboxes

2. **Check `MEMORY.md`** for corrections, preferences, and past decisions.

3. **Check `BUGS.md`** for known issues before investigating.

4. **Check `AUDIT.md`** to understand what's built vs. what's missing.

---

## Communication Style

- Be concise. Bullet points over paragraphs.
- State what you're doing, then do it. No preamble.
- When presenting options, lead with your recommendation.
- If unsure, ask — don't guess.

---

## Code Comments

- **Do:** Add JSDoc to all public functions with `@param`, `@returns`, `@throws`
- **Do:** Add `// TODO:` with GitHub issue reference for known gaps
- **Don't:** Add obvious comments (`// increment counter` above `count++`)
- **Don't:** Add `// AI-generated` or self-referential meta-comments
- **Don't:** Comment out code — delete it (git has history)

```typescript
// ✅ Good
/**
 * Upload a file to FileLu cloud storage.
 * @param filePath - Absolute path to the file
 * @param options - Upload options (encrypt, retries)
 * @returns Upload result with file code and URL
 * @throws {UploadError} If file doesn't exist or upload fails after retries
 */
export async function uploadFile(filePath: string, options?: UploadOptions): Promise<UploadResult> {

// ❌ Bad
// This function uploads a file
export async function uploadFile(filePath: string, options?: UploadOptions) {
```

---

## Testing Requirements

- **Write tests before implementation** (TDD) when adding new functions
- **Run tests after every change:** `npx vitest run`
- **Never skip tests** — fix them or explain why they're wrong
- **Mock at boundaries** — mock `FileLuClient` and `Database`, not `fetch` or `fs`
- **See `TESTING.md`** for patterns and coverage targets

---

## File Organization

- Follow the directory structure in `ARCHITECTURE.md` exactly
- One responsibility per file — split at 300 lines
- Test files mirror source: `src/core/uploader.ts` → `tests/unit/core/uploader.test.ts`
- New files require: source + test + JSDoc on exports

---

## Commit Conventions

```
feat: add incremental backup engine
fix: handle empty file upload gracefully
test: add encryption roundtrip tests
docs: update API reference with retry config
refactor: extract retry logic into withRetry helper
chore: update vitest to 2.1
```

- One logical change per commit
- Run `npx vitest run && npx tsc --noEmit` before committing
- Never commit: node_modules, dist, *.db, config.json, .env

---

## Decision Making

When you face a design decision:
1. Check `DECISIONS.md` for prior decisions on the same topic
2. If no prior decision exists, ask the user
3. After the decision is made, record it in `DECISIONS.md`

---

## Forbidden Actions

- ❌ Do not install new runtime dependencies without explicit approval
- ❌ Do not use `any` type — use `unknown` + type guards
- ❌ Do not use `console.log` in `src/` — use `logger.*`
- ❌ Do not store API keys in code, logs, or error messages
- ❌ Do not use default exports
- ❌ Do not modify files outside of `src/`, `tests/` without asking
- ❌ Do not change the database schema without updating `DATA_MODEL.md`
- ❌ Do not build features listed in "What the MVP Is NOT" (see `PRD.md`)

---

## Task Tracking

- Update `TODO.md` when starting/completing tasks
- Update `TASK_TODAY.md` at the start of each session
- Update `AUDIT.md` after completing a major feature
- Update `DOCUMENTATION.md` after adding new modules
- Update `MEMORY.md` when learning something non-obvious

---

## Debugging Process

1. Read the error message carefully
2. Check `BUGS.md` for known issues
3. Reproduce with minimal test case
4. Fix the root cause, not the symptom
5. Add a regression test
6. Log the bug and fix in `BUGS.md`
