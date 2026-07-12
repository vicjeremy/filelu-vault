# FileLu Vault — Future Roadmap

Based on the official FileLu API, the following features are slated for future implementation to expand the CLI beyond just backup and sync functionality.

## 1. Remote Uploads
Allow the FileLu server to download files directly from other URLs, saving local bandwidth.
- [ ] `vault remote-upload <url>` (Remote URL Upload)
- [ ] `vault remote-status <job-id>` (Check Remote URL Upload Status)

## 2. File & Link Management
Manage uploaded files and generate secure sharing links directly from the terminal.
- [ ] `vault list` (Get Files List)
- [ ] `vault info <file-id>` (File Info)
- [ ] `vault rename <file-id> <new-name>` (Rename File)
- [ ] `vault copy <file-id>` (Clone File)
- [ ] `vault move <file-id> <folder-id>` (Set File Folder)
- [ ] `vault delete <file-id>` (File Remove)
- [ ] `vault restore <file-id>` (File Restore)
- [ ] `vault trash` (List Deleted Files)

## 3. Secure Sharing
Control access and permissions for your uploaded files.
- [ ] `vault share <file-id> --private` (Set File Sharing / Only Me)
- [ ] `vault password set <file-id> <password>` (Set File Link Password)
- [ ] `vault password remove <file-id>` (Unset File Link Password)
- [ ] `vault download-link <file-id>` (Get Direct Download Link)

## 4. Folder Management
Organize files into directories on the FileLu cloud.
- [ ] `vault folder list` (Folder List)
- [ ] `vault folder create <name>` (Create Folder)
- [ ] `vault folder rename <folder-id> <new-name>` (Rename Folder)
- [ ] `vault folder move <folder-id> <destination-id>` (Move Folder)
- [ ] `vault folder copy <folder-id> <destination-id>` (Copy Folder)
- [ ] `vault folder delete <folder-id>` (Delete Folder)
- [ ] `vault folder restore <folder-id>` (Restore Folder)
- [ ] `vault folder password set <folder-id> <password>` (Set Folder Password)
- [ ] `vault folder settings <folder-id>` (Folder Setting)

## 5. Download Client
- [ ] `vault download <file-id>` (Securely download and decrypt files)

## 6. Advanced Vault Features (Value-Add)
*These are custom CLI features beyond the standard API, leveraging local state and processing power.*

### Automation & Integration
- [ ] **Scheduled Backups:** `vault schedule backup ./docs "0 0 * * *"` (Registers a backup job with your OS cron/launchd natively).
- [ ] **Ignore Files:** Support for `.vaultignore` (or reading `.gitignore`) to automatically skip folders like `node_modules/` or `.git/` during syncs and backups.

### Advanced Syncing
- [ ] **Two-Way Sync:** Pull remote changes down to the local machine so multiple computers can stay in perfect sync.
- [ ] **Bandwidth Throttling:** `vault config set max-bandwidth 5MB/s` (Limit network usage so background syncs don't interrupt your workflow).

### Enhanced Security
- [ ] **Secure Key Sharing:** Share encrypted files securely by embedding the decryption key in a URL fragment (e.g., `vault share --secure <file-id>`), allowing recipients with the CLI to automatically decrypt upon downloading.
- [ ] **Point-in-Time Snapshots:** Locally track file versions and append timestamps to file names, allowing you to restore your directory exactly as it looked on a specific date.

### User Experience
- [ ] **Terminal UI (TUI):** `vault dashboard` (An interactive, full-terminal dashboard showing live sync logs, storage graphs, and active upload progress bars).
- [ ] **Export/Import State:** `vault export-state` (Easily migrate your SQLite tracking database and encryption keys to a new computer).
