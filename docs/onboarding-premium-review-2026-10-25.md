# Votic onboarding review — October 25, 2026

## Status and evidence

**Mobbin research is blocked and incomplete: 0 of 100 distinct experiences reviewed (0 onboarding, 0 paywalls).** Mobbin's public homepage loaded, but https://mobbin.com/discover returned “This request was blocked” and “403 Forbidden”, including after one reload. This does not establish whether an authenticated account would resolve the restriction. No complete flow or animation was available for review. Marketing thumbnails do not count as reviewed experiences.

Consequently, there is no 100-entry source inventory or Mobbin-backed pattern synthesis in this report. The recommendations below are design judgments grounded in Votic's current source. Complete the research using accessible Mobbin flows or user-provided exports before treating these as comparative research findings. Do not share credentials in chat.

Research inventory: **empty**. For each eventual entry, capture app, platform, flow name/version, direct Mobbin URL, onboarding/paywall/both classification, sequence, payment placement, value demonstration, visual treatment, observable motion, personalization, permission timing, offer/disclosure/dismissal behavior, and Votic takeaway. Review 100 distinct experiences with at least 40 onboarding and 40 paywall experiences; track both categories separately and deduplicate identical flows.

Repository inspected: `Bmajor1997/Votic`. Verified latest consolidated remote branch: `feature/paywall-research-improvements-2026-10-22`, starting at `0ff1d26`. Recent work includes per-piece logo motion, voice discovery, remembered sign-in email, six accent colors, statistics corrections, note context, and answer-passage links. The branch contains credit wallet/webhook/catalog work. No applicable AGENTS.md files were found in the repository or checked ancestors. The other local checkout and main were left unchanged.

## Current implementation audit

Relevant source: `apps/mobile/app/_layout.tsx`, `welcome.tsx`, `ready.tsx`, `paywall.tsx`; `src/onboarding/PersonalizationQuestions.tsx`, `AccountSetupProvider.tsx`, `WelcomeMotion.tsx`, `HomeScreenWidgetsIntro.tsx`; `src/subscription/PaywallContent.tsx`, `PaywallPreview.tsx`, `usePaywallPreview.ts`, `offerText.ts`, `revenueCatService.ts`; `src/design/tokens.ts` and `src/theme/ThemeProvider.tsx`.

Before this correction, new-account navigation was Welcome → account creation → four personalization screens → paywall → widgets introduction → ready recap → Home. That makes the paywall an intermediate setup step. Existing account setup and subscription access are correctly separate facts.

What works:

- Welcome has clear social/email account choices and a full-size existing-account sign-in action.
- Personalization is useful: purpose, live reading-comfort preview, explanation examples, and listening with actual device voices, speed and highlight settings. It is more valuable than a purely decorative carousel.
- Per-account setup resumes saved progress and isolates account preferences. Existing-account migration avoids repeating setup for returning users.
- The paywall already personalizes its headline to purpose, offers a real sample voice preview, displays store-derived pricing/trial terms, supports restoration and recovery, and discloses the subscription requirement. Additional benefits/questions expand on demand.
- Scrollable content, large touch targets, reduced-motion navigation and alternate checkout placement for short screens/large fonts are useful foundations.
- Logo motion is implemented in React Native Animated. The Welcome flight is user-triggered and roughly 900 ms; Home has a separate two-second entrance. These are source-observed timings, not device-verified visual judgments.

What could improve:

- Setup changes subjects across preferences, widgets and a static recap. It lacks one continuous example showing what a user can accomplish.
- Four preference pages plus widgets and recap require substantial attention before use. Some controls could become optional inline customization.
- Importing and capturing notes are described rather than demonstrated in a connected pre-purchase story.
- The long widget-install instructions are secondary to reading/listening value. A future redesign should move this instruction to Home or Settings, after first value; this patch retains it and places it before payment.
- The Welcome sign-in animation delays a returning user's task. Consider a shorter motion with immediate navigation in a separate approved design change.
- Setup uses its own accent treatment while the logo uses blue. This can be coherent if blue consistently denotes identity and the setup accent consistently denotes interaction; avoid additional decorative colors.

