# Votic code and security audit — 2026-10-09

Baseline: `aa91a61ab2c12c983fc935fcabdb3e01fe2bf3c5`, verified as the current head of `feature/note-workspace` before editing. No merge to main.

## Method and limits

Manual source review through GitHub, including Home, Statistics, Account Settings/Firebase auth, Note Workspace, document storage, Reader navigation/playback, Ask Votic voice and answer reveals, mobile API requests, server authentication, document parsing, webpage imports, AI accounting, and CI workflows. Findings below are established from source; new regression tests exercise their triggers in CI. This session has no local execution environment, emulator, device or deployment credentials. Runtime/scanner results must be read from GitHub Actions; this report is not a certification that the repository has no vulnerabilities.

No exposed credential was identified in reviewed files. Firebase public configuration and client identifiers are not server credentials. The existing narrowly scoped Gitleaks exception was not expanded. Full secret/history and dependency scanning still require successful scanner runs.

## Confirmed findings and remediation

| ID / severity | Affected files | Evidence / reproduction | User impact | Fix |
| --- | --- | --- | --- | --- |
| R1 — Medium | apps/mobile/app/reader.tsx | Open Read and expand More: Switch to listening was offered. Open with mode=read and autoplay=1: local initial mode became Listen. A reused route retained local mode. | Unexpected TTS and wrong controls. | Derive mode from navigation; explicit Read wins. Remove Read's Listen entry. Stop/invalidate narration and previews on Read entry; guard playback starts and late callbacks. Saved position remains intact. |
| R2 — Medium | apps/mobile/app/(tabs)/index.tsx | Equal-width actions constrained long labels with shrink/wrapping; labels were Resume/Listen/Read rather than complete Continue labels. | Split words and unclear actions at narrow widths. | Complete Continue Listening/Reading labels, Listening first, proportional widths and compact 14-point labels only on narrow phones. Keep 50-point targets and font scaling; stack for large text or measured wrapping, without truncation. Native typography still needs device verification. |
| S1 — High | app_parts/web_import.js; votic_server.js | Validation resolved DNS, then fetch independently resolved again; mapped IPv4 IPv6 addresses such as ::ffff:127.0.0.1 bypassed privateIp. | Potential SSRF into private network services. | Reject non-public/mapped addresses and pin the actual HTTP(S) connection to a validated address, retaining the original Host/TLS hostname. Revalidate redirects. Server uses this protected transport, separate from injected AI fetch. |
| S2 — Medium | app_parts/web_import.js; votic_server.js | Timeout was cleared after headers; response.text() buffered everything before checking 2 MB. A never-ending body or absent/false Content-Length bypassed practical limits. Raw network exceptions reached clients. | Memory exhaustion, hung imports, internal transport details exposed. | Stream with a running byte cap, race the complete body operation against a deadline, abort/cancel on all exits and redirects; return only curated import errors. Request identity encoding and reject unexpected compressed bodies. |
| S3 — Medium | votic_server.js | Send a partial PDF upload, then another request before finishing the first. Both passed the concurrency check because reservation occurred after read_body. | Processing capacity could be exceeded. | Reserve before reading body; release in finally on success, malformed input, timeout or failure. Preserve HTTP validation status codes. |
| D1 — High (data integrity) | apps/mobile/src/documents/documentStorage.ts | Delay getAllKeys during load. loadDocuments previously returned before snapshot-based orphan deletion completed; a later import/save could create a key absent from that snapshot. | A newly imported document's text could be removed. | Await orphan cleanup before publishing loaded documents; existing unavailable-document preservation remains unchanged. |
| A1 — Medium | apps/mobile/src/api/voticApi.ts | A token refresh that never settles or a response whose headers arrive but body never settles outlived the advertised timeout. | Thinking/transcribing/import UI could remain busy indefinitely. | Race token refresh, fetch and JSON body parsing together against the deadline; abort and prevent requests after a late token arrives. |
| A2 — Medium | apps/mobile/app/assistant.tsx; apps/mobile/src/components/KeyboardDictationButton.tsx | Begin transcription, change document/notes context in the mounted Ask screen, then resolve the previous transcript. The old recorder could update the new question. | Wrong-context text or a stuck recording UI. | Remount the recorder by context key, reset composer voice state, ignore unmounted work, and avoid an old transcription resetting the audio mode after a new recording starts. Preserve waveform, expo-audio, editable transcript and reveals. |
| C1 — Medium (verification) | .github/workflows/security-checks.yml; .github/workflows/reliability-edge-cases.yml | Failed Expo/dependency steps prevented later scanners/checks from running. Generated npm report excluded high/critical entries. | Missing checks and misleading partial reports. | Run independent scanners after earlier failures; continue remaining validation checks unless cancelled. Include all npm advisory severities. No assertions, security thresholds or exceptions weakened. |

