# Home and Notes cleanup — October 27, 2026

Branch: `codex/vatic-v1-audit-20261027`. Existing draft PR: <https://github.com/Bmajor1997/Votic/pull/21>. Baseline: `c47869b20b608574fea2a86f00b09966f1ea33cb`.

## Implemented

- Empty Home gives non-interactive directions to upload through Documents. Continue Reading/Listening, populated recent-document navigation, and Browse for an existing fully completed library remain available. `apps/mobile/src/home/HomeWidgets.tsx` reuses the existing empty widget, with its existing colors and illustration; `apps/mobile/app/(tabs)/index.tsx` supplies whether readable documents exist. Quick Notes does not count as an imported readable document.
- Empty Notes no longer has an Open a document redirect. Guidance distinguishes no imported documents from an existing document with no saved notes. Existing notebook previews, Quick Note availability/creation, filtering, editing, selection, sharing, deletion, pinning, listening, and Open in Reader for source passages remain.
- Removed Notes assistant launch points and their suggestion controls from the Notes list/selection bar, `NotebookHeader.tsx`, and `NoteViewer.tsx`. The Notes selection tip now teaches sharing/deletion; the saved internal tip ID remains stable. The walkthrough no longer targets the removed Ask button.
- The shared assistant route, context logic and suggestions remain because they serve other entry points and existing links. The reader's Read/Listen Ask Votic conversation, suggestions, answer actions and note saving were not edited. Billing, paywall, source-note colors, artwork, and V2 were not changed.

## Illustration investigation — visual confirmation still required

The current `apps/mobile/assets/notes-empty.png` is an RGBA illustration with fully transparent corners. It is not an opaque white rectangular image. Inspection found some near-transparent outer-edge residue (alpha 1/255), but did not establish that this explains the reported white box. The existing image/container styles had no white background fill.

The Notes illustration and empty-state container now explicitly use transparent backgrounds. This is a surface safeguard, **not evidence that the reported white rectangle has been reproduced or fixed**. The image pixels, notebook/pencil artwork, sizing and colors were preserved; no replacement illustration or white color-matching workaround was introduced.

If a rectangle remains in the refreshed app, obtain a screenshot identifying the exact illustration/screen and appearance mode. It may be a different rendered element or a cached asset; neither cause is confirmed. Actual dark-mode compositing on the user's device remains to be checked.

## Focused commits

- `598d7056f09501d56cfd6cb082f43895430d7911`: empty-state guidance, explicit transparent surfaces, Light/Dark empty-state checks and corresponding Home walkthrough wording.
- `b6b0f2e640e087ad779bbaa5dcd7b859a0385b15`: remove Notes assistant launches/suggestions, preserve notebook sharing and source-reader access, retain completed-library Home browsing, update affected tests/tips.
- Documentation follow-up: record verification and the unresolved visual symptom in this report.

## Verification

- 201 component/integration tests passed in 14 affected suites: Notes, Home widgets, note source colors, personalization, document import, reader, reader modes, reader tools, shared assistant, answer listening, Home note links, draft protection, walkthrough and document transitions.
- 48 logic tests passed across walkthrough, Notes listing/context and shared personalization suggestions.
- Final completed-library Home adjustment was additionally verified by rerunning all 20 Home widget tests.
- TypeScript, mobile ESLint, Prettier and `git diff --check` passed. Final changed Home files also received a focused lint/format check and a fresh TypeScript run.
- Complexity screening: 3,837 functions, 35 existing hotspots, zero regressions; baseline unchanged.
- Tests cover empty Light/Dark states, populated widget/source colors, Quick Note creation and saved-note editing/listening, notebook sharing with its actual share callback, selection/deletion controls, existing import handling, reader Ask in Read/Listen modes and revised tips. API calls in component tests are mocked; this is not a live backend connectivity check.

No emulator/physical-device visual check, native build, merge, production release or deployment was performed. GitHub Actions at the newly published head are separate from local test results; refer to the current PR Checks tab.
