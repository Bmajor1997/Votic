# Finish experience: audit fixes and verification

Work date: October 21, 2026. Branch: `feature/finish-experience`.

## Starting state and scope

The inspected base was `bccd81e982b433f78db3f615031e7dbfa097a0ca`, already on the consolidated branch. Remote updates were fetched before editing and checked again before publication; no newer branch commit was present at the initial inspection. No applicable `AGENTS.md` was found. Existing worktrees and changes in other checkouts were left alone. `main` was neither edited nor pushed. Environment files, credentials and existing generated native files were preserved.

The app uses Expo/React Native, account-scoped local AsyncStorage and context providers; Android narration uses the existing native TTS foreground media service. The backend is the existing Node HTTP server with isolated document parser workers. Firebase authentication, RevenueCat subscriptions and the native feedback backend remain in place. There are no new services or dependencies and no production deployment or cloud changes.

Opening a saved document from Documents still asks Read or Listen first (the chooser added earlier the same day), and every reader also has an in-reader Read/Listen switch. Imports open straight into the Reader without the chooser, and switching never pushes another reader route. Explicit widget/deep-link modes retain their existing behavior. Recently Deleted and draft recovery use local account storage, with a 30-day deletion-retention policy.

## Commits

- Base: `bccd81e982b433f78db3f615031e7dbfa097a0ca`.
- PDF/layout/encoding extraction: `be7a55a64ee0154c04c67e9ead8eb68245d52843`.
- Webpage/browser decoding: `f60c60b4f65bf146761365144b19120889b93209`.
- Verified mobile implementation: `53a328ca649c26e0f8022808fb2cc09fbbc08f04`.
- This report is delivered in the following documentation commit on the same branch; its SHA is recorded in the delivery response.

## Verified causes and resulting behavior

