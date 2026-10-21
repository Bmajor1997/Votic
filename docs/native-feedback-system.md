# Native Votic feedback

## Branch and scope

Base: `fix/release-readiness-2026-10-20` at `83cf0ccd20067a1aa1a402e31be3eb8e123fdc50`.
Feature branch: `feature/native-feedback-system`.
The base is the most recent remote development tip inspected on October 21, 2026;
`feature/expressive-subscription-paywall` and `feature/owasp-nist-security-hardening`
are ancestors. It includes the expressive paywall, latest AI status animation,
NASA safety fixes, and release-readiness changes. `main` is not modified.

## Architecture

- Expo Router: Settings → Feedback → dedicated feature/bug forms. Regular users see
  exactly two choices. There is no public board, voting, feedback list, or administrator route in mobile.
- Firebase: reuse current Votic ID tokens through `auth_headers()` and the existing
  server verifier. A development/explore identity is insufficient. Feedback does
  not require a subscription or separate Firebase/RevenueCat account.
- Node HTTP server: `POST /api/feedback`, protected by verified Votic identity,
  existing account-deletion blocking, network/user rate limits, and validation.
- SQLite: reuse the same `VOTIC_AI_USAGE_DB` connection as the existing private
  ledger. No Firestore, external queue, new npm runtime dependency, or AI service.
- Admin web: `/admin/feedback` serves the login shell. Its static HTML/CSS/JS and
  public Firebase web configuration contain no feedback. Every data/mutation API
  requires both a valid Firebase ID token and membership in the server-side UID
  allowlist. Data responses and the shell use `Cache-Control: no-store`.

### API

All feedback APIs use POST with `Content-Type: application/json` and
`Authorization: Bearer <Firebase ID token>`; the optional existing app gateway key
still applies. Admin requests use the same authentication verifier as mobile.

| Endpoint | Authorization | Input / result |
| --- | --- | --- |
| `/api/feedback` | Authenticated, non-deleted Votic user | Validated submission → submission ID only |
| `/api/admin/feedback/list` | Provisioned administrator UID | `query`, zero-based `page` → totals, feature/bug groups, priority issues |
| `/api/admin/feedback/details` | Provisioned administrator UID | `id`, `page` → originals, status, possible matches |
| `/api/admin/feedback/mutate` | Provisioned administrator UID | `action`: `update`, `merge`, `separate` |

There is no regular-user read endpoint. Neither submitted `user_id`, `email`,
`isAdmin`, nor arbitrary profile fields can set ownership or privileges. Unknown
submission fields are rejected. IDs in administrative mutations are checked for
existence, category, and group membership, inside a transaction.

### Schema

| Table | Fields and invariants |
| --- | --- |
| `feedback_submissions` | UUID `id`; `request_id`; verified `user_id`; `group_id`; `category`; original trimmed `title`, `description`, `steps`, `expected`, `actual`; normalized full-payload `fingerprint`; UTC `created_at`, `updated_at`. Unique `(user_id, request_id)` for retry idempotency. |
| `feedback_groups` | UUID `id`; `category`; `status`; `severity`; `safety_flag`; UTC `created_at`, `updated_at`. Title derives from the earliest remaining original, with UUID as tie-breaker. |
| `feedback_rates` | `(user_id, day)` primary key, daily submission count. Survives restarts and is deleted with the account. |

Submission status is the group's status, returned through a join rather than
copied into every original. Unique-user counts are `COUNT(DISTINCT user_id)`, not
cached counters. Summary cards count original submissions, including distinct
submissions by one user; transport retries with the same request ID count once.

`BEGIN IMMEDIATE` serializes writes across processes sharing the same SQLite
file. Validation, duplicate selection, creation, daily quota, merge, and separation
are transactional. A five-second SQLite busy timeout is inherited from the ledger.
Different hosts must not maintain independent copies of this file: use the current
single-host private persistent-volume architecture. Moving to a distributed
backend would require a separately reviewed database migration.

## Grouping and ranking

- Normalize Unicode (NFKC) and whitespace. Feature matching also folds case and
  punctuation. Bug auto-matching preserves case and punctuation so different
  error messages and reproduction evidence are not silently conflated.
- Automatically group only identical full normalized payloads in the same category,
  including all optional bug fields. Preserve every original submission.
- If an exact fingerprint already spans multiple manually separated groups, do
  not guess which is correct: create a new reviewable group.
- Near matches use Jaccard overlap of text tokens with a minimum of three tokens
  and a 0.55 threshold. These are review hints only, never automatic merges.
  Candidate work is bounded to 20 source originals and 1,000 recent same-category
  submissions. Search lets the administrator find older/unrelated wording.
