# Settings: library, support, privacy and storage

Settings now links directly to Contact support, Privacy & Legal, Library tools and Storage management.
Library tools collects backup/restore, Recently Deleted, note drafts and unfinished scan review. Existing
backup access in Account & Membership remains available. Help retains guides, tips, widgets and statistics.
Contact support opens an email draft to votic.support@gmail.com; opening the page sends nothing.
Privacy & Legal reuses the configured policy URLs and the existing optional failure-count consent.

## Storage behavior

- The reading library contains extracted text, metadata, notes and progress in account-scoped device storage.
  Original import binaries are not retained as the library. Scan draft photos have separate durable storage.
- The storage page reads UTF-8 value sizes in batches, never all library text at once. Document estimates
  include text chunks and serialized metadata/notes. The account total also includes local drafts and settings.
  SQLite overhead, app installation, legacy backups, other accounts and externally saved files are excluded.
- Native scan-photo measurement is restricted to the current account's hashed ScanDrafts folder.
- Temporary-file measurements cover only DocumentPicker, Camera and LibraryBackups cache folders.
  Cleanup requires confirmation and removes files only when both creation and modification dates are known
  and older than one hour. New copies of old files are protected. It never clears AsyncStorage, durable
  ScanDrafts, provider originals or exported copies outside Votic. Unknown cache folders are untouched.
- Web has no native filesystem measurement or cleanup; unavailable measurements display as unavailable.
- Import limits remain 25,000,000 bytes per document and 12,000,000 bytes per page photo. Existing text,
  metadata, document-count and backup validation limits remain. These are ceilings, not reserved capacity.
- The Expo Android build plugin sets AsyncStorage_db_size_in_MB to 128 (128 MiB), replacing its 6 MiB default.
  This is the local SQLite ceiling shared by accounts, not a per-document allowance. It grows on demand,
  depends on free device space, and requires a new native build. It does not change an already installed build.

## Cost and verification

These changes provision no cloud storage and add no storage subscription. Backups remain manual exported
files, with no automatic cloud sync. Existing document extraction, OCR, AI, server and network costs are
separate. Cloud sync would need its own quota, retention and billing design.

Automated checks cover account isolation, Unicode/chunk accounting, read failure handling, preservation of
documents/drafts/originals/recent cache, cleanup confirmation, support mail failures, legal links and routes.
The native database ceiling is checked for idempotence and preservation of other Gradle settings.
An Android build and device pass are still needed for OS email handoff, filesystem usage and low-space behavior.