| Item                | Verified cause at the base                                                                                                                   | Result                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| ------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| PDF text loss       | Repeated short edge labels could qualify as running headers after number normalization.                                                      | Ambiguous repeated content is retained. Only sequential, geometrically supported page-number furniture is removed. Actual HTTP/parser fixtures retain all six repeated instructions, chapter headings and bottom sentences.                                                                                                                                                                                                                  |
| PDF columns         | Global vertical/horizontal sorting could interleave columns.                                                                                 | Bounded gutter detection reads supported columns within bands separated by spanning text; majority RTL reverses column order. Uneven/mixed layouts are tested through extraction. Numeric table-like rows retain row order.                                                                                                                                                                                                                  |
| Encodings           | Mobile TXT/Markdown, uploaded HTML/archive XML, webpage bodies and browser text imports used permissive UTF-8 decoding.                      | One strict decoder supports UTF-8, UTF-8 BOM, UTF-16 LE/BE BOM and rejects malformed bytes, NUL/binary input, unpaired surrogates and unsupported encodings. Error text gives a UTF-8 re-export recovery action. Backup file reading also uses the decoder. Existing byte/character/archive limits remain.                                                                                                                                   |
| Note drafts         | The editor held unsaved fields only in component state.                                                                                      | Account-scoped recoverable drafts retain title, text, type, tags and source association. Close/Android Back offers Keep editing, Keep draft or Discard. Edits are debounced, flushed on interruption/unmount and recoverable from Settings → Help → Note drafts. Saved notes are not changed by draft persistence; drafts clear only after a successful durable note save or explicit discard.                                               |
| Read/Listen access  | The saved-document chooser was the only mode entry point; it remains, alongside the new switch.                                                                                  | Every reader has Read/Listen controls. Switching pauses audio, preserves location and updates the current route rather than pushing another reader. Listening requires an explicit Play.                                                                                                                                                                                                                                                     |
| Offline readiness   | Listen settings always claimed offline readiness.                                                                                            | Locally saved text is distinguished from voice capability. Android queries actual voice network/data flags; network, missing and unknown states have accurate copy and a device-settings recovery action. Voice-name suffixes do not determine readiness.                                                                                                                                                                                    |
| Background activity | JavaScript activity tracking stopped with app suspension.                                                                                    | Native confirmed-speech callbacks run a monotonic clock; five-second/transport checkpoints persist cumulative account/document counters. Activity and document totals reconcile independently and durably before acknowledgment. Duplicate/restarted checkpoints cannot inflate totals. Foreground listening tracking is disabled when the native journal is available.                                                                      |
| Find                | No in-document search existed.                                                                                                               | Literal Unicode search provides input, match count, previous/next, highlighting and result navigation. Work yields between batches and is bounded to the first 1,000 displayed matches. Search is a temporary location; close/Back restores the reading view without starting audio, completing the document or overwriting saved progress. Opening a reader no longer rewrites progress solely from recalculation at an unchanged location. |
| Recently Deleted    | Documents and individual notes were removed immediately.                                                                                     | Both use 30-day local recovery. Document deletion hides its associated notes and stops playback. Removing a narrated Quick Notes entry also stops the stale playback queue. Live context excludes deleted content from reading, search, recommendations and widgets. Restore preserves associations. Permanent deletion requires confirmation and flushes storage. Expiry/permanent deletion also clears associated note drafts.             |
| OCR review          | Successful recognition was immediately concatenated and saved, with empty page results omitted.                                              | Camera/image imports require ordered, editable text review before final save. Empty pages remain visible for correction. Successful camera OCR is cached during retry, so a later failed page does not force another paid read of earlier pages. Corrected review text is persisted locally in chunks and resumable from Help. Stable import IDs prevent duplicate documents after interrupted finalization.                                 |
| Provenance          | New webpage documents kept their generated filename/origin but lost the URL.                                                                 | The backend-returned original/final public URL is retained. Documents → options → Details offers a confirmed Open original action for validated HTTP(S) sources. Missing links are explained; cache/private file paths are never offered as originals. Source URLs survive backups.                                                                                                                                                          |
| Sleep timer         | No timer existed.                                                                                                                            | Native Android offers 15/30/60 minutes or End of passage, shows the active timer and allows cancellation. Durations include pauses and use a monotonic deadline. Expiry pauses, never starts, audio. Document/account change, Stop, completion or playback-process restart cancels the timer. Skipping a passage with a passage timer pauses at that boundary. No JavaScript polling timer or additional wake lock is introduced.            |
| Help                | Mobile answers/guide still named Upload and misstated account-deletion retention; native documentation said background time was not tracked. | Mobile support, guide, walkthrough hint, Statistics copy, backup copy and native documentation match the current UI and limitations. Notes’ conversational study actions remain. Retired Review/graded understanding screens were not restored.                                                                                                                                                                                              |

## Local data and compatibility

- Optional document fields: `deletedAt`, `sourceUrl`, `nativeCheckpoints`. Saved passages gain optional `deletedAt`; activity logs gain optional native checkpoint watermarks. Older libraries without these fields remain readable.
- Deleted records remain within the same account library until expiry/permanent removal. Expiry is enforced at load, foreground return and hourly while running; an app that is not running cannot physically purge storage. Expired items cannot be restored. Failed cleanup retains hidden data and provides a retry notice. They count toward the existing document, metadata and text limits. Associated drafts are cleared when their source is permanently removed or expires.
- Draft keys use the existing encoded UID prefix and separately encoded document/passage identifiers; writes/discards serialize. Up to 100 unfinished note drafts are retained. Drafts are not backups and do not sync between devices.
- One unfinished OCR review is retained per account. Its manifest is committed only after all text chunks are written. Chunks contain at most 500,000 characters, below Android's per-value read ceiling; failed staging does not replace a prior complete review. The review limit remains approximately the existing 10-million-character document ceiling. Review edits are debounced at 300 ms; note edits at 350 ms. Abrupt termination before those writes finish can lose the most recent edit.
- Native activity records contain identifiers/times, not document text. A service that survives an account switch rotates its cumulative session identity. Native records are cleared during account deletion and pending-deletion recovery at launch. Existing local account deletion also removes drafts, review chunks and trash by the account prefix.
- **New backups are version 2; version-1 backups remain accepted.** Version 2 prevents older backup readers from silently dropping deletion/source metadata. Deleted items and source URLs are included, with deletion timestamps preserved. Note drafts, unfinished scan reviews and original binaries are excluded. Older exported backups retain their own copies and can intentionally restore older content. Do not downgrade the installed app while relying on the new trash metadata: older app code does not understand it.
- Backups remain unencrypted, as before. In-app copy explains retained deleted content and excludes credentials/purchases. Update/review the release privacy policy for local draft/review storage, 30-day recovery, native time measurements and exported-backup retention before release.

