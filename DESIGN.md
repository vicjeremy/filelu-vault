# FileLu Vault — Design System

> **Version:** 1.0 | **Standard:** Google Stitch | **Last Updated:** 2026-07-09

---

## 1. Brand Identity

**Product Name:** FileLu Vault
**Tagline:** Secure cloud backup from your terminal
**Personality:** Technical, trustworthy, minimal, fast

---

## 2. Color System

### Primary Palette

| Name | Hex | HSL | Usage |
|------|-----|-----|-------|
| **Vault Blue** | `#3B82F6` | `217, 91%, 60%` | Primary actions, links, active states |
| **Vault Dark** | `#0F172A` | `222, 47%, 11%` | Backgrounds, terminal theme |
| **Vault Slate** | `#1E293B` | `217, 33%, 17%` | Card backgrounds, secondary surfaces |
| **Vault White** | `#F8FAFC` | `210, 40%, 98%` | Primary text on dark |

### Semantic Colors

| Name | Hex | Usage |
|------|-----|-------|
| **Success** | `#22C55E` | Upload complete, tests passing |
| **Warning** | `#F59E0B` | Skipped files, expiring premium |
| **Error** | `#EF4444` | Failed uploads, API errors |
| **Info** | `#06B6D4` | Progress, status messages |
| **Muted** | `#64748B` | Secondary text, timestamps |

### Terminal Colors (ANSI)

```typescript
const COLORS = {
  reset:   '\x1b[0m',
  bold:    '\x1b[1m',
  dim:     '\x1b[2m',
  success: '\x1b[32m',  // green
  warning: '\x1b[33m',  // yellow
  error:   '\x1b[31m',  // red
  info:    '\x1b[36m',  // cyan
  blue:    '\x1b[34m',  // blue
  muted:   '\x1b[90m',  // gray
} as const;
```

---

## 3. Typography

### Terminal Output

| Element | Style | Example |
|---------|-------|---------|
| **Headings** | Bold + Blue | `\x1b[1m\x1b[34m╔══ FileLu Vault ══╗\x1b[0m` |
| **Labels** | Bold | `\x1b[1mStatus:\x1b[0m uploaded` |
| **Values** | Normal | `1,234 files` |
| **Errors** | Bold + Red | `\x1b[1m\x1b[31m✗ Upload failed\x1b[0m` |
| **Success** | Green | `\x1b[32m✓ Uploaded\x1b[0m` |
| **Dimmed** | Dim | `\x1b[2m(skipped — unchanged)\x1b[0m` |
| **URLs** | Underline + Blue | `\x1b[4m\x1b[34mhttps://filelu.com/abc123\x1b[0m` |

### Documentation / Web

| Element | Font | Size | Weight |
|---------|------|------|--------|
| **H1** | Inter | 32px | 700 |
| **H2** | Inter | 24px | 600 |
| **H3** | Inter | 18px | 600 |
| **Body** | Inter | 16px | 400 |
| **Code** | JetBrains Mono | 14px | 400 |
| **Small** | Inter | 13px | 400 |

---

## 4. Iconography (Terminal)

| Symbol | Meaning | Context |
|--------|---------|---------|
| `✓` | Success | File uploaded |
| `✗` | Failure | Upload failed |
| `⟳` | In progress | Currently uploading |
| `⊘` | Skipped | Dedup match |
| `🔒` | Encrypted | File encrypted before upload |
| `⚡` | Fast | Cached/skipped |
| `▓░` | Progress bar | Upload/backup progress |

---

## 5. Spacing & Layout

### Terminal Output Rules

```
┌──────────────────────────────────────────┐
│  2 spaces padding inside boxes           │
│                                          │
│  Label:  value (2-space indent)          │
│  Label:  value                           │
│                                          │
│  1 blank line between sections           │
└──────────────────────────────────────────┘
```

| Rule | Value |
|------|-------|
| Left padding | 2 spaces |
| Label-value gap | 2 spaces after colon |
| Section separator | 1 blank line |
| Progress bar width | 40 characters |
| Max output width | 80 characters |

### Progress Bar Design

```
Uploading report.pdf  [▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓░░░░░░░░░░] 65% 12.4 MB/s
```

---

## 6. CLI Output Patterns

### Success
```
✓ Uploaded report.pdf → https://filelu.com/b578rni0e1ka
```

### Error
```
✗ Failed to upload large-file.zip: API returned 500 (Server Error)
  Retried 3 times. Run with --verbose for details.
```

### Backup Summary
```
╔══════════════════════════════════════════╗
║         Backup Complete                  ║
╠══════════════════════════════════════════╣
║  Source:    ./my-project                 ║
║  Uploaded: 12 new │ Skipped: 128         ║
║  Failed:   2 │ Duration: 34.2s           ║
╚══════════════════════════════════════════╝
```

### Status
```
╔══════════════════════════════════════════╗
║           FileLu Vault Status            ║
╠══════════════════════════════════════════╣
║  Account:  you@domain.com                ║
║  Plan:     Premium (exp 2025-02-18)      ║
║  Storage:  45.2 GB / ∞                   ║
╠══════════════════════════════════════════╣
║  Local:    1,234 tracked │ 1,200 synced  ║
║  Pending:  30 │ Failed: 4               ║
╚══════════════════════════════════════════╝
```

---

## 7. Do's and Don'ts

### ✅ DO
- Use Unicode box-drawing (`╔═╗║╚╝`) for structured output
- Use colors sparingly — status indicators only
- Right-align numbers in columns
- Truncate long paths: `…/deep/path/file.txt`
- Show human-readable sizes: `12.4 MB` not `13003776`
- Respect `NO_COLOR` env var
- Use `stderr` for logs, `stdout` for parseable output

### ❌ DON'T
- Don't use emoji (except `🔒` for encryption)
- Don't print raw JSON (only with `--json` flag)
- Don't show stack traces (unless `--verbose`)
- Don't use spinners (break piped output)
- Don't print the API key — ever
- Don't use ANSI in `--json` mode
- Don't print absolute paths when relative is clearer

---

## 8. Error Message Format

```
✗ {what failed}: {why}
  {what the user can do}
```

Examples:
```
✗ Authentication failed: Invalid API key
  Run `vault config set-key <your-key>` to set a valid key.

✗ Upload failed: Connection timeout after 30s
  Check your internet connection and try again.
```
