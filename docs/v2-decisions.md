# Votic V2 — agreed follow-up work

## Samsung status-bar player that expands over the Home screen

Recorded October 15, 2026. The user explicitly deferred this interaction to V2.

While Votic is reading aloud and the person leaves the app:

- Show a compact Samsung media chip beside the clock, containing the Votic V icon and the current document title.
- Tapping the chip expands a compact player over the upper portion of the phone's Home screen. Keep the rest of the Home screen visible; do not open the full Votic app or require pulling down the notification panel for this interaction.
- The expanded player shows the blue V artwork, the document title, play/pause, previous passage, and next passage controls.
- Use the app's default blue (#2563EB), not the former orange branding.
- Match the Samsung system interaction shown in the user's Spotify screenshots. Prefer the supported Samsung media surface rather than inventing an unrelated floating overlay.

### Reference and validation

The user supplied these screenshots from their Samsung phone running One UI 8.5 / Android 16:

- `Screenshot_20261015_144744_One UI Home.jpg`: collapsed Spotify chip beside the clock.
- `Screenshot_20261015_144749_One UI Home.jpg`: expanded Spotify player over the upper Home screen.

Copies are saved alongside this document in `v2-references/`.

Validate on a compatible physical Samsung phone with Media player enabled in Now bar settings. The current standard Android emulator does not verify Samsung's expanding status-bar player. The existing V1 notification-panel player remains the tested baseline, not acceptance evidence for this V2 interaction.

## Votic Pro (second subscription tier)

Recorded October 26, 2026. V1 launches with one subscription, Votic Plus. **Votic Pro is deferred to V2.**

- The tier previously planned for V1 was $12.99/month with 2,000 monthly AI credits (see `credit-plan-integration-status.md`). Treat that as the starting point for V2 pricing, not a commitment.
- Pro's previously discussed feature list is not recorded in this repository. Add it here when it is confirmed, rather than reconstructing it.
- Reusable infrastructure kept for V2: the tier catalog `VOTIC_SUBSCRIPTION_TIERS_JSON` (`monthlyCredits`, `monthlyTokens`, `monthlyBudgetUsd` per verified product), `/api/subscription-options` and its higher-capacity `upgrades`, the mobile upgrade screen `app/subscription.tsx` / `UpgradeOptions`, `upgrade_offers`, and the annual-value comparison `annual_value`. V1 does not link to the upgrade screen, and the paywall offers only the monthly Votic Plus plan.
- Before shipping Pro: define how a mid-period upgrade carries usage over (today an overlapping new period stays in the period already granted), re-run the worst-case cost table in `ai-credit-policy.md`, and restore an upgrade entry point from AI Usage.
