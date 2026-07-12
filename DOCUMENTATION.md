# FileLu Vault Documentation

## Architecture Overview

FileLu Vault is a Node.js CLI tool that securely uploads and synchronizes files to FileLu cloud storage.

It consists of four main architectural layers:
1. **API Layer (`src/api/client.ts`)**: Direct HTTP interactions with FileLu.
2. **Database Layer (`src/db/database.ts`)**: Local state management using SQLite to track file hashes and avoid redundant uploads.
3. **Core Services (`src/core/`)**:
   - `uploader.ts`: Orchestrates file uploads and interacts with both API and Database.
   - `encryption.ts`: Stream-based AES-256-GCM encryption engine.
   - `backup.ts`: Scans directories and drives bulk uploads.
   - `sync.ts`: Hooks into native `fs.watch` events for live synchronization.
4. **CLI Layer (`src/cli/index.ts`)**: The entry point utilizing Commander to parse arguments and expose functionality to the user.

## Data Model

The `tracked_files` SQLite table acts as the source of truth for deduplication:

| Column | Type | Description |
|---|---|---|
| `id` | INTEGER | Primary key |
| `local_path` | TEXT | Absolute file path |
| `file_hash` | TEXT | SHA-256 content hash |
| `file_size` | INTEGER | File size in bytes |
| `remote_file_code`| TEXT | FileLu URL code |
| `status` | TEXT | 'uploading', 'uploaded', 'failed', 'deleted' |

## Encryption

When `--encrypt` is used, files are routed through `Encryptor.encryptFile`.
1. A temporary file is generated in the OS temp directory.
2. A random 12-byte IV is appended to the stream header.
3. The file is piped through AES-256-GCM using the user's config key.
4. The 16-byte authentication tag is appended to the tail of the stream.

This ensures the remote file is securely encrypted before it touches the network.

## Testing

Run tests using `vitest`:
```bash
npm test                # Run unit tests
npm run test:integration # Run CLI integration tests
npm run test:coverage    # Generate V8 coverage report
```
