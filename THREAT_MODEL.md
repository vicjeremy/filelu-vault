# FileLu Vault — Threat Model

> **Version:** 1.0 | **Last Updated:** 2026-07-09

---

## 1. Assets

| Asset | Sensitivity | Location | Impact if Compromised |
|-------|------------|----------|----------------------|
| **API Key** | Critical | `~/.filelu-vault/config.json` | Full account takeover — upload/delete any file |
| **Encryption Key** | Critical | `~/.filelu-vault/config.json` | All encrypted files become readable |
| **File Contents** | High | Local FS → network → FileLu servers | Data breach, IP theft |
| **File Metadata** | Medium | `~/.filelu-vault/vault.db` | Reveals file names, sizes, directory structure |
| **Upload Logs** | Low | `~/.filelu-vault/vault.db` | Reveals upload timing and servers used |

---

## 2. Threat Actors

| Actor | Access Level | Goal | Likelihood |
|-------|-------------|------|-----------|
| **Local attacker** | Read files on same machine | Steal API key, read file metadata | Medium |
| **Network eavesdropper** | MITM on upload traffic | Intercept file contents in transit | Medium (upload uses HTTP) |
| **FileLu compromise** | Access to FileLu storage servers | Read stored files | Low |
| **Supply chain attacker** | Malicious npm dependency | Exfiltrate credentials | Low |
| **Physical access** | Stolen/shared laptop | Read config + DB | Medium |

---

## 3. Attack Surfaces & Mitigations

### 3.1 API Key Exposure

| Attack Vector | Mitigation |
|--------------|-----------|
| Key in log output | Logger redacts strings matching API key pattern |
| Key in CLI output | `vault config show` masks key: `****<last4>` |
| Key in error messages | `ApiError` strips key from URL before storing |
| Key in git history | `.gitignore` includes `config.json`; `.env.example` uses placeholder |
| Key in memory after use | Best-effort: zero-fill key buffer on `process.exit` |
| Config file readable by other users | Created with `0600`; verified on every load |

### 3.2 Data in Transit

| Attack Vector | Mitigation |
|--------------|-----------|
| Upload server uses HTTP (not HTTPS) | Client-side AES-256-GCM encryption before upload |
| API key in query string (HTTPS) | HTTPS encrypts query params in transit; key only sent to `filelu.com` |
| Man-in-the-middle on upload | Encrypted payload unreadable without client key |

> [!WARNING]
> FileLu upload server URLs use HTTP. File contents are sent in **cleartext** unless `--encrypt` flag is used. Always recommend encryption for sensitive data.

### 3.3 Data at Rest

| Attack Vector | Mitigation |
|--------------|-----------|
| Files stored unencrypted on FileLu | `--encrypt` flag: AES-256-GCM before upload |
| SQLite DB readable | `vault.db` set to `0600` permissions |
| Encryption key stored alongside data | Key in `config.json` (separate file, `0600`); user advised to back up key separately |
| Temp encrypted files left on disk | `finally` block deletes temp files; crash recovery cleans orphans |

### 3.4 Client-Side Encryption

| Property | Implementation |
|----------|---------------|
| **Algorithm** | AES-256-GCM (Authenticated Encryption with Associated Data) |
| **Key size** | 256 bits (32 bytes), base64 encoded in config |
| **IV** | 12 bytes, `crypto.randomBytes(12)`, unique per file |
| **Auth tag** | 16 bytes, appended to ciphertext |
| **File format** | `[IV 12B][Ciphertext][AuthTag 16B]` |
| **Streaming** | Yes — `createCipheriv` piped through streams |
| **Key generation** | `crypto.randomBytes(32).toString('base64')` |

**Encryption guarantees:**
- Confidentiality: AES-256 — no known practical attacks
- Integrity: GCM auth tag detects any tampering
- IV uniqueness: random per file — no pattern analysis across files

