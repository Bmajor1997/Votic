# Contextual subscription upgrades

The app has Settings → Account → View plans, and a dismissible monthly AI allowance notice inside the affected feature. The notice never opens a modal or automatically loads prices, launches the store, or navigates to checkout. The notice is shown once per reset period per authenticated session across screens. It disappears when the feature loses focus or its reset time passes. Leaving a screen also detaches its pending request notifications. It includes the server's calendar-month UTC reset time, displayed in the device's timezone. Reading, on-device speech, and saved notes remain available. Other errors (global budget, daily cap, concurrency, rate limiting, connectivity) do not trigger an upgrade prompt.

Opening View plans is an explicit choice. On that page, this is a store-managed upgrade flow: Votic presents eligible monthly options with prices from RevenueCat's native store SDK. Review upgrade opens the existing subscription's management URL. The person selects and confirms a change in the store; Votic does not buy a second subscription or select a proration mode. The screen explicitly explains this handoff and the store's final charges/credits, effective date and renewal terms. Returning from the store refreshes subscription access and available options. There is also a manual refresh button. Cancellation or pending approval never grants capacity locally.

## Activation requires business configuration

**No live prices, products, entitlements, dashboard settings, allowances or environment variables were changed.** Without a catalog, current allowance enforcement remains exactly as before and no paid upgrade is advertised. An unavailable/unknown product, different store, missing SDK price or non-monthly product also suppresses the upgrade offer. Settings still provides existing store management.

Choose real plan names, products, prices and monthly capacity before activating this feature. Configure the products in the stores and RevenueCat with the existing Premium entitlement and correct store upgrade relationships. In particular, independently verify which replacements the store subscription settings actually offer. Do not put higher-tier products into the initial offering merely to enable upgrades: the upgrade screen reads product prices independently and leaves the initial paywall alone.

The backend accepts an optional `VOTIC_SUBSCRIPTION_TIERS_JSON` array. Each entry specifies:

| Field              | Meaning                                                                                                                                          |
| ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| `productId`        | Exact verified RevenueCat/store product identifier; Android `subscriptionId:basePlanId` when a base plan is reported; never a package identifier |
| `store`            | `play_store` or `app_store`                                                                                                                      |
| `name`             | Customer-visible plan name                                                                                                                       |
| `monthlyTokens`    | Approved monthly token capacity, positive integer                                                                                                |
| `monthlyBudgetUsd` | Approved per-account monthly AI spending ceiling, positive number; backend only                                                                  |

Do not copy arbitrary example allowances into production. Map both the existing lower-tier products and approved higher-tier products. Monthly and annual products with the same benefits should have the same monthly capacity. Unknown products keep the existing default limits; they never acquire a guessed tier.

Both monthly caps must strictly increase to advertise an upgrade. An exact capacity multiplier is shown only when both caps increase by exactly the same ratio; otherwise the screen says “a higher monthly AI allowance.” These are shared AI processing limits across supported features, not a promised number of answers. Daily, request-size, concurrency and global spending caps still apply. Those protections are unchanged. The underlying ledger keeps existing usage on upgrade and never resets it as part of a purchase.

The server looks up the authenticated UID through RevenueCat, validates active Premium access, then matches its product and store to the server catalog. A product or tier supplied by the phone is ignored. Only the resulting server-owned allowance reaches the ledger. Public responses contain names, product IDs and capacity multipliers; no internal spending ceilings, documents, questions, tokens, or billing receipts are sent as upgrade telemetry. No analytics were added.

Confirmed RevenueCat profiles are cached for at most one minute, as Premium access was previously. Store propagation and this cache can delay a new allowance; the UI does not claim an upgrade succeeded or take effect immediately. Refresh after the store has confirmed the replacement.

## Verification and remaining device checks

Automated coverage includes catalog validation; verified product/store matching; higher-capacity filtering; real server enforcement; spoofed identity/tier rejection; preserved global limits and usage; year rollover; absent offers; localized price matching; independent SDK upgrade reads; temporary errors; account changes/stale responses; dismissal; store-opening failures; focus/navigation suppression; reset expiry; continued reading controls; and first-request Catch up notices.

