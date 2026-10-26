# Premium onboarding refinement

Builds on the existing interactive setup and paywall on `feature/paywall-research-improvements-2026-10-22`, starting at `f708535`. This implements a focused portion of the earlier research proposal, not a replacement onboarding system.

## Result

- Reading comfort, explanation styles, listening and the paywall now share the same purpose-aware sample document. Sample titles and content remain recognizable across the journey. Prepared answers are labeled as examples.
- The ready screen recaps actual reading, listening and explanation preferences, rather than repeating a generic feature list. Defaults appear honestly when questions were skipped. Preferences remain editable in Settings.
- The paywall introduces three clear outcomes: read/listen, ask documents, and keep ideas. Its existing localized price, trial disclosure, purchase recovery and final-step position remain intact.
- The existing preview uses saved reading typography and highlighting preferences. It starts with the chosen listening speed, and speed changes apply to subsequent documents. The selected speed remains visible even outside the usual preview presets.
- Read mode demonstrates keeping a sample note, with an explicit preview-only confirmation. This makes no network call and writes no note or document to the library.
- Personalization content uses a bounded reading width on wider screens. Preview mode changes use a shorter 260 ms transition and retain the reduced-motion path.

## Validation

- 70 component/integration tests across onboarding, preview, paywall/account, voice discovery and root navigation.
- 22 logic tests for onboarding state, paywall presentation and offer disclosures.
- TypeScript, ESLint, changed-file formatting and diff checks.
- Added behavioral checks for saved speed, no-highlighting, preview-only note saving and actual preference recap. Existing tests continue to cover cancellation, restoration and entitlement-gated access.

This is automated component/logic validation, not native-device or real-purchase E2E testing. A temporary React Native Web fixture bundled successfully, but screenshot review could not run because no Chromium binary is installed. Native small-screen, large-text, dark-theme, screen-reader, audio and store-sandbox review remain necessary.

## Credit offers

This change does not advertise the planned 1,000/2,000 allowances as live. The current branch's `credit-plan-integration-status.md` identifies unfinished credit spending and paywall integration. Complete that work against verified product IDs before adding those promises to checkout. No billing economics, entitlement logic, backend credit handling, authentication or routing rules were changed here.
