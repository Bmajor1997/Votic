# Accounts, onboarding, and subscriptions

How Votic's new-user flow works, what each service does, and what has to be configured outside the code.

## Flow

```
Welcome ─┬─ Create Account ─ Verify email ─ Personalization (5 questions) ─ Paywall ─ Store purchase ─ "Votic is ready" ─ Votic
         └─ Sign In ─────────────────────────────────────────────────────── (paywall only if no active entitlement) ─ Votic
```

`src/onboarding/entryRoute.ts` decides the screen from three separate facts:

| Fact                       | Source                                   | Stored where                                                                 |
| -------------------------- | ---------------------------------------- | ---------------------------------------------------------------------------- |
| Signed in, email verified  | Firebase Authentication                  | Firebase; session kept by the Firebase SDK in the app's private AsyncStorage |
| Setup progress and answers | This device                              | AsyncStorage `votic.mobile.onboarding.v1:<firebase uid>`                     |
| Trial / subscription       | App Store or Google Play, via RevenueCat | RevenueCat (keyed by Firebase uid); never a local "paid" flag                |

Finishing onboarding never implies a subscription.

## Existing Votic installs

On the first launch of this version, `loadDeviceHistory()` records whether the device already had Votic data
(documents, collections, a chosen purpose, or a finished/migrated first-run tour; empty lists don't count).
The answer is saved in `votic.mobile.device-history.v1` and never recomputed.

- **Existing devices:** must create an account or sign in (email verification included), then go straight into Votic.
  They skip personalization and are **not** shown the paywall — grandfathered until a pricing decision is made.
  To change that later, edit the `deviceHistory === "existing"` line in `entryRoute.ts`.
- **All devices:** documents and notes are stored on the device and are not touched by signing in, signing out,
  or deleting an account.
- Signing in on a device with no saved setup (reinstall, new phone) skips personalization; answers can be
  changed in Settings → Personalization.

## Personalization answers

Saved as `PersonalizationAnswers` (`src/onboarding/onboardingModel.ts`), versioned with `ONBOARDING_VERSION = 1`.
Raising the version does not, by itself, send anyone through onboarding again.

**Takes effect now**

| Answer                                                                              | Effect                                                                 |
| ----------------------------------------------------------------------------------- | ---------------------------------------------------------------------- |
| Listening: "Highlight the words as they're read" / "Highlight the current sentence" | Sets the Reader's existing highlight setting (word, sentence, or both) |

**Already how Votic works** (no setting to change): read aloud / listen instead of read, change reading speed,
remember where I stopped / pick up where I left off, ask questions as I read, save important passages,
quickly save something, create notes.

**Stored for future personalization**

| Answer                                                                                         | Where it would plug in                                                                                                                                                                                           |
| ---------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Explanation style (Quickly / Simply / In detail / Adapt to me)                                 | Send `explanationStyleFor(answers)` with `askVotic()` in `src/api/voticApi.ts`, validate it in `/api/help` in `votic_server.js`, and add one sentence to the AI instructions there. Needs a small server change. |
| Goals (question 1)                                                                             | Ask Votic suggestions and Home, like the existing purpose setting; paywall value statements already use them                                                                                                     |
| Reading help (question 2)                                                                      | Ask Votic suggestions                                                                                                                                                                                            |
| "Make it easy to jump backward or forward"                                                     | Reader controls (sentence skip already exists)                                                                                                                                                                   |
| "Stay focused while reading"                                                                   | Future Reader focus mode                                                                                                                                                                                         |
| "Organize key points for me", "Keep my questions with my notes", "Help me find my notes later" | Future Notes work (Ask Votic answers can already be saved to notes)                                                                                                                                              |
| "I'll decide as I go", "I'm mainly here to read", "I'll organize things myself"                | Recorded only; listening is never turned off                                                                                                                                                                     |

## Setting up Firebase Authentication (free for email/password)

1. Create a project at <https://console.firebase.google.com>.
2. **Build → Authentication → Get started → Sign-in method → Email/Password → Enable.**
3. **Authentication → Settings → User actions → Email enumeration protection: on.**
4. **Authentication → Templates:** set the sender name and app name used in verification and reset emails.
5. **Project settings → Your apps → Add app → Web** (the JS SDK uses the web config, even on phones).
   Copy `apiKey`, `authDomain`, `projectId`, `appId` into `apps/mobile/.env` (see `.env.example`).
6. Restart Expo (`npm start -- --clear`) so the new values are included.

The Firebase web config is a public identifier, not a secret. Security comes from Firebase's server-side rules.

## Setting up subscriptions (RevenueCat)

Nothing in Votic can sell a subscription until all of this exists. Until then the paywall says subscriptions
aren't set up, and only development builds offer a "Continue without a subscription" button.

**Accounts you need**

- Apple Developer Program — $99/year (required for any iOS in-app purchase or TestFlight).
- Google Play Console — $25 one-time.
- RevenueCat — free until roughly $2,500/month in tracked revenue, then about 1% (check revenuecat.com/pricing).

**App Store Connect**

1. Register a bundle ID (e.g. `app.votic`) and add `ios.bundleIdentifier` to `app.json`.
2. Sign the Paid Apps agreement and complete tax and banking.
3. Create a subscription group and an auto-renewable subscription (e.g. `votic_monthly`), set the price,
   and add an **Introductory Offer → Free → 1 week or 2 weeks**. The paywall reads this trial length from
   the store, so the app text changes when you change it here.
4. Optional: enrol in the App Store Small Business Program (15% instead of 30%).

**Google Play Console**

1. Add `android.package` to `app.json` and upload a build to an internal testing track.
2. Create a subscription with a base plan (monthly) and an **offer → Free trial → 7 or 14 days**.

**RevenueCat**

1. Create a project and add the iOS and Android apps (App Store Connect shared secret / API key and a Google
   service account go into RevenueCat's dashboard, never into this repository).
2. Create the entitlement `pro` and attach both store products.
3. Create an offering (mark it **Current**) with a `$rc_monthly` package (and `$rc_annual` if you add one).
4. Copy the **public** SDK keys into `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` / `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`.

**Build for testing purchases**

Store purchases need native code, so they never work in Expo Go (Votic shows a message instead).
Use an EAS development build: `npx eas build --profile development` (free Expo tier has a monthly build quota),
then test with App Store sandbox accounts / Play license testers.

**Store fees:** Apple and Google keep 15% of subscription revenue under their small-business programs
(Apple's standard rate is 30%; Google's subscription rate is 15%).

## Terms of Service and Privacy Policy

Not yet written. Both are required by Apple and Google for subscriptions and for apps with accounts.
Host them on HTTPS and set `EXPO_PUBLIC_VOTIC_TERMS_URL` and `EXPO_PUBLIC_VOTIC_PRIVACY_URL`; the paywall shows
the links only when they are set.

## Account deletion

Settings → Delete Account confirms the password, then deletes the Firebase account (required by App Store
guideline 5.1.1(v)). It does not cancel store subscriptions; the screen tells subscribers to cancel first.
Documents and notes stay on the device.

## Adding Google and Apple sign-in later

The code is structured so each provider is an addition, not a redesign:

1. Add `"google"` / `"apple"` to `AuthMethod` in `src/auth/authTypes.ts` and a method to `AuthService`
   (`signInWithGoogle()`, `signInWithApple()`).
2. Implement them in `src/auth/firebaseAuthService.ts` with Firebase's `signInWithCredential` and
   `GoogleAuthProvider.credential(idToken)` / `OAuthProvider("apple.com").credential({ idToken, rawNonce })`.
3. Add "Continue with Google" / "Continue with Apple" buttons to `WelcomeScreen.tsx`, shown only when
   `services.auth.methods` includes them. Google/Apple accounts arrive with a verified email, so they skip
   the verification screen automatically. Everything after sign-in (personalization, paywall, RevenueCat
   identity) is unchanged.

**Continue with Google — you will need**

- Firebase: enable the Google sign-in provider (creates the OAuth web client).
- Google Cloud console (same project): OAuth consent screen (app name, support email, privacy policy URL,
  and verification if you request more than basic scopes), plus iOS and Android OAuth client IDs
  (Android needs the SHA-1 of the signing key, including Play App Signing's key).
- A native Google sign-in library (e.g. `@react-native-google-signin/google-signin`) in an EAS build. Free.

**Continue with Apple — you will need**

- Apple Developer Program membership ($99/year).
- The **Sign in with Apple** capability on the App ID, `expo-apple-authentication` (iOS), and an EAS build.
- Firebase: enable the Apple provider. For Android or web support, also a Services ID, a return URL, and a
  private key (.p8) — the key goes into Firebase's console, never into this repository.
- App Store rule 4.8: once Google sign-in is offered on iOS, Sign in with Apple (or an equivalent
  privacy-focused option) must be offered too. Email/password alone does not require it.