Before activating a catalog, use real store sandbox accounts to verify Basic → higher tier, cancelled replacement, pending approval, delayed RevenueCat propagation, renewal/downgrade, cross-platform subscribers, Android product/base-plan identifiers and available store replacement choices. Check Android Back and iOS dismissal, TalkBack/VoiceOver focus, small screens, large text and Less motion. No emulator, physical-device, or live store transaction was performed in this environment.

Initial upgrade implementation validation, before the subsequent calmer UX revision, completed October 24, 2026: 254 backend tests, 440 mobile reliability tests, and 555 component/integration tests passed (1,249 total). Mobile TypeScript, mobile and backend ESLint, mobile Prettier, `git diff --check`, and complexity checks passed; the complexity baseline was not changed. Targeted backend tests were repeated after the final reset-time adjustment.

Official references reviewed October 24, 2026:

- https://www.revenuecat.com/docs/subscription-guidance/managing-subscriptions
- https://www.revenuecat.com/docs/api-v1/customer-info-model
- https://github.com/RevenueCat/purchases-android/blob/main/purchases/src/main/kotlin/com/revenuecat/purchases/common/CustomerInfoFactory.kt (base-plan identity normalization)

Store-managed upgrades are deliberate for this first implementation. A future direct in-app Google Play replacement would additionally require the old product ID and an explicitly chosen replacement mode, rather than reusing the onboarding purchase call unchanged.

## Calmer upgrade design: ChatGPT and Claude comparison

Reviewed official help documentation on October 24, 2026. These are documentation-based observations, not a firsthand inspection of signed-in mobile screens or evidence of improved conversion or satisfaction.

| Product and source                                                                                                    | Documented behavior                                                                                                                                            | Application to Votic                                                                                                                                                         |
| --------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| [ChatGPT model and usage guidance](https://help.openai.com/en/articles/20001354-gpt-6-and-other-models-in-chatgpt)    | Identifies affected allowances and displays reset information when available. Waiting or another available model can be an option.                             | State which allowance is affected and its real reset time; preserve reading, on-device listening, and notes. Votic has no verified alternate AI model fallback to advertise. |
| [Claude usage and length limits](https://support.claude.com/en/articles/11647753-how-do-usage-and-length-limits-work) | Distinguishes usage limits from conversation length limits and presents waiting or upgrading as options.                                                       | An upgrade is optional. Avoid presenting every failed AI request as a reason to pay.                                                                                         |
| [Claude error messages](https://support.claude.com/en/articles/12466728-troubleshoot-claude-error-messages)           | Gives reset information for usage limits and distinguishes them from service capacity errors. Describes advance warnings where usage information is available. | Preserve the personal-allowance versus service-failure distinction. Do not invent a remaining percentage, countdown, message allowance, or low-credit warning.               |

The Votic design choice is an inference from these documented patterns and the product's own capabilities: show a small, static, dismissible notice in the feature's scrolling content. Waiting and the continued usefulness of the current plan appear before a secondary View plans link. The app never replaces the current feature with an upgrade page. Ordinary errors still provide action feedback if the optional notice was dismissed. Settings also uses View plans; the opt-in comparison page uses Available plans rather than an urgency-focused headline.

Account/session scoping and once-per-period suppression are shared across feature instances, using weak ownership tied to the AuthProvider lifetime. Only focused surfaces subscribe. Reader subscribes before its result sheet mounts, so a first Catch up request can display its notice inline. Expiry timers are bounded to one day and recheck on foreground; blur/unmount cancels listeners and timers. There is no entrance animation or focus capture. The notice uses normal scalable text and 44-point controls. Scanner notices stay inside the scrollable page review instead of crowding the camera footer.

This revision changes presentation, not Votic's monthly reset policy, actual plan limits, prices, store configuration, entitlement behavior, or billing. Copying a competitor's rolling reset windows, prices or usage-credit system would require a separate business decision. A gentler interface alone cannot establish that an allowance is generous enough: evaluate actual request sizes, per-account costs and limit encounters before choosing those values. No new telemetry or automatic paid overage behavior was added.

Calmer UX validation completed October 24, 2026: all 441 mobile reliability tests and 560 component/integration tests passed (1,001 mobile tests across 44 reliability files and 73 Jest suites). TypeScript, mobile ESLint, formatting, whitespace checks and the unchanged complexity gate passed. The backend and store configuration were unchanged in this revision. Physical-device checks remain for screen-reader announcement/focus, large text, keyboard visibility, scanner scrolling and native navigation; actual signed-in competitor screens were not inspected.
