# Votic internal-test readiness review — October 28, 2026

Reviewed branch: `claude/v1-internal-test`, starting at `44de5e29ccff6d3f86bfdb40a3a95f3e524ec8e2`. This review made code and draft-document changes only. No merge to main, server deployment, private settings changes, purchase or Play upload was performed.

## Findings and corrections

- Privacy: distinguish local/server imports, OCR, optional voice transcription, device speech-engine behavior, external unencrypted backups and provider retention. Describe 365-day feature/bug feedback retention separately from 30-day AI reports and optional diagnostic counts. Disclose retained deletion hashes, de-identified spending metadata and offline-device limitations. Remove an unverified promise about server backup expiry. Code evidence: `app_parts/feedback.js`, `app_parts/ai_usage.js`, `app_parts/account_deletion.js`, `apps/mobile/src/auth/authBackend.ts`, and `docs/LIBRARY_IMPORT_RELEASE_SAFEGUARDS.md`.
- Terms: preserve Georgia and `votic.support@gmail.com`, correct the blanket 24-hour Google Play cancellation statement and clarify uninstalling does not cancel billing. The documents remain drafts requiring the owner's review. This is a factual/code review, not a certification of legal compliance.
- Account deletion: keep the existing external request form. Its page returned HTTP 200, but no submission was made and email delivery/ownership verification were not tested.
- Reliability: format `apps/mobile/app.json` and split sample-player rendering and the better-voices notice out of ListeningStep. Existing playback/highlighting/component tests pass. Complexity baseline was not changed; regressions fell from one to zero.
- Deployment security: replace the NodeSource curl-to-root-shell installer with an explicit signed APT repository. Require lockfile installation and systemd unit validation instead of silently continuing after failures. Bash syntax and systemd unit validation pass locally; the installer was not run against the VM.
- First-build protection: require an explicit RevenueCat entitlement and reject Test Store, Apple and backend secret keys in the Android production SDK-key field. Play builds must use a `goog_` public SDK key. Added the missing backend-address field to the mobile environment example.
- Cost wording: the setup script no longer promises an always-free server. Eligible e2-micro/disk usage can fit Free Tier, but IPv4 and other resources can incur charges. The $20 AI setting is an application ledger safeguard, not a Google Cloud billing cap.

## Public server observations

Requests made to `https://136-72-31-77.sslip.io` during this review:

| Path | Observed status |
| --- | --- |
| `/healthz` | HTTP 502 |
| `/readyz` | HTTP 502 |
| `/privacy` | HTTP 502 |
| `/terms` | HTTP 502 |

These are observations from this environment's HTTPS/proxy route. They do not independently establish the origin service's exact state, certificate configuration, or failure cause. The owner/Claude handoff says the backend is waiting for two private keys. Confirm service logs and host state through the existing authenticated session; do not print key values.

## Required build settings

Remote Expo environment values were not accessible in this session. The following is the required configuration, not a claim that it has already been entered. No secret values are included here.

| Setting | Required value/source |
| --- | --- |
| Build profile / environment | Existing `production` AAB profile; Play internal testing still needs release safeguards |
| Android application ID | `com.votic.app` |
| EAS project | `9798a258-048f-45f1-b28a-92773d5039aa`, owner `votic-organization`; recorded in app.json |
| `EXPO_PUBLIC_FIREBASE_PROJECT_ID` | `votic-da5c4` |
| `EXPO_PUBLIC_FIREBASE_API_KEY` | Existing Firebase Web app public configuration; owner to enter/confirm |
| `EXPO_PUBLIC_FIREBASE_APP_ID` | Existing Firebase Web app configuration; owner to enter/confirm |
| `EXPO_PUBLIC_FIREBASE_AUTH_DOMAIN` | Copy the existing Firebase Web app configuration; verify Google sign-in configuration separately |
| `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY` | Google Play app public SDK key, beginning `goog_`; not Test Store or secret key |
| `EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID` | `premium` |
| `EXPO_PUBLIC_VOTIC_API_URL` | Candidate `https://136-72-31-77.sslip.io`; verify health and authenticated access first |
| `EXPO_PUBLIC_VOTIC_PRIVACY_URL` | Candidate backend address plus `/privacy`; review draft and verify HTTP 200 first |
| `EXPO_PUBLIC_VOTIC_TERMS_URL` | Candidate backend address plus `/terms`; review draft and verify HTTP 200 first |
| Google sign-in client ID | Needed if enabling Google sign-in; configure/verify the installed Play build and signing credentials |