These are source-based findings. Actual layout quality, text wrapping, timing and accessibility behavior still need device inspection.

## Priorities (design estimates, not measured conversion effects)

| Priority | Recommendation | Expected benefit | Effort |
| --- | --- | --- | --- |
| 1 | Finish setup before presenting the paywall | Correct sequencing, clear purchase-to-Home transition | Small; implemented |
| 2 | Use one sample document across Read, Listen and Keep demonstrations | Makes the core value tangible | Medium |
| 3 | Fold preference controls into those demonstrations; keep skipping simple | Reduces repeated explanation and decisions | Medium |
| 4 | Defer detailed widget setup until Home | Shortens the path to the primary task | Small/medium |
| 5 | Standardize hero card, type hierarchy and motion cadence | More coherent perceived quality | Medium |
| 6 | Shorten returning-user sign-in motion | Faster access for repeat use | Small |

## Recommended future flow — proposal only

Keep authentication in its existing architectural position for this iteration. Use original sample content, clearly marked “Sample”; simulated interactions must not imply an actual upload, saved personal file, AI request or completed store purchase.

| Screen | Purpose and suggested copy | Primary / secondary actions | Graphic and transition |
| --- | --- | --- | --- |
| Welcome | “Read. Listen. Keep what matters.” / “Turn your documents into reading, listening, and notes that fit you.” | Create account / Sign in; existing social choices | Existing V identity above one original document card; 320 ms one-time entrance |
| Account | Keep current secure account forms and legal links | Create account or social continuation / Back or Sign in | Quiet form, keyboard-aware scrolling; no additional artwork |
| Bring and read | “Your documents, easier to read.” / “Bring a PDF, Word file, EPUB, web article, or scan. Make the page comfortable for you.” | Continue / Skip demo; optional reading settings | Sample file card resolves into a readable paragraph. Offer current font/size/spacing preview inline; show format chips without requesting file/camera permissions |
| Listen | “Keep going, hands free.” / “Listen at your pace and follow the words as they're read.” | Continue / Skip; explicit Play sample | Reuse the same paragraph. Read/Listen selector, real device voice and speed controls; synchronize highlights with speech callbacks |
| Keep and personalize | “Keep the ideas you need.” / “Save a passage, organize notes, and ask about what you're reading.” | See plans / Back; optional purpose/explanation preferences | Tap a sample highlighted sentence to show a note card. End with a compact value recap on this same screen, rather than another ready page |
| Final paywall | Keep the real purpose-aware headline; fallback “Make more of what you read.” | Store-derived Subscribe/Start free trial / Restore Purchases, terms, privacy, account and sign-out | Compact version of the same document motif. Keep localized price and billing terms adjacent to checkout. No onboarding pages after success |

For new subscribers, confirmed access leads directly to Home. Subscribers bypass the paywall. Keep the current subscription-required product rules; no free-access dismissal is proposed. Existing developer-only testing access remains development-only.

Optional preferences should remain editable in Settings. Place camera permission at Scan and file selection at import, rather than during the demonstration. Do not request microphone permission for a text-only AI demonstration. Defer widgets until the person has a saved document to resume.

## Visual and motion specification — proposal only

Use the existing typography, 20-point card radius and spacing tokens. Use a warm neutral page, existing navy/text colors and one setup accent; retain the blue logo identity. Keep a single main illustration/card per page. Use real text rather than rasterized UI copy, scalable layouts, and meaningful accessibility labels. Preserve light/dark/high-contrast behavior. These timings are starting points for device tuning.

