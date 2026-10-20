# Branch reconciliation review (2026-10-20)

Target: `feature/owasp-nist-security-hardening`. Do not merge divergent branches wholesale or change `main`.

GitHub ancestry comparison found 25 of 34 branches fully included (counting this target), 8 divergent branches with commits not in target, and one unrelated-history sample branch. Divergent commits are not proof of missing functionality.

| Branch | Unique commits | Decision |
|---|---:|---|
| fix/nasa-safety-review | 2 | **Review first**: changes to native CI, import isolation, backup and activity recovery; compare tests and integrate only nonduplicated corrections |
| feature/expressive-subscription-paywall | 1 | **Likely already present**: verified `useImportSession.ts` blob SHA matches target (`8bb45ae10afd3ece6614568119b60a7fe81ee098`); inspect remaining changed files before deciding |
| codex/fix-subscription-recovery | 2 | **Already present for service implementation**: compared `revenueCatService.ts`; behavior matches target, with function identifiers refactored to snake_case; verify tests before closing |
| feature/revenuecat-paywall | 4 | **Do not merge blindly**: legacy dependencies/theme changes may conflict with current paywall |
| fix/audit-2026-10-16 | 1 | Review backend/OCR/security changes against current code and tests |
| chore/daily-votic-tests | 2 | Review workflow-only differences and test schedule |
| codex/empty-state-assets | 1 | Review UI assets against current visual design |
| feature/landing-page-waitlist | 2 | Review old Vetra landing page separately; likely out of scope for Android V1 |
| icon-test-samples | unrelated history | Compare file content manually only if needed |

## Verification gates before accepting a missing change
1. Compare current target files and tests with source branch at the file/function level.
2. Confirm functionality is genuinely absent; do not overwrite newer implementation.
3. Add or update a regression test for any correction.
4. Run relevant unit/integration tests and native build in CI.
5. Record source commit, resulting commit, evidence and any unresolved risk.

This review is preliminary: no missing commits were merged and no automated test suite was executed by this document change.
