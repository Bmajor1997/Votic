# Library, imports and release safeguards

This work is based on `fix/android-v1-audit-followups` (`ba54a00`) and belongs on a review branch. Deploy the backend before distributing an app that imports HEIC/HEIF or sends optional diagnostic counters. No change here configures a live Firebase/RevenueCat account or merges into main.

## Library backup and restore

Account & Membership → Library backup & restore remains available to signed-in people without an active subscription. Save the generated JSON file to Files, a trusted cloud provider, or another device. The file is **not encrypted**. It contains readable document text, notes and saved passages, collections, progress, activity, pronunciation entries and account reading preferences. Original PDF, image and Office files, sign-in credentials, subscriptions, device appearance/accessibility choices, onboarding and walkthrough state are excluded. A canceled share sheet does not mean a backup was saved: verify the file in the chosen destination.

Pick a file, review its date and document/note counts, then confirm restore into the currently signed-in account. Existing documents are kept; an incoming document with the same ID but different content/metadata becomes a stable copy. Current pronunciation entries take precedence. Reading preferences are kept by default; choose **Use reading preferences from this backup** to replace them. Activity merges use maximum overlapping values rather than adding repeated restores. Restart after restore to apply imported account preferences. This is a portable backup, not automatic cloud sync.

The v1 importer rejects unsupported versions, unsafe object keys, invalid values, duplicate document/note IDs and backups above 25 MB. Individual storage values are bounded for Android. Unreadable local documents prevent export rather than silently producing an incomplete backup. Very large libraries or note metadata may exceed this first version's safe limits and produce an explicit error.

Backup/restore pauses narration and temporarily unmounts library consumers, waits for their final saves, then takes a snapshot. Restore writes account-scoped staging data, commits a journal, and writes document metadata last. An interrupted committed restore replays before any library is displayed at startup. A failed replay keeps libraries hidden with Retry. Existing deletion intent takes precedence; staged restores must not resurrect a deleting account. There is no automatic rollback after a committed journal: retry completes the validated merge.

Verify export to a different device/account, conflict copies, repeated restore, insufficient storage, app termination during writes, backgrounding, and account deletion. Deleting an account cannot erase backup files a user previously saved outside Votic.

## HEIC/HEIF

The file picker, supported-type validation and Android share filters include HEIC/HEIF. The private backend validates a supported HEIF container signature, decodes in a bounded worker, checks dimensions before RGBA allocation, converts to PNG, then uses the existing OCR accounting path. Limits: 12 MB input, 20 megapixels, 12 MB converted PNG, a 10-second conversion timeout, and the existing overall server deadline/concurrency limit. Multi-image containers are rejected instead of silently selecting one page. No secret belongs in the mobile bundle. Real provider OCR and device orientation/phone-camera samples still need acceptance testing.

## Native and browser CI

The Android workflow now triggers for all mobile files and builds playback, widgets, a complete release APK and an AAB with bundled JavaScript. It launches the APK in an emulator, checks that Welcome renders, the process remains alive, and both widget receivers are packaged. CI artifacts use the generated project's CI/debug signing setup and empty service configuration; **they are not a store-ready signed production release**. Release signing, real store/Firebase settings, production configuration validation and physical-device tests remain separate.

iOS CI generates the full app and widget target, installs Pods, and compiles a simulator Release without signing. This catches native integration failures; it does not establish Apple account/purchase/deletion readiness or real-device playback. Browser CI installs Chromium and runs the existing seven Playwright cases. Microsoft Edge can still be selected locally with `VOTIC_BROWSER_CHANNEL=msedge`.

Route-access tests enumerate filesystem screens, read their actual guards and execute the installed Expo Router's automatic inclusion/filtering algorithm. This supplements component tests whose router mock only tracks declared screens. Every new filesystem screen must be explicitly classified.

## Privacy-safe diagnostics

Account & Membership offers **Share failure counts**, disabled by default. Opted-in clients retain a bounded, account-scoped count of screen-render failures for at most a day and submit it while signed in. No error message, stack trace, document, note, audio, screen name or purchase data is sent. Turning the choice off clears pending counts. The server aggregates only calendar day, event code and a capped count, retaining up to 30 days. Update the published privacy policy to describe this optional processing before enabling it in a distributed build.