| Graphic/motion | Trigger, duration, easing, repeat | Implementation and performance | Reduced motion |
| --- | --- | --- | --- |
| V identity arrival | First Welcome appearance; 320 ms ease-out; once | Existing separated logo assets and Animated opacity/transform; avoid repeated glow layers or an infinite pulse | Static assembled logo |
| File becomes reader | Enter/tap sample on Bring and read; 420 ms cubic ease-out; once, replay only on request | Two lightweight RN views sharing title/position; crossfade and native-driver translate/scale instead of animating layout or parsing a real file | Show finished sample reader immediately |
| Read/Listen transformation | Tap mode selector; 260 ms ease-in-out; each explicit toggle | Reuse the same text/card, crossfade tool controls, translate selector indicator; keep actual mode text accessible | Immediate mode change |
| Spoken-word highlight | Explicit Play; duration follows actual sample speech; ends with speech | Reuse expo-speech callbacks and existing preview ownership/cancellation. A small optional waveform is decorative and must not claim real amplitude measurement; stop it when speech stops or page blurs | Keep meaningful text highlights; remove decorative waveform movement |
| Passage becomes note | Tap Save sample passage; 360 ms ease-out; once per tap | Duplicate only the short excerpt in an overlay, translate/scale into note card and remove overlay. Label as a sample; no backend writes | Immediate sample note plus accessible confirmation |
| Paywall reveal | Enter final paywall; 240 ms ease-out; once | Subtle opacity and 8-point translation of hero only. Keep price, terms and purchase action immediately usable; no staggered price reveal | All content visible immediately |

Use React Native Animated and Expo Router, already in the app, for interactive runtime behavior. Remotion may support offline motion studies, but do not introduce a video player or Remotion runtime to animate native controls. Stop animations on unmount/blur, and stop samples before checkout. Avoid continuous loops, expensive blur, particle fields, and large autoplay videos. A product demo should work without animation or sound.

## Implemented correction

The flow now runs:

Welcome → account creation → personalization → widgets introduction (native only) → ready recap → final paywall → Home after confirmed access.

- Widgets/ready depend on personalization progress rather than paid access, so they precede the paywall.
- The paywall requires both personalization and the completed recap; paid routes still require subscription access and completed setup.
- The ready action says “See Votic Premium plans” for unpaid accounts and “Start using Votic” for subscribers. Its body explains the next paid step.
- The existing saved completion timestamp now means the pre-purchase setup is done. No schema bump or forced replay is necessary. Previously completed accounts retain their progress.
- Trial/purchase/restore confirmation goes directly to Home after completed setup. Unknown, expired or absent entitlement cannot open paid routes. Cancel/pending/failure behavior remains on the paywall.
- A restart on the unpaid final paywall resumes there. Unfinished questions/widgets/recap retain their existing persistence. Protected routes keep previous setup screens out of the active navigation set, preventing Back from replaying completed setup.
- No price, trial, credit allowance, purchase implementation or subscription economics were changed. Repository configuration is not proof of live store offers. This work did not access Play Console or RevenueCat dashboards to verify production offers. The branch's `docs/credit-plan-integration-status.md` records remaining credit integration work; this report does not assert that the planned 1,000/2,000 credit offers are live.

## Validation and remaining checks

Automated checks: targeted onboarding/paywall/account/root-layout component and integration suites; real Expo Router filesystem route-filtering and onboarding-model tests; TypeScript; ESLint; formatting and diff checks. Final results: 73 tests passed across five component/integration suites; 14 tests passed across two routing/model suites; TypeScript, ESLint, formatting and diff checks passed.

Tests cover pre-paywall widgets/recap, subscribers skipping payment, blocked paid routes, saved completion without access, restart at the final paywall, purchase cancellation/pending/failure, trial confirmation, restoration, expired/unknown subscriptions and returning accounts. Router mocks are used for component tests; the filesystem guard suite additionally executes Expo Router's installed registration/filtering algorithm. This is not emulator E2E coverage.

Required emulator/device verification:

1. Fresh Android install: sign up, answer/skip each question, view widgets/recap, then reach paywall last.
2. Background/kill/relaunch during every stage, and while a store sheet is open; use Android Back and iOS gestures where relevant.
3. Sandbox purchase, trial eligibility/ineligibility, cancellation, pending payment, store/network failure and restore on the correct store account. Verify confirmed access goes straight to Home without repeated setup.
4. Returning subscriber, expired subscription and account switching; confirm no purchase or preferences cross account boundaries.
5. Small screen, large font, TalkBack/VoiceOver, dark/sepia/high-contrast and Reduce Motion.
6. Listen sample start/stop, incoming audio interruptions and checkout cancellation, including devices with different voice inventories.

Mobbin's 100-experience inventory and research-backed revisions remain pending accessible source material. No broader visual redesign was implemented.
