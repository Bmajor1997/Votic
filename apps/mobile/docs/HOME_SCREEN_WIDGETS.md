# Home-screen widgets

Votic has two widgets on iPhone and Android. They show only what the app has already measured, and every tap opens Votic at the right place.

| Widget        | iPhone                                                          | Android                             | Shows                                                                                                                                                                                                                                    | Tap                                                                                                                |
| ------------- | --------------------------------------------------------------- | ----------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------ |
| **Continue**  | Small, medium, large; Lock Screen circular, rectangular, inline | Resizable 2×2 to 4×4 (opens at 4×2) | The unfinished document opened most recently: type, title, progress, time left. Medium and up add **Listen** and **Read** (the way it was last used is filled). Large adds **Up next** (three more documents) and this week at a glance. | Listen resumes narration; Read opens without audio controls; Up next opens the document; the week opens Statistics |
| **This Week** | Small, medium; Lock Screen rectangular                          | 2×2, widens to 4×2                  | Reading plus listening time Monday to Sunday, a bar per day, the reading/listening split (medium), and a streak of 2+ days                                                                                                               | Opens Statistics                                                                                                   |

Each widget also has honest states for the rest of the time:

- **No documents yet:** "Ready when you are", with **Add document** (opens Documents).
- **Everything finished:** "All caught up", with **Add document**.
- **No activity this week:** "No activity".
- **Signed out, or Votic never opened:** "Open Votic". Nothing from the library is shown.

## How it works

```
App (src/widgets/WidgetSync.tsx)
  └─ builds a small snapshot (src/widgets/widgetSnapshot.ts) when the library or activity changes
       ├─ iPhone: App Group "group.com.votic.app" → targets/widget (SwiftUI, WidgetKit)
       └─ Android: SharedPreferences → modules/votic-widgets (AppWidgetProvider, RemoteViews)
Widget tap → votic://widget?open=… → app/widget.tsx → Reader, Statistics, or Documents
```

- **What the snapshot holds:** document id, title (shortened to 120 characters), file type, color family, progress, the status line ("42% · about 10 min left"), how it was last used, the library size, and reading/listening seconds per day for the last 42 days. It never holds document text or notes. Quick Notes isn't shown.
- **When it updates:** two seconds after the library or reading time changes, right away on sign-out, and before Votic goes to the background. Unchanged snapshots aren't sent again. Nothing is sent until sign-in, the library, and activity have loaded, so a widget never flashes an empty library.
- **The week stays right without the app:** the widgets get daily totals, not a finished weekly number, and work out this week (Monday first) and the streak (an active day is one minute or more, the same as Statistics) when they draw. Both refresh just after midnight.
- **Development sample statistics** never reach the widgets; they always use the measured log.
- **Links:** `votic://widget?open=listen|read&id=<document>`, `?open=statistics`, `?open=add`, or plain `votic://widget` for Home. A document deleted since the widget last updated opens Home. The route exists only for signed-in, personalized accounts, like the rest of the app.
- **Privacy on iPhone:** titles are marked privacy-sensitive, so iOS can hide them on a locked device.

## Before the first build

1. **iPhone: set your Apple Team ID.** Add `"appleTeamId": "<your team ID>"` under `expo.ios` in `app.json`. It's in the Apple Developer portal under Membership, or in Xcode's Signing & Capabilities. Until it's set, `npx expo prebuild` warns and iOS signing may fail.
2. **iPhone: App Group.** The app, the share extension (`expo-sharing`), and the widget extension (`com.votic.app.widgets`) all use `group.com.votic.app`. EAS Build with managed credentials registers it. Otherwise, register it in the Apple Developer portal and enable it for all three identifiers.
3. **Android: set the package name.** `app.json` has no `expo.android.package` yet, and every Android build needs one (for example `com.votic.app`). Choose it carefully: it can't change after the app is on Google Play.
4. **Build a development or release build** (`npx expo run:ios`, `npx expo run:android`, or EAS). Widgets need native code, so they don't appear in Expo Go.

Nothing here adds a paid service. `@bacons/apple-targets` (MIT) adds the widget extension to the Xcode project during prebuild and gives the app access to the App Group. `package.json` overrides its bundled plist parser to the patched version Expo already uses, so it adds no new vulnerable code.

## Files

| Path                                           | What it is                                                                                                                               |
| ---------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `src/widgets/widgetSnapshot.ts`                | What the widgets show, built from the library and activity log (tested in `widgetSnapshot.test.ts`)                                      |
| `src/widgets/WidgetSync.tsx`                   | Sends the snapshot when it changes (mounted in `app/_layout.tsx`)                                                                        |
| `src/widgets/widgetBridge.ts`                  | Hands the snapshot to iPhone or Android; does nothing on web and in tests                                                                |
| `src/widgets/widgetLinks.ts`, `app/widget.tsx` | Where a widget tap leads                                                                                                                 |
| `targets/widget/`                              | iPhone widgets (SwiftUI). `Info.plist` is generated once and kept; `Assets.xcassets` is regenerated on every prebuild and ignored by git |
| `modules/votic-widgets/`                       | Android widgets and the module that receives the snapshot (Kotlin, XML layouts)                                                          |

## What was verified, and what still needs a device

Verified while building:

- Jest and Vitest cover the snapshot, links, updates, sign-out clearing, and the deep-link screen.
- Android Kotlin compiled against Android 14's framework classes. On the JVM, its JSON parsing, week, streak, and duration wording matched the app's.
- Every Android resource file is well-formed XML.
- Swift files pass a Swift syntax parser.
- A trial `expo prebuild` on both platforms added the widget extension (iOS 16.4+, App Group entitlements) and linked the Android module, with `votic://` handled by the main activity.

Not yet done (it needs Xcode, the Android SDK, and devices):

- Full iOS and Android builds.
- Checking the widgets on real home screens in light and dark mode, at large text sizes, and with VoiceOver and TalkBack.

On a device, check:

- [ ] Add each widget in every size. The gallery shows your own document, or an example before Votic has been used.
- [ ] Listen starts narration where you left off; Read opens without audio controls.
- [ ] Read or listen for a few minutes, then go to the Home Screen: the progress and this week update.
- [ ] Delete the document shown: the widget moves to the next one, and an old tap opens Home.
- [ ] Sign out: both widgets show "Open Votic".
- [ ] Leave the phone past midnight on Sunday: This Week starts a new week.
