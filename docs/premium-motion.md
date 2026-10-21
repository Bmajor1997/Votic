# Premium interaction motion

Implementation branch: `feature/finish-experience`, based on `02bdccc`.

The change adds seven Remotion studies under `apps/motion-studio` and corresponding native interactions. Shared durations and playback geometry live in `apps/mobile/src/motion/motionSpec.ts`. Remotion is a development/preview dependency only; mobile retains its existing native stack.

## Live integration

| Interaction      | Trigger and behavior                                                                                                                                                                                                                                                                                |
| ---------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Document opening | Existing card expansion uses a 420 ms eased transition. Documents and Home cards capture their title geometry; an independent title bridges to the reader header without being stretched with the page. Text fades in later. Direct imports/deep links without a card retain the existing fallback. |
| Read/Listen      | The selected background slides between the two modes; the dock enters gently after the route changes. Switching retains the stop → same-route update behavior and does not automatically play. Home's explicit Continue Listening action retains its existing autoplay intent.                      |
| Play/pause       | Two scanline halves morph from a triangle into pause bars in 200 ms. State follows the existing playback state, including pause/interruption; the button retains its accessible name and handler.                                                                                                   |
| Import saved     | File, OS-share, webpage and reviewed camera/image imports publish an ephemeral confirmation after durable saving. The document glyph settles into a checkmark inside a saved card. No save/navigation waits for the animation.                                                                      |
| Finish           | The last stretch of the completion ring closes, the checkmark draws, actual time/passage totals enter, then existing summary/follow-up/next-document actions enter. No counters or completion logic are changed.                                                                                    |
| Bookmark         | Existing passage-save behavior remains; a successful storage flush triggers a short bookmark pop and confirmation. A failed flush does not claim success.                                                                                                                                           |
| Note             | After the existing note save/flush/draft-clear sequence succeeds, a confirmation appears and only the saved note row settles. Recoverable drafts are not presented as saved notes.                                                                                                                  |

All movement is finite, native-driven, interruptible and disabled by system or in-app Reduce motion. No flashing, automatic playback, looping decorative motion, backend changes, authentication changes, subscription changes, new services or production deployment are included. Confirmation titles remain in memory, clear on timeout/background/account change, and reject stale callbacks from another account.

## Review on Android

1. Open a document from Documents, Home Continue and Home Recent at normal and large font sizes; check title alignment and text reveal. Close during opening, then reopen another document; direct imports/widget links should not inherit stale card geometry.
2. Toggle Read/Listen quickly and while audio is playing. Confirm position is retained, audio stops, only one reader remains in navigation, and switching alone never starts speech.
3. Play, pause, resume and interrupt narration. Check both compact and expanded controls; glyph state must match the button's spoken label.
4. Import TXT/PDF, an OS share, a webpage and a reviewed scan. Successful saves should show the saved card; canceled/failed recognition and failed storage must not show a success. Existing review/retry behavior must remain intact.
5. Save/edit a passage and a note, then test a storage failure with a disposable fixture. Confirm saved-row feedback, draft recovery and no false success.
6. Finish a document with and without a summary/next document. Confirm ring → check → totals → actions. Close remains available immediately, and existing actions remain unchanged.
7. Repeat with Reduce motion on, dark/sepia/high-contrast appearances, a screen reader and larger text. Change accounts while saving; no other account's title or confirmation should appear.

See `apps/motion-studio/README.md` for preview commands. Remotion studies are illustrative previews; native alignment/performance and accessibility need device review before release.

## Automated verification

- Backend: 236 tests passed.
- Mobile reliability: 416 tests across 41 files passed.
- Mobile component/integration/navigation: 524 tests across 68 suites passed. Focused reader/save tests were repeated after the final presentation adjustments.
- TypeScript, mobile ESLint (zero warnings), Prettier, and root JavaScript/HTML/CSS quality checks passed.
- Complexity: zero regressions; existing baseline and thresholds unchanged. Reader presentation state and narration-duration estimates are isolated in small hooks.
- Android Metro/Hermes export passed. No native dependency or Kotlin changes were needed for these interactions.
- Remotion ESLint/TypeScript and bundle build passed. All seven compositions rendered to inspection frames; the dark reduced-motion finish variant was checked separately.
- A path-filtered Motion Studio CI workflow now validates the preview project and shared motion specification. Root ESLint excludes only the generated Studio bundle; Studio sources have their own lint/type check.
- Studio started locally, but the separate remote browser could not access this workspace's localhost port. Headless inspection frames succeeded. Interactive Studio review on the user's computer and Android/iOS device review remain pending; no emulator or phone testing is claimed.
