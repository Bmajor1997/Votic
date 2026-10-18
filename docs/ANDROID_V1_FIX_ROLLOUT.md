# Android V1 audit follow-ups

Deploy the backend before distributing the updated Android app. Existing accounts need a recent sign-in (within five minutes) to delete an account. The app checks server configuration before erasing local data; an interrupted deletion stays blocked and can be retried after restarting or signing back in. Partial deletion cannot restore already-erased data.

## Backend prerequisites and rollout

- Back up and migrate the persistent `VOTIC_AI_USAGE_DB` using the normal deployment procedure. Do not use an ephemeral database in production. Startup creates the deletion table; multiple instances must use the same supported database deployment, not independent copies.
- Configure `REVENUECAT_SECRET_API_KEY` with permission to delete customers as well as read entitlements. Verify deletion against a dedicated test customer. Neither this secret nor a Firebase administrative credential belongs in the app.
- Deploy `POST /api/delete-account`, `POST /api/account-status` and the public `/delete-account` page. Confirm the public page is reachable without authentication and use its actual deployed HTTPS URL for the Play Console deletion link.
- Confirm an actual email/password and Google account can complete deletion: Firebase login disappears, RevenueCat customer is deleted, local documents/notes/preferences and widgets are cleared, and unrelated accounts remain intact. Test vendor failure, network loss, app termination and retry. Automated tests use fake vendors, not live Firebase or RevenueCat.

The in-app flow deletes backend data and the RevenueCat customer before deleting the Firebase credential through Firebase's authenticated client SDK. Pending intent survives app restarts; late local writes and backend requests cannot recreate deleted data. Updated clients detect a deleted account on startup/foreground and authenticated API calls. Offline devices cannot be remotely wiped; older app versions need updating. A RevenueCat customer deletion does not cancel a Google Play or Apple subscription; the confirmation and public page explain store cancellation separately.

The backend removes that account's AI reports and de-identifies cost records, including provider request IDs. Anonymous cost records are retained for at most 90 days and pruned on startup and hourly; reports expire after 30 days. A SHA-256 UID revocation marker remains to reject old signed tokens. Include this limited retention, provider processing and your actual backup expiry policy in the published privacy policy and Data safety responses. Confirm vendor-side retention separately. Existing backups require their own deletion/expiry process; SQLite row removal is not a guarantee of physical erasure from backups or storage media.

For a verified request made outside the app, run `node security/delete-account-data.js --uid=VERIFIED_FIREBASE_UID --confirmed-owner` on the private backend host with its production environment. This only removes backend/vendor data. Then delete the same verified identity in Firebase Console and confirm completion to the requester. Establish and monitor the support process; the repository cannot verify inbox handling or ownership checks. Never ask for passwords or tokens.

## Android build

`apps/mobile/eas.json` defines an internal preview APK and a production AAB. Set the actual EAS project ID (`EAS_PROJECT_ID` or `extra.eas.projectId`), Firebase public settings, RevenueCat Android public key, production API URL, Terms URL and Privacy URL in the production build environment. Production config now fails for missing required values and obvious local/private URLs. This validates configuration shape, not service availability or ownership.

A new Android build is required for the added share MIME types and this combined release. Public environment variables are compiled into the app. Backend changes and the public deletion page require backend deployment. No OTA release channel has been configured or verified by this change. Confirm signing, package ownership, version code, Play billing, pending/refunded purchases, policy disclosures and current Play requirements in the release process.

## Other behavior changes and limits

- Every image-bearing PDF now uses the existing whole-document OCR path, including small image regions beside substantial selectable text. This closes silent omission of scanned regions, but logos/illustrations can also trigger OCR. Existing size, Premium and AI-budget limits apply; unsupported/oversized OCR must show an explicit failure rather than returning incomplete text. Verify representative documents against their originals.
- Import jobs cancel when leaving the screen or backgrounding, ignore late results, and remove app-owned temporary files. Imported documents wait for persistent storage before navigation. Camera OCR retains completed page results during a retry on the same screen.
- Pronunciations are stored per account. A legacy dictionary migrates only with known ownership; unknown legacy data is not silently assigned to the next account.
- Welcome animations cannot redirect after choosing a competing destination. Reader page offsets use a linear pass. Membership checks and plan loading have bounded waits with recovery messages; an opaque native SDK task may still finish later, and purchases are never automatically retried or granted.
- Settings exposes configured legal links. A privacy-safe app error screen offers retry. No crash telemetry vendor or production alert routing has been configured; decide and verify these before depending on unattended diagnostics.
- Statistics explicitly describe foreground-only listening measurement. Native background playback still needs physical-device verification.

Accepted dependency advisory exceptions remain in the existing security policy; no unverified dependency upgrade is included. This change does not declare the app release-ready. Full signed AAB installation, physical-device lifecycle tests, deployed service checks, Play Console settings, legal review and support/report triage remain release checks.
