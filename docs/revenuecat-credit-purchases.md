# RevenueCat extra-credit purchase integration (in progress)

This branch adds a backend-only, persistent credit wallet and authenticated webhook handler.

Configure on the server:
- `VOTIC_AI_USAGE_DB`: persistent writable SQLite database file; do not use `:memory:` in production.
- `REVENUECAT_WEBHOOK_SECRET`: random secret of at least 24 characters. Set RevenueCat webhook's Authorization header to this exact value.
- `VOTIC_CREDIT_PRODUCTS_JSON`: JSON object mapping actual RevenueCat one-time product IDs to integer credit quantities, for example `{"credits_500":500}`. Product IDs here are **examples**, not configured store products.

RevenueCat webhook URL: `https://YOUR_BACKEND_HOST/api/revenuecat-webhook`.

- `VOTIC_CREDIT_ALLOW_SANDBOX`: leave unset in production. Set to `true` only on a test server that should credit free store test purchases.

The endpoint grants recognized `NON_RENEWING_PURCHASE` transactions (RevenueCat's only event type for one-time purchases) to the RevenueCat `app_user_id` (must be the signed-in Votic UID), once per transaction. Only `environment: "PRODUCTION"` events grant credits; `SANDBOX` events (TestFlight, Google Play testers) are acknowledged without credits unless `VOTIC_CREDIT_ALLOW_SANDBOX=true`. RevenueCat reports a refund as `CANCELLATION` (reason `CUSTOMER_SUPPORT`), which revokes that transaction's grant; `REFUND_REVERSED` (App Store only) restores it. Other events are acknowledged without granting extra credits.

The webhook authenticates with `REVENUECAT_WEBHOOK_SECRET` and is handled before the `VOTIC_CLIENT_KEYS` app-key check, because RevenueCat never sends Votic's app key. Event bodies up to 256 KB are accepted, so events carrying customer attributes are not refused.

**Not yet production-ready:** The new wallet is not yet wired into AI-request deductions, the mobile balance display, account deletion, or subscription billing-period resets. Store products must be created in Google Play and RevenueCat before customers can buy them. Do not advertise extra-credit purchases until these integrations and end-to-end tests are complete.