## Limits and recovery paths

Multi-column extraction is conservative geometry, not a general layout engine. Dense magazines, rotated/overlapping text, irregular sidebars and complex nonnumeric tables may remain in row order or have imperfect narration order. No text is removed to conceal uncertainty. The guide recommends exporting a single-column TXT/Markdown/Word source and checking order against the original. No OCR/layout service was added.

Camera and image review is page-aware. Existing scanned-PDF OCR returns whole-document text without per-page correction/review metadata; its existing size, completeness, paid-usage and cancellation safeguards remain. For page-specific correction, scan/import page images; for difficult mixed PDFs, export selectable/single-column text. Completed camera pages are cached during a recoverable recognition retry in the current scan session. A restart during recognition, before review text is persisted, may require choosing/photographing the original again. Saved review text resumes without keeping original photos. Temporary images are cleaned when the scanner/import session closes; they are not permanent originals.

A voice reporting offline capability is engine evidence, not a playback guarantee. Test airplane mode on the intended device. Missing/unknown engines require installation or another voice. Sleep timers/background measurement require a newly rebuilt Android native app; Metro refresh alone does not update Kotlin. iPhone/web/Expo Go keep existing speech behavior and report unavailable/unknown capabilities honestly.

An abrupt native process kill can lose the last unfinished measurement interval (normally up to five seconds). Confirmed checkpoints replay idempotently; elapsed time during a dead or paused process is never invented. Native build and OEM/device behavior still need verification.

## Automated verification

Executed checks (final source unless noted):

| Check                                        | Result                                                                                                                                            |
| -------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------- |
| Backend `npm test`                           | 236 passed, 0 failed, 0 skipped. Includes actual HTTP/parser routes.                                                                              |
| Mobile Vitest reliability                    | 416 passed across 41 files.                                                                                                                       |
| Mobile Jest component/integration/navigation | 522 passed across 67 suites, 0 failed. Includes ordered OCR retry/correction, surrogate-safe chunk boundaries, and Quick Notes playback deletion. |
| TypeScript                                   | `npm run typecheck` passed.                                                                                                                       |
| Root quality                                 | ESLint, HTML validation and CSS lint passed via `npm run quality`.                                                                                |
| Mobile quality                               | ESLint with zero warnings and Prettier check passed.                                                                                              |
| Complexity                                   | No regressions; existing baseline/thresholds unchanged.                                                                                           |
| Android Metro/Hermes export                  | Passed; final Android HBC generated.                                                                                                              |
| Native project generation                    | Passed in a temporary source copy.                                                                                                                |
| Generated Android manifest/resources         | Passed the existing verification script.                                                                                                          |
| Browser/native execution                     | Blocked as detailed below; not passing results.                                                                                                   |

Browser and native blockers below must not be interpreted as passing checks.

- Backend production-route fixtures cover PDF repeated instructions, ordinary page furniture, uneven columns/full-width bands, UTF-16 HTML, EPUB XML and malformed encoding. Additional helper fixtures cover RTL, numeric tables, Unicode and both UTF-16 byte orders.
- Mobile tests cover production providers/storage for restoration, permanent deletion, expiry, draft isolation/discard/deletion, chunked OCR failure recovery, backup versions/provenance/trash and native cumulative persistence/replay. Component/navigation tests cover Read/Listen, Find without progress/audio side effects, note draft keep/resume/save, camera review/correction, voice-capability states and timer controls.
- Quality thresholds, existing assertions and complexity baselines were retained. Tests expecting old Upload copy or rejection of the now-supported backup version 2 were updated to the new behavior; unsupported version 3 and legacy compatibility are explicitly tested.
- Android export and native project generation run against source copies/output directories, preserving existing generated native files.

