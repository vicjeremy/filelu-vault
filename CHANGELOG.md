# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-07-12

### Added
- Initial release of `filelu-vault` CLI
- FileLu API integration for authentication and file uploads
- Local SQLite database for file tracking and deduplication
- Upload engine with retry logic and batch concurrency controls
- AES-256-GCM client-side encryption support (`--encrypt`)
- `backup` command for recursive directory scanning
- `sync` command with `fs.watch` for continuous file syncing
- `--dry-run` option for safe backup testing
- Comprehensive test suite with GitHub Actions CI
