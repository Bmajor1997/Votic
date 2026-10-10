# Votic code and security audit — 2026-10-09

Baseline: `aa91a61ab2c12c983fc935fcabdb3e01fe2bf3c5`, verified as the current head of `feature/note-workspace` before editing. No merge to main.

## Method and limits

Manual source review through GitHub, including Home, Statistics, Account Settings/Firebase auth, Note Workspace, document storage, Reader navigation/playback, Ask Votic voice and answer reveals, mobile API requests, server authentication, document parsing, webpage imports, AI accounting, and CI workflows. Findings below are established from source; new regression tests exercise their triggers in CI. The execution environment was initially unavailable and became available during completion. Tests, lint, formatting, type-checks, Expo compatibility and npm audits were then run locally. No emulator, physical device or deployment credentials are available. CodeQL, Semgrep, Gitleaks and OSV results are checked in GitHub Actions; this report is not a certification that the repository has no vulnerabilities.

No exposed credential was identified in reviewed files. Firebase public configuration and client identifiers are not server credentials. The existing narrowly scoped Gitleaks exception was not expanded. Full secret/history and dependency scanning still require successful scanner runs.

## Confirmed findings and remediation

| ID / severity | Affected files | Evidence / reproduction | User impact | Fix |
| --- | --- | --- | --- | --- |
| R1 — Medium | apps/mobile/app/reader.tsx | Open Read and expand More: Switch to listening was offered. Open with mode=read and autoplay=1: local initial mode became Listen. A reused route retained local mode. | Unexpected TTS and wrong controls. | Derive mode from navigation; explicit Read wins. Remove Read's Listen entry. Stop/invalidate narration and previews on Read entry; guard playback starts and late callbacks. Saved position remains intact. |
| R2 — Medium | apps/mobile/app/(tabs)/index.tsx | Equal-width actions constrained long labels with shrink/wrapping; labels were Resume/Listen/Read rather than complete Continue labels. | Split words and unclear actions at narrow widths. | Complete Continue Listening/Reading labels, Listening first, proportional widths and compact 14-point labels only on narrow phones. Keep 50-point targets and font scaling; stack for large text or measured wrapping, without truncation. Native typography still needs device verification. |
| S1 — High | app_parts/web_import.js; votic_server.js | Validation resolved DNS, then fetch independently resolved again; mapped IPv4 IPv6 addresses such as ::ffff:127.0.0.1 bypassed privateIp. | Potential SSRF into private network services. | Reject non-public/mapped addresses and pin the actual HTTP(S) connection to a validated address, retaining the original Host/TLS hostname. Revalidate redirects. Server uses this protected transport, separate from injected AI fetch. |
| S2 — Medium | app_parts/web_import.js; votic_server.js | Timeout was cleared after headers; response.text() buffered everything before checking 2 MB. A never-ending body or absent/false Content-Length bypassed practical limits. Raw network exceptions reached clients. | Memory exhaustion, hung imports, internal transport details exposed. | Stream with a running byte cap, race the complete body operation against a deadline, abort/cancel on all exits and redirects; return only curated import errors. Request identity encoding; preserve gzip/deflate/Brotli responses through bounded streaming decompression, including cancellation cleanup. |
| S3 — Medium | votic_server.js | Send a partial PDF upload, then another request before finishing the first. Both passed the concurrency check because reservation occurred after read_body. | Processing capacity could be exceeded. | Reserve before reading body; release in finally on success, malformed input, timeout or failure. Preserve HTTP validation status codes. |
| D1 — High (data integrity) | apps/mobile/src/documents/documentStorage.ts | Delay getAllKeys during load. loadDocuments previously returned before snapshot-based orphan deletion completed; a later import/save could create a key absent from that snapshot. | A newly imported document's text could be removed. | Await orphan cleanup before publishing loaded documents; existing unavailable-document preservation remains unchanged. |
| A1 — Medium | apps/mobile/src/api/voticApi.ts | A token refresh that never settles or a response whose headers arrive but body never settles outlived the advertised timeout. | Thinking/transcribing/import UI could remain busy indefinitely. | Race token refresh, fetch and JSON body parsing together against the deadline; abort and prevent requests after a late token arrives. |
| A2 — Medium | apps/mobile/app/assistant.tsx; apps/mobile/src/components/KeyboardDictationButton.tsx | Begin transcription, change document/notes context in the mounted Ask screen, then resolve the previous transcript. The old recorder could update the new question. | Wrong-context text or a stuck recording UI. | Remount the recorder by context key, reset composer voice state, ignore unmounted work, and avoid an old transcription resetting the audio mode after a new recording starts. Preserve waveform, expo-audio, editable transcript and reveals. |
| C1 — Medium (verification) | .github/workflows/security-checks.yml; .github/workflows/reliability-edge-cases.yml | Failed Expo/dependency steps prevented later scanners/checks from running. Generated npm report excluded high/critical entries. | Missing checks and misleading partial reports. | Run independent scanners after earlier failures; continue remaining validation checks unless cancelled. Include all npm advisory severities. The web Semgrep command now uses --error so findings fail the job rather than remaining informational. No assertions, security thresholds or exceptions weakened. |