Blocked checks:

1. Gradle native compilation and JVM tests: wrapper download of Gradle 9.3.1 failed with `java.net.SocketException: Network is unreachable`. No Android SDK/Kotlin compiler is installed locally. New native unit tests are present but unexecuted here. Native CI must pass before release.
2. Playwright browser suite: ten cases failed to launch because Chromium was missing. `npx playwright install chromium` was attempted; its download was invalid/truncated and could not be unpacked. Application/browser assertions did not execute. The shared decoder's allowlisted HTTP module route was separately exercised successfully.
3. Emulator/physical-device checks were deliberately reserved for October 22, 2026.

## Configuration and tomorrow's Android checklist

No new Firebase/RevenueCat settings, credentials, production database migrations or services are needed. Keep the existing local environment files. Backend packaging must include the shared dependency-free decoder at `apps/mobile/src/documents/textEncoding.js` as well as the backend files (a full repository checkout already does). Pull the consolidated branch and rebuild the Android development app with the existing Android build flow; on Windows use `npm.cmd`/`npx.cmd` to avoid PowerShell's script-policy issue. Do not overwrite environment files or generated native directories to update this branch.

1. Import the repeated-instruction and uneven-column PDFs, ordinary/scanned/mixed PDFs, a list/table and RTL text. Compare narration order and retained lines with originals; use the documented fallback for unsupported layouts.
2. Import multilingual TXT/Markdown in UTF-8 and both BOM UTF-16 byte orders; malformed input must give the re-export recovery message.
3. Test new and edited note drafts via Close, Android Back, background/restart, save and discard. Switch between two test accounts and confirm isolation. Empty Notes must still offer its intended document-first experience.
4. Open saved files, fresh imports, webpage imports, scans and OS shares. Switch Read/Listen, confirm position, no automatic speech and correct Back behavior. Check explicit widget/deep-link modes.
5. Find several matches, Unicode, punctuation, no results and a large document. Navigate and close/Back; saved location/completion and speech/bookmarks must remain correct.
6. Test installed offline, network-dependent and missing voices, including airplane mode and the settings recovery action.
7. Listen foreground/background/locked, pause, interrupt with other audio and unplug headphones. Compare Home/Statistics/widget/finish totals, restart after a checkpoint and confirm no replay inflation.
8. Set/cancel a duration timer and an End of passage timer. Test pause/resume, manual skip, completion, another document and process restart; expired/restored timers must never start audio.
9. Delete a playing document and a standalone note; verify hidden content, stopped audio, correct restoration and permanent-delete confirmation. Round-trip version-2 trash/provenance and restore an older backup. Use a disposable test account for account-deletion cleanup checks.
10. Scan two pages, simulate a recoverable later-page failure, retry, correct both pages and save in order. Keep/restart/resume an unfinished review. Check temporary-image cleanup and safe Open original/unavailable-original behavior.

## Changed files

The list below includes implementation and regression files since the inspected base; no source files were removed.