The public Firebase Web API key and RevenueCat SDK key ship with the app. OpenAI and RevenueCat secret keys belong only on the backend. Google service-account JSON must never enter Expo public settings or the repository.

## Backend activation and end-to-end gates

1. In the existing private host session, enter the OpenAI and RevenueCat REST-v1-capable secret keys using the hidden prompt. Verify RevenueCat customer-read/delete access for account deletion. Do not create replacement infrastructure.
2. Deploy the reviewed revision to the VM before expecting the updated legal documents or scripts. Validate the service and Caddy configuration; verify the private ledger path, current estimated AI-budget value and disk persistence after restart.
3. Require HTTP 200 from health/readiness and both reviewed legal pages; verify a signed-out protected request is rejected. Health alone does not verify Firebase, OpenAI or RevenueCat.
4. Enter/verify the Expo settings above and build the AAB. Upload only to the existing internal-testing track. No release or main merge is authorized by this review.
5. Recheck the remaining RevenueCat package-name warning after the build is recognized by Play. Reuse/create the approved $9.99 monthly Play product and map it to `premium` and the monthly package; leave annual, trials and extra-credit products out of scope.
6. On the tester phone: Firebase account creation/sign-in/reset, document import, purchase, Plus access, 1,000-credit monthly allowance, a small AI request and accurate deduction, restart, restore, expiry/refund, feedback, and account deletion. Verify the same Firebase UID is used for RevenueCat identification.
7. Before production: establish server backup schedule/expiry and deletion reconciliation, verify the external deletion request reaches the operator, and review the final privacy disclosures against deployed configuration.

Google Play notifications reaching RevenueCat were reported tested by Claude; that is separate from RevenueCat-to-backend webhook delivery. Code currently enables the webhook only with the separately configured purchased-credit wallet. Monthly allowances are read from verified RevenueCat REST profiles, with a short cache. Do not enable extra-credit products just to activate that webhook. Verify renewal, expiry/refund and credit behavior on the subscription-only configuration.

## Validation

| Check | Local result |
| --- | --- |
| Backend suite | 304 passed, 0 failed |
| Mobile logic | 477 passed across 49 files |
| Mobile component/integration suite | 655 passed across 80 suites |
| Mobile lint, Prettier and TypeScript | Passed |
| Complexity | 3,838 functions, 35 existing hotspots, zero regressions; baseline unchanged |
| Root ESLint / existing HTML gate | Passed |
| Privacy, Terms and deletion-page HTML validation | Passed |
| Legal public routes and production configuration regressions | Passed in backend suite |
| Bash syntax / systemd unit validation | Passed; no VM installer execution |
| Semgrep auto rules | 525 rules, 599 tracked targets, zero findings; configured skips still apply |
| Backend production npm audit | Zero reported vulnerabilities |
| Mobile production npm audit | 16 low package findings; existing high/critical gate passes; not a zero-vulnerability claim |

No new native build, device acceptance, live provider call or live purchase was performed. New-head GitHub Actions status must be checked separately.

## Remaining security blocker

The latest pre-review GitHub OSV scan fails on **GHSA-gcqx-w48m-w2h4 / CVE-2026-93753**, deepmerge 4.3.1, inherited through Expo config tooling and Jest. The advisory lists affected versions 4.2.0–4.3.1 and no patched version. The earlier OSV run reports Medium while the updated GitHub advisory rates Low; do not treat severity differences as remediation.

This review does not suppress the finding, extend exceptions, downgrade the scanner or invent a patched version. Upstream remediation or an explicitly reviewed, scoped treatment is still needed. The overall quality/security workflow may remain red even after Semgrep and reliability fixes pass.

## Primary references

- [OpenAI API data controls](https://developers.openai.com/api/docs/guides/your-data)
- [Google Play cancellation](https://support.google.com/googleplay/answer/7018481)
- [RevenueCat SDK key configuration](https://revenuecat.github.io/codelabs/guides/configure-sdk.html)
- [deepmerge advisory](https://github.com/advisories/GHSA-gcqx-w48m-w2h4)
- [NodeSource repository setup](https://github.com/nodesource/distributions/blob/master/scripts/deb/setup_24.x)
- [Google Cloud external-IP pricing](https://cloud.google.com/vpc/network-pricing)
- [Google Cloud Free Tier](https://docs.cloud.google.com/free/docs/free-cloud-features)
