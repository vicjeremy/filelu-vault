# FileLu Vault — Constraints

> **Version:** 1.0 | **Last Updated:** 2026-07-09
> AI agents: these are hard boundaries. Violating any constraint is a build-breaking error.

---

## 1. Dependency Constraints

### Allowed Runtime Dependencies (exhaustive list)

| Package | Version | Purpose |
|---------|---------|---------|
| `commander` | ^12.x | CLI framework |
| `better-sqlite3` | ^11.x | SQLite driver |
| `node-fetch` | ^3.x | HTTP client |
| `form-data` | ^4.x | Multipart upload encoding |

**Total allowed runtime deps: 4.** Adding any other runtime dependency requires explicit human approval.

### Forbidden Libraries

| Library | Reason |
|---------|--------|
| `axios` | Unnecessary — node-fetch is sufficient |
| `express` / `fastify` / `koa` | This is a CLI, not a web server |
| `mongoose` / `prisma` / `typeorm` | This is SQLite, not a managed DB |
| `winston` / `pino` / `bunyan` | Custom logger is < 50 lines — no framework needed |
| `lodash` / `underscore` | Use native JS — no utility belts |
| `moment` / `dayjs` | Use native `Date` + `toISOString()` |
| `chalk` / `kleur` | Use raw ANSI codes — 10 lines, not a dependency |
| `ora` / `cli-spinners` | Spinners break piped output — use progress bars |
| `inquirer` / `prompts` | CLI is non-interactive — no prompts |
| `dotenv` | Config is JSON file, not env vars |
| `zod` / `joi` | Validation is simple enough for manual checks |
| Any `@types/*` beyond `@types/node`, `@types/better-sqlite3` | Minimize type deps |

### Allowed Dev Dependencies

| Package | Purpose |
|---------|---------|
| `typescript` | Compiler |
| `@types/node` | Node type definitions |
| `@types/better-sqlite3` | SQLite type definitions |
| `vitest` | Test runner |
| `tsup` | Bundler |
| `eslint` | Linter |
| `@typescript-eslint/*` | TS ESLint plugin |

---

## 2. Performance Targets

| Metric | Target | Hard Limit |
|--------|--------|-----------|
| CLI startup time | < 200ms | 500ms |
| Hash 1 MB file | < 10ms | 50ms |
| Hash 100 MB file | < 500ms | 2s |
| Backup scan 10K files | < 5s | 15s |
| Memory usage (10K file backup) | < 100MB | 256MB |
| Concurrent uploads | 3 (default) | 10 (max) |
| Retry backoff max delay | 10s | 30s |
| DB query (single file lookup) | < 1ms | 5ms |

---

## 3. Security Constraints

| Rule | Enforcement |
|------|-------------|
| API key never in logs | Logger redacts any string matching key pattern |
| API key never in stdout | CLI masks key: `****<last4>` |
| Config file permissions | `0600` — checked on load, set on write |
| No secrets in error messages | `ApiError` strips key from URL before storing |
| No eval / Function constructor | ESLint rule: `no-eval`, `no-new-func` |
| No dynamic require/import | ESLint rule: `no-dynamic-require` |
| Encryption IV | Random 12 bytes per file — never reuse |
| Encryption auth tag | 16 bytes — always verified on decrypt |
| Temp encrypted files | Deleted in `finally` block — never persist |

---

## 4. Compatibility Constraints

| Constraint | Value |
|-----------|-------|
| Node.js minimum | 20 LTS |
| TypeScript target | ES2022 |
| Module system | ESM only (`"type": "module"`) |
| OS support | macOS, Linux, Windows (WSL) |
| Terminal width | Output must work in 80-column terminal |
| `NO_COLOR` support | Respect env var — disable ANSI when set |
| Piped output | No progress bars, no ANSI when `!process.stdout.isTTY` |

---

## 5. Code Quality Constraints

| Rule | Value |
|------|-------|
| TypeScript strict mode | `strict: true` in tsconfig |
| No `any` type | Zero tolerance — use `unknown` + type guards |
| No `@ts-ignore` | Use `@ts-expect-error` with explanation if absolutely needed |
| No `console.log` in src/ | Use `logger.*` — ESLint rule enforced |
| Max function length | 50 lines |
| Max file length | 300 lines |
| Test coverage | ≥ 80% line coverage |
| All public functions | Must have JSDoc comment |
| All exports | Must have explicit return type |

---

## 6. API Constraints

| Rule | Value |
|------|-------|
| Base URL | `https://filelu.com` — hardcoded, not configurable |
| Auth method | `key` query parameter (GET) or POST body field |
| Upload method | POST multipart/form-data to dynamic upload server URL |
| Upload field name | `file_0` (first file), `file_1`, etc. |
| Upload type field | `utype=prem` for premium accounts |
| Max concurrent API calls | 5 |
| Min delay between calls | 100ms |
| Retry on status codes | 500, 502, 503, 504 only |
| Never retry on | 403 (auth), 404 (not found) |

---

## 7. File Handling Constraints

| Rule | Value |
|------|-------|
| Symlinks | Skip — do not follow |
| Hidden files (dotfiles) | Skip by default in backup/sync |
| Empty files (0 bytes) | Skip with warning |
| Binary vs text | No distinction — treat all as binary streams |
| Max filename length | OS limit (255 chars) — validate before upload |
| Path traversal | Reject any path containing `..` outside source dir |
| Excluded patterns | `node_modules/**`, `.git/**`, `.DS_Store`, `Thumbs.db`, `*.tmp`, `*.swp` |

---

## 8. Architecture Constraints

| Rule | Description |
|------|-------------|
| No circular imports | ESLint rule: `import/no-cycle` |
| Layer boundaries | CLI → Core → API/DB/Utils (never reverse) |
| Single entry point | `src/cli/index.ts` is the only executable |
| Single DB connection | One `better-sqlite3` instance, created in `Database.init()` |
| No global state | All state in class instances or function parameters |
| No singletons | Pass dependencies via constructor injection |
| No process.exit in core | Only CLI layer calls `process.exit()` |
