# Credit-plan integration status

Target branch: `feature/paywall-research-improvements-2026-10-22`.

Approved subscription offers:
- Standard: $9.99/month, 1,000 monthly usage credits.
- Premium: $12.99/month, 2,000 monthly usage credits.
- Monthly credits reset on the subscriber's verified billing anniversary and do not roll over.
- Additional one-time credit purchases are granted automatically and do not disappear at the monthly reset.

Existing subscription tier catalog (`VOTIC_SUBSCRIPTION_TIERS_JSON`) now accepts an optional positive integer `monthlyCredits` alongside its existing `monthlyTokens` and `monthlyBudgetUsd`. Configure **real** RevenueCat product/base-plan IDs; do not infer plan identity from a localized price string. The authenticated subscription-options response exposes the configured `monthlyCredits` for the verified current tier.

The RevenueCat verifier now exposes verified `periodStart` and `periodEnd` fields when present. These dates are not yet wired into the AI usage ledger. A purchase wallet and authenticated webhook are implemented in `app_parts/credit_wallet.js`, but wallet spending is not yet connected to AI requests.

**Required before launch:** Define how many credits each AI operation costs; enforce deductions atomically with the existing AI reservation ledger; handle cancellation/refund, upgrades, renewal period identity and delayed RevenueCat events; prevent spending on revoked top-ups; handle account deletion and migration; connect balance endpoints and paywall copy to actual configured product IDs; run backend/mobile/CI tests and sandbox purchases. Until complete, do not claim customer credit balances or advertise these allowances as live.
