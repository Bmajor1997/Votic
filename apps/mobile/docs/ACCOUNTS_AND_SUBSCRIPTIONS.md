# Accounts, onboarding, and Votic Premium

How a new person gets into Votic, what each service does, and what has to be set up outside the code.

## Flow

```
Welcome ─┬─ Get started ─ Create account (Apple · Google · email) ─┐
         └─ Sign in (Apple · Google · email · Forgot password) ────┤
                                                                   ▼
        Personalization (5 questions, new accounts only) ─ Votic Premium ─ "Votic is ready for you" ─ Home
                                                                                   │
                                          "Start using Votic" opens Home, where the Home tour begins
```

`app/_layout.tsx` shows only the screens for the current stage (`Stack.Protected`). The stage comes from three
separate facts, so finishing setup never grants access by itself:

| Fact                       | Source                                   | Stored where                                                                |
| -------------------------- | ---------------------------------------- | --------------------------------------------------------------------------- |
| Signed in                  | Firebase Authentication                  | Firebase; the session is kept by the Firebase SDK in the app's AsyncStorage |
| Setup progress and answers | This device                              | AsyncStorage `votic.mobile.onboarding.v1:<firebase uid>`                    |
| Walkthroughs seen          | This device                              | AsyncStorage `votic.mobile.walkthrough.v1:<firebase uid>`                   |
| Votic Premium              | App Store or Google Play, via RevenueCat | RevenueCat, keyed by the Firebase uid. Never a locally saved "paid" flag    |

## Who sees setup

| Situation                                                              | What happens                                               |
| ---------------------------------------------------------------------- | ---------------------------------------------------------- |
| New account (email, or the first Apple/Google sign-in)                 | Personalization → Votic Premium → "Votic is ready for you" |
| Leaves mid-setup and comes back                                        | Same question, same answers (saved as they change)         |
| Existing account signs in on a new phone or after a reinstall          | Setup is skipped; answers can be set in Settings           |
| Another account signs in on the same phone                             | That account has its own setup                             |
| Signed in on a build from before per-account setup                     | Keeps whatever that build decided                          |
| Any account without an active subscription or trial (including expiry) | Votic Premium screen                                       |

Walkthroughs follow the same rules: a new account gets them, an existing account signing in on a new phone or
after a reinstall doesn't (each can be replayed from Settings → Learn Votic), another account on the same phone
has its own, and a session from before per-account progress keeps what the phone had recorded. Which walkthroughs
an account finished on another phone isn't known, because this is kept on the device, not on a server.

"New account" comes from Firebase: a sign-in that created the account has the same creation and last-sign-in time.

**Decision for you:** everyone needs Votic Premium, including people who used Votic before accounts. Earlier
drafts let existing installs skip the paywall; that was removed because it would grant paid access from a local
flag. If you want to give existing users free access, the right way is a RevenueCat promotional entitlement.

## Personalization answers

Five questions, one per screen, each optional (`src/onboarding/onboardingModel.ts`). What they change:

| Answer                                                                   | Effect                                                                                        |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- |
| Explanation style (Quickly / Simply / In detail / Adapt to me)           | Sets Settings → Personalization → Explanations, which Ask Votic sends with every question     |
| "Highlight the words as they're read" / "Highlight the current sentence" | Sets the Reader's highlight (word, sentence, or both)                                         |
| Starting speed (on the listening question)                               | The speed new documents start at                                                              |
| Answers with a direct match (summaries, explanations, key points, notes) | Ask Votic's suggestions and the Notes notebook actions (`src/personalization/suggestions.ts`) |

Everything else is recorded for later use; nothing is turned off ("I'm mainly here to read" leaves listening on).
Answers are edited in Settings → Personalization → Your answers. People with no answers keep the suggestions
their earlier "purpose" choice gave them.

The server only accepts the four style names. Missing or unknown values get today's default answer, and request
text is never added to the AI instructions.

## Votic Premium (RevenueCat)

**What the screen does**

- Title, trial length, and price come from the store product, so changing them in App Store Connect or Play Console
  changes the app text. With the planned setup it reads "Try Votic Premium free for 2 weeks" and
  "2 weeks free, then $9.99/month. Cancel anytime."
- Trial timeline (Today → the date billing starts) only when the store says this person can get the trial.
- Trial eligibility: on iOS, StoreKit is asked through RevenueCat and the trial is shown only when the answer is
  "eligible" (RevenueCat's guidance for "unknown"). Google Play only returns the free phase to eligible people.
  Anyone whose subscription has ended is never promised a trial.
- Button: "Start free trial" with a trial, "Subscribe for $9.99/month" without one.
- Purchase results: success opens Votic once RevenueCat confirms the entitlement; closing the store sheet does
  nothing; pending (Ask to Buy, slow payment) explains that Votic opens when approved; failures show a short,
  plain message. Raw store or RevenueCat errors are never shown.
- Restore Purchases, Terms, and Privacy stay pinned at the bottom. Sign out is at the end of the page.
- The screen can't be dismissed: Votic requires Premium.
- Access: trial, active, cancelled-but-paid-through, and billing grace period. "Unknown" never grants access.
- Expo Go and builds without RevenueCat keys say purchases aren't available. Only development builds also offer
  "Continue without a subscription (development build)".

**What you need to set up**

1. Apple Developer Program ($99/year) and Google Play Console ($25 once).
2. App Store Connect: sign the Paid Apps agreement, add tax and banking, create a subscription group and an
   auto-renewable monthly subscription at $9.99, then add an Introductory Offer → Free → 2 weeks.
3. Play Console: create a subscription with a monthly base plan at $9.99 and an offer → Free trial → 14 days,
   eligibility "new customers".
4. RevenueCat (free until about $2,500/month in revenue): add both apps (the App Store key and Google service
   account go into RevenueCat's dashboard, never this repository), create the entitlement `pro`, attach both
   products, and make an offering marked Current with a `$rc_monthly` package.
5. Put the **public** SDK keys in `EXPO_PUBLIC_REVENUECAT_IOS_API_KEY` and `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`.
6. Purchases need native code: use a development build (`npx expo run:ios`, `npx expo run:android`, or EAS),
   then test with App Store sandbox accounts and Play license testers.

## Terms of Service and Privacy Policy

Not written yet, and both stores require them for subscriptions and accounts. Host them on HTTPS and set
`EXPO_PUBLIC_VOTIC_TERMS_URL` and `EXPO_PUBLIC_VOTIC_PRIVACY_URL`. Until then the screens show plain text, never a
made-up link.

## Account deletion

Settings → Delete account deletes the Firebase account and this device's setup and walkthrough progress for it. Documents and notes stay
on the device. It does not cancel a store subscription. If Firebase asks for a recent sign-in, the person is told
to sign out and back in first.

Not yet done: revoking the Sign in with Apple token when an Apple account is deleted (Apple asks apps to do this).
It needs a server endpoint with Apple's private key, so it belongs on the Votic server.