```text
app_parts/document_file_tools.js
app_parts/help_answers.js
app_parts/pdf_layout.js
app_parts/votic_screen.js
app_parts/web_import.js
app_parts/web_import.test.js
apps/mobile/app/(tabs)/notes.tsx
apps/mobile/app/_layout.tsx
apps/mobile/app/handle-share.tsx
apps/mobile/app/import-web.tsx
apps/mobile/app/library-backup.tsx
apps/mobile/app/note-drafts.tsx
apps/mobile/app/reader.tsx
apps/mobile/app/recently-deleted.tsx
apps/mobile/app/scan.tsx
apps/mobile/app/statistics.tsx
apps/mobile/docs/notification-listening.md
apps/mobile/modules/votic-playback/android/src/main/java/com/votic/playback/MeasuredSpeechClock.kt
apps/mobile/modules/votic-playback/android/src/main/java/com/votic/playback/PlaybackActivityJournal.kt
apps/mobile/modules/votic-playback/android/src/main/java/com/votic/playback/PlaybackSleepTimer.kt
apps/mobile/modules/votic-playback/android/src/main/java/com/votic/playback/VoticPlaybackModule.kt
apps/mobile/modules/votic-playback/android/src/main/java/com/votic/playback/VoticPlaybackService.kt
apps/mobile/modules/votic-playback/android/src/test/java/com/votic/playback/PlaybackReliabilityTest.kt
apps/mobile/src/activity/ActivityProvider.tsx
apps/mobile/src/activity/activityModel.ts
apps/mobile/src/activity/useReaderActivity.ts
apps/mobile/src/auth/AuthProvider.tsx
apps/mobile/src/documents/DocumentActionsSheet.tsx
apps/mobile/src/documents/DocumentLibraryProvider.tsx
apps/mobile/src/documents/OcrReviewProvider.tsx
apps/mobile/src/documents/OriginalSource.tsx
apps/mobile/src/documents/documentStorage.ts
apps/mobile/src/documents/libraryRecovery.ts
apps/mobile/src/documents/ocrReviewStorage.ts
apps/mobile/src/documents/readImportedText.ts
apps/mobile/src/documents/sourceInformation.ts
apps/mobile/src/documents/textEncoding.d.ts
apps/mobile/src/documents/textEncoding.js
apps/mobile/src/documents/types.ts
apps/mobile/src/documents/useDocumentImport.ts
apps/mobile/src/documents/useImportSave.ts
apps/mobile/src/notes/components/NoteEditor.tsx
apps/mobile/src/notes/draftStorage.ts
apps/mobile/src/notes/useNoteDraftProtection.ts
apps/mobile/src/onboarding/voticGuide.ts
apps/mobile/src/playback/NativeActivitySync.tsx
apps/mobile/src/playback/NotificationPlaybackSync.tsx
apps/mobile/src/playback/nativeActivity.test.ts
apps/mobile/src/playback/nativeActivity.ts
apps/mobile/src/playback/notificationPlayback.ts
apps/mobile/src/reader/components/FindHighlight.tsx
apps/mobile/src/reader/components/OfflineVoiceStatus.tsx
apps/mobile/src/reader/components/ReaderSettingsSheet.tsx
apps/mobile/src/reader/components/ReaderTools.tsx
apps/mobile/src/reader/components/ReadingPages.tsx
apps/mobile/src/reader/components/SleepTimerControl.tsx
apps/mobile/src/reader/documentFind.test.ts
apps/mobile/src/reader/documentFind.ts
apps/mobile/src/reader/useReaderFind.ts
apps/mobile/src/settings/SettingsDetails.tsx
apps/mobile/src/storage/AccountDataProvider.tsx
apps/mobile/src/storage/accountDeletion.ts
apps/mobile/src/storage/libraryBackup.ts
apps/mobile/src/storage/libraryBackupModel.ts
apps/mobile/src/walkthrough/LearnVoticSettings.tsx
apps/mobile/tests/components/documentImport.component.test.tsx
apps/mobile/tests/components/listeningReadiness.component.test.tsx
apps/mobile/tests/components/noteDraftProtection.component.test.tsx
apps/mobile/tests/components/readerTools.component.test.tsx
apps/mobile/tests/components/scan.component.test.tsx
apps/mobile/tests/integration/libraryBackup.test.ts
apps/mobile/tests/integration/nativeActivitySync.test.tsx
apps/mobile/tests/integration/recoveryExperience.test.tsx
apps/mobile/tests/integration/rootLayout.test.tsx
apps/mobile/tests/renderWithProviders.tsx
code_checks/audit_2026_10_13.test.js
code_checks/document_file_tools.test.js
code_checks/import_accuracy.test.js
code_checks/pdf_page_furniture.test.js
code_checks/text_encoding_route.test.js
docs/finish-experience-audit-2026-10-21.md
votic_server.js
```
