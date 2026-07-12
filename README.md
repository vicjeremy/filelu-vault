# FileLu Vault

[![CI](https://github.com/vicjeremy/filelu-vault/actions/workflows/ci.yml/badge.svg)](https://github.com/vicjeremy/filelu-vault/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](https://opensource.org/licenses/MIT)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.8-blue.svg)](https://www.typescriptlang.org/)

Secure, dedup-aware CLI for syncing and backing up files to [FileLu](https://filelu.com).

## Features

- **Blazing Fast Uploads:** Streams directly to the optimal FileLu ingest server.
- **Deduplication:** Local SQLite database prevents re-uploading unchanged files via SHA-256 hash tracking.
- **Client-Side Encryption:** Optional AES-256-GCM encryption before data leaves your machine.
- **Continuous Sync:** Built-in `fs.watch` wrapper to auto-upload modified files.
- **Cross-Platform:** Works seamlessly on Windows, macOS, and Linux.
- **Zero-Dependency Core:** Only depends on `better-sqlite3`, `commander`, and `node-fetch`.

## Installation

```bash
npm install -g filelu-vault
```

## Quick Start

### 1. Set your API Key

Obtain your API key from the FileLu dashboard.

```bash
vault config set-key <your-api-key>
```

### 2. Verify Status

Check your account storage and limits.

```bash
vault status
```

### 3. Upload a File

Upload a single file. It will skip automatically if the exact file has already been uploaded.

```bash
vault upload my-photo.jpg
```

### 4. Backup a Directory

Recursively scan and upload all files in a directory.

```bash
vault backup ./documents
```
*Tip: Use `--dry-run` to see what would be uploaded without actually transferring data.*

### 5. Continuously Sync

Watch a directory for changes and automatically upload new or modified files.

```bash
vault sync ./projects
```

## Client-Side Encryption

To ensure maximum security, you can configure `filelu-vault` to encrypt all files *before* they are uploaded. This uses AES-256-GCM with a 12-byte IV and 16-byte Authentication Tag.

1. **Enable Encryption in Config**
   Edit `~/.filelu-vault/config.json`:
   ```json
   {
     "encryptionEnabled": true,
     "encryptionKey": "<your-base64-encoded-32-byte-key>"
   }
   ```
2. **Use the `-e` flag**
   You can also trigger encryption per-command using the `-e` or `--encrypt` flag.
   ```bash
   vault backup -e ./secret-documents
   ```

*Note: You are responsible for securely backing up your encryption key. If lost, your encrypted files cannot be recovered.*

## Development

```bash
git clone https://github.com/filelu-vault/filelu-vault.git
cd filelu-vault
npm ci
npm run build
npm test
```

## License

MIT License. See [LICENSE](LICENSE) for details.
