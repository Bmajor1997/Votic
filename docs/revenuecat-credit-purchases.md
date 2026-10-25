# RevenueCat extra-credit purchase integration (in progress)

This branch adds a backend-only, persistent credit wallet and authenticated webhook handler.

Configure on the server:
- `VOTIC_AI_USAGE_DB`: persistent writable SQLite database file; do not use `:memory:` in production.
- `REVENUECAT_WEBHOOK_SECRET`: random secret of at least 24 characters. Set RevenueCat webhook's Authorization header to this exact value.
- `VOTIC_CREDIT_PRODUCTS_JSON`: JSON object mapping actual RevenueCat one-time product IDs to integer credit quantities, for example `{"credits_500":500}`. Product IDs here are **examples**, not configured store products.

RevenueCat webhook URL: `https://YOUR_BACKEND_HOST/api/revenuecat-webhook`.

The endpoint grants recognized `NON_RENEWING_PURCHASE` or `ONE_TIME_PURCHASE` transactions to the RevenueCat `app_user_id` (must be the signed-in Votic UID), once per transaction. `REFUND` events revoke the corresponding transaction grant. Other events are acknowledged without granting extra credits.

**Not yet production-ready:** The new wallet is not yet wired into AI-request deductions, the mobile balance display, account deletion, or subscription billing-period resets. Store products must be created in Google Play and RevenueCat before customers can buy them. Do not advertise extra-credit purchases until these integrations and end-to-end tests are complete.
