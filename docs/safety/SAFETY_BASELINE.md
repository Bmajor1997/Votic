# Votic software assurance baseline

Owner: Ben / release maintainer. Adopted for the NASA safety review of October 20, 2026.

Votic is a consumer document reader with AI assistance. This is a voluntary, tailored engineering baseline. It is not NASA certification, a NASA classification decision, or authorization for flight, medical, emergency, or other safety-critical use. No NASA contract or classification record has been established. AI answers and OCR remain fallible: the original document is the reference. Do not describe this project as NASA compliant.

## Standards and tailoring

References: [NPR 7150.2D](https://nodis3.gsfc.nasa.gov/displayDir.cfm?Internal_ID=N_PR_7150_002D_), [NASA-STD-8739.8B](https://standards.nasa.gov/standard/NASA/NASA-STD-87398), [JPL Power of Ten](https://spinroot.com/gerard/pdf/P10.pdf).

| Practice | Votic application | Evidence |
| --- | --- | --- |
| SWE-020/176 classification and mapping | Record intended use and applicability here; no NASA class assigned | This file and TRACEABILITY.md |
| SWE-022/205 assurance and safety assessment | Maintain product risk register; re-assess if intended use changes | TRACEABILITY.md |
| SWE-052 traceability | Link risks, requirements, controls, and behavioral checks | TRACEABILITY.md |
| SWE-061/135 coding and analysis | TypeScript strict mode, zero-warning JS/TS lint, CodeQL/Semgrep, coverage and complexity evidence | CI and security/code-metrics.cjs |
| SWE-134 recovery principles | Preserve user data on read failures; bound untrusted work; fail explicitly | Storage, worker, deletion, and backup tests |
| SWE-219 MC/DC and SWE-220 complexity <=15 | These formal safety-critical requirements are conditional; no claim of MC/DC coverage. Measure complexity and ratchet existing hotspots down | Generated quality-evidence/code-metrics.json |
| SWE-065/066/073 verification | Automated tests plus actual target-device and vendor acceptance | Release evidence and OPERATIONS_ACCEPTANCE.md |
| SWE-087 review | Require review of requirements, changes, tests, findings, and risk decisions | Pull request and release evidence |

## Language-specific coding rules

- External data must have byte, count, depth, and time limits before it drives expensive work. Blocking parsers run in terminable workers with resource limits and bounded concurrency. HTML parsing itself runs inside the worker; a tree check caps cleanup recursion to depth 128 and 20,000 nodes. DNS and redirects share the overall import deadline. Streams reject zero-length or excessive fragments.
- Check persistence results. A missing value is different from a failed read or an invalid value. Preserve unreadable data, expose recovery, and prevent saves before successful hydration. Paid requests are not automatically retried.
- Keep state account-scoped, minimize mutable scope, and make cancellation, sign-out, and deletion explicit transitions. Native playback must pause on audio-focus loss and headphone disconnect.
- New functions should have measured complexity <=15 and <=60 executable statements. Physical lines including JSX are a diagnostic, not a blanket React function limit. Existing exceptions are measured from commit 31e0d70 in security/complexity-baseline.json; CI rejects new/worsened exceedances. The baseline is not permission to add debt. Reductions require review; never regenerate it from HEAD simply to make CI green.
- JavaScript/React Native, Kotlin, and Swift use managed runtime allocation; Power of Ten's C heap/pointer/preprocessor restrictions cannot be promised literally. Use bounded data and lifecycle cleanup instead. Intentional animation/service loops require cancellation. Do not add trivial assertions to meet a numeric assertion quota.
- Native compilation is supplemented by Kotlin/Swift CodeQL, Android lint, and native model tests. Native findings require review. JS/TS lint warnings block CI. Native analysis must actually complete; a missing SARIF report fails the gate.

## Verification and evidence

Run root npm run test:coverage, then in apps/mobile run npm run test:coverage, npm run test:components:coverage, npm run metrics, npm run typecheck, npm run lint, and npm run format:check. Coverage applies to explicitly listed risk-bearing modules, including storage, activity recovery, account deletion, backup restore, entitlement, and API configuration. It is not whole-app coverage or MC/DC. Thresholds are in the test configs; do not lower them merely to accept a failure.

CI retains native build/smoke, native analysis/model tests, coverage, and metrics for 90 days. Export immutable release evidence to the release record before expiry. CI builds use test/empty service settings, so passing CI does not establish real billing, sign-in, deletion, native crash reporting, or store signing.

Before distribution, copy release-evidence.example.json to a private release record, set its exact commit and target platforms, and attach actual evidence, reviewer, and timestamp for each applicable check. Run node security/check-release-evidence.cjs PATH_TO_RECORD from the repository. The example intentionally fails. This validates record completeness, not the truth of human attestations. Keep sensitive customer data out of evidence and do not commit credentials.

The large reader and server functions remain tracked refactoring work, with their measured exceptions visible. They are not asserted to satisfy a strict flight-code limit. Changes to their behavior require focused behavioral tests and a fresh review.
