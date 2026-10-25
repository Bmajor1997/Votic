# Mobbin source inventory — 100 flow references

100 distinct Mobbin flow IDs across 83 apps: 50 primarily onboarding and 50 primarily subscription/paywall/upgrade experiences. Some onboarding flows also contain an offer. These are flow records, not 100 apps or 100 separate paywall screens. Different versions or entry points remain separate when the captured journey differs. Repeated or overlapping search results and unrelated journeys were excluded.

**Evidence scope:** 1,031 recorded screen positions are covered: 381 visually inspected and the other 650 text-screened with OCR. All 100 records have source material reviewed; only 12 have every screenshot visually inspected. OCR is supplementary, can miss controls or words, and is not an interactive walkthrough. The notes below describe the visually inspected sequence, with intervening OCR material used to flag missing context. Exact coverage positions are provided per record. No animation, backend access, conversion result or current billing behavior was verified. Prices/trials are historical capture content, not current offers. The connector supplies no Android search; all records here are iOS.

Some entries are first-use segments (for example a first-task tutorial) or offer comparisons rather than entire account-to-Home journeys; their names preserve this distinction. Unknowns are retained rather than inferred from missing screens.

## 001. Matter — Onboarding

[Open source flow](https://mobbin.com/flows/b6eea49b-47ad-4ef3-8883-729fbdaae8c3) · Onboarding · iOS · 20 recorded screens.
Visual inspection: positions 1,6,11,15,16,17,18,19,20. Supplementary OCR: 2,3,4,5,7,8,9,10,12,13,14.

**Observed sequence:** Splash → account → intended uses → link/newsletter setup → Pro introduction → trial reminder → annual offer → no-card welcome trial → queue.
**Graphics, typography, spacing, color:** Dark reading setup; purple/pink atmospheric offer, white rounded controls and compact annual plan card.
**Offer, placement and dismissal:** Offer at screen 18/20 after setup, before queue; seven-day trial, annual total plus monthly equivalent, X; subsequent no-card trial screen is a distinct captured state, not proof of universal eligibility.
**Personalization and permissions:** Use selection; newsletter connection has Skip.
**Motion:** Static screenshots only; no movement, easing or duration verified.
**Votic takeaway (design judgment):** Explain the import sources and allow optional integrations to be skipped.

## 002. Matter — Onboarding

[Open source flow](https://mobbin.com/flows/240006b0-7613-4401-a700-9d87a5180ba7) · Onboarding · iOS · 13 recorded screens.
Visual inspection: positions 1,4,7,10,13. Supplementary OCR: 2,3,5,6,8,9,11,12.

**Observed sequence:** Splash → reading habit explanation → yearly book estimate → reading/listening choice → personalization introduction.
**Graphics, typography, spacing, color:** White line illustrations on black; large numeric outcome; short progress indicator.
**Offer, placement and dismissal:** No offer in sampled screens; this is an introductory onboarding segment.
**Personalization and permissions:** Reading/listening preference and reading goal.
**Motion:** Static screenshots only; no movement, easing or duration verified.
**Votic takeaway (design judgment):** Give preference questions a visible purpose; avoid unsupported outcome estimates.

## 003. Speechify — Onboarding

[Open source flow](https://mobbin.com/flows/6ba96348-6b9d-43a5-a608-d84a78a2eeb0) · Onboarding · iOS · 13 recorded screens.
Visual inspection: positions 1,4,7,10,13. Supplementary OCR: 2,3,5,6,8,9,11,12.

**Observed sequence:** Splash → gender → name → reading-source choices → listening customization introduction.
**Graphics, typography, spacing, color:** Blue identity, generous white space, outlined option cards, headphone character.
**Offer, placement and dismissal:** No offer inspected in this segment; later subscription flow reviewed separately.
**Personalization and permissions:** Name, gender, document types; sign-in link.
**Motion:** Static screenshots only; no movement, easing or duration verified.
**Votic takeaway (design judgment):** Demonstrate listening without collecting unrelated demographics.

## 004. Headway — Onboarding

[Open source flow](https://mobbin.com/flows/a5187f3a-b2db-4bc7-a247-f882842ea146) · Onboarding · iOS · 41 recorded screens.
Visual inspection: positions 1,11,21,31,40,41. Supplementary OCR: 2,3,4,5,6,7,8,9,10,12,13,14,15,16,17,18,19,20,22,23,24,25,26,27,28,29,30,32,33,34,35,36,37,38,39.

**Observed sequence:** Splash → focus choice → illustrated audio-summary explanation → habit question → recommendations Home; trial guide at screen 40 before Home at 41.
**Graphics, typography, spacing, color:** Blue accent, warm paper, illustrated phone/headphones, segmented progress.
**Offer, placement and dismissal:** Trial guide at screen 40/41, after personalization/commitment and before Home; X and Start free trial; full localized billing terms not established by this guide alone.
**Personalization and permissions:** Goal and habit questions.
**Motion:** Static screenshots only; no movement, easing or duration verified.
**Votic takeaway (design judgment):** Use product-specific illustration, while keeping Votic substantially shorter than this 41-screen record.

## 005. Alma — Subscribing to premium membership

[Open source flow](https://mobbin.com/flows/afe2cc2a-7672-43f7-b75c-15c1ff369a52) · Paywall / subscription offer · iOS · 6 recorded screens.
Visual inspection: positions 1,4,6. Supplementary OCR: 2,3,5.

**Observed sequence:** Premium sheet → usage tutorial → dashboard.
**Graphics, typography, spacing, color:** Cream surface, dark green CTA, serif headline, compact benefit checklist.
**Offer, placement and dismissal:** 7-day trial; monthly/yearly choices and renewal price; X, restore and legal links visible.
**Personalization and permissions:** Tutorial shows example questions and a central add action.
**Motion:** Static screenshots only; no movement, easing or duration verified.
**Votic takeaway (design judgment):** Use one concise benefit group, then clear plan selection; move tutorials before Votic's paywall.

## 006. Apple Podcasts — Subscribing to a channel

[Open source flow](https://mobbin.com/flows/381a2778-e4d7-4737-bce2-5b06f91e31d8) · Paywall / subscription offer · iOS · 5 recorded screens.
Visual inspection: positions 1,3,5. Supplementary OCR: 2,4.

**Observed sequence:** Channel page → subscription offer → subscriber channel page.
**Graphics, typography, spacing, color:** Branded blue hero and real show covers; white offer surface; purple CTA.
**Offer, placement and dismissal:** Two plans and 7-day trial shown; X dismiss control.
**Personalization and permissions:** Channel content establishes what membership unlocks.
**Motion:** Static screenshots only; no movement, easing or duration verified.
**Votic takeaway (design judgment):** Show a concrete reading/listening outcome above the offer.

## 007. The Atlantic Magazine — Subscribe to The Atlantic

[Open source flow](https://mobbin.com/flows/be71df59-0b65-4698-9ee5-7e80987142b1) · Paywall / subscription offer · iOS · 3 recorded screens.
Visual inspection: positions 1,2,3. Supplementary OCR: not needed; every screenshot visually inspected.

**Observed sequence:** Settings subscribe entry → trial offer → scrolled billing terms.
**Graphics, typography, spacing, color:** Editorial serif headline, cream panel, restrained red accents, two plan cards.
**Offer, placement and dismissal:** Two-week trial, monthly/yearly plans; Cancel; sign-in/restore.
**Personalization and permissions:** No personalization observed.
**Motion:** Static screenshots only; no movement, easing or duration verified.
**Votic takeaway (design judgment):** Borrow the editorial calm and visible recovery links, not the long legal-text density.

## 008. Pillow — Subscribing to Premium

[Open source flow](https://mobbin.com/flows/9b4eb007-54f7-4a93-b7d9-0c2fb645faf0) · Paywall / subscription offer · iOS · 10 recorded screens.
Visual inspection: positions 1,4,7,10. Supplementary OCR: 2,3,5,6,8,9.

**Observed sequence:** Invitation → included premium features → store trial sheet → sleep dashboard.
**Graphics, typography, spacing, color:** Purple gradient, large outlined feature icons and spacious type.
**Offer, placement and dismissal:** Store sheet shows one-week trial and annual renewal; final dashboard follows.
**Personalization and permissions:** No personalization observed in previews.
**Motion:** Static screenshots only; no movement, easing or duration verified.
**Votic takeaway (design judgment):** Keep premium benefits readable and route directly to useful content after payment.

## 009. Goodreads — Onboarding

[Open source flow](https://mobbin.com/flows/50f86dd7-f922-43b9-961f-36af19d88b8e) · Onboarding · iOS · 17 recorded screens.
Visual inspection: positions 1,5,9,13,17. Supplementary OCR: 2,3,4,6,7,8,10,11,12,14,15,16.

**Observed sequence:** Splash → create account → annual reading goal → genres → recommendations Home.
**Graphics, typography, spacing, color:** Warm beige brand, traditional serif wordmark, book covers and genre tiles.
**Offer, placement and dismissal:** No offer visible in sampled screens.
**Personalization and permissions:** Reading target, genres, Skip and Next.
**Motion:** Static screenshots only; no movement, easing or duration verified.
**Votic takeaway (design judgment):** Use familiar document visuals and make goal selection optional.

## 010. Apple Books — Onboarding

[Open source flow](https://mobbin.com/flows/73f23bc5-3288-41fe-a4b9-b71095b9c6fa) · Onboarding · iOS · 4 recorded screens.
Visual inspection: positions 1,3,4. Supplementary OCR: 2.

**Observed sequence:** Welcome/value explanation → notification prompt → Books Home.
**Graphics, typography, spacing, color:** Minimal white sheet, app icon, black CTA; editorial content cards.
**Offer, placement and dismissal:** No subscription offer in previews.
**Personalization and permissions:** Notification pre-prompt and system prompt; Not Now visible.
**Motion:** Static screenshots only; no movement, easing or duration verified.
**Votic takeaway (design judgment):** Explain optional permissions at a useful moment and keep a clear deferral.

## 011. Fable — Onboarding

[Open source flow](https://mobbin.com/flows/859ea28a-a592-4ec5-8cf8-71e2cdd1756c) · Onboarding · iOS · 32 recorded screens.
Visual inspection: positions 1,9,17,24,32. Supplementary OCR: 2,3,4,5,6,7,8,10,11,12,13,14,15,16,18,19,20,21,22,23,25,26,27,28,29,30,31.

**Observed sequence:** Splash → books/TV choice → genre chips → personalized thank-you → Home setup suggestions.
**Graphics, typography, spacing, color:** Cream paper, green accents, serif headings, consistent black-and-white character illustrations.
**Offer, placement and dismissal:** No offer visible in sampled screens.
**Personalization and permissions:** Interest chips; preferences editable later.
**Motion:** Static screenshots only; no movement, easing or duration verified.
**Votic takeaway (design judgment):** Use a single illustration family and show that choices affect the experience.

## 012. bless. — Subscription

[Open source flow](https://mobbin.com/flows/aa956b58-fb2c-40b5-a9af-ca313fb252ba) · Paywall / subscription offer · iOS · 2 recorded screens.
Visual inspection: positions 1,2. Supplementary OCR: not needed; every screenshot visually inspected.

**Observed sequence:** Profile membership row → unlock-benefits sheet for an existing subscriber.
**Graphics, typography, spacing, color:** Black background, large colored abstract shapes and line-art hand, green CTA.
**Offer, placement and dismissal:** 7-day trial copy; already-subscribed state; X and privacy/terms; price not shown.
**Personalization and permissions:** No personalization observed.
**Motion:** Static screenshots only; no movement, easing or duration verified.
**Votic takeaway (design judgment):** Treat already-subscribed visitors distinctly; decorative shapes should not displace billing clarity.

## 013. Jobber — Subscription

[Open source flow](https://mobbin.com/flows/e6e28fb7-a294-4b88-b03e-1617e967e47b) · Paywall / subscription offer · iOS · 5 recorded screens.
Visual inspection: positions 1,3,5. Supplementary OCR: 2,4.

**Observed sequence:** More → choose-plan carousel → scrolled feature/restore section.
**Graphics, typography, spacing, color:** White cards, deep teal headings, green action, compact line icons.
**Offer, placement and dismissal:** Introductory price and subsequent price; trial-ending language, restore and legal links.
**Personalization and permissions:** No personalization observed.
**Motion:** Static screenshots only; no movement, easing or duration verified.
**Votic takeaway (design judgment):** Make both introductory and renewal charges explicit and accessible.

## 014. Instagram — Purchasing a subscription

[Open source flow](https://mobbin.com/flows/0fc16673-00b5-4930-92a2-fd82c65963d8) · Paywall / subscription offer · iOS · 7 recorded screens.
Visual inspection: positions 1,4,7. Supplementary OCR: 2,3,5,6.

**Observed sequence:** Suggested creator subscriptions → store confirmation → exclusive creator feed.
**Graphics, typography, spacing, color:** Familiar blue buttons and creator identity/content; native payment sheet.
**Offer, placement and dismissal:** Store subscription confirmation shown; final exclusive content visible; app offer intermediate not inspected.
**Personalization and permissions:** Creator selection.
**Motion:** Static screenshots only; no movement, easing or duration verified.
**Votic takeaway (design judgment):** Connect the purchase to specific unlocked content; preserve native confirmation.

## 015. Insight Timer — Subscription & donations

[Open source flow](https://mobbin.com/flows/885aa508-ff69-4d75-973f-4229d6a4c8bc) · Paywall / subscription offer · iOS · 3 recorded screens.
Visual inspection: positions 1,2,3. Supplementary OCR: not needed; every screenshot visually inspected.

**Observed sequence:** Settings → subscription/donations offer → same offer lower down.
**Graphics, typography, spacing, color:** Warm white, serif heading, portrait collage and gold CTA.
**Offer, placement and dismissal:** Subscribe and Restore visible; no billing terms or checkout in these three screens.
**Personalization and permissions:** No personalization observed.
**Motion:** Static screenshots only; no movement, easing or duration verified.
**Votic takeaway (design judgment):** Use authentic content previews; do not substitute a collage for clear Votic plan terms.

## 016. Udemy — Subscription

[Open source flow](https://mobbin.com/flows/644ee342-b798-456d-8669-bcc90fe0a869) · Paywall / subscription offer · iOS · 2 recorded screens.
Visual inspection: positions 1,2. Supplementary OCR: not needed; every screenshot visually inspected.

**Observed sequence:** Account → available personal subscription plan.
**Graphics, typography, spacing, color:** Restrained black text, white layout, benefit bullets, black outlined/filled actions.
**Offer, placement and dismissal:** Starting monthly amount, Start subscription and Learn more; no store sheet inspected.
**Personalization and permissions:** No personalization observed.
**Motion:** Static screenshots only; no movement, easing or duration verified.
**Votic takeaway (design judgment):** Describe paid benefits directly; Votic should show actual localized price rather than a vague starting price.

## 017. Evernote — Onboarding

[Open source flow](https://mobbin.com/flows/4f4d734f-364e-4506-917e-6a5a17fbadff) · Onboarding · iOS · 13 recorded screens.
Visual inspection: positions 1,4,7,10,13. Supplementary OCR: 2,3,5,6,8,9,11,12.

**Observed sequence:** Splash → product preview/personalization → preparation/proof → offer success → Home.
**Graphics, typography, spacing, color:** White canvas, green brand, purple accents, phone UI mockup and progress ring.
**Offer, placement and dismissal:** Offer shown after preparation, before Home; limited-plan link and trial/introductory choices.
**Personalization and permissions:** Personalization progress; Home retains setup invitation.
**Motion:** Static screenshots only; no movement, easing or duration verified.
**Votic takeaway (design judgment):** Use the product preview, but do not add a fake preparation delay or unsupported proof.

## 018. Notion — Onboarding

[Open source flow](https://mobbin.com/flows/2ada33fc-fedc-4d26-a89a-96714e261e81) · Onboarding · iOS · 14 recorded screens.
Visual inspection: positions 1,4,8,11,14. Supplementary OCR: 2,3,5,6,7,9,10,12,13.

**Observed sequence:** Welcome/login → Google authentication → interests → gesture tutorial → workspace.
**Graphics, typography, spacing, color:** Monochrome illustration with sparse color; generous white space and real UI screenshots.
**Offer, placement and dismissal:** No paywall in sampled screens.
**Personalization and permissions:** Interest grid; Skip; gesture lesson.
**Motion:** Static screenshots only; no movement, easing or duration verified.
**Votic takeaway (design judgment):** Use a real sample UI to teach one action instead of a generic decorative hero.

## 019. Fabric — Setting up an account

[Open source flow](https://mobbin.com/flows/0d0fcf38-1786-421a-9545-82bed7e2a26d) · Onboarding · iOS · 14 recorded screens.
Visual inspection: positions 1,4,8,11,14. Supplementary OCR: 2,3,5,6,7,9,10,12,13.

**Observed sequence:** Name → purpose → digital-mind introduction → share-sheet guide → example-content Home.
**Graphics, typography, spacing, color:** White with lavender accents, mixed serif/sans headlines, product walkthrough cards.
**Offer, placement and dismissal:** Upgrade entry appears on Home; no offer inspected.
**Personalization and permissions:** Personal/work/study use case; share-extension tutorial.
**Motion:** Static screenshots only; no movement, easing or duration verified.
**Votic takeaway (design judgment):** Make import discoverable with a contextual guide; avoid a long system-setup detour before payment.

## 020. Raycast — Onboarding

[Open source flow](https://mobbin.com/flows/1c30eb52-9997-4a33-a50d-05dc3e7a8f09) · Onboarding · iOS · 9 recorded screens.
Visual inspection: positions 1,5,9. Supplementary OCR: 2,3,4,6,7,8.

**Observed sequence:** Dark welcome → create-account form → search/commands Home.
**Graphics, typography, spacing, color:** Red glowing logo on black; strong white actions; light destination UI.
**Offer, placement and dismissal:** No offer in sampled screens.
**Personalization and permissions:** Email/social sign-up; no preferences visible.
**Motion:** Static screenshots only; no movement, easing or duration verified.
**Votic takeaway (design judgment):** A strong identity mark can feel polished without multiple decorative scenes.

## 021. FocusFlight — Onboarding

[Open source flow](https://mobbin.com/flows/532e8d22-e823-44b9-878c-176637d2dec5) · Onboarding · iOS · 13 recorded screens.
Visual inspection: positions 1,4,7,10,13. Supplementary OCR: 2,3,5,6,8,9,11,12.

**Observed sequence:** Welcome aboard → brand explanation → focus scenarios → map appearance → start journey.
**Graphics, typography, spacing, color:** Flight metaphor; dark imagery, pastel scenario chips, map-preview cards.
**Offer, placement and dismissal:** No offer in sampled screens.
**Personalization and permissions:** Focus scenario and appearance choices.
**Motion:** Static screenshots only; no movement, easing or duration verified.
**Votic takeaway (design judgment):** Keep a coherent visual metaphor, but only offer choices that affect Votic.

## 022. Tiimo — Onboarding

[Open source flow](https://mobbin.com/flows/817f5bfd-1701-4756-bcbc-dcdfc3597723) · Onboarding · iOS · 16 recorded screens.
Visual inspection: positions 1,5,9,12,16. Supplementary OCR: 2,3,4,6,7,8,10,11,13,14,15.

**Observed sequence:** Splash → email account → primary need → illustrated social proof → calendar import.
**Graphics, typography, spacing, color:** Lavender gradient, serif headings, pill choices, line-art people.
**Offer, placement and dismissal:** No offer in sampled screens.
**Personalization and permissions:** Need selection; calendar import Skip.
**Motion:** Static screenshots only; no movement, easing or duration verified.
**Votic takeaway (design judgment):** Put optional integrations behind a clear skip and keep illustrations consistent.

## 023. Todoist — Onboarding

[Open source flow](https://mobbin.com/flows/9910ff65-57e3-4946-aad3-d032a01f5d71) · Onboarding · iOS · 7 recorded screens.
Visual inspection: positions 1,4,7. Supplementary OCR: 2,3,5,6.

**Observed sequence:** Welcome → email sign-up → introductory checklist → project list.
**Graphics, typography, spacing, color:** Red brand accent, light product illustration, checked benefit rows.
**Offer, placement and dismissal:** No offer in sampled screens.
**Personalization and permissions:** Multiple account methods; no goal selection shown.
**Motion:** Static screenshots only; no movement, easing or duration verified.
**Votic takeaway (design judgment):** Promise a small number of concrete outcomes, then hand off quickly.

## 024. Notion — Onboarding

[Open source flow](https://mobbin.com/flows/5ed77200-e4f1-4053-b071-aa716a704569) · Onboarding · iOS · 15 recorded screens.
Visual inspection: positions 1,5,8,12,15. Supplementary OCR: 2,3,4,6,7,9,10,11,13,14.

**Observed sequence:** Splash → authentication choices → verification → Home-tab tutorial → workspace.
**Graphics, typography, spacing, color:** White/gray system, thin illustration, blue CTA and direct product screenshot.
**Offer, placement and dismissal:** No offer in sampled screens.
**Personalization and permissions:** Multiple sign-in methods; organized starter content.
**Motion:** Static screenshots only; no movement, easing or duration verified.
**Votic takeaway (design judgment):** Use the same navigation labels in demonstrations and in the actual app.

## 025. Opal — Completing app setup

[Open source flow](https://mobbin.com/flows/210e154f-3fc0-42db-8c2e-ba584f2a0254) · Onboarding · iOS · 22 recorded screens.
Visual inspection: positions 1,6,12,17,22. Supplementary OCR: 2,3,4,5,7,8,9,10,11,13,14,15,16,18,19,20,21.

**Observed sequence:** Focus introduction → apps to block → notification explanation → referral code → active session.
**Graphics, typography, spacing, color:** Black canvas, white pills, blue instructional arrow and photo-led session.
**Offer, placement and dismissal:** Referral mentions Pro time; no priced offer in sampled screens.
**Personalization and permissions:** App selection; notification prompt; referral input.
**Motion:** Static screenshots only; no movement, easing or duration verified.
**Votic takeaway (design judgment):** Explain system permissions where needed; omit referral questions from Votic's essential path.

## 026. Quizlet — Onboarding

[Open source flow](https://mobbin.com/flows/2327db2e-02f8-41d5-9ce3-4d19bf2a8816) · Onboarding · iOS · 13 recorded screens.
Visual inspection: positions 1,4,7,10,13. Supplementary OCR: 2,3,5,6,8,9,11,12.

**Observed sequence:** Splash → account → validation/role selection → premium trial → Home.
**Graphics, typography, spacing, color:** Blue/purple identity, white form, dark premium hero and yellow CTA.
**Offer, placement and dismissal:** Trial offer before Home; seven-day trial, benefits, Skip for now.
**Personalization and permissions:** Student/teacher role and form validation.
**Motion:** Static screenshots only; no movement, easing or duration verified.
**Votic takeaway (design judgment):** Use clear value and recovery; Votic's dismissal must follow its own subscription-required rules.

## 027. Brilliant — Onboarding

[Open source flow](https://mobbin.com/flows/7ffbd4f0-78d1-49be-bf0d-9c90cac00e8c) · Onboarding · iOS · 15 recorded screens.
Visual inspection: positions 1,5,8,12,15. Supplementary OCR: 2,3,4,6,7,9,10,11,13,14.

**Observed sequence:** Splash → relevance/proof → learning-time preference → account → trial timeline.
**Graphics, typography, spacing, color:** White space, green accent, compact learning illustrations and speech-bubble guide.
**Offer, placement and dismissal:** Final sampled screen is trial timeline with actual annual charge and close control.
**Personalization and permissions:** Learning schedule; account methods.
**Motion:** Static screenshots only; no movement, easing or duration verified.
**Votic takeaway (design judgment):** Give each question context, then present one clear timeline if Votic's real offer supports a trial.

## 028. Udemy — Onboarding

[Open source flow](https://mobbin.com/flows/a387dcfd-c823-4fe1-a4f5-9f20b3892367) · Onboarding · iOS · 13 recorded screens.
Visual inspection: positions 1,4,7,10,13. Supplementary OCR: 2,3,5,6,8,9,11,12.

**Observed sequence:** Splash → email sign-up → verification → learning field → recommended catalog.
**Graphics, typography, spacing, color:** Black line-art icons, white forms, purple verification CTA, instructor photography.
**Offer, placement and dismissal:** No paywall in sampled screens.
**Personalization and permissions:** Learning field; Save & exit.
**Motion:** Static screenshots only; no movement, easing or duration verified.
**Votic takeaway (design judgment):** Let a small number of useful choices shape the destination without blocking progress.

## 029. Skillshare — Onboarding

[Open source flow](https://mobbin.com/flows/74cad4ce-4680-4706-a02e-4f49fad5db0b) · Onboarding · iOS · 11 recorded screens.
Visual inspection: positions 1,4,8,11. Supplementary OCR: 2,3,5,6,7,9,10.

**Observed sequence:** Photo-led welcome → plan choice → topic selection → course Home.
**Graphics, typography, spacing, color:** Creative work photography, oversized serif headline, dark teal and bright green actions.
**Offer, placement and dismissal:** Paywall appears early, before topic setup; trial and annual total visible; X.
**Personalization and permissions:** Topic tiles; Skip for now at welcome.
**Motion:** Static screenshots only; no movement, easing or duration verified.
**Votic takeaway (design judgment):** Use authentic output imagery, but keep Votic's topic/setup decisions before payment.

## 030. MasterClass — Onboarding

[Open source flow](https://mobbin.com/flows/511e85e4-8fb6-43d6-a043-2c1aa965fdf4) · Onboarding · iOS · 10 recorded screens.
Visual inspection: positions 1,4,7,10. Supplementary OCR: 2,3,5,6,8,9.

**Observed sequence:** Splash → account methods → account form → catalog upsell.
**Graphics, typography, spacing, color:** Black background, restrained red wordmark/action, real instructor photographs.
**Offer, placement and dismissal:** Get All-Access entry on final Home; priced offer not inspected.
**Personalization and permissions:** Account methods; no preference form visible.
**Motion:** Static screenshots only; no movement, easing or duration verified.
**Votic takeaway (design judgment):** Use actual document examples as the equivalent of recognizable course content.

## 031. Mimo — Onboarding

[Open source flow](https://mobbin.com/flows/a59b2d63-1c67-4f4c-9fac-e9565ee90657) · Onboarding · iOS · 21 recorded screens.
Visual inspection: positions 1,6,11,16,21. Supplementary OCR: 2,3,4,5,7,8,9,10,12,13,14,15,17,18,19,20.

**Observed sequence:** Splash → experience slider → daily-time goal → Pro benefits → learning path.
**Graphics, typography, spacing, color:** Lavender/white, coding/device illustration, strong purple buttons and progress bar.
**Offer, placement and dismissal:** Pro benefits screen before final learning path; exact checkout not sampled.
**Personalization and permissions:** Experience and time commitment.
**Motion:** Static screenshots only; no movement, easing or duration verified.
**Votic takeaway (design judgment):** Keep goal choices actionable; show the first useful task rather than only a feature list.

## 032. Brilliant — Onboarding

[Open source flow](https://mobbin.com/flows/20ad012b-2683-4c0c-beb8-8ff62c6f509e) · Onboarding · iOS · 14 recorded screens.
Visual inspection: positions 1,4,8,11,14. Supplementary OCR: 2,3,5,6,7,9,10,12,13.

**Observed sequence:** Splash → goal → skill level → routine time → account.
**Graphics, typography, spacing, color:** Green guide character, white outlined cards with small code examples.
**Offer, placement and dismissal:** No offer in sampled screens of this variant.
**Personalization and permissions:** Goal, level and learning routine.
**Motion:** Static screenshots only; no movement, easing or duration verified.
**Votic takeaway (design judgment):** Use miniature examples inside choices to clarify their meaning.

## 033. Deepstash — Onboarding

[Open source flow](https://mobbin.com/flows/fadfb386-acb6-443a-b2ca-ede25e0f7adf) · Onboarding · iOS · 15 recorded screens.
Visual inspection: positions 1,5,8,12,15. Supplementary OCR: 2,3,4,6,7,9,10,11,13,14.

**Observed sequence:** Value comparison → email → verification → trial reminder explanation → first-read Home.
**Graphics, typography, spacing, color:** Editorial serif headings, illustrated books/phone, large simple bell.
**Offer, placement and dismissal:** Trial reminder statement before Home; full offer missing from samples.
**Personalization and permissions:** Email/code authentication; Skip visible.
**Motion:** Static screenshots only; no movement, easing or duration verified.
**Votic takeaway (design judgment):** Demonstrate Read and Listen visibly; only promise reminders when implemented.

## 034. Character AI — Onboarding

[Open source flow](https://mobbin.com/flows/dcb24b7b-7dc9-4e6a-9945-757cf3ca318e) · Onboarding · iOS · 14 recorded screens.
Visual inspection: positions 1,4,8,11,14. Supplementary OCR: 2,3,5,6,7,9,10,12,13.

**Observed sequence:** Splash → join/email → birthday → interest chips → character feed.
**Graphics, typography, spacing, color:** Dark canvas, orbit-style character portraits, rounded chips and white CTA.
**Offer, placement and dismissal:** No priced offer in sampled screens; paid entry on Home.
**Personalization and permissions:** Birthday and interests.
**Motion:** Static screenshots only; no movement, easing or duration verified.
**Votic takeaway (design judgment):** Borrow selectable visual examples while avoiding irrelevant demographic collection.

## 035. Grok Bot — Completing account set up

[Open source flow](https://mobbin.com/flows/498edf36-1e0f-4a2d-88a0-c22c7d7eda64) · Onboarding · iOS · 12 recorded screens.
Visual inspection: positions 1,5,8,12. Supplementary OCR: 2,3,4,6,7,9,10,11.

**Observed sequence:** Meet bot → notification choice → name first bot → bot list.
**Graphics, typography, spacing, color:** Minimal monochrome bot mark, white space and rounded black controls.
**Offer, placement and dismissal:** No offer in sampled screens.
**Personalization and permissions:** Notification Later; first-bot name.
**Motion:** Static screenshots only; no movement, easing or duration verified.
**Votic takeaway (design judgment):** Use a single clear first action and allow optional notification setup to wait.

## 036. Microsoft Copilot — Onboarding

[Open source flow](https://mobbin.com/flows/b83a3666-782d-4077-a2ad-8fee91eae1cd) · Onboarding · iOS · 15 recorded screens.
Visual inspection: positions 1,5,8,12,15. Supplementary OCR: 2,3,4,6,7,9,10,11,13,14.

**Observed sequence:** Welcome → account → birthdate/country → voice choices → conversation Home.
**Graphics, typography, spacing, color:** Soft blue/green background, rounded white controls, compact logo.
**Offer, placement and dismissal:** No offer in sampled screens.
**Personalization and permissions:** Guest option, account details and voice choice.
**Motion:** Static screenshots only; no movement, easing or duration verified.
**Votic takeaway (design judgment):** Integrate a useful voice preference into the demonstration rather than collecting many unrelated answers.

## 037. Google Gemini — Onboarding

[Open source flow](https://mobbin.com/flows/0754aca9-0341-43c7-a05f-4bc51105c598) · Onboarding · iOS · 5 recorded screens.
Visual inspection: positions 1,3,5. Supplementary OCR: 2,4.

**Observed sequence:** Assistant introduction → selected account → conversation Home.
**Graphics, typography, spacing, color:** White space, restrained multicolor brand treatment and blue action.
**Offer, placement and dismissal:** No offer in sampled screens.
**Personalization and permissions:** Account selection.
**Motion:** Static screenshots only; no movement, easing or duration verified.
**Votic takeaway (design judgment):** A short introduction can communicate capability without a long questionnaire.

## 038. Dot — Onboarding

[Open source flow](https://mobbin.com/flows/f3d6bb8b-de86-45d2-91ef-34206516177a) · Onboarding · iOS · 18 recorded screens.
Visual inspection: positions 1,5,10,14,18. Supplementary OCR: 2,3,4,6,7,8,9,11,12,13,15,16,17.

**Observed sequence:** Splash → email → name → optional birthday → introductory letter.
**Graphics, typography, spacing, color:** Soft peach/lavender background, serif prompts and a paper-note composition.
**Offer, placement and dismissal:** No offer in sampled screens.
**Personalization and permissions:** Birthday Skip; personal introductory text.
**Motion:** Static screenshots only; no movement, easing or duration verified.
**Votic takeaway (design judgment):** A document-like note is an apt graphic for Votic; keep extra personal questions optional.

## 039. Claude — Onboarding

[Open source flow](https://mobbin.com/flows/b2b69e75-9b22-4e3e-8373-0efbffe8fedf) · Onboarding · iOS · 13 recorded screens.
Visual inspection: positions 1,4,7,10,13. Supplementary OCR: 2,3,5,6,8,9,11,12.

**Observed sequence:** Welcome/authentication → verification → name/age → policy acknowledgement → chat Home.
**Graphics, typography, spacing, color:** Warm off-white, serif editorial greeting, restrained terracotta logo and black pills.
**Offer, placement and dismissal:** No offer in sampled screens.
**Personalization and permissions:** Name and age attestation; account methods.
**Motion:** Static screenshots only; no movement, easing or duration verified.
**Votic takeaway (design judgment):** Carry editorial typography and a quiet palette consistently into the product.

## 040. ChatGPT — Onboarding

[Open source flow](https://mobbin.com/flows/eceb4e59-4502-4e2d-ba91-ba7bb8579617) · Onboarding · iOS · 8 recorded screens.
Visual inspection: positions 1,5,8. Supplementary OCR: 2,3,4,6,7.

**Observed sequence:** Splash → sign-in choices/system consent → chat Home.
**Graphics, typography, spacing, color:** Minimal black/white, large pill actions, example task cards at destination.
**Offer, placement and dismissal:** Get Plus entry appears on Home; no offer inspected.
**Personalization and permissions:** Account choices; authentication consent.
**Motion:** Static screenshots only; no movement, easing or duration verified.
**Votic takeaway (design judgment):** Use concise task examples to explain AI value instead of a large capability list.

## 041. Microsoft Copilot — Onboarding

[Open source flow](https://mobbin.com/flows/f96a399d-d7d9-4c68-a3e0-a27edd49b97d) · Onboarding · iOS · 5 recorded screens.
Visual inspection: positions 1,3,5. Supplementary OCR: 2,4.

**Observed sequence:** Splash → tracking prompt → first conversation suggestions.
**Graphics, typography, spacing, color:** Soft background, blue CTA and outlined prompt cards.
**Offer, placement and dismissal:** No offer in sampled screens.
**Personalization and permissions:** Tracking prompt; guest interaction then sign-in invitation.
**Motion:** Static screenshots only; no movement, easing or duration verified.
**Votic takeaway (design judgment):** Show a usable example early; do not copy unrelated tracking requests.

## 042. Grok — Upgrade a plan

[Open source flow](https://mobbin.com/flows/0eda8f6a-070f-40c2-a88d-f322af31641d) · Paywall / subscription offer · iOS · 3 recorded screens.
Visual inspection: positions 1,2,3. Supplementary OCR: not needed; every screenshot visually inspected.

**Observed sequence:** Settings subscription entry → trial plan → non-trial plan selection.
**Graphics, typography, spacing, color:** Dark cosmic texture, white benefit icons, translucent cards and prominent white CTA.
**Offer, placement and dismissal:** Monthly/yearly, trial and renewal terms; Skip and restore visible.
**Personalization and permissions:** No personalization observed.
**Motion:** Static screenshots only; no movement, easing or duration verified.
**Votic takeaway (design judgment):** Keep real terms adjacent to the action and distinguish trial from non-trial states.

## 043. stoic. — Subscribing to premium

[Open source flow](https://mobbin.com/flows/3b7a09b5-ff45-4211-934c-9d92c60be08a) · Paywall / subscription offer · iOS · 13 recorded screens.
Visual inspection: positions 1,4,7,10,13. Supplementary OCR: 2,3,5,6,8,9,11,12.

**Observed sequence:** Premium/AI benefit offer → reviews → plan comparison → activation/setup → Home.
**Graphics, typography, spacing, color:** Monochrome editorial layout with lavender AI badges, icon rows and fixed CTA.
**Offer, placement and dismissal:** Annual/monthly AI/non-AI choices, trial durations, restore; X.
**Personalization and permissions:** Post-purchase cloud/Face ID/AI setup.
**Motion:** Static screenshots only; no movement, easing or duration verified.
**Votic takeaway (design judgment):** Separate tiers clearly, but do setup before Votic's final paywall and avoid unsupported social proof.

## 044. Deel — Upgrade to premium

[Open source flow](https://mobbin.com/flows/67481312-b9b4-4350-99c3-6cc0ee035bd4) · Paywall / subscription offer · iOS · 4 recorded screens.
Visual inspection: positions 1,3,4. Supplementary OCR: 2.

**Observed sequence:** Contract upgrade entry → benefit sheet → assessment.
**Graphics, typography, spacing, color:** White modal, pale blue/purple faceted diamond, compact checklist.
**Offer, placement and dismissal:** Monthly upgrade price, X and terms; assessment follows.
**Personalization and permissions:** Contract assessment after upgrade entry.
**Motion:** Static screenshots only; no movement, easing or duration verified.
**Votic takeaway (design judgment):** A restrained hero icon can work; avoid moving Votic's required setup after payment.

## 045. Public — Upgrading to Public Premium

[Open source flow](https://mobbin.com/flows/f7d0346d-4a34-42f8-bbdd-9a0f7bd8a926) · Paywall / subscription offer · iOS · 8 recorded screens.
Visual inspection: positions 1,5,8. Supplementary OCR: 2,3,4,6,7.

**Observed sequence:** Asset screen → membership offer → price alerts.
**Graphics, typography, spacing, color:** Light editorial layout, subtle iridescent hero, expandable benefits and black CTA.
**Offer, placement and dismissal:** Monthly selection, recurring debit explanation; exact preceding offer header not sampled.
**Personalization and permissions:** No personalization observed.
**Motion:** Static screenshots only; no movement, easing or duration verified.
**Votic takeaway (design judgment):** Keep benefits expandable while preserving visible billing terms.

## 046. Neuecast — Subscribe to premium

[Open source flow](https://mobbin.com/flows/b8d6c477-f6d4-4303-aaec-85707f218e7c) · Paywall / subscription offer · iOS · 2 recorded screens.
Visual inspection: positions 1,2. Supplementary OCR: not needed; every screenshot visually inspected.

**Observed sequence:** Settings membership → upgrade sheet.
**Graphics, typography, spacing, color:** White/gray, generous type, black full-width CTA; developer story text.
**Offer, placement and dismissal:** Annual price, cancel statement and restore entry; sheet drag affordance.
**Personalization and permissions:** No personalization observed.
**Motion:** Static screenshots only; no movement, easing or duration verified.
**Votic takeaway (design judgment):** A simple typography-led offer can feel premium without an animated hero.

## 047. Truecaller — Subscribing to Truecaller Premium

[Open source flow](https://mobbin.com/flows/b2e513c1-2487-4d1a-82c6-3c66300df380) · Paywall / subscription offer · iOS · 4 recorded screens.
Visual inspection: positions 1,3,4. Supplementary OCR: 2.

**Observed sequence:** Notification explanation → premium offer → membership welcome.
**Graphics, typography, spacing, color:** White/blue, phone illustration and gold crown motif.
**Offer, placement and dismissal:** Monthly introductory promotion and regular-price note; X, restore and redeem.
**Personalization and permissions:** Notifications can be deferred.
**Motion:** Static screenshots only; no movement, easing or duration verified.
**Votic takeaway (design judgment):** Use a compact product illustration, while making the full renewal price explicit.

## 048. Brave Browser — Leo premium

[Open source flow](https://mobbin.com/flows/34c43394-376a-43a7-9cb7-a2ad1d7ef534) · Paywall / subscription offer · iOS · 2 recorded screens.
Visual inspection: positions 1,2. Supplementary OCR: not needed; every screenshot visually inspected.

**Observed sequence:** AI model menu with premium item → Leo offer.
**Graphics, typography, spacing, color:** Deep blue benefit list, model icons and high-contrast gradient CTA.
**Offer, placement and dismissal:** Annual/monthly cards, seven-day trial, Cancel and Restore.
**Personalization and permissions:** Model selection provides upgrade context.
**Motion:** Static screenshots only; no movement, easing or duration verified.
**Votic takeaway (design judgment):** Explain the practical benefit of higher access; do not promise models Votic does not provide.

## 049. Spotify — Subscribe to Spotify Premium

[Open source flow](https://mobbin.com/flows/50adf611-1b1a-45f7-a926-504624c9bda2) · Paywall / subscription offer · iOS · 4 recorded screens.
Visual inspection: positions 1,3,4. Supplementary OCR: 2.

**Observed sequence:** Listening Home → available membership plans → family plan detail.
**Graphics, typography, spacing, color:** Dark cards, plan-specific accent colors and short benefit bullets.
**Offer, placement and dismissal:** Trial badges and plan benefits; capture says upgrade unavailable in app; no checkout.
**Personalization and permissions:** Individual/student/family segmentation.
**Motion:** Static screenshots only; no movement, easing or duration verified.
**Votic takeaway (design judgment):** Explain plan differences plainly; do not copy a web-only upgrade route into native Votic.

## 050. Truecaller — Upgrade a plan

[Open source flow](https://mobbin.com/flows/d0788d3b-9bbd-4729-9530-22e357d62f83) · Paywall / subscription offer · iOS · 2 recorded screens.
Visual inspection: positions 1,2. Supplementary OCR: not needed; every screenshot visually inspected.

**Observed sequence:** Premium benefits → plan-change sheet.
**Graphics, typography, spacing, color:** White benefit cards, blue controls and concise bottom sheet.
**Offer, placement and dismissal:** Annual/family/gold prices; eligibility qualifier; X.
**Personalization and permissions:** Current member upgrade context.
**Motion:** Static screenshots only; no movement, easing or duration verified.
**Votic takeaway (design judgment):** Show the subscriber's current state and the exact plan-change offer.

## 051. Numo — Subscribing to premium

[Open source flow](https://mobbin.com/flows/8ad8f058-7bfb-4ab3-a603-a6a34f498324) · Paywall / subscription offer · iOS · 8 recorded screens.
Visual inspection: positions 1,5,8. Supplementary OCR: 2,3,4,6,7.

**Observed sequence:** Teams Home → trial/help section → purchase success.
**Graphics, typography, spacing, color:** White layout, blue CTA, pale yellow support pills and simple dividers.
**Offer, placement and dismissal:** Start trial, restore, refund/cancel FAQ, promo and logout; price not sampled.
**Personalization and permissions:** No personalization observed.
**Motion:** Static screenshots only; no movement, easing or duration verified.
**Votic takeaway (design judgment):** Keep recovery and support reachable without making the main offer visually busy.

## 052. Pocket — Subscribe to premium

[Open source flow](https://mobbin.com/flows/c14d0753-76fd-47d8-85d6-28e8cd01e19b) · Paywall / subscription offer · iOS · 3 recorded screens.
Visual inspection: positions 1,2,3. Supplementary OCR: not needed; every screenshot visually inspected.

**Observed sequence:** Settings → premium membership → store confirmation.
**Graphics, typography, spacing, color:** Cream/editorial serif title, colorful border, concise green checks and two plan tiles.
**Offer, placement and dismissal:** Monthly/yearly, renewal disclosure, X and native subscription sheet.
**Personalization and permissions:** No personalization observed.
**Motion:** Static screenshots only; no movement, easing or duration verified.
**Votic takeaway (design judgment):** Use typography and one accent frame; keep benefits specific to saved reading.

## 053. Speechify — Subscribing to premium

[Open source flow](https://mobbin.com/flows/a26dd806-20fc-4061-98c4-8a03756f2c10) · Paywall / subscription offer · iOS · 7 recorded screens.
Visual inspection: positions 1,4,7. Supplementary OCR: 2,3,5,6.

**Observed sequence:** Personalized listening recap → trial/store confirmation → account choices.
**Graphics, typography, spacing, color:** Blue accents, checkmarked personal settings, friendly character collage.
**Offer, placement and dismissal:** Three-day trial and annual charge shown by store; X on app offer.
**Personalization and permissions:** Purpose, document types, voice and speed recapped; account after offer.
**Motion:** Static screenshots only; no movement, easing or duration verified.
**Votic takeaway (design judgment):** Recap useful choices before payment, but preserve Votic's existing account-first architecture.

## 054. The Weather Channel — Subscribing to Premium

[Open source flow](https://mobbin.com/flows/4539bacc-bfaa-4312-98c5-c70127946fe7) · Paywall / subscription offer · iOS · 11 recorded screens.
Visual inspection: positions 1,4,8,11. Supplementary OCR: 2,3,5,6,7,9,10.

**Observed sequence:** Forecast → subscription features/store processing → premium introduction → forecast.
**Graphics, typography, spacing, color:** Nature photography, cream surfaces, restrained black controls.
**Offer, placement and dismissal:** Annual trial/monthly options, restore and offer-code entry; back/close controls.
**Personalization and permissions:** No personalization observed.
**Motion:** Static screenshots only; no movement, easing or duration verified.
**Votic takeaway (design judgment):** Keep success brief; long post-payment introductions would violate Votic's desired final-step behavior.

## 055. Neo Financial — Upgrading to Build membership

[Open source flow](https://mobbin.com/flows/99be03bb-6845-4b7e-ba84-4029c25ee99a) · Paywall / subscription offer · iOS · 9 recorded screens.
Visual inspection: positions 1,5,9. Supplementary OCR: 2,3,4,6,7,8.

**Observed sequence:** Accounts → Build membership benefits → accounts.
**Graphics, typography, spacing, color:** White/soft gray cards, quiet gradient header, icon-led benefits.
**Offer, placement and dismissal:** Monthly upgrade amount, alternative no-cost route and terms link.
**Personalization and permissions:** No personalization observed.
**Motion:** Static screenshots only; no movement, easing or duration verified.
**Votic takeaway (design judgment):** Make the selected tier and actual charge unambiguous; avoid complex alternate economics in Votic.

## 056. Sweatcoin — Subscribing to premium

[Open source flow](https://mobbin.com/flows/08f22fe8-8273-4336-83fd-91156c30791a) · Paywall / subscription offer · iOS · 4 recorded screens.
Visual inspection: positions 1,3,4. Supplementary OCR: 2.

**Observed sequence:** Activity Home → premium comparison → activity Home.
**Graphics, typography, spacing, color:** Dark gradient offer, yellow accent and simple Free/Premium matrix.
**Offer, placement and dismissal:** Monthly/annual totals, X and Continue; no trial in sampled offer.
**Personalization and permissions:** No personalization observed.
**Motion:** Static screenshots only; no movement, easing or duration verified.
**Votic takeaway (design judgment):** A short tier comparison can clarify value; keep actual totals more prominent than equivalents.

## 057. Buddy — Subscribing to Premium

[Open source flow](https://mobbin.com/flows/b055c728-1094-44ae-88e2-b861db4a7d03) · Paywall / subscription offer · iOS · 4 recorded screens.
Visual inspection: positions 1,3,4. Supplementary OCR: 2.

**Observed sequence:** Trial timeline → success → household Home.
**Graphics, typography, spacing, color:** Purple/white gradient, boxed timeline, heart success graphic.
**Offer, placement and dismissal:** Seven-day trial, annual total and weekly equivalent; X and See all plans.
**Personalization and permissions:** No personalization observed.
**Motion:** Static screenshots only; no movement, easing or duration verified.
**Votic takeaway (design judgment):** Explain charge timing directly and return to useful content after confirmation.

## 058. monday.com — Browsing tutorial

[Open source flow](https://mobbin.com/flows/d35a64a4-8d5e-41f8-8656-c881c7b0b923) · Onboarding · iOS · 6 recorded screens.
Visual inspection: positions 1,4,6. Supplementary OCR: 2,3,5.

**Observed sequence:** Home setup checklist → status tooltip → first board.
**Graphics, typography, spacing, color:** White product UI, blue instructional callout and colored statuses.
**Offer, placement and dismissal:** No offer in sampled screens; contextual tutorial, not full initial onboarding.
**Personalization and permissions:** Tutorial progress and Next.
**Motion:** Static screenshots only; no movement, easing or duration verified.
**Votic takeaway (design judgment):** Teach a real control in context rather than adding extra pre-purchase pages.

## 059. Granola — Logging in

[Open source flow](https://mobbin.com/flows/4e0d4dff-b70d-4b62-baa7-ced1ac41691d) · Onboarding · iOS · 10 recorded screens.
Visual inspection: positions 1,4,7,10. Supplementary OCR: 2,3,5,6,8,9.

**Observed sequence:** Photo welcome/authentication → Google sign-in → acquisition question → empty notes Home.
**Graphics, typography, spacing, color:** Editorial café photograph, warm paper and black pills.
**Offer, placement and dismissal:** No offer in sampled screens.
**Personalization and permissions:** Acquisition question has Skip.
**Motion:** Static screenshots only; no movement, easing or duration verified.
**Votic takeaway (design judgment):** Use a warm editorial tone; defer marketing attribution until after first value.

## 060. Numo — Creating a first task

[Open source flow](https://mobbin.com/flows/96c4f619-f8e8-41f2-8789-c255a52c61fa) · Onboarding · iOS · 7 recorded screens.
Visual inspection: positions 1,4,7. Supplementary OCR: 2,3,5,6.

**Observed sequence:** Enter first task → preparation feedback → username.
**Graphics, typography, spacing, color:** Large bold headings, blue progress marks, playful character.
**Offer, placement and dismissal:** No offer in sampled screens; first-task onboarding segment.
**Personalization and permissions:** First task and username; Skip onboarding.
**Motion:** Static screenshots only; no movement, easing or duration verified.
**Votic takeaway (design judgment):** Let a user experience a meaningful action, without simulated waiting or unnecessary profile setup.

## 061. Jomo — Onboarding

[Open source flow](https://mobbin.com/flows/743bc988-c7c6-427e-b122-518a1ee69f7c) · Onboarding · iOS · 15 recorded screens.
Visual inspection: positions 1,5,8,12,15. Supplementary OCR: 2,3,4,6,7,9,10,11,13,14.

**Observed sequence:** Evidence-led welcome → name → usage question → calculation → brand explanation.
**Graphics, typography, spacing, color:** Blue/white, before/after cards, bold sans headings and mountain mascot.
**Offer, placement and dismissal:** No offer in sampled screens.
**Personalization and permissions:** Name and usage questions.
**Motion:** Static screenshots only; no movement, easing or duration verified.
**Votic takeaway (design judgment):** Use an understandable outcome demonstration, but do not invent Votic proof or impose calculation delays.

## 062. ClickUp — Onboarding

[Open source flow](https://mobbin.com/flows/27e7e819-51fb-43bb-b9bf-a96ac01c30d5) · Onboarding · iOS · 17 recorded screens.
Visual inspection: positions 1,5,9,13,17. Supplementary OCR: 2,3,4,6,7,8,10,11,12,14,15,16.

**Observed sequence:** Splash → email → sign-up → notification explanation → workspace.
**Graphics, typography, spacing, color:** White/gray UI, purple accents, simple bell icon and starter content.
**Offer, placement and dismissal:** No offer in sampled screens.
**Personalization and permissions:** Notification Give permissions and Skip.
**Motion:** Static screenshots only; no movement, easing or duration verified.
**Votic takeaway (design judgment):** Make the destination ready to use and defer optional permissions.

## 063. Tiimo — Onboarding

[Open source flow](https://mobbin.com/flows/16df946d-5f8e-45f7-b93d-951241938530) · Onboarding · iOS · 19 recorded screens.
Visual inspection: positions 1,6,10,15,19. Supplementary OCR: 2,3,4,5,7,8,9,11,12,13,14,16,17,18.

**Observed sequence:** Splash → community proof → email account → reminder choice → Home.
**Graphics, typography, spacing, color:** Peach/lavender gradient, simple geometric forms, serif headings and clear black action.
**Offer, placement and dismissal:** No offer in sampled screens.
**Personalization and permissions:** Reminder modal with No thanks; optional setup cards on Home.
**Motion:** Static screenshots only; no movement, easing or duration verified.
**Votic takeaway (design judgment):** Move widget setup to a contextual Home card in a future Votic redesign.

## 064. Linear Mobile — Onboarding

[Open source flow](https://mobbin.com/flows/628034a6-be45-450e-99d3-fb86e4571661) · Onboarding · iOS · 22 recorded screens.
Visual inspection: positions 1,6,12,17,22. Supplementary OCR: 2,3,4,5,7,8,9,10,11,13,14,15,16,18,19,20,21.

**Observed sequence:** Splash → email code → welcome tutorial → update preferences → inbox.
**Graphics, typography, spacing, color:** Monochrome with muted purple CTA, sparse explanatory cards.
**Offer, placement and dismissal:** No offer in sampled screens.
**Personalization and permissions:** Separate changelog/marketing toggles.
**Motion:** Static screenshots only; no movement, easing or duration verified.
**Votic takeaway (design judgment):** Distinguish essential setup from optional communications.

## 065. Superlist — Creating a profile

[Open source flow](https://mobbin.com/flows/b61e00a6-999f-46cf-8a18-5b7d28e0a441) · Onboarding · iOS · 8 recorded screens.
Visual inspection: positions 1,5,8. Supplementary OCR: 2,3,4,6,7.

**Observed sequence:** Splash → agreements/preferences → starter workspace.
**Graphics, typography, spacing, color:** Off-white, rounded panels, handwritten accent and black CTA.
**Offer, placement and dismissal:** No offer in sampled screens.
**Personalization and permissions:** Terms and marketing choices shown together.
**Motion:** Static screenshots only; no movement, easing or duration verified.
**Votic takeaway (design judgment):** Use clean form hierarchy, but keep optional marketing separate from necessary agreement.

## 066. Breathwrk — Onboarding

[Open source flow](https://mobbin.com/flows/6a11cdef-8719-40e3-bd75-3829517b7e40) · Onboarding · iOS · 11 recorded screens.
Visual inspection: positions 1,4,8,11. Supplementary OCR: 2,3,5,6,7,9,10.

**Observed sequence:** Splash → benefit chips → goals → optional calibration.
**Graphics, typography, spacing, color:** Dark blue atmospheric background, translucent chips and white CTA.
**Offer, placement and dismissal:** No offer in sampled screens.
**Personalization and permissions:** Goals; calibration Set up later.
**Motion:** Static screenshots only; no movement, easing or duration verified.
**Votic takeaway (design judgment):** Keep goal choices brief and let optional calibration wait.

## 067. stoic. — Onboarding

[Open source flow](https://mobbin.com/flows/948a7285-9f2f-46d1-8d82-32da2d4ce828) · Onboarding · iOS · 14 recorded screens.
Visual inspection: positions 1,4,8,11,14. Supplementary OCR: 2,3,5,6,7,9,10,12,13.

**Observed sequence:** Splash → desired outcomes → reminder times → preparation → trial timeline.
**Graphics, typography, spacing, color:** Monochrome, wide pill choices, minimal icon timeline and soft blue CTA.
**Offer, placement and dismissal:** Trial timeline is final sampled screen; annual charge, close and View all plans.
**Personalization and permissions:** Goals, reminder times; Skip visible.
**Motion:** Static screenshots only; no movement, easing or duration verified.
**Votic takeaway (design judgment):** Use a direct final offer, while avoiding fake setup progress and unclear discount claims.

## 068. Calm — Onboarding

[Open source flow](https://mobbin.com/flows/38549b00-2fe8-4fd1-914b-13c4905db245) · Onboarding · iOS · 10 recorded screens.
Visual inspection: positions 1,4,7,10. Supplementary OCR: 2,3,5,6,8,9.

**Observed sequence:** Breathing introduction → plan picker → attribution question → Home.
**Graphics, typography, spacing, color:** Blue gradient, nature photography, spacious white type.
**Offer, placement and dismissal:** Trial/yearly/family/monthly choices; X and reminder toggle; attribution follows offer.
**Personalization and permissions:** Attribution question after offer; notification settings link.
**Motion:** Static screenshots only; no movement, easing or duration verified.
**Votic takeaway (design judgment):** Borrow calm visual restraint, but keep Votic's optional questions before the final paywall.

## 069. Ahead — Onboarding

[Open source flow](https://mobbin.com/flows/57e41d19-30db-4443-ab36-b19c8c20dfe4) · Onboarding · iOS · 36 recorded screens.
Visual inspection: positions 1,10,19,27,36. Supplementary OCR: 2,3,4,5,6,7,8,9,11,12,13,14,15,16,17,18,20,21,22,23,24,25,26,28,29,30,31,32,33,34,35.

**Observed sequence:** Mascot splash → account → scenario questionnaire → matched journeys → Pro offer.
**Graphics, typography, spacing, color:** Purple character system, illustrative choice cards, clear progress.
**Offer, placement and dismissal:** Final sample is Pro benefits with restore and Continue; billing amount not sampled.
**Personalization and permissions:** Ten-question assessment and journey selection.
**Motion:** Static screenshots only; no movement, easing or duration verified.
**Votic takeaway (design judgment):** A consistent character family works; Votic needs a much shorter decision path.

## 070. Life Reset — Setting up profile

[Open source flow](https://mobbin.com/flows/e91bc9a4-db92-449a-8de2-2d5e81381f6b) · Onboarding · iOS · 12 recorded screens.
Visual inspection: positions 1,5,8,12. Supplementary OCR: 2,3,4,6,7,9,10,11.

**Observed sequence:** Profile introduction → confidence slider → user story → personalized advice.
**Graphics, typography, spacing, color:** Dark canvas, orange accent, scenic illustration, dense story/advice cards.
**Offer, placement and dismissal:** No offer in sampled screens.
**Personalization and permissions:** Confidence input and personalized interpretation.
**Motion:** Static screenshots only; no movement, easing or duration verified.
**Votic takeaway (design judgment):** Keep feedback tied to the user's real choices; avoid lengthy identity claims.

## 071. Liven — Setting up personalized program

[Open source flow](https://mobbin.com/flows/5695ec7e-a531-4d04-8381-746e3591db36) · Onboarding · iOS · 23 recorded screens.
Visual inspection: positions 1,7,12,18,23. Supplementary OCR: 2,3,4,5,6,8,9,10,11,13,14,15,16,17,19,20,21,22.

**Observed sequence:** Community illustration → answers with feedback → emotional-state slider → evidence statement → commitment.
**Graphics, typography, spacing, color:** Soft pastel backdrop, green action, editorial illustration and progress bar.
**Offer, placement and dismissal:** No offer in sampled screens.
**Personalization and permissions:** Multiple questionnaire steps and drawn commitment.
**Motion:** Static screenshots only; no movement, easing or duration verified.
**Votic takeaway (design judgment):** Use supportive inline feedback, but omit commitment rituals and unrelated sensitive questions.

## 072. Liven — Onboarding

[Open source flow](https://mobbin.com/flows/ba9958ef-dd21-4a03-9ba1-2e5a3f5b51e3) · Onboarding · iOS · 20 recorded screens.
Visual inspection: positions 1,6,11,15,20. Supplementary OCR: 2,3,4,5,7,8,9,10,12,13,14,16,17,18,19.

**Observed sequence:** Splash → goal → gender → create account → mood Home.
**Graphics, typography, spacing, color:** Light pastel gradient, green accent, restrained line icons.
**Offer, placement and dismissal:** No offer in sampled screens.
**Personalization and permissions:** Goals and demographics; account creation.
**Motion:** Static screenshots only; no movement, easing or duration verified.
**Votic takeaway (design judgment):** Let preferences affect the actual app; avoid unrelated demographic requirements.

## 073. GoPro Quik — Subscribing to premium

[Open source flow](https://mobbin.com/flows/753a20b6-422e-4e81-af67-5c7be7003659) · Paywall / subscription offer · iOS · 8 recorded screens.
Visual inspection: positions 1,5,8. Supplementary OCR: 2,3,4,6,7.

**Observed sequence:** Albums → plan/store purchase → premium feature setup.
**Graphics, typography, spacing, color:** Real photo thumbnails, black/white text, expandable benefit panels.
**Offer, placement and dismissal:** Store monthly confirmation; comparison behind sheet; post-purchase setup.
**Personalization and permissions:** Setup for newly unlocked functions follows payment.
**Motion:** Static screenshots only; no movement, easing or duration verified.
**Votic takeaway (design judgment):** Show concrete media/product output, but place Votic's teaching before its final paywall.

## 074. Plum — Subscribing to Premium

[Open source flow](https://mobbin.com/flows/e11ad5e8-3b9d-441b-84bf-1f73fac912dd) · Paywall / subscription offer · iOS · 14 recorded screens.
Visual inspection: positions 1,4,8,11,14. Supplementary OCR: 2,3,5,6,7,9,10,12,13.

**Observed sequence:** Home → premium offer → trial started → portfolio setup → completion.
**Graphics, typography, spacing, color:** Purple brand, membership card composition and celebratory graphic.
**Offer, placement and dismissal:** Monthly amount, one-month trial; celebration and setup follow.
**Personalization and permissions:** Post-purchase portfolio setup.
**Motion:** Static screenshots only; no movement, easing or duration verified.
**Votic takeaway (design judgment):** Use a short confirmed-success state and avoid a second onboarding after subscribing.

## 075. Headspace — Subscribing to premium

[Open source flow](https://mobbin.com/flows/ccf14439-4c45-4d56-b031-45173490cafe) · Paywall / subscription offer · iOS · 10 recorded screens.
Visual inspection: positions 1,4,7,10. Supplementary OCR: 2,3,5,6,8,9.

**Observed sequence:** Trial timeline → store confirmation → reminder prompt → introductory exercise.
**Graphics, typography, spacing, color:** Warm illustrated orange/yellow hero, simple vertical timeline, blue CTA.
**Offer, placement and dismissal:** Trial lengths vary by selected plan; annual/monthly toggle, X and restore.
**Personalization and permissions:** Reminder/exercise after payment; Maybe later.
**Motion:** Static screenshots only; no movement, easing or duration verified.
**Votic takeaway (design judgment):** Only promise reminders you can deliver; move Votic's sample before payment.

## 076. talabat — Upgrade a subscription plan

[Open source flow](https://mobbin.com/flows/2fa40869-ac87-485d-94f0-8aa38b3dc8ec) · Paywall / subscription offer · iOS · 2 recorded screens.
Visual inspection: positions 1,2. Supplementary OCR: not needed; every screenshot visually inspected.

**Observed sequence:** Current family membership → yearly upgrade sheet.
**Graphics, typography, spacing, color:** Brand orange/purple, compact white sheet, outlined plan card.
**Offer, placement and dismissal:** Annual total and monthly equivalent, renewal date, trial continuation and X.
**Personalization and permissions:** Current-member plan context.
**Motion:** Static screenshots only; no movement, easing or duration verified.
**Votic takeaway (design judgment):** Show what happens to the current period when upgrading, using verified store data.

## 077. Perplexity — Upgrading to Perplexity Pro

[Open source flow](https://mobbin.com/flows/5b3ed1e0-eac9-4be5-9c56-8eab7b486142) · Paywall / subscription offer · iOS · 6 recorded screens.
Visual inspection: positions 1,4,6. Supplementary OCR: 2,3,5.

**Observed sequence:** Pro/Max offer → purchase success → Computer credits state.
**Graphics, typography, spacing, color:** Teal accent, white rounded cards, compact Free/Pro matrix.
**Offer, placement and dismissal:** Monthly/yearly prices, restore, X; later credit exhaustion message.
**Personalization and permissions:** No personalization observed.
**Motion:** Static screenshots only; no movement, easing or duration verified.
**Votic takeaway (design judgment):** Distinguish subscription benefits from separately metered AI credits in plain language.

## 078. BitePal — Subscribing to BitePal Plus

[Open source flow](https://mobbin.com/flows/9c7e199a-9c79-414c-903b-2cb0459baaf6) · Paywall / subscription offer · iOS · 6 recorded screens.
Visual inspection: positions 1,4,6. Supplementary OCR: 2,3,5.

**Observed sequence:** Mascot Home → feature/plan carousel → Home.
**Graphics, typography, spacing, color:** Coherent cartoon raccoon, large illustration, white offer and green selection.
**Offer, placement and dismissal:** Weekly price, Continue, close and Restore.
**Personalization and permissions:** No personalization observed.
**Motion:** Static screenshots only; no movement, easing or duration verified.
**Votic takeaway (design judgment):** A single mascot language can be memorable, but Votic's document motif is a better functional fit.

## 079. Ahead — Subscribing to premium

[Open source flow](https://mobbin.com/flows/4d5e054d-b7cc-4ad8-be54-adfb606d1986) · Paywall / subscription offer · iOS · 11 recorded screens.
Visual inspection: positions 1,4,8,11. Supplementary OCR: 2,3,5,6,7,9,10.

**Observed sequence:** Pro benefit proof → plans → success → journey Home.
**Graphics, typography, spacing, color:** Purple mascot hero, white plan sheet and consistent illustrated destinations.
**Offer, placement and dismissal:** Seven-day trial; yearly/quarterly/lifetime options, X and legal links.
**Personalization and permissions:** Journey destination after activation.
**Motion:** Static screenshots only; no movement, easing or duration verified.
**Votic takeaway (design judgment):** Keep art consistent across offer and Home; do not use questionable competitor/value comparisons.

## 080. MasterClass — Subscribing to premium

[Open source flow](https://mobbin.com/flows/d8258933-911e-4c0c-b8fd-2e650bf763bc) · Paywall / subscription offer · iOS · 6 recorded screens.
Visual inspection: positions 1,4,6. Supplementary OCR: 2,3,5.

**Observed sequence:** Catalog → paid plan/terms → member catalog.
**Graphics, typography, spacing, color:** Black/red editorial layout, instructor portraits, strong annual-price hierarchy.
**Offer, placement and dismissal:** Annual charge and monthly equivalent; X; recurring terms and email-reminder copy.
**Personalization and permissions:** No personalization observed.
**Motion:** Static screenshots only; no movement, easing or duration verified.
**Votic takeaway (design judgment):** Lead with authentic content and the real charge, not only a monthly equivalent.

## 081. adidas Running — Subscribing to premium

[Open source flow](https://mobbin.com/flows/814b296d-bbe1-46fc-a8cc-36a42c3e37da) · Paywall / subscription offer · iOS · 6 recorded screens.
Visual inspection: positions 1,4,6. Supplementary OCR: 2,3,5.

**Observed sequence:** Profile → premium purchase success → membership details.
**Graphics, typography, spacing, color:** Athlete photography, neutral/black layout and yellow-gold offer accent.
**Offer, placement and dismissal:** Monthly/yearly options; X; paid membership-management destination.
**Personalization and permissions:** No personalization observed.
**Motion:** Static screenshots only; no movement, easing or duration verified.
**Votic takeaway (design judgment):** Show confirmed subscription state and recovery/manage actions clearly.

## 082. Duolingo — Super features

[Open source flow](https://mobbin.com/flows/b7216829-0da7-4492-b9f5-645c6d571246) · Paywall / subscription offer · iOS · 4 recorded screens.
Visual inspection: positions 1,3,4. Supplementary OCR: 2.

**Observed sequence:** Learning path → Super benefits → unlock offer.
**Graphics, typography, spacing, color:** Bright game illustrations, blue/green accents, short benefit rows.
**Offer, placement and dismissal:** Try-for-zero CTA and X; priced checkout not sampled.
**Personalization and permissions:** Existing member feature state mixed with unlock entry.
**Motion:** Static screenshots only; no movement, easing or duration verified.
**Votic takeaway (design judgment):** Explain premium benefits visually, without carrying unverified performance statistics into Votic.

## 083. Apple Invites — Upgrading to iCloud+

[Open source flow](https://mobbin.com/flows/c661bfdf-a5eb-4cf5-9ffe-11f9613ebc57) · Paywall / subscription offer · iOS · 4 recorded screens.
Visual inspection: positions 1,3,4. Supplementary OCR: 2.

**Observed sequence:** Event composition with subscription gate → store sheet → event composition.
**Graphics, typography, spacing, color:** Colorful event gradient, sparse interface and blue action.
**Offer, placement and dismissal:** Subscription-required note and native monthly store sheet; close controls.
**Personalization and permissions:** Event is configured before pay request.
**Motion:** Static screenshots only; no movement, easing or duration verified.
**Votic takeaway (design judgment):** Let people understand the result before the final subscription choice.

## 084. YouTube — Subscribing to premium

[Open source flow](https://mobbin.com/flows/06f6bab3-f57c-4853-95d4-6b5a1f7eaf17) · Paywall / subscription offer · iOS · 12 recorded screens.
Visual inspection: positions 1,5,8,12. Supplementary OCR: 2,3,4,6,7,9,10,11.

**Observed sequence:** Home → trial plan confirmation → activation → premium Home.
**Graphics, typography, spacing, color:** Familiar white/red UI, compact native-like plan dialog and check success.
**Offer, placement and dismissal:** Individual/family trial and post-trial monthly charge; Cancel and X.
**Personalization and permissions:** No personalization observed.
**Motion:** Static screenshots only; no movement, easing or duration verified.
**Votic takeaway (design judgment):** Show an unambiguous selected plan and transition directly to the product.

## 085. Coffee Meets Bagel — Subscribe to Premium

[Open source flow](https://mobbin.com/flows/64932289-fa91-42ea-9f7e-9c445b21caef) · Paywall / subscription offer · iOS · 6 recorded screens.
Visual inspection: positions 1,4,6. Supplementary OCR: 2,3,5.

**Observed sequence:** Profile comparison → recommended subscription → all plans.
**Graphics, typography, spacing, color:** White background, indigo plan cards and bottom action.
**Offer, placement and dismissal:** Quarterly actual charge and daily equivalent; monthly/quarterly/half-year, Cancel and See all plans.
**Personalization and permissions:** Recommended-plan wording.
**Motion:** Static screenshots only; no movement, easing or duration verified.
**Votic takeaway (design judgment):** Give a clear default without hiding alternative plans or actual billing totals.

## 086. Dot — Subscribing to premium

[Open source flow](https://mobbin.com/flows/867477d0-6b8e-4d37-b4e7-e2ae6c7b5887) · Paywall / subscription offer · iOS · 8 recorded screens.
Visual inspection: positions 1,5,8. Supplementary OCR: 2,3,4,6,7.

**Observed sequence:** Personalized conversation → paid store sheet → history.
**Graphics, typography, spacing, color:** Paper-like cards, soft pink/lavender, serif conversation text.
**Offer, placement and dismissal:** Monthly subscription confirmation; app offer behind store sheet; dismiss controls.
**Personalization and permissions:** Existing personalized conversation before purchase.
**Motion:** Static screenshots only; no movement, easing or duration verified.
**Votic takeaway (design judgment):** Demonstrate a meaningful result before asking for payment.

## 087. Stake — Upgrading to Stake Black

[Open source flow](https://mobbin.com/flows/c32a7f33-d755-47fa-a144-e84c769f27f3) · Paywall / subscription offer · iOS · 12 recorded screens.
Visual inspection: positions 1,5,8,12. Supplementary OCR: 2,3,4,6,7,9,10,11.

**Observed sequence:** Locked market-depth feature → branded plan → payment method → failure recovery.
**Graphics, typography, spacing, color:** Black/white/gold diagonal hero, real product screenshot and compact selector.
**Offer, placement and dismissal:** Annual/monthly, actual selected charge; failed-payment message and alternate method.
**Personalization and permissions:** Feature-triggered entry.
**Motion:** Static screenshots only; no movement, easing or duration verified.
**Votic takeaway (design judgment):** Preserve clear failure recovery; polished artwork must not obscure purchase status.

## 088. The Outsiders — Subscribing to premium

[Open source flow](https://mobbin.com/flows/e120cae3-60fa-4c2c-ba23-8e766103e242) · Paywall / subscription offer · iOS · 4 recorded screens.
Visual inspection: positions 1,3,4. Supplementary OCR: 2.

**Observed sequence:** Training Home → membership offer → unlocked training Home.
**Graphics, typography, spacing, color:** Dark/pink design, restrained app icon hero and award framing.
**Offer, placement and dismissal:** Monthly/annual/lifetime choices; X; annual best-offer label.
**Personalization and permissions:** No personalization observed.
**Motion:** Static screenshots only; no movement, easing or duration verified.
**Votic takeaway (design judgment):** Limit hero decoration so the selected plan and billing remain easy to scan.

## 089. Reddit — Subscribing to premium

[Open source flow](https://mobbin.com/flows/fed7b538-c4de-4489-bfc1-da04f7fcabf0) · Paywall / subscription offer · iOS · 5 recorded screens.
Visual inspection: positions 1,3,5. Supplementary OCR: 2,4.

**Observed sequence:** Profile premium entry → subscription confirmation → success.
**Graphics, typography, spacing, color:** Large 3D mascot/throne, black/yellow action hierarchy.
**Offer, placement and dismissal:** Monthly amount and renewal text; back/help; success overlay.
**Personalization and permissions:** No personalization observed.
**Motion:** Static screenshots only; no movement, easing or duration verified.
**Votic takeaway (design judgment):** Use a branded success moment briefly, without adding another required step.

## 090. Wysa — Activating premium access

[Open source flow](https://mobbin.com/flows/b97d4ad0-6362-410e-b8b3-41363c4f3b5a) · Paywall / subscription offer · iOS · 7 recorded screens.
Visual inspection: positions 1,4,7. Supplementary OCR: 2,3,5,6.

**Observed sequence:** Locked exercise list → premium offer → unlocked exercise list.
**Graphics, typography, spacing, color:** Blue scenic artwork, white offer, gold testimonial/CTA accents.
**Offer, placement and dismissal:** Monthly/lifetime and partner-access alternative; X and terms.
**Personalization and permissions:** No personalization observed.
**Motion:** Static screenshots only; no movement, easing or duration verified.
**Votic takeaway (design judgment):** Tie an upgrade to the exact useful capability it unlocks.

## 091. Bloom — Subscribe to premium

[Open source flow](https://mobbin.com/flows/d41da1db-1735-4c0a-928e-3d1a08301a19) · Paywall / subscription offer · iOS · 7 recorded screens.
Visual inspection: positions 1,4,7. Supplementary OCR: 2,3,5,6.

**Observed sequence:** Trial timeline → store confirmation → goal choices.
**Graphics, typography, spacing, color:** Minimal teal/white, serif headings, large timeline nodes.
**Offer, placement and dismissal:** Seven-day trial, annual total/weekly equivalent, X and View all plans; refund/reminder promises shown.
**Personalization and permissions:** Goal selection follows purchase.
**Motion:** Static screenshots only; no movement, easing or duration verified.
**Votic takeaway (design judgment):** Use a truthful trial timeline, but move Votic's goals before payment and avoid copying unsupported promises.

## 092. mymind — Subscribing to premium

[Open source flow](https://mobbin.com/flows/e5893443-6b29-4cfb-813d-156ee8142960) · Paywall / subscription offer · iOS · 12 recorded screens.
Visual inspection: positions 1,5,8,12. Supplementary OCR: 2,3,4,6,7,9,10,11.

**Observed sequence:** Three plan cards → selected tier → success → first-save Home.
**Graphics, typography, spacing, color:** Warm flowing gradient, serif headings, original sculptural head graphics and orange CTA.
**Offer, placement and dismissal:** Student/monthly/yearly tier cards; exact purchase outcome shown.
**Personalization and permissions:** First-save instruction after payment.
**Motion:** Static screenshots only; no movement, easing or duration verified.
**Votic takeaway (design judgment):** Translate distinctive art into a document motif; move import teaching before Votic's paywall.

## 093. Notion — Upgrading to Notion Plus & AI

[Open source flow](https://mobbin.com/flows/5f364e70-6361-4277-9cb3-fe2e765f8a64) · Paywall / subscription offer · iOS · 5 recorded screens.
Visual inspection: positions 1,3,5. Supplementary OCR: 2,4.

**Observed sequence:** Workspace upgrade entry → Plus/AI offer → workspace.
**Graphics, typography, spacing, color:** White bottom sheet, subtle hand-drawn cat/product card, blue selector.
**Offer, placement and dismissal:** Two plan tabs, monthly/yearly amounts, price-specific CTA, X and Restore.
**Personalization and permissions:** Workspace/member context.
**Motion:** Static screenshots only; no movement, easing or duration verified.
**Votic takeaway (design judgment):** Keep plan switching compact and connect AI allowance to the actual selected tier.

## 094. Coinbase — Tiers

[Open source flow](https://mobbin.com/flows/c12b046b-3499-44c7-ba11-82ed6674bba4) · Paywall / subscription offer · iOS · 3 recorded screens.
Visual inspection: positions 1,2,3. Supplementary OCR: not needed; every screenshot visually inspected.

**Observed sequence:** Membership settings → tier choice → selected tier and authorization.
**Graphics, typography, spacing, color:** White native list, thin separators, blue action; little decoration.
**Offer, placement and dismissal:** Monthly tier price and authorization/renewal text; back.
**Personalization and permissions:** Current-tier indicator.
**Motion:** Static screenshots only; no movement, easing or duration verified.
**Votic takeaway (design judgment):** Clear plan states and charge terms can feel premium without illustration.

## 095. Tolan — Subscribing to Tolan Plus

[Open source flow](https://mobbin.com/flows/7c8ada58-34ea-46b1-bfe0-3b6e0b032a96) · Paywall / subscription offer · iOS · 15 recorded screens.
Visual inspection: positions 1,5,8,12,15. Supplementary OCR: 2,3,4,6,7,9,10,11,13,14.

**Observed sequence:** Character upgrade introduction → plan sheet → family invites → first chat → world.
**Graphics, typography, spacing, color:** Consistent colorful 3D character and environment with dark/purple offer.
**Offer, placement and dismissal:** Monthly/yearly, year-only trial shown, X, native/payment alternatives.
**Personalization and permissions:** Family sharing and first chat follow payment.
**Motion:** Static screenshots only; no movement, easing or duration verified.
**Votic takeaway (design judgment):** Use one coherent art system; avoid delaying Votic's first useful action with post-payment setup.

## 096. Bumble — Pay plan

[Open source flow](https://mobbin.com/flows/8b21909e-9125-4d52-9160-f319bf5bde63) · Paywall / subscription offer · iOS · 2 recorded screens.
Visual inspection: positions 1,2. Supplementary OCR: not needed; every screenshot visually inspected.

**Observed sequence:** Profile paid-plan entry → extended feature comparison.
**Graphics, typography, spacing, color:** Yellow/white identity, black CTA and two-column checkmark matrix.
**Offer, placement and dismissal:** Premium/Premium+ differences; prices/checkout not in these two screens.
**Personalization and permissions:** No personalization observed.
**Motion:** Static screenshots only; no movement, easing or duration verified.
**Votic takeaway (design judgment):** Use a short comparison for meaningful tier differences, not a very long feature matrix.

## 097. Amie — Subscribing to premium

[Open source flow](https://mobbin.com/flows/04fa1de6-7862-47f1-a98b-8a015e920df1) · Paywall / subscription offer · iOS · 7 recorded screens.
Visual inspection: positions 1,4,7. Supplementary OCR: 2,3,5,6.

**Observed sequence:** Package offer → store confirmation → calendar.
**Graphics, typography, spacing, color:** Glossy blue checkmark artwork, white canvas, colored benefit icons and black CTA.
**Offer, placement and dismissal:** Annual total/monthly equivalent and monthly alternative; X; store confirmation.
**Personalization and permissions:** No personalization observed.
**Motion:** Static screenshots only; no movement, easing or duration verified.
**Votic takeaway (design judgment):** A single polished hero asset can suffice; distinguish available benefits from coming-soon promises.

## 098. Queue — Onboarding

[Open source flow](https://mobbin.com/flows/b64d4f8a-1ff6-417e-8ac0-1d16d19f74b4) · Onboarding · iOS · 10 recorded screens.
Visual inspection: positions 1,4,7,10. Supplementary OCR: 2,3,5,6,8,9.

**Observed sequence:** Cover-art introduction → podcast choices → Pro offer → listening Home.
**Graphics, typography, spacing, color:** White space, bold condensed wordmark, tilted real-product cards and covers.
**Offer, placement and dismissal:** Monthly/yearly prices; Restore and Later; offer before Home.
**Personalization and permissions:** Podcast selection.
**Motion:** Static screenshots only; no movement, easing or duration verified.
**Votic takeaway (design judgment):** Show a real listening result and keep the final offer concise.

## 099. Neuecast — Onboarding

[Open source flow](https://mobbin.com/flows/696bfa0b-ab96-41f1-8e22-7efb92a9f82b) · Onboarding · iOS · 5 recorded screens.
Visual inspection: positions 1,3,5. Supplementary OCR: 2,4.

**Observed sequence:** Welcome → starter podcast choices → episode feed.
**Graphics, typography, spacing, color:** Minimal light background, gray type, real cover grid with selection checks.
**Offer, placement and dismissal:** No offer in sampled screens.
**Personalization and permissions:** Starter-content choices explicitly changeable later.
**Motion:** Static screenshots only; no movement, easing or duration verified.
**Votic takeaway (design judgment):** Use a useful default sample and let people refine it later.

## 100. Apple Podcasts — Home

[Open source flow](https://mobbin.com/flows/1a94fc73-192d-46e8-a6a1-7ffc03914b22) · Onboarding · iOS · 8 recorded screens.
Visual inspection: positions 1,5,8. Supplementary OCR: 2,3,4,6,7.

**Observed sequence:** Welcome/privacy explanation → podcast Home → channel recommendations.
**Graphics, typography, spacing, color:** White system sheet, purple brand accent, real podcast covers.
**Offer, placement and dismissal:** No offer in sampled screens; channel subscriptions are a separate reviewed flow.
**Personalization and permissions:** No preference or permission prompt in inspected previews.
**Motion:** Static screenshots only; no movement, easing or duration verified.
**Votic takeaway (design judgment):** Keep a short value explanation and provide useful content immediately afterward.
