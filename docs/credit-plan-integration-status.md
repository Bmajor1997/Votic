# Credit-plan integration status

Target branch: `feature/paywall-research-improvements-2026-10-22`. Updated 2026-10-26.

**V1 decision:** one subscription, **Votic Plus**, billed monthly (US $9.99/month) or annually (US $79.99/year), with identical features and 1,000 AI credits per monthly cycle on both (`VOTIC_MONTHLY_CREDITS`). Localized prices and savings always come from the store. Annual subscribers get a fresh monthly allowance on each monthly anniversary of their verified start date. Credits reset on the verified billing anniversary and never roll over. Additional usage is bought separately, survives renewals, and is granted only after RevenueCat confirms the purchase. The previously planned $12.99 / 2,000-credit tier is deferred to V2 as Votic Pro (see `v2-decisions.md`).

## Done (server and app)

- RevenueCat's verified billing period drives the monthly allowance. AI routes hold, charge, or release credits atomically. Purchased credits are spent after the monthly allowance, and refunds revoke them. Account deletion removes credit data. Policy, prices, worst-case costs, and safeguards are in `ai-credit-policy.md`.
- `POST /api/ai-usage` reports the signed-in account's percentage remaining, period, and purchased balance.
- The app has Settings → AI Usage (its own page, not under Reading Statistics), a calm, dismissible notice when usage runs out (no upgrade prompt), and the Votic Plus paywall with six benefits.
- The tier catalog `VOTIC_SUBSCRIPTION_TIERS_JSON` still works and still accepts `monthlyCredits` per product. Without a catalog, every verified subscriber gets `VOTIC_MONTHLY_CREDITS`. The V2 upgrade screen (`app/subscription.tsx`, `UpgradeOptions`) is kept in the code but no longer linked from V1.

## Still required outside the repository before launch

1. **Google Play Console:** create the Votic Plus subscription with two auto-renewing base plans, monthly (P1M, US $9.99) and yearly (P1Y, US $79.99). Use base plans of one subscription product, which the in-app switch's replacement flow expects. Create any one-time additional-usage products too. No product IDs are invented in this repository.
2. **RevenueCat:** import both base plans and attach both to the entitlement the app and server use (`REVENUECAT_ENTITLEMENT_ID` / `EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID`, default `pro`). In the current offering, add them as the Monthly (`$rc_monthly`) and Annual (`$rc_annual`) packages. The paywall shows only 1-month and 1-year packages. Add the one-time products. Point the webhook at `/api/revenuecat-webhook` with `REVENUECAT_WEBHOOK_SECRET` as its Authorization header.
3. **Server environment:** set a persistent `VOTIC_AI_USAGE_DB`, `REVENUECAT_SECRET_API_KEY`, `REVENUECAT_WEBHOOK_SECRET`, and `VOTIC_CREDIT_PRODUCTS_JSON` (real product IDs → credit quantities; suggested price at least $0.005 per credit, for example 500 credits for $2.99). Raise `VOTIC_AI_MONTHLY_BUDGET_USD` to about subscribers × $3.60.
4. **End-to-end test on an Android development build** with a Google Play license tester: subscribe monthly and annually, switch both ways, restore, buy additional usage, refund, and let renewals happen. Play's accelerated test renewals make an annual term about 30 minutes long, so monthly cycles inside it are very short in testing.

Until steps 1–3 are done, purchases of additional usage stay hidden in the app. AI Usage says buying isn't available only once usage has run out.