- Paraphrases such as “listen without Wi-Fi” and “offline reading” are **not**
  reliably matched semantically. Administrators merge them after inspecting the
  originals. Future semantic matching should evaluate a labeled Votic dataset,
  use a bounded shortlist, exclude identities, budget requests, defend against
  prompt injection, and retain administrator review for uncertain matches.
- Feature and bug lists sort independently by unique users descending, then group
  creation date ascending, then UUID ascending. Each category has 50 groups per
  page. Originals have 50 per page.
- Explicitly assessed critical issues and security/privacy/data-loss/blocking
  issues flagged by an administrator appear in a separate priority section
  regardless of search, page, or popularity until resolved. Severity is a human
  assessment; the system does not infer the severity of arbitrary free text.
  Unassessed bugs also stay in priority triage until severity is assessed, so a
  new critical issue cannot disappear solely because it has a low count.
- Merge preserves originals, recalculates unique users, retains the highest
  severity and safety flag, and reopens a resolved target if the source was
  unresolved. Separation moves 1–100 selected originals to a new group, copies
  severity/safety flags conservatively, and resets its status to New.

The dashboard displays two summary cards and both ranked sections together;
there is no Features/Bugs tab switcher. It supports search, original details,
reviewable merge confirmation, separation, issue status, resolution, and bug severity.

## Authentication and administrator provisioning

Keep the existing Firebase and RevenueCat setup. No provider, identity, project,
subscription entitlement, sign-in, account recovery, or deletion configuration
is changed by this feature.

Set backend environment variables locally or through the hosting secret/config
manager (never commit populated files):

```dotenv
FIREBASE_PROJECT_ID=<existing Votic Firebase project ID>
VOTIC_AI_USAGE_DB=<absolute path on a private persistent volume>
VOTIC_FEEDBACK_ADMIN_UIDS=<existing trusted administrator Firebase UID>
FIREBASE_WEB_API_KEY=<existing project's public Firebase Web API key>
```

Use the Firebase Console's Authentication users page to verify the administrator's
actual UID. Multiple explicitly trusted UIDs may be comma-separated. Empty means
no administrator access. Changing this allowlist requires an operator-controlled
backend restart. Browser-supplied claims or email addresses do not grant roles.

`FIREBASE_WEB_API_KEY` is a public project identifier, not a service-account key.
The administrator's existing email/password credentials are sent directly to
Firebase's documented `accounts:signInWithPassword` endpoint over HTTPS. They are
not sent to Votic's backend. This does not enable a provider or create an account.
The current Firebase provider configuration must already support that account.
Social-only administrators can provide a current ID token obtained from a trusted
existing Votic session. Do not send a token in chat or put it in a URL.

The dashboard does not retain refresh tokens or persist auth in localStorage,
cookies, or URLs. It signs out after at most one hour; expired tokens are always
rejected by the server. Refresh/reopen requires another sign-in. Sign out removes
loaded feedback from the DOM. This feature adds no authentication bypass for
local device testing. Automated test authorizers exist only in test fixtures.

If `VOTIC_CLIENT_KEYS` is already enabled, set
`VOTIC_FEEDBACK_WEB_CLIENT_KEY` to the corresponding **public app gateway
identifier**. It is served to the browser and must never be a private credential.
The gateway key is not administrator authorization.

Mobile routes remain protected by the existing signed-in Stack. A session-only
allowlisted destination can return a user to a feedback form after sign-in or
crash recovery. Draft content is not persisted and is cleared on an account
change. Existing personalization/subscription gates for the rest of Votic remain.

## Validation, abuse limits, and privacy

- Required title ≤120 characters; description ≤5,000. Bugs optionally include
  steps ≤3,000; expected and actual behavior ≤2,000 each.
- Reject malformed bodies, unknown properties, invalid categories, control
  characters, and client ownership/role assertions. All SQL is parameterized.
- 70KB JSON transport ceiling and the existing upload deadline.
- Ten accepted submissions per authenticated account per UTC day, transactionally
  enforced across workers/restarts. Retries with the same reference are idempotent.
- Per-window authenticated-user/network limits also apply; current global request
  limits remain in force. Up to 50,000 retained submissions; reject new submissions
  explicitly when full. Operators should monitor the private ledger's disk usage.
- No AI is used. Feedback text is data, never instructions. The admin UI constructs
  DOM nodes with `textContent`; it never uses HTML interpolation for submissions.
- Restrictive CSP, same-origin bearer-token APIs, no CORS opening, no cookies or
  ambient administrator authority, frame blocking, and no-store responses.
