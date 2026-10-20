# Votic security and AI assurance baseline

Status: **adopted engineering targets, not a certification or claim of compliance**.

Scope: Expo/React Native Android app, Node.js services, document import/OCR, Firebase authentication, RevenueCat entitlements, AI summarization and document Q&A.

## Standards and assessment
- **OWASP MASVS**: assess MASVS-STORAGE, CRYPTO, AUTH, NETWORK, PLATFORM, CODE, RESILIENCE, and PRIVACY as applicable. Use MASTG test cases and record evidence.
- **OWASP ASVS 5.0.0**: maintain a control-by-control applicability matrix for backend APIs, session/authentication, access control, validation, file uploads, cryptography, logging, and configuration. Target Level 2 for internet-facing user-data services; justify exclusions and higher-risk exceptions.
- **NIST AI RMF 1.0**: GOVERN (ownership, policies), MAP (AI use cases and threats), MEASURE (grounding, prompt injection, privacy, failure rates), MANAGE (mitigations, monitoring, incident response). Include NIST Generative AI Profile considerations.
- **NASA-inspired reliability**: bounded jobs, checked errors, safe recovery, regression tests, documented release gates.

## Non-negotiable engineering requirements
1. Every document, note, job, and AI request must be authorized server-side to its owning user. Test cross-account access.
2. Reject unsupported and oversized files before expensive work; impose processing time, memory and concurrency bounds; fail closed without losing mixed scanned PDF pages.
3. Keep secrets out of client bundles, source control, logs and AI prompts. Protect document content in transit and at rest.
4. Treat uploaded document text and retrieved content as untrusted instructions. Never let document instructions override system policy or authorize tool access.
5. Record AI model/provider, evaluation dataset version, source-grounding outcomes, privacy incidents and error rates without logging sensitive document content.
6. Fail safely on crashed requests, restore reserved usage quotas, avoid duplicate charges, and support retry/cancellation.
7. Verify RevenueCat entitlements server-side where privileged operations require them; do not change existing account integrations without targeted tests.
8. Security changes require automated tests, review, documented risk acceptance for exceptions, and an Android build before merge.

## Rollout and evidence register
| Workstream | Initial status | Evidence required |
| --- | --- | --- |
| MASVS mobile controls | Not assessed | Per-control code review and MASTG test output |
| ASVS backend controls | Not assessed | API threat model, access-control and input-validation tests |
| NIST AI RMF | Not assessed | AI risk register, evaluation dataset and measured outcomes |
| CI release gate | Not assessed | Workflow run links and reproducible Android artifact |
| Dependency and secret scans | Not assessed | Scan reports and triaged findings |

Do not mark a control compliant solely because this document exists. First audit the actual implementation and latest corrections; fix verified gaps on this feature branch and keep main unchanged.

References:
- https://mas.owasp.org/MASVS/
- https://mas.owasp.org/MASTG/
- https://owasp.org/www-project-application-security-verification-standard/
- https://www.nist.gov/itl/ai-risk-management-framework
