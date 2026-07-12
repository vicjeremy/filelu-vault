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