All listed defects were present before this audit. A2 affects the voice flow introduced in today's recording work; R1/R2 affect the existing Reader/Home implementation. The source history of the server/storage/API defects was not exhaustively attributed, so they are baseline defects rather than claimed regressions from today's changes.

## Existing dependency/configuration findings — unresolved

Earlier Actions identified these independently of this patch. Verify their current status in the new runs:

- Critical: shell-quote 1.10.0, GHSA-pqg4-j6r4-53mv; earlier scanner indicated 1.11.0 as the fix.
- High: source-map-js 1.2.1, GHSA-68fv-2mgg-jv7q; earlier scanner indicated 1.2.2 as the fix.
- Moderate: sprintf-js 1.0.3, GHSA-hp3w-g68c-fv3c; earlier scanner reported no patched version.
- Expo compatibility: expo, expo-constants, expo-linking and expo-router patch mismatches in earlier runs.
- Existing documented unpatched braces/node-forge advisories and their narrow existing exceptions remain unchanged.

These require a package-manager environment to resolve and regenerate both lockfiles safely, then verify Expo compatibility, package provenance and advisories. No blanket upgrades, npm audit fix --force or hand-invented lockfile integrity values were used. These remain open even if behavior tests pass.

## Suspected issues / follow-up, not established regressions

- Persistent metadata validates only a subset of optional document/note fields. A manually corrupted savedPassages/tags object could break consumers; a compatibility-aware schema/recovery pass should be tested with real legacy libraries before tightening it.
- Activity writes recover their dirty flag after storage errors but do not show a persistence warning. Device storage-failure testing is needed to assess observable statistics loss.
- Account deletion correctly calls Firebase deleteUser and handles recent-login requirements. It preserves device documents/notes and does not cancel store subscriptions. Server AI usage ledger retention and subscription/account policy need deployment/product review; this patch does not erase billing/security accounting.
- Native speech cancellation, audio session handoff, VoiceOver/TalkBack, actual text wrapping at 320–430 points, huge accessibility text, Reduce Motion, real webpage TLS/DNS connections and deployed Firebase authorization require device/deployment validation.

## Regression coverage

Reader: no audio option in Read, explicit Read versus stale autoplay, playback stopped on reused route and late callback ignored; existing saved-position/listening tests retained.
Home: correct Continue navigation through existing integration assertions, label/order/touch/font-scale assertions, normal widths, large-text fallback and native wrapping fallback.
Storage: delayed cleanup cannot finish after exposing a saveable library.
Server/import: upload capacity reserved before body completion and released after rejection; mapped/private address rejection, connection pinning, streamed byte cap, stalled-body timeout, redirect cancellation and sanitized network errors.
API/voice: stalled token/body timeouts, recovery, no late authenticated request and no transcript applied after context changes.
Existing Statistics, Notes, Account, recording/shimmer/Reduce Motion suites remain in place.

GitHub Actions results and remaining failures are summarized in the delivery message.