**Encryption limitations:**
- No key rotation mechanism (v1)
- No password-based key derivation — raw key, not PBKDF2/scrypt (v1)
- File metadata (names, sizes) not encrypted — visible in DB and on FileLu

### 3.5 Supply Chain

| Attack Vector | Mitigation |
|--------------|-----------|
| Malicious dependency | Only 4 runtime deps — all high-profile, audited |
| Dependency version hijack | `package-lock.json` with exact versions |
| Postinstall script attack | `npm audit` in CI; manual review of deps |
| Typosquatting | Dependencies listed by exact canonical name |

### 3.6 Input Validation

| Input | Validation | Rejection |
|-------|-----------|-----------|
| API key | Non-empty, printable ASCII | `ConfigError` |
| File paths | Resolve absolute, check exists, no `..` traversal | `UploadError` |
| Config values | Type + range checks per schema | `ConfigError` |
| API responses | All fields type-checked before use | `ApiError` |
| File names | No null bytes, no control characters | Skip with warning |
| SQL parameters | Prepared statements only — never string interpolation | N/A (architectural) |

---

## 4. Authentication & Authorization

| Aspect | Implementation |
|--------|---------------|
| **Auth mechanism** | API key (bearer-style, in query param) |
| **Auth scope** | Full account access (upload, account info) |
| **Key storage** | `~/.filelu-vault/config.json` with `0600` perms |
| **Key validation** | Call `getAccountInfo()` on first use; cache result |
| **Session management** | `sess_id` from upload server — ephemeral, single-use |
| **No user-level auth** | Single-user tool — whoever has the config file has access |

---

## 5. Data Protection Boundaries

```
┌─ TRUSTED ZONE ──────────────────────────────────────┐
│                                                      │
│  Local Machine                                       │
│  ┌────────────────┐  ┌────────────────┐              │
│  │  config.json   │  │   vault.db     │              │
│  │  API key       │  │   file paths   │              │
│  │  Enc key       │  │   hashes       │              │
│  │  (0600)        │  │   (0600)       │              │
│  └────────────────┘  └────────────────┘              │
│                                                      │
│  Plaintext files → Encrypt → Ciphertext              │
│                                                      │
└──────────────────────┬───────────────────────────────┘
                       │ HTTPS (API) / HTTP (upload)
┌─ UNTRUSTED ZONE ─────▼───────────────────────────────┐
│                                                      │
│  FileLu Servers                                      │
│  ┌────────────────┐                                  │
│  │  Stored files  │  ← encrypted if --encrypt used   │
│  │  (ciphertext)  │                                  │
│  └────────────────┘                                  │
│                                                      │
└──────────────────────────────────────────────────────┘
```

---

## 6. Security Checklist

### Pre-Release

- [ ] API key never appears in stdout, stderr, or log files
- [ ] `config.json` created with `chmod 0600`
- [ ] `vault.db` created with `chmod 0600`
- [ ] `.gitignore` excludes `config.json`, `*.db`, `*.db-wal`
- [ ] `npm audit` → 0 critical/high vulnerabilities
- [ ] Encryption roundtrip: encrypt → decrypt → `diff` → identical
- [ ] Auth tag tamper test: modify 1 byte of ciphertext → decrypt throws
- [ ] Path traversal: `../../etc/passwd` → rejected
- [ ] Empty file (0 bytes) → skipped, no crash
- [ ] File > 1GB → streaming, no OOM
- [ ] SQL injection: path with `'; DROP TABLE --` → safely parameterized

### Ongoing

- [ ] Dependabot / Renovate enabled for dependency updates
- [ ] CI runs `npm audit` on every PR
- [ ] SECURITY.md in repo root with disclosure process
- [ ] Release notes mention security-relevant changes

---

## 7. Incident Response

If a security vulnerability is discovered:

1. **Do not** create a public GitHub issue
2. Email maintainers at the address in `SECURITY.md`
3. Maintainers acknowledge within 48 hours
4. Patch developed privately
5. CVE assigned if applicable
6. Patch released, advisory published
7. 90-day disclosure timeline
