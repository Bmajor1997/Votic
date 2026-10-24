# Multi-page scanning — first implementation

Implemented on `feature/paywall-research-improvements-2026-10-22` on October 24, 2026. Main remains unchanged.

## User flow

1. Photograph the first sheet. A numbered thumbnail strip identifies the pages belonging to one document.
2. Choose **Add another page** and repeat (up to 50 pages per scan).
3. Select any thumbnail to retake, rotate clockwise, remove, or move that page earlier/later. Retaking replaces the selected page in place; it never removes the other sheets. Rotation changes the JPEG used for recognition.
4. Enter a document title and tap **Finish scan**. Text is recognized in the chosen order, with page-specific progress and failure messages.
5. Correct the recognized text in the existing page-by-page review, then choose **Save document**. Exactly one library document opens in the Reader, with page text separated by blank lines. Read, Listen and Ask Votic use the combined document.

This creates a Votic text document, not a PDF containing the original photos. Reading order is retained; the Reader does not gain a separate image-page navigation mode in this change.

## Recovery and privacy

Native Android/iOS captures are copied from temporary camera files to app-private document storage before a successful capture is acknowledged. A per-account, chunked manifest retains the title, ordered page identifiers and completed OCR. Reopening Scan resumes that draft. Stable document identity prevents a repeated handoff from creating duplicate library records.

Recognition checkpoints each successful page. A failed/blank page is identified and can be retried, retaken or removed. Completed pages are reused after a recoverable error or reopening the scanner. Cached OCR is invalidated only for a retaken/rotated page; moving pages preserves it. If storage fails, the error asks the user to keep Votic open; in-memory recognized text is reused on retry. Recovery after an uncommitted storage failure cannot be guaranteed.

On Finish, every page's recognized text is durably stored in the existing OCR review before raw scan photos are erased. An unfinished text review continues to be available through Settings → Help. Removed/replaced photos may remain in the private draft directory until handoff or explicit discard; retaining them during writes prevents a concurrent title update from deleting a newly staged capture. Discarding a scan erases its images and draft manifest. Account deletion, including interrupted-deletion recovery on launch, also erases that account's photos, orphaned files and metadata. Another account's files are preserved.

The web scanner supports multi-page capture in the current tab, with an explicit warning that photos do not survive a reload. Durable photo-draft recovery in this first implementation is native only. Photos and drafts are not added to exported text-library backups.

No new photo upload happens before Finish scan. Existing authenticated OCR requests remain per page. No shutter flash was added; the camera still uses `animateShutter={false}`.

## Build and validation

Added Expo SDK 57-compatible `expo-image-manipulator` (`~57.0.21`) and its transitive image-loader dependency. **Rebuild the native development/store app before testing; an OTA update alone cannot add a native module.** No generated iOS/Android files or store settings were edited.

Automated validation: 434 reliability tests (42 files) and 539 component/integration tests (70 suites) passed. Type checking, mobile lint, formatting and whitespace checks passed. The complexity gate reported 3,506 functions and zero regressions, without changing its baseline. Focused tests cover collecting and ordering pages, title preservation, retake-in-place, rotation, saving one document, partial-OCR recovery after remount, blank-page handling, chunked Unicode storage, failed-manifest preservation, account isolation and native-file ownership/cleanup. Existing import/OCR review and account deletion tests remain part of the full mobile suite.

Physical-device checks still required: camera readiness and permissions; actual image rotation/orientation; multi-sheet capture; large-text/keyboard behavior; force-close and resume; airplane-mode failure on a later page; low-storage errors; account switching/deletion; and confirming one combined document reads/listens in order. Native emulator/physical-device and OCR-provider end-to-end tests were not run here.
