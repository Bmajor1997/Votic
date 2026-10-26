# Credit-plan integration status

Target branch: `feature/paywall-research-improvements-2026-10-22`. Updated 2026-10-26.

**V1 decision:** one subscription, **Votic Plus** (US $9.99/month, the localized price always read from the store), with 1,000 monthly AI credits (`VOTIC_MONTHLY_CREDITS`). Credits reset on the verified billing anniversary and never roll over. Additional usage is bought separately, survives renewals, and is granted only after RevenueCat confirms the purchase. The previously planned $12.99 / 2,000-credit tier is deferred to V2 as Votic Pro (see `v2-decisions.md`).

## Done (server and app)

- RevenueCat's verified billing period drives the monthly allowance. AI routes hold, charge, or release credits atomically. Purchased credits are spent after the monthly allowance, and refunds revoke them. Account deletion removes credit data. Policy, prices, worst-case costs, and safeguards are in `ai-credit-policy.md`.
- `POST /api/ai-usage` reports the signed-in account's percentage remaining, period, and purchased balance.
- The app has Settings → AI Usage (its own page, not under Reading Statistics), a calm, dismissible notice when usage runs out (no upgrade prompt), and the Votic Plus paywall with six benefits.
- The tier catalog `VOTIC_SUBSCRIPTION_TIERS_JSON` still works and still accepts `monthlyCredits` per product. Without a catalog, every verified subscriber gets `VOTIC_MONTHLY_CREDITS`. The V2 upgrade screen (`app/subscription.tsx`, `UpgradeOptions`) is kept in the code but no longer linked from V1.

## Still required outside the repository before launch

1. **Google Play Console:** create the Votic Plus monthly subscription and base plan at US $9.99, and create any one-time additional-usage products. No product IDs are invented in this repository.
2. **RevenueCat:** attach the subscription to the entitlement the app and server use (`REVENUECAT_ENTITLEMENT_ID` / `EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID`, default `pro`), and make it the current offering's monthly package. Add the one-time products. Point the webhook at `/api/revenuecat-webhook` with `REVENUECAT_WEBHOOK_SECRET` as its Authorization header.
3. **Server environment:** set a persistent `VOTIC_AI_USAGE_DB`, `REVENUECAT_SECRET_API_KEY`, `REVENUECAT_WEBHOOK_SECRET`, and `VOTIC_CREDIT_PRODUCTS_JSON` (real product IDs → credit quantities; suggested price at least $0.005 per credit, for example 500 credits for $2.99). Raise `VOTIC_AI_MONTHLY_BUDGET_USD` to about subscribers × $3.60.
4. **End-to-end test on an Android development build** with a Google Play license tester: subscribe, restore, buy additional usage, refund, and let a renewal happen.

Until steps 1–3 are done, purchases of additional usage stay hidden in the app. AI Usage says buying isn't available only once usage has run out.
