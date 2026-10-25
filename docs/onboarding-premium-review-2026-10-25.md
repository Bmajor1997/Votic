# Votic onboarding review — October 25, 2026

## Research findings and scope

The Mobbin plugin now provides access. This update replaces the earlier blocked-access research section. The application changes remain the paywall-order correction; the visual redesign is still a proposal.

The source inventory contains **100 distinct flow records across 83 apps**, divided into **50 primarily onboarding experiences and 50 primarily subscription/paywall/upgrade experiences**. Some onboarding records also include a paywall. Records are counted by distinct captured journey, not by screenshot count. Different versions or entry points from the same app are identified separately; overlapping fragments, repeated search results and unrelated journeys were excluded. This is a curated reference study, not a representative statistical sample or evidence of conversion lift.

**Review depth matters:** 381 screenshots were visually inspected, with exact positions recorded for every flow. Only 12 records have every screenshot visually inspected. The other 650 screen positions were text-screened with OCR to check intervening steps, covering all 1,031 recorded positions. OCR is supplementary and may miss text or controls. The inventory records both visual and OCR coverage; its visual observations deliberately retain their inspected-screen scope. Do not describe this work as 100 interactive end-to-end walkthroughs. No animation timings, real purchase behavior, backend entitlement, current store offer, or conversion rate was verified from static captures.

**Platform limitation:** the plugin exposes iOS and web, without Android search. This inventory uses iOS to prioritize mobile references; it supplies no Android evidence. Android navigation, permissions, billing and accessibility need native validation. Captures span different product versions and dates, including older captures. Their prices and offers are reference content rather than current market or Votic pricing.

Files:

- [Detailed 100-entry source inventory](mobbin-onboarding-paywall-inventory-2026-10-25.md): sequence, visuals, offer/dismissal, personalization/permissions, motion limitations and Votic lesson for every experience.
- [Sortable CSV inventory](mobbin-onboarding-paywall-inventory-2026-10-25.csv): same observations in tabular form.

Validation: 100 unique source URLs, 83 app names, 50 primary onboarding and 50 primary offer records, and complete coverage accounting for 1,031 screen positions. No reference images or raw OCR transcripts are included as deliverables.

## What the references support

### 1. Show a recognizable product result before asking for payment