- Backend errors never log original feedback text or credentials. Error messages
  expose safe validation/authorization failures, not SQL or provider internals.
- SQLite uses `secure_delete=ON`; the private ledger file is POSIX mode 0600, and newly
  created parent directories are mode 0700. Use host access controls, encrypted
  storage, and existing private backups; never place the ledger in a web asset path.

### Retention and deletion

Feedback is retained for at most 365 days in the active ledger. Pruning runs on
startup and the existing hourly retention timer; up to one hour's pruning delay
is possible while the server runs. There is no permanent anonymous aggregate.
Expired originals and orphaned groups are removed and counts recalculate.

The existing account-deletion transaction removes the user's submissions and
quota identifiers immediately when deletion begins, before external billing
cleanup. Group titles derive from remaining originals, so deleted users' wording
is not retained as copied metadata. Empty groups disappear. Existing deletion
revocation tombstones still block stale-token submissions. The current RevenueCat
and Firebase deletion process is preserved, including idempotent retries and
external deletion requests using the private operator tool.

Pre-existing backups and logs are outside active-database deletion. Before
release, document and enforce restricted backup access, a bounded backup retention
period, and restoration procedures that reapply deletion requests before serving
traffic. Backups may contain self-disclosed personal content: do not claim
immediate erasure of historical snapshots. No historical UserJot feedback was
read, exported, migrated, or deleted by this implementation.

**Privacy policy update needed before release:** describe private feedback content,
Votic UID association, administrator access, purpose, 365-day active retention,
account deletion, backup retention, and the warning against submitting sensitive
information. No formal OWASP/NIST/NASA compliance claim is made. Tests provide
specific evidence for selected controls, not certification.

## Local Android testing and deployment

1. Use Node 24. Install root and mobile packages with `npm ci --ignore-scripts`.
2. Create ignored `.env.backend.local` from the root `.env.example`; reuse the
   existing Firebase project ID, set a private persistent ledger path and the
   administrator UID. Preserve existing RevenueCat and AI values. Backend feedback
   itself needs neither an AI key nor a paid subscription.
3. Start the backend from the repository root:

   ```sh
   node --env-file=.env.backend.local votic_server.js
   ```

4. Preserve mobile Firebase settings. In the existing ignored mobile env file,
   point `EXPO_PUBLIC_VOTIC_API_URL` to the same running backend:
   Android emulator `http://10.0.2.2:4173`; physical Android device
   `http://<computer-LAN-IP>:4173` on the same network. Allow the development
   port through the host firewall. Production builds require an HTTPS URL.
5. From `apps/mobile`, run `npm run android` with the existing Android SDK/emulator
   setup, or load the existing development build using `npm start`. Existing native
   Google sign-in requires a native Votic build rather than Expo Go.
6. Sign in with a real Votic account, open Settings → Feedback, and submit each
   form. Reopen the dashboard at `http://localhost:4173/admin/feedback` on your
   computer; sign in with the allowlisted existing administrator. Confirm totals,
   originals, merge/separate, safety flags, status, and unique-user counts.
7. Try a second Votic account and repeat the same request. Verify +2, then repeat
   under the first account and verify it stays +2. A regular account must get 403
   for administrator APIs. Test light/dark, large system fonts, TalkBack, keyboard
   visibility, reduced motion, bad network, retry, and account deletion.

For beta testers on other networks, host this existing Node backend on an
always-running HTTPS service with a persistent private volume. A server running
only in a local PowerShell terminal is not remotely available to testers.

**Deployment is not performed or authorized by these code changes.** On an
approved deployment, back up the private ledger before starting the updated
backend: its startup creates the three feedback tables and indexes additively.
This is a production schema change and requires the user's explicit approval
before deployment. No Firebase rules, remote configuration, production schema,
provider, or credentials were deployed here. Firestore rules are inapplicable:
there is no client database connection. Authorization happens at every Node API.

## Verification commands

```sh
npm test
npm run lint
npm run test:browser
node security/code-metrics.cjs
cd apps/mobile
npm run typecheck
npm run lint
npm run format:check
npm run test:reliability
npm run test:components -- --runInBand
npx expo export --platform android --output-dir /tmp/votic-feedback-export
```

Browser tests need Playwright Chromium (`npx playwright install --with-deps chromium`).
The existing CI workflows cover full Android release/APK/AAB/lint and iOS simulator
builds after a push. A Metro/Hermes export checks JavaScript bundling, not native
compilation or an actual Android device interaction.

Firebase REST reference: https://firebase.google.com/docs/reference/rest/auth#section-sign-in-email-password
