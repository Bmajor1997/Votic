# Votic motion studies

Ten Remotion compositions accompany the live Expo/React Native interactions on `feature/finish-experience`:

- `HomeLogoEntrance`: Home-only V and robot-carried letter entrance at the native header's logical size (390 × 844, 60 fps, two-second settled hold); toggle `dark`, `reducedMotion`, or `returningSession`.
- `CarryOptions`: the three grip options that were compared (A chest hug — chosen, B low cradle, C top hook), playing in sync. A design study with its own simplified arm; the app uses option A via `carrierHug.ts`.
- `HomeRobotCloseUp`: the same wordmark magnified (`zoom`, default 5×) with a baseline `guides` line, for pausing on the carry, foot contact, set-down, turn and walk-out. Robot `o` walks in from frame 130, places its letter at frame 229 and is gone by frame 283.

  Both draw the carrier robot from `../mobile/src/motion/robotCarrier.ts` (body, walk, lean, squat, exit) and `../mobile/src/motion/carrierHug.ts` (the chest-hug grip and its placement), the same pose functions, element structure and transform order the app's `CarrierLetter` uses, so poses and timing match the Android app. The app samples the poses (about 120 points per letter, linear between them); the study evaluates them exactly per frame.
- `DocumentOpen`: measured document card expands, its title travels independently, then reader text appears.
- `ReadListen`: sliding selection and listening-control entrance.
- `PlayPause`: triangle/pause geometry morph, in both directions.
- `ImportSaved`: document settles into a saved confirmation card after durable storage.
- `FinishReveal`: ring completion → checkmark → actual totals → next actions.
- `BookmarkSaved`: confirmed passage-save feedback.
- `NoteSaved`: confirmed note-save feedback and the saved row settling.

## Preview

From this directory, run `npm ci`, then `npm run dev -- --no-open`. Open the printed localhost URL. Choose a composition, play or scrub it, and edit `dark` / `reducedMotion` in its input props to inspect variants. The original seven compositions are four seconds at 60 fps with time to inspect the settled state. All example text and totals are illustrative; these compositions are motion studies, not recordings of the running app.

The shared timing and play/pause geometry live in `../mobile/src/motion/motionSpec.ts`. Keep a full repository checkout: the Studio imports that file directly. The Studio has its own dependencies and lockfile; it is not imported by the mobile app, backend, or purchase flow.

## Live app

Remotion authors frame-based previews. React Native `Animated` supplies the corresponding interactive behavior on Android/iOS; it follows real navigation, audio and durable-storage results. No embedded videos, browser player, WebView, extra native package or artificial processing delay is used in the app. System or in-app Reduce motion switches animations to their final state. The preview's scheduled events likewise switch immediately in reduced-motion mode.

Use `npm run lint` for ESLint/TypeScript and `npm run build` for a reproducible Studio bundle. Generated `build/` and rendered `out/` files are excluded from Git.

## Licence

Remotion is not MIT-licensed. Its licence is free for individuals and for companies with up to three employees; larger companies need a paid company licence from remotion.pro. This Studio is a development preview only (nothing from it ships in the app), but check the current Remotion licence terms before Votic grows past that size or uses Remotion for anything else.