[Evernote](https://mobbin.com/flows/4f4d734f-364e-4506-917e-6a5a17fbadff) uses a phone/UI demonstration during setup. [Notion](https://mobbin.com/flows/2ada33fc-fedc-4d26-a89a-96714e261e81) teaches real gestures with product screenshots. [Queue](https://mobbin.com/flows/b64d4f8a-1ff6-417e-8ac0-1d16d19f74b4) places podcast choices before its Pro offer and listening Home.

**Votic judgment:** one sample document should persist across the reading, listening and saved-note demonstrations. The same title, excerpt, highlight color and note destination should remain recognizable. This would explain Votic better than a succession of unrelated generic illustrations.

### 2. A coherent art direction matters more than the quantity of artwork

[Fable](https://mobbin.com/flows/859ea28a-a592-4ec5-8cf8-71e2cdd1756c) combines warm paper, green accents, serif headings and a consistent line-art character family. [Brilliant](https://mobbin.com/flows/7ffbd4f0-78d1-49be-bf0d-9c90cac00e8c) carries its green guide and learning-card motifs through questions and its trial explanation. [mymind](https://mobbin.com/flows/e5893443-6b29-4cfb-813d-156ee8142960) uses a warm gradient, sculptural art and editorial type across plans and the destination.

**Votic judgment:** use an editorial product style: warm neutral page, existing navy text, blue V identity, one interaction accent, and softly layered document cards. Keep live UI copy readable and native. Prefer one original hero composition over a new illustration style on every screen. A 3D mascot, photoreal backgrounds and neon effects together would weaken the visual consistency.

### 3. Personalization should earn its space

[Speechify's introductory flow](https://mobbin.com/flows/6ba96348-6b9d-43a5-a608-d84a78a2eeb0) asks what people read; its [subscription flow](https://mobbin.com/flows/a26dd806-20fc-4061-98c4-8a03756f2c10) recaps purpose, sources, voice and speed. [Neuecast](https://mobbin.com/flows/696bfa0b-ab96-41f1-8e22-7efb92a9f82b) offers useful starter-content choices and says they can change later. [Brilliant's other captured variant](https://mobbin.com/flows/20ad012b-2683-4c0c-beb8-8ff62c6f509e) makes skill options concrete with small examples.

**Votic judgment:** retain the live reading comfort and voice demonstrations already implemented. Fold optional purpose/explanation choices into them. Avoid importing demographic questions, broad habit assessments, acquisition surveys or commitment rituals just because another app has them. Show how a selected option changes the sample.

### 4. The final paywall is a deliberate product choice, not a universal research finding

[Matter](https://mobbin.com/flows/b6eea49b-47ad-4ef3-8883-729fbdaae8c3) places a Pro offer after source setup and before its queue; [Headway](https://mobbin.com/flows/a5187f3a-b2db-4bc7-a247-f882842ea146) has a trial guide immediately before its Home in the captured record. Other flows take different paths: [Skillshare](https://mobbin.com/flows/74cad4ce-4680-4706-a02e-4f49fad5db0b) shows topic selection after a plan page; [Alma](https://mobbin.com/flows/afe2cc2a-7672-43f7-b75c-15c1ff369a52), [Headspace](https://mobbin.com/flows/ccf14439-4c45-4d56-b031-45173490cafe) and [Bloom](https://mobbin.com/flows/d41da1db-1735-4c0a-928e-3d1a08301a19) have teaching, permissions or goals after the offer/payment sequence in inspected screenshots.

**Votic decision:** honor the requested final-paywall design. Preferences, demonstrations and the value recap come first; confirmed subscription access leads directly to Home. Do not copy post-purchase onboarding merely because it appears in a reference. A brief confirmed-purchase feedback state is not another required setup page.

### 5. Keep offer mechanics understandable and recovery visible

[Alma](https://mobbin.com/flows/afe2cc2a-7672-43f7-b75c-15c1ff369a52) groups benefits, plans and recovery links compactly. [Grok](https://mobbin.com/flows/0eda8f6a-070f-40c2-a88d-f322af31641d) changes its CTA/terms with the selected offer. [Notion Plus & AI](https://mobbin.com/flows/5f364e70-6361-4277-9cb3-fe2e765f8a64) shows tier tabs, billing choices and a price-specific action. [Stake](https://mobbin.com/flows/c32a7f33-d755-47fa-a144-e84c769f27f3) explicitly shows a failed payment and another-method recovery.

**Votic judgment:** preserve the working store-derived pricing/trial disclosures and Restore Purchases. Keep the real charge beside checkout. Do not copy discount claims, reminder promises, social-proof numbers, free-tier dismissals or refund guarantees unless Votic actually implements them. Credit allowances must come from verified product configuration; an attractive feature matrix does not establish a live allowance.

### 6. Delay secondary setup until it can help

[Tiimo's captured onboarding](https://mobbin.com/flows/16df946d-5f8e-45f7-b93d-951241938530) leaves optional setup cards on Home. [monday.com's tutorial](https://mobbin.com/flows/d35a64a4-8d5e-41f8-8656-c881c7b0b923) teaches controls in a real first board rather than making every lesson an initial setup page.

**Votic judgment:** in a later redesign, introduce widgets after a document exists, through a dismissible Home card or Settings. The current correction keeps the widget introduction but places it before the paywall, as authorized. Moving it into Home is a separate proposed design change.

### Motion evidence and recommendation boundary

These references establish composition, content order and static states. They do not establish animation duration, easing, looping or measured performance. All motion timings later in this report are original implementation proposals based on Votic's existing React Native Animated/Expo Router stack. They are not claimed as observed Mobbin animations.

Repository inspected: `Bmajor1997/Votic`. Verified latest consolidated remote branch: `feature/paywall-research-improvements-2026-10-22`, starting at `0ff1d26`, with the paywall correction subsequently committed as `5eb1317`. This research follow-up starts from `5eb1317` and changes documentation only. Recent work includes per-piece logo motion, voice discovery, remembered sign-in email, six accent colors, statistics corrections, note context, and answer-passage links. The branch contains credit wallet/webhook/catalog work. No applicable AGENTS.md files were found in the repository or checked ancestors. The other local checkout and main were left unchanged.

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

These are findings from Votic source, interpreted alongside the screenshot study above. Actual layout quality, text wrapping, timing and accessibility behavior still need device inspection.

## Priorities (design estimates, not measured conversion effects)

| Priority | Recommendation                                                           | Expected benefit                                      | Effort             |
| -------- | ------------------------------------------------------------------------ | ----------------------------------------------------- | ------------------ |
| 1        | Finish setup before presenting the paywall                               | Correct sequencing, clear purchase-to-Home transition | Small; implemented |
| 2        | Use one sample document across Read, Listen and Keep demonstrations      | Makes the core value tangible                         | Medium             |
| 3        | Fold preference controls into those demonstrations; keep skipping simple | Reduces repeated explanation and decisions            | Medium             |
| 4        | Defer detailed widget setup until Home                                   | Shortens the path to the primary task                 | Small/medium       |
| 5        | Standardize hero card, type hierarchy and motion cadence                 | More coherent perceived quality                       | Medium             |
| 6        | Shorten returning-user sign-in motion                                    | Faster access for repeat use                          | Small              |

## Recommended future flow — proposal only

Keep authentication in its existing architectural position for this iteration. Use original sample content, clearly marked “Sample”; simulated interactions must not imply an actual upload, saved personal file, AI request or completed store purchase.

| Screen               | Purpose and suggested copy                                                                                                   | Primary / secondary actions                                                                        | Graphic and transition                                                                                                                                            |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Welcome              | “Read. Listen. Keep what matters.” / “Turn your documents into reading, listening, and notes that fit you.”                  | Create account / Sign in; existing social choices                                                  | Existing V identity above one original document card; 320 ms one-time entrance                                                                                    |
| Account              | Keep current secure account forms and legal links                                                                            | Create account or social continuation / Back or Sign in                                            | Quiet form, keyboard-aware scrolling; no additional artwork                                                                                                       |
| Bring and read       | “Your documents, easier to read.” / “Bring a PDF, Word file, EPUB, web article, or scan. Make the page comfortable for you.” | Continue / Skip demo; optional reading settings                                                    | Sample file card resolves into a readable paragraph. Offer current font/size/spacing preview inline; show format chips without requesting file/camera permissions |
| Listen               | “Keep going, hands free.” / “Listen at your pace and follow the words as they're read.”                                      | Continue / Skip; explicit Play sample                                                              | Reuse the same paragraph. Read/Listen selector, real device voice and speed controls; synchronize highlights with speech callbacks                                |
| Keep and personalize | “Keep the ideas you need.” / “Save a passage, organize notes, and ask about what you're reading.”                            | See plans / Back; optional purpose/explanation preferences                                         | Tap a sample highlighted sentence to show a note card. End with a compact value recap on this same screen, rather than another ready page                         |
| Final paywall        | Keep the real purpose-aware headline; fallback “Make more of what you read.”                                                 | Store-derived Subscribe/Start free trial / Restore Purchases, terms, privacy, account and sign-out | Compact version of the same document motif. Keep localized price and billing terms adjacent to checkout. No onboarding pages after success                        |

For new subscribers, confirmed access leads directly to Home. Subscribers bypass the paywall. Keep the current subscription-required product rules; no free-access dismissal is proposed. Existing developer-only testing access remains development-only.

Optional preferences should remain editable in Settings. Place camera permission at Scan and file selection at import, rather than during the demonstration. Do not request microphone permission for a text-only AI demonstration. Defer widgets until the person has a saved document to resume.

## Visual and motion specification — proposal only

Use the existing typography, 20-point card radius and spacing tokens. Use a warm neutral page, existing navy/text colors and one setup accent; retain the blue logo identity. Keep a single main illustration/card per page. Use real text rather than rasterized UI copy, scalable layouts, and meaningful accessibility labels. Preserve light/dark/high-contrast behavior. These timings are starting points for device tuning.

| Graphic/motion             | Trigger, duration, easing, repeat                                                       | Implementation and performance                                                                                                                                                                          | Reduced motion                                                       |
| -------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------- |
| V identity arrival         | First Welcome appearance; 320 ms ease-out; once                                         | Existing separated logo assets and Animated opacity/transform; avoid repeated glow layers or an infinite pulse                                                                                          | Static assembled logo                                                |
| File becomes reader        | Enter/tap sample on Bring and read; 420 ms cubic ease-out; once, replay only on request | Two lightweight RN views sharing title/position; crossfade and native-driver translate/scale instead of animating layout or parsing a real file                                                         | Show finished sample reader immediately                              |
| Read/Listen transformation | Tap mode selector; 260 ms ease-in-out; each explicit toggle                             | Reuse the same text/card, crossfade tool controls, translate selector indicator; keep actual mode text accessible                                                                                       | Immediate mode change                                                |
| Spoken-word highlight      | Explicit Play; duration follows actual sample speech; ends with speech                  | Reuse expo-speech callbacks and existing preview ownership/cancellation. A small optional waveform is decorative and must not claim real amplitude measurement; stop it when speech stops or page blurs | Keep meaningful text highlights; remove decorative waveform movement |
| Passage becomes note       | Tap Save sample passage; 360 ms ease-out; once per tap                                  | Duplicate only the short excerpt in an overlay, translate/scale into note card and remove overlay. Label as a sample; no backend writes                                                                 | Immediate sample note plus accessible confirmation                   |
| Paywall reveal             | Enter final paywall; 240 ms ease-out; once                                              | Subtle opacity and 8-point translation of hero only. Keep price, terms and purchase action immediately usable; no staggered price reveal                                                                | All content visible immediately                                      |

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

The plugin-based 100-reference inventory is now available. Complete visual/interactive walkthroughs, observed motion research, Android references and conversion validation remain outside this static screenshot study. No broader visual redesign was implemented.