All listed defects were present before this audit. A2 affects the voice flow introduced in today's recording work; R1/R2 affect the existing Reader/Home implementation. The source history of the server/storage/API defects was not exhaustively attributed, so they are baseline defects rather than claimed regressions from today's changes.

## Dependency/configuration findings

Confirmed independently by Actions before this patch:

- **Fixed — Critical:** shell-quote 1.10.0, GHSA-pqg4-j6r4-53mv; pinned to 1.11.0 through a targeted mobile override.
- **Fixed — High:** source-map-js 1.2.1, GHSA-68fv-2mgg-jv7q; pinned to 1.2.2 through a targeted mobile override.
- **Fixed — Expo compatibility:** expo 57.0.27, expo-constants 57.0.21, expo-linking 57.0.12 and expo-router 57.0.25. Their required transitive packages were resolved by npm; expo-audio is unchanged. `expo install --check` now passes.
- **Open — Moderate:** sprintf-js 1.0.3, GHSA-hp3w-g68c-fv3c. OSV reports no patched version. It occurs in both lockfiles; root npm audit traces it through Mammoth/argparse. npm suggests a breaking Mammoth downgrade to 0.3.29, which would endanger the existing document parser and was not applied.
- **Open — existing exceptions:** documented unpatched braces/node-forge advisories remain subject to their narrow, existing exceptions. No exceptions were added or expanded.
- **Open — peer compatibility warnings:** npm reports existing test-renderer/react-reconciler versus React 19.2.3 warnings, and optional react-native-worklets 0.13.0 versus Expo module compatibility warnings. Automated checks do not establish native compatibility for these; this patch does not force unrelated React/animation upgrades or downgrades.

The package manager regenerated the mobile lockfile; no invented integrity values, blanket upgrades or `npm audit fix --force` were used. CI can remain red for the unpatched sprintf-js advisory even when functional checks pass. The mobile production npm audit still reports 46 high and 5 moderate aggregate findings; their leaf advisories are the existing braces/node-forge exceptions and sprintf-js. These are not 51 separate new defects.

## Suspected issues / follow-up, not established regressions

- Persistent metadata validates only a subset of optional document/note fields. A manually corrupted savedPassages/tags object could break consumers; a compatibility-aware schema/recovery pass should be tested with real legacy libraries before tightening it.
- Activity writes recover their dirty flag after storage errors but do not show a persistence warning. Device storage-failure testing is needed to assess observable statistics loss.
- Account deletion correctly calls Firebase deleteUser and handles recent-login requirements. It preserves device documents/notes and does not cancel store subscriptions. Server AI usage ledger retention and subscription/account policy need deployment/product review; this patch does not erase billing/security accounting.
- Native speech cancellation, audio session handoff, VoiceOver/TalkBack, actual text wrapping at 320–430 points, huge accessibility text, Reduce Motion, real webpage TLS/DNS connections and deployed Firebase authorization require device/deployment validation.

## Additional confirmed CI finding

**C2 — Medium (verification), fixed:** the mobile audit gate classified a parent package by its aggregate high severity but treated *all* leaf advisories as high/critical, including moderate sprintf-js. Reproduce using one allowed high advisory plus one moderate advisory beneath a high-severity parent: the old gate falsely rejected it. The gate now classifies leaf severity, retains the exact existing exceptions, still blocks new high/critical advisories, and fails closed if audit output/severity details are missing. Behavioral tests cover mixed severity, indirect/cyclic dependency paths, unexpected high/critical findings and invalid reports. OSV still reports the open moderate advisory; no meaningful security failure was suppressed.

## Additional supply-chain finding

**C3 — Medium, fixed:** Semgrep reported 15 mutable Action tag references in the three workflows. An upstream tag can be repointed, changing CI code without a repository change. All references are now pinned to full verified commit SHAs, with version comments. Existing Action version lines are preserved (dependency-review-action resolves its explicit v5.0.0 release; its floating v5 alias was unavailable). No scanner exceptions were added. References were verified through upstream GitHub refs and git ls-remote.

## Regression coverage

Reader: no audio option in Read, explicit Read versus stale autoplay, playback stopped on reused route and late callback ignored; existing saved-position/listening tests retained.
Home: correct Continue navigation through existing integration assertions, label/order/touch/font-scale assertions, normal widths, large-text fallback and native wrapping fallback.
Storage: delayed cleanup cannot finish after exposing a saveable library.
Server/import: upload capacity reserved before body completion and released after rejection; mapped/private address rejection, connection pinning, streamed byte cap, stalled-body timeout, redirect cancellation and sanitized network errors.
API/voice: stalled token/body timeouts, recovery, no late authenticated request and no transcript applied after context changes.
Existing Statistics, Notes, Account, recording/shimmer/Reduce Motion suites remain in place.

Local validation: 106 server tests and 162 Vitest reliability tests passed; root JavaScript/HTML/CSS quality checks passed; Expo dependency compatibility passed. All 227 mobile component tests passed in GitHub Actions; mobile lint, formatting, type-checking and Expo configuration/compatibility passed. An initial concurrent local run had one test timeout; its unchanged Reader suite passed on isolated rerun (25 tests). Scanner results are summarized in the delivery message.

The temporary workflow proposed during the initial environment outage was never published. GitHub Actions results and remaining failures are summarized in the delivery message.
