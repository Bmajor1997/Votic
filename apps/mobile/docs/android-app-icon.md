# Android app icon

The Android launcher uses the approved charcoal V, exactly three blue wings, and an icy-blue background. The higher-resolution central mark was isolated from the existing 1024px `assets/icon.png`; its contour and wing arrangement were retained, the decorative rings were excluded, and the fills were made solid. No new logo geometry was drawn. The existing shared icon and all in-app logo assets remain unchanged.

Palette: charcoal `#2E2623`, blue `#2563EB` (the existing blue theme accent), background `#D6EAFD` (sampled from the approved icy-blue preview).

## Assets

All paths below are relative to `apps/mobile/assets/android-icon/`.

| File                      | Size        | Purpose                                                                           |
| ------------------------- | ----------- | --------------------------------------------------------------------------------- |
| `logo-source.png`         | 577 x 411   | Transparent original mark, without surrounding rings; retained for future exports |
| `icon.png`                | 1024 x 1024 | Opaque standard Android launcher source                                           |
| `adaptive-foreground.png` | 1024 x 1024 | Transparent foreground, with a centered 500px-wide mark                           |
| `adaptive-background.png` | 1024 x 1024 | Opaque, uniform icy-blue background                                               |
| `adaptive-monochrome.png` | 1024 x 1024 | Black silhouette with exactly the foreground's alpha, for themed icons            |
| `play-store.png`          | 512 x 512   | Opaque Google Play listing source; upload separately when updating the listing    |

The foreground and monochrome artwork fit inside Android's central 66/108 safe circle: maximum nontransparent radius is 305.62px, below the 312.89px limit. Their nontransparent bounds are x=262..761, y=334..689. They contain no baked-in outer corners, shadows, circles, or borders. On supported launchers, enabling Android themed icons intentionally replaces the charcoal/blue palette with system theme colors.

## Configuration and native resources

`app.json` supplies the Android-specific standard, foreground, background and monochrome paths. `app.config.js` retains these settings without modification. The shared `expo.icon` is unchanged to preserve the existing iOS/shared icon and splash behavior.

There is no maintained application-level `apps/mobile/android` directory. Expo generates it during prebuild. Native playback/widget modules remain unchanged. `withAndroidLintResources.js` still fixes PNG filename extensions and round-icon aliases; its hand-drawn monochrome fallback was removed so Expo's configured monochrome PNG supplies the exact same silhouette as the color icon. The generated-resource verifier now checks that resource and all three adaptive PNG layers.

## Validation

- Resolved Expo public configuration successfully with the installed SDK 57 dependencies.
- Decoded all six PNGs; checked dimensions, transparency, opaque backgrounds and all referenced paths.
- Confirmed exactly four separate source components: one charcoal stroke and three wings.
- Confirmed foreground/monochrome alpha equality and containment in the adaptive safe circle.
- Generated native Android resources before and after the change, without installing/building Android. The generated Android verifier passed both times. Afterward, only 24 icon resource files differed; manifests, Gradle/signing files and splash resources were byte-identical.
- Visually reviewed square, round, rounded-square and 48px previews.
- No EAS build, Gradle build, installation, Play upload or release was performed. Device/launcher verification is still pending the user's next build.

The existing prebuild notices about `ios.appleTeamId` and optional `expo-system-ui` also occur before this change. Neither blocks the Android icon generation check.

## Build and install later

These commands are instructions only; they were not executed as part of this change.

1. Check out this branch (or `main` after the user approves and merges the PR).
2. From `apps/mobile`, run `npm ci`.
3. Use the project's existing Expo account, EAS project, environment variables and signing credentials. If necessary, run `npx eas-cli login` and `npx eas-cli project:info` to confirm the existing project association; do not create a new project or application ID.
4. Run `npx eas-cli build --platform android --profile preview`. The existing preview profile produces an internally distributed APK.
5. Open the resulting EAS build link on the Android device, download the APK, and allow installation from that source when prompted. Alternatively, install the downloaded APK with `adb install -r path/to/votic.apk` when the existing installation uses a compatible signing key.
6. Inspect the home-screen icon with themed icons disabled, then enabled on a supported launcher. Check the charcoal V, three blue wings, icy-blue background and absence of decorative rings. Launch the app and confirm the splash screen and in-app branding are unchanged.
7. If the launcher retains an old shortcut, remove and re-add the shortcut or restart the launcher/device. If Android rejects an update due to a signing-key mismatch, use the existing compatible signing credentials; uninstalling the app would delete its local data.

The commit uses `[skip ci]` because this repository automatically starts native Android/iOS builds on push and PR events, and the user requested no build yet. Run CI/builds later when the user authorizes them. No workflow configuration was changed.

References: [Expo app icons](https://docs.expo.dev/develop/user-interface/splash-screen-and-app-icon/), [Android adaptive icon design](https://developer.android.com/develop/ui/compose/system/icon_design_adaptive).
