# Home logo entrance

The Home header's existing Votic logo and wordmark move together from the right edge to their existing upper-left layout position. The motion lasts 600 ms, with a monotonic cubic Bézier deceleration `(0.215, 0.61, 0.355, 1)`. The logo reserves its normal layout space, uses a native-driver translation, does not capture touches, and retains the `Votic logo` accessibility label. Its wing pulse is disabled inside this entrance so the group stays rigid; the shared logo's existing behavior elsewhere, including Welcome/sign-in, is preserved.

## Session and readiness

`AuthProvider` owns an in-memory, account-and-generation-scoped latch. A fresh authenticated account transition arms one entrance. Home claims it when starting. Token refreshes, tab changes, Reader returns, and background/foreground transitions do not re-arm it. Sign-out and a new sign-in re-arm it even for the same account. A persisted session restored at launch stays static. Old callbacks must present their original generation, preventing a delayed callback from consuming a new sign-in's entrance.

Only Home passes `HomeLogoEntrance` into the optional `Screen.brand` slot. Documents, Notes, Settings and other screens retain the default branding. The entrance waits for the focused Home route, active app state, authenticated hydration, account handoff, confirmed subscription access, loaded library/activity and initial device/local motion preferences. Its initial transform is already off-screen, preventing a final-position flash while waiting.

Device Reduce Motion and Votic Less motion display the final position immediately. Blur, unmount, preference changes or backgrounding stop an entrance already underway. A 1.5-second deadline settles the logo if initialization or the animation driver stalls; after a deadline the entrance is skipped for that session. A driver start error also settles it. No authentication, subscription or onboarding access rules are changed.

## Remotion study

Open `HomeLogoEntrance` in `apps/motion-studio`:

```sh
cd apps/motion-studio
npm ci
npm run dev -- --no-open
```

The composition is 390 × 844 logical pixels, 60 fps, three seconds, using the shared `MOTION.homeLogo` timing/easing and copies of the existing logo assets. Edit `dark`, `reducedMotion` or `returningSession` to inspect variants. The sample Home content is illustrative; this is a motion study, not a device recording. Remotion and its rendering dependencies remain isolated from the mobile runtime.

## Verification

Automated checks cover session ownership/generations, restored sessions, same-account re-login, readiness, focus changes, navigation/remount, foregrounding, reduced motion, interrupted and stalled animations, driver errors, labels and usable controls. Validation passed: 437 reliability tests (43 files), 547 component/integration tests (71 suites), mobile type checking, full lint/format checks, whitespace checks, and the complexity gate (3,525 functions, zero regressions). Studio lint/TypeScript and the production bundle also pass.

Studio launch in this execution environment failed at `os.networkInterfaces()` (`uv_interface_addresses`). The production Remotion bundle builds; serving it from a local static server did not make it reachable from the separate cloud browser (`ERR_CONNECTION_REFUSED`). Interactive playback and rendered-frame inspection are not claimed.

On Android/iPhone, verify fresh sign-in → Home, a returning saved session, tab/Reader navigation, interrupted sign-in/navigation, account switching, system and app reduced motion (including changing it mid-entrance), larger text, dark mode and screen rotation. Check the original header alignment and that the controls remain responsive during the 600 ms movement. No emulator or physical-device visual verification was performed here.
