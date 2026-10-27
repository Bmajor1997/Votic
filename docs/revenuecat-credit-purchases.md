# RevenueCat extra-credit purchase integration

This branch adds a backend-only, persistent credit wallet and authenticated webhook handler.

Configure on the server:
- `VOTIC_AI_USAGE_DB`: persistent writable SQLite database file; do not use `:memory:` in production.
- `REVENUECAT_WEBHOOK_SECRET`: random secret of at least 24 characters. Set RevenueCat webhook's Authorization header to this exact value.
- `VOTIC_CREDIT_PRODUCTS_JSON`: JSON object mapping actual RevenueCat one-time product IDs to integer credit quantities, for example `{"credits_500":500}`. Product IDs here are **examples**, not configured store products.

RevenueCat webhook URL: `https://YOUR_BACKEND_HOST/api/revenuecat-webhook`.

- `VOTIC_CREDIT_ALLOW_SANDBOX`: leave unset in production. Set to `true` only on a test server that should credit free store test purchases.

The endpoint grants recognized `NON_RENEWING_PURCHASE` transactions (RevenueCat's only event type for one-time purchases) to the RevenueCat `app_user_id` (must be the signed-in Votic UID), once per transaction. Only `environment: "PRODUCTION"` events grant credits; `SANDBOX` events (TestFlight, Google Play testers) are acknowledged without credits unless `VOTIC_CREDIT_ALLOW_SANDBOX=true`. RevenueCat reports a refund as `CANCELLATION` (reason `CUSTOMER_SUPPORT`), which revokes that transaction's grant; `REFUND_REVERSED` (App Store only) restores it. Other events are acknowledged without granting extra credits.

The webhook authenticates with `REVENUECAT_WEBHOOK_SECRET` and is handled before the `VOTIC_CLIENT_KEYS` app-key check, because RevenueCat never sends Votic's app key. Event bodies up to 256 KB are accepted, so events carrying customer attributes are not refused.

**Status (2026-10-26):** Purchased credits are now spent by AI requests after the monthly Votic Plus allowance (see `ai-credit-policy.md`). They are shown as "Additional AI usage" on Settings → AI Usage, removed on account deletion, and kept across subscription renewals. A purchase reported for a deleted account is not credited. The app offers only products listed in `VOTIC_CREDIT_PRODUCTS_JSON` that the store also returns. **Store products must still be created in Google Play and RevenueCat before customers can buy them, and the flow needs an end-to-end test on an Android development build.** Until then the app shows no purchase button.

## Refund delivery safeguards (October 27, 2026)

Refunds and reversed refunds use the same product, account and environment checks as grants. Sandbox or missing-environment events cannot change a production wallet. Production startup rejects sandbox-credit mode and requires a usable webhook secret when credit products are configured. Only a dedicated test server should enable sandbox events.

`credit_refund_states` is an additive SQLite table created on startup. It keeps the latest `event_timestamp_ms` for each transaction/account/product, including refunds received before their purchase. Old or duplicate events cannot undo a newer reversal. Equal-time ambiguity conservatively revokes the grant. Missing/invalid refund timestamps produce an error for retry/investigation rather than acknowledging a lost mutation. Existing grants remain intact on migration; the table cannot reconstruct refund events that were lost before this fix. Reconcile historical transactions with RevenueCat before launch.

The state and grant update commit atomically; delayed grants read refund state in their insert statement. Grant/refund deletion checks are inside immediate transactions, so another server process cannot delete the account between the check and wallet write. Account deletion removes refund state with credit data and blocks later events for that deleted account. Snapshots include the new table through SQLite's whole-database backup. No new store products, prices, credits, subscription access or V2 functionality are introduced.

References: [RevenueCat webhook flows](https://www.revenuecat.com/docs/integrations/webhooks/event-flows), [event fields](https://www.revenuecat.com/docs/integrations/webhooks/event-types-and-fields).
