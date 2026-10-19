# Votic's four-part subscription experience

The paywall branches from `fix/library-import-release-safeguards` at `b5b282c`.

1. **What Votic helps me do:** the headline follows the account's saved purpose, with a general reading outcome when no purpose is selected.
2. **What it sounds and feels like:** Read / Listen / Understand tabs show one clearly labelled sample document. Read shows the existing word-emphasis preference; Listen plays actual device speech with available English voices and local speed controls; Understand reveals an explicitly labelled example answer. It does not send a model request or upload a visitor's document.
3. **What I receive and pay:** three initial benefits, an expandable complete list, store-backed billing cards, a selected-offer trial timeline, full billing terms, and a persistent purchase action. Weekly, monthly, annual and other periods appear only when returned by the current RevenueCat offering. Annual savings compare a numeric annual price with 12 monthly payments in the same currency. Missing or ambiguous comparisons have no badge.
4. **How I start:** a short explanation of the confirmed-purchase-to-library handoff, cancellation and restore help, and the existing account/restore/legal actions.

## Motion and audio

The preview is visible immediately; changing tabs brings the sample card into place with a short lift and rotation. Audio activity moves only during playback. Highlighting follows speech-engine boundary events, not an invented timer. Engines without word boundaries still play the sample without pretending to track words. Reduced motion removes the card transition, moving activity and advancing word highlights. No audio autoplays. Checkout, restore, changing tabs/voices/speed, backgrounding, blur and unmount stop owned preview audio. Delayed callbacks cannot revive a stopped sample.

The preview uses device text-to-speech, as the reader currently does. It is not a recording of an unavailable premium cloud voice. The selected preview speed and voice do not overwrite saved reader preferences.

## Store configuration and subsequent work

The implementation retains the current verified Premium entitlement and the existing Firebase/RevenueCat purchase flow. It does not create or price products in App Store Connect, Google Play Console or RevenueCat.

- To show additional billing periods, attach their real products to the current offering and the existing entitlement, validate store eligibility, then test purchases on native store builds. All displayed prices/trials come from those products. One membership is shown even when only one billing option is available.
- **Plus and Pro are not live in this change.** They need final usage allowances, real store products, verified server tier identification, and matching server enforcement. Both should share features; the future tier selector should compare allowances separately from billing periods. Product IDs and limits must not be inferred from client labels or trusted client claims.
- **Trial reminders are not enabled.** The timeline promises access and billing dates only. Add a reminder option only with permission-aware native scheduling, the verified trial expiry and cancellation/account-switch cleanup.
- **Testimonials/ratings are not fabricated.** Add only attributable feedback or verified store ratings when available.
- **A/B assignment and conversion analytics are not added.** First test the current design against this preview using stable assignments and a consistent eligible-user denominator. Measure paid conversion, revenue after speech/AI costs, refunds and renewal; let trials mature before comparing outcomes. A new weekly product, trial length or pricing change is a separate experiment, not a silent consequence of the UI update.

## Validation

Run mobile typecheck/lint, Vitest and Jest. Native store testing still needs a signed build with real configured products; web/Expo Go cannot validate billing or native device voice quality. The browser preview exercises the real React Native Web layout with development access, never a production purchase bypass.

Verified locally: TypeScript and ESLint passed; 361 Vitest tests and 420 Jest component/integration tests passed. React Native Web was inspected at 320, 390 and 768 pixels wide with no horizontal page overflow, including tab switching, the example answer, disclosure controls, the jump to plans and dark appearance. The voice sample play control is visible without scrolling at 390 × 844. Real native speech and store purchases still require device verification.

![Listening preview rendered from the application on React Native Web](paywall-preview.png)
