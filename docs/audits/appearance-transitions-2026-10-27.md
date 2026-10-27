# Neutral appearance and reader transitions — October 27, 2026

Branch: `codex/vatic-v1-audit-20261027`. PR: <https://github.com/Bmajor1997/Votic/pull/21>.
Baseline: `b9ba5f2168811b3130237b1692da1da348c1b2de` (local equivalent tree at `de52820`).

## Inspection and changes

1. **App appearance.** The cream navigation surfaces came from `navigationPalettes` in `apps/mobile/src/theme/ThemeProvider.tsx`, rather than an app-wide Sepia selection. Light now uses white; Dark uses black with neutral secondary surfaces. Existing `useColorScheme` resolution and native `userInterfaceStyle: automatic` are retained. Tests exercise changing the reported system scheme while mounted and confirm explicit Light/Dark choices remain fixed. Navigation, tab scenes, loading screens, scroll fades, and standard sheets already consume these shared colors.
2. **Reader appearance and preview paper.** Reader overrides already default to `null` (follow app), with Light/Dark/Sepia controls under More → Color. Those preferences, persistence, and the existing migration from legacy app-wide Sepia are preserved. Reader Light/Dark backgrounds are now white/black; explicit Sepia and high-contrast palettes remain available. `apps/mobile/src/home/ContinuePreview.tsx` had separate hardcoded sepia paper, backing sheet, and brown ink; these now use app theme colors independently of reader overrides.
3. **Responsiveness.** Opening previously waited for pagination or passage measurement before starting the source-card animation. The reader now starts that animation at first root layout, while text remains gated on readiness and saved-position preparation. Closing previously awaited speech cleanup before animation; cleanup now starts without blocking navigation, including when speech stop is slow or rejects. Timings are 300 ms open / 180 ms close (previously 420 / 240), with text reveal beginning earlier. Geometry, title bridge, reduced-motion path, and existing reading-position logic are retained. Entrance state lives in the existing `useReaderMotion` hook to preserve the complexity gate.
4. **Navigation lock defects.** Two new regression tests failed before the fix: an opening animation completing with `finished: false` left `locked` held, and repeated close requests could navigate twice. The provider now tracks transition phase and generation, settles interrupted transitions, ignores stale callbacks and duplicate pending closes, and settles pending motion when the app becomes inactive/backgrounded. Unmount invalidates callbacks. Native narration ownership is unchanged.

Source artwork, widget palettes, file-type accent/foreground definitions, source-based note palettes, typography, layouts, imported content, prices, and billing rules were not changed. File-icon tile backgrounds still blend their existing file accent with the newly neutral surrounding theme surface. No paywall source files were edited; screens consuming the shared app theme inherit its new neutral colors. No V2 work, merge, or release was performed.

## Focused implementation commits

- `a4fad56c9b058dcee1dfd76e9d6a39a5ad7dc671`: neutral app surfaces and system-mode regression test.
- `2906cbb90f9df0740f760c4e60e90cf9c2f963ac`: neutral reader and Home preview paper; reader preference tests.
- `b5ab69f3c670a39edcdfeccaf94c9c66ec74add0`: remove serialized opening/closing waits and shorten document motion.
- `9bf8fda291321f92bbc966c26a04a945df9fd922`: interrupted navigation, duplicate-close, background/resume, and unmount safeguards.
- Follow-up validation commit: move entrance state into `apps/mobile/src/motion/useReaderMotion.ts`, update the old file-icon surface expectation, and add this report.

## Local verification

| Check | Result |
| --- | --- |
| `npm run test:components -- --runInBand` | 653 tests, 79 suites passed |
| `npm run test:reliability` | 477 tests, 49 files passed |
| `npm run typecheck` | Passed |
| `npm run lint` | Passed |
| `npm run format:check` | Passed |
| `npm run metrics` | 3,851 functions; 35 existing hotspots; zero regressions; baseline unchanged |
| `git diff --check` | Passed |

Coverage includes light/dark surfaces, simulated live system appearance changes, saved reader overrides and legacy Sepia, High contrast, Home paper with unchanged widget/source colors, saved reading positions, existing reader controls and Back behavior, deferred/rejected speech cleanup, early layout-driven opening, interrupted animations, duplicate Close, simulated background/resume, unmount, and existing native playback synchronization.

The first full component run failed two assertions that still expected the former file-icon surfaces; their expectations now match the new neutral surfaces. The initial complexity run flagged one added statement in the large reader component; moving entrance state into its existing motion hook resolved it without changing the baseline. The final full rerun passes. The test run also emits React `act` warnings in `voiceReader.component.test.tsx`; that passing suite was not changed. These local results are separate from GitHub Actions; use PR Checks for results at the published head.

## Still requiring device confirmation

No emulator or physical-device visual/performance verification was performed in this workspace. Automated tests do not establish frame rate, end-to-end tap latency, absence of native startup/transition flashes, or reproduction of the user's exact lock symptom. No new Android/iOS native build is claimed.

Check on the existing development build:

- Light, Dark, and System across Home, Documents, Notes, Settings, sheets, and loading/empty states; change the device appearance while Votic is open.
- Open a document in each mode; select Sepia through More → Color, restart, and confirm it remains reader-only. Home preview paper should continue to follow app appearance.
- Open long documents at saved positions; close during initial pagination, double-tap Close, and use Android Back. Check position restoration, source-card/title motion, and Reduce Motion.
- Lock/unlock or background/resume during opening, closing, and listening; verify navigation stays usable and Android native background narration retains its established behavior.

The exact observed lock bug remains unconfirmed. If it persists, obtain the document/type, Read or Listen mode, whether the phone screen actually locks or only navigation freezes, the triggering steps, and ideally a recording. The two reproduced transition defects above should not be presented as proof that every device lock/unlock issue is fixed.