This catches React screen error-boundary failures; it does **not** capture OS/native process crashes, ANRs, or detailed crash stacks. Production native crash reporting still needs a configured provider and device verification. No vendor or paid monitoring account was provisioned by this change.

## Backend operations

- `GET /healthz` reports process liveness. `GET /readyz` checks ledger connectivity; neither reveals keys, customer data or private statistics. Readiness is not a live Firebase/OpenAI/RevenueCat purchase test.
- `node security/ops-check.js` reads the private ledger and prints aggregate budget, report-storage, backlog, diagnostic-count and database-size information. It exits nonzero for defined alert thresholds. Run hourly in the private hosting environment and connect its exit status/output to the host's alerting destination. Do not place production secrets in GitHub Actions to run this local-host check.
- `node security/review-ai-reports.js` reviews **open reports oldest first**. Use its `next_cursor` with `--after=CURSOR`; add `--status=all` or `--status=reviewed` for other queues. Existing `--resolve=ID` and explicit `--include-content` remain supported. Metadata is the default; avoid sharing content-bearing logs. A page cursor is a continuation, not an access token.
- Global report caps default to 10,000 rows and 50 MB of answer content. Set `VOTIC_REPORT_MAX_ROWS`/`VOTIC_REPORT_MAX_BYTES` to suitable positive limits. At capacity, submissions fail explicitly; old evidence is not silently discarded to admit new reports. Metadata/database overhead needs additional disk headroom. Retention runs on startup/hourly as in the preceding branch.
- The npm dependency gate reads IDs and expiration dates from `osv-scanner.toml`; exceptions stop applying at 00:00 UTC on their expiry date. The OSV and npm policies share the same file. Review advisories before expiry rather than extending them automatically.

## Consistent ledger backup and restore drill

On the private backend host, use Node 24 or newer. Keep snapshot directories private and outside public assets, with sufficient disk space. The SQLite backup API produces a consistent snapshot of an active ledger; do not copy a live `.sqlite` file with a filesystem copy command and assume WAL state is captured.

```
node security/ledger-snapshot.js backup /private/live/ai-usage.sqlite /private/backups/ledger-YYYY-MM-DD.sqlite
node security/ledger-snapshot.js verify /private/backups/ledger-YYYY-MM-DD.sqlite
node security/ledger-snapshot.js restore /private/backups/ledger-YYYY-MM-DD.sqlite /private/drill/restored.sqlite --backend-stopped
```

The tool requires a new destination, creates it with mode 0600, runs integrity/schema checks, and never overwrites an existing database. The restore flag is an operator acknowledgement, not a mechanism that stops a service. For a real recovery: stop the backend, preserve the current database and its WAL/SHM together in a private recovery directory, restore to a new path, verify it, point `VOTIC_AI_USAGE_DB` at that path, start one backend instance, check readiness, and exercise a dedicated test account. Keep the old copy until validation succeeds; rollback by stopping the service and returning to the preserved database. Do not run two independent production ledgers.

Schedule daily snapshots, a regular isolated restore drill, disk checks, and backup expiry on the hosting platform. Establish backup retention and deletion handling before production: snapshots can contain reported answers and older personal records, and restoring an old snapshot can reintroduce records deleted since that snapshot. Reconcile completed account-deletion requests and spending since the snapshot **before** opening recovered service to users. These host schedules, alert destinations, encryption at rest and off-site storage require deployment configuration and are not activated by committing scripts.

## Review and rollout

Run root tests/lint, mobile Vitest/Jest/typecheck/lint/format, dependency scans, native CI and browser CI. Review the branch against the preceding audit branch so the new work is distinct from pending account-deletion changes. Deploy backend, verify health/readiness and ops tools on a staging ledger, then distribute a new native build. The added MIME filters require a rebuilt native app. Do not label a release verified until the new full-build workflows and installed-device checks succeed.
