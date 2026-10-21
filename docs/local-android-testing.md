# Local Android testing (emulator + local backend)

How to run the Votic backend and Metro on Windows so the Android emulator can import documents and webpages,
scan pages, use Ask Votic, and send feedback.

## Files

| File | Holds | Committed? |
| --- | --- | --- |
| `.env.backend.local` (repository root) | Backend settings: `PORT`, `VOTIC_HOST`, `VOTIC_CLIENT_KEYS`, `FIREBASE_PROJECT_ID`, `OPENAI_*`, `VOTIC_AI_*` | No (gitignored) |
| `apps/mobile/.env` | Public app settings: Firebase web config, `EXPO_PUBLIC_VOTIC_API_URL`, `EXPO_PUBLIC_VOTIC_CLIENT_KEY` | No (gitignored) |

Backend secrets (`OPENAI_API_KEY`) belong only in `.env.backend.local`. Never put them in an `EXPO_PUBLIC_`
variable; the server refuses to start if an `EXPO_PUBLIC_*OPENAI*` variable exists.

Settings each feature needs:

- **Feedback, account deletion, voice questions:** `FIREBASE_PROJECT_ID=votic-da5c4`, the project the app signs in
  with. Without it the server cannot verify sign-in, and feedback says the service is unavailable.
- **Camera text recognition, scanned PDFs, Ask Votic answers about a document, AI review:** `OPENAI_API_KEY`.
- **Client keys:** when `VOTIC_CLIENT_KEYS` is set, the app's `EXPO_PUBLIC_VOTIC_CLIENT_KEY` must be one of them,
  or every request is refused with "This app isn't allowed to use this Votic server."

## Start everything (two PowerShell tabs)

Tab 1, the backend:

```powershell
cd C:\Users\benja\Documents\Codex\votic-feedback-fixes
node --env-file=.env.backend.local votic_server.js
```

It prints which features are on, for example:

```
Votic is ready on 127.0.0.1:4173 for local and mobile devices
  Sign-in verification: on (Firebase project votic-da5c4)
  AI features: on (model gpt-6-luna)
```

Any line saying `OFF` names the setting to add.

Tab 2, Metro:

```powershell
cd C:\Users\benja\Documents\Codex\votic-feedback-fixes\apps\mobile
npx expo start --clear
```

Press `a` to open the app on the running emulator. Restart Metro after changing `apps/mobile/.env`, because Expo
reads `EXPO_PUBLIC_` values when it bundles.

Only one backend can use port 4173. Stop any other `votic_server.js` first (Ctrl+C in its tab).

## How the emulator reaches the backend

`EXPO_PUBLIC_VOTIC_API_URL=http://10.0.2.2:4173` points the app at this computer. On the Android emulator,
`10.0.2.2` is the host's own `127.0.0.1`, so the backend can stay bound to `127.0.0.1`: not reachable from other
devices on the Wi-Fi, and no firewall changes needed.

Without `EXPO_PUBLIC_VOTIC_API_URL`, a development build guesses the backend from Metro's address (for example
`http://192.168.12.103:4173`). That only works if the backend listens on that network address (`VOTIC_HOST=0.0.0.0`).
A physical phone needs that setup, and it exposes the development server to your local network.

To check connectivity, look at the backend tab's startup lines, then import a PDF in the app. PDFs are read by
the server, so a successful import confirms the connection. A connection failure in a development build names the
address it tried.

## Expo's floating gear button

The grey gear that can cover the Reader's bookmark is Expo Go's **Tools button**, not part of Votic. It doesn't
exist in release builds. To hide it while testing, open the Expo menu (Ctrl+M in the emulator, or shake a device),
then turn off **Tools button**. You can still open the menu with Ctrl+M.

## Release blocker: policy links

Terms of Service and Privacy Policy links appear in Settings, on sign-in and on the paywall only when
`EXPO_PUBLIC_VOTIC_TERMS_URL` and `EXPO_PUBLIC_VOTIC_PRIVACY_URL` are set to HTTPS addresses. No approved addresses
exist yet: the Votic site has a `/delete-account` page, but no Terms or Privacy page. Publish both policies, then
set the two variables in `apps/mobile/.env` locally and in the EAS `preview` and `production` environments.
Production builds already refuse to build without them (`security/check-mobile-release.cjs`).
