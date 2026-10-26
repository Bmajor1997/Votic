# Votic Plus AI credit policy (V1)

Decided 2026-10-26 on `feature/paywall-research-improvements-2026-10-22`.

Votic V1 sells one subscription, **Votic Plus**, billed monthly (US $9.99/month) or annually (US $79.99/year, about $6.67/month, about 33% less than 12 monthly payments). The app always shows the store's localized prices and calculates savings from them. Both plans have identical features and include **1,000 AI credits per monthly allowance cycle** (`VOTIC_MONTHLY_CREDITS`, default 1000). Annual billing does not mean an annual allowance: annual subscribers get 1,000 credits each month, never 12,000 at once. Credits are an internal unit. The paywall and AI Usage screen describe "generous monthly AI usage" and a percentage remaining, not credit counts.

## What a credit pays for

Each action has a fixed price. The server picks it from the request's size before any AI work starts, so the same action always costs the same. The prices live in `app_parts/ai_credits.js`.

| Action | Server feature | Credits |
|---|---|---:|
| Help question about using Votic, no document (AI answer) | `ask-votic` / `catch-me-up` without a document | 1 |
| Question, summary, or Catch me up about a document, request ≤ 100 KB | `ask-votic`, `catch-me-up` | 2 |
| Same, larger request (bounded by `VOTIC_MAX_JSON_BYTES`, default 500 KB) | `ask-votic`, `catch-me-up` | 5 |
| AI document review (server route kept; the retired Review screen is not restored) | `document-review` | 2 / 5 by size |
| Camera scan, one page | `scan-ocr` | 3 |
| Scanned PDF ≤ 3 MB / ≤ 8 MB / ≤ 12 MB | `pdf-ocr` | 10 / 20 / 30 |
| Spoken question (≤ 60 s), transcription only | `ask-votic-transcription` | 1 |

Free: reading, listening (device speech), notes, bookmarks, imports of text documents and webpages, the local OCR review, and built-in help answers. When AI usage runs out, help about using Votic falls back to its free built-in answer instead of an error.

**Why fixed prices, not tokens.** Equating 1 credit with 1 token would make the allowance hard to understand and would surprise people with large deductions from long documents. Fixed per-action prices are predictable. The size tiers stop one very large document from costing the same as a short note. Tokens and dollars stay enforced underneath as safeguards (see below).

### Examples

With 1,000 credits a month, someone could ask about 500 questions on ordinary documents, or about 200 on very long ones. They could also scan about 330 camera pages, or mix these. Typical use (a few questions a day, some summaries, occasional scans) uses well under half the allowance.

## Worst-case cost per credit

The model is `gpt-6-luna` at $0.10 per million input tokens and $0.50 per million output tokens (×2 input and ×1.5 output above 272K input tokens). `gpt-4o-mini-transcribe` is priced at $1.25 input and $5 output per million tokens. These are the prices in `app_parts/ai_usage.js`, verified 2026-10-05.

| Action | Worst realistic provider cost | Credits | $/credit |
|---|---:|---:|---:|
| Large document question (500 KB of dense text, ~170K tokens, 900 output) | ≈ $0.018 | 5 | ≈ $0.0036 |
| Small document question (100 KB, ~33K tokens) | ≈ $0.0038 | 2 | ≈ $0.0019 |
| Help question with 20-turn history (~13K tokens) | ≈ $0.0015 | 1 | ≈ $0.0015 |
| Camera page (image plus up to 5K output) | ≈ $0.003 | 3 | ≈ $0.001 |
| 12 MB scanned PDF (up to ~300K tokens, long-context rate, 12K output) | ≈ $0.07 | 30 | ≈ $0.0023 |
| 60 s voice question | ≈ $0.003 | 1 | ≈ $0.003 |

**Worst case: about $0.0036 per credit, or about $3.60 per subscriber per month if all 1,000 credits go on the most expensive action.** A typical month costs well under $1. Net revenue after the store's 15% subscription fee is about $8.49, so the allowance stays sustainable even at worst-case use. Re-check this table whenever model prices or `OPENAI_*_MODEL` settings change.

### Safeguards that stay in place

- **Per-account dollar and token limits** (`VOTIC_AI_USER_MONTHLY_BUDGET_USD`, `VOTIC_AI_MONTHLY_TOKENS`) are still enforced per UTC calendar month. When credits apply, both limits rise with the credits actually spent that month, up to $0.005 and 40,000 tokens per credit (`MAX_USD_PER_CREDIT`, `MAX_TOKENS_PER_CREDIT`). The configured values remain the floor. A subscriber is not refused while credits remain, but provider cost per credit can never exceed the bound, even if prices change. If a tier in `VOTIC_SUBSCRIPTION_TIERS_JSON` sets `monthlyTokens` / `monthlyBudgetUsd`, those explicit values are used instead.
- **Service-wide budget** `VOTIC_AI_MONTHLY_BUDGET_USD` (default $100) still caps all spending. Raise it to roughly subscribers × $3.60 before launch, or AI stops for everyone when it is reached.
- Daily, per-minute, and concurrency limits (`VOTIC_AI_CLIENT_DAILY_LIMIT` 100/day, `VOTIC_AI_USER_RATE_LIMIT`, `VOTIC_AI_USER_CONCURRENCY`) are unchanged.

## Accounting rules (server-authoritative)

All of this lives in the private SQLite ledger (`VOTIC_AI_USAGE_DB`), in the tables `credit_periods`, `credit_charges`, `credit_grants`, and `credit_spends`.

1. **Allowance cycle.** The billing period comes from RevenueCat's REST profile, which `premium_access.js` verifies on the server: `purchase_date` → `expires_date` of the active entitlement. A period of up to 45 days (monthly billing) is one allowance cycle. A longer period (annual billing) is split into monthly cycles counted from the verified subscription start (`allowance_cycle`, `add_months`). A cycle that starts on the 31st falls on the last day of shorter months (Jan 31 → Feb 28, or Feb 29 in leap years → Mar 31). Cycles are always counted from the start date, so a short month never shifts later ones. The last cycle ends with the annual term, and during billing grace it continues with no new allowance. Each `(account, cycle start)` gets one allowance row. Renewal (or the next monthly cycle) gives a fresh allowance. Unused monthly credits do not roll over. The server computes the cycle from the verified dates and its own clock on each request, never from a timer on the phone. If the store reports no billing end (a lifetime grant or malformed dates), the allowance resets on the UTC calendar month and the API reports `billingPeriodVerified: false`.
2. **No duplicate allowances.** Repeated verification of the same cycle reuses its row; its allowance is fixed when first recorded. **Switching billing periods:** monthly → annual on Google Play takes effect immediately (`WITH_TIME_PRORATION`). The new annual term starts mid-cycle, so the current cycle continues and is extended to the annual plan's first monthly anniversary, with no second allowance. Annual → monthly is `DEFERRED` until the annual term ends, and the first monthly period then starts one new cycle. A profile older than the latest recorded period (stale cache, delayed data) stays in the latest period. A new start more than 24 hours before the recorded period's end (resubscribing mid-period, overlapping restarts) also stays in the recorded period, with its end extended. Webhook order never affects allowances: RevenueCat events only clear the 60-second cached profile, so the next request re-reads the current state.
3. **Hold, then charge or release.** Before any provider call the server holds the price under a server-generated request ID, inside a `BEGIN IMMEDIATE` transaction. Concurrent requests and multiple server processes on the same database therefore cannot overspend. A request ID is held at most once and charged at most once, and a released hold can never be charged later. The hold is **charged only when the person receives the result**. It is **released** when the provider rejects the request, fails, times out, is cancelled, or returns an incomplete result, and when the app falls back to a built-in answer. A hold left by a crashed process is released after 10 minutes. The provider's token and dollar reservation for uncertain calls is kept separately, as before, for cost safety.
4. **Monthly credits first, then purchased credits.** Purchased credits survive renewals. Balances never go negative, and a request that cannot be fully covered is refused with `429 AI_CREDITS_EXHAUSTED` and `resetsAt` (the period end) before any AI work.
5. **Purchases.** Credits are granted only by the authenticated RevenueCat webhook (`NON_RENEWING_PURCHASE`, production environment, a product listed in `VOTIC_CREDIT_PRODUCTS_JSON`), once per transaction. A refund (`CANCELLATION`) revokes the remaining credits of that purchase. Already-spent credits are not clawed back into a negative balance. `REFUND_REVERSED` restores them. Purchases are not granted to deleted accounts.
6. **Subscription states.** A cancelled subscription stays active until its paid-through date, and billing grace counts as active. Both keep the current period, with no new allowance until a renewal is reported. Expiry or a subscription refund removes access: AI routes return 403 and AI Usage reports `not-subscribed`. If RevenueCat cannot be reached, AI routes and AI Usage return 503. The server never guesses.
7. **Account deletion** removes the account's credit periods, charges, grants, and spends in the same transaction that begins deletion.
8. **Nothing comes from the phone.** Identity is the verified Firebase UID. The plan, period, allowance, and balances are read from RevenueCat and the ledger, and request-body fields are ignored.

## Authenticated AI Usage API

`POST /api/ai-usage` requires a signed-in account (and the app key when configured), has no body, and returns `Cache-Control: no-store`:

```json
{
  "status": "active | unmetered | not-subscribed | not-configured",
  "plan": { "name": "Votic Plus" },
  "monthly": { "percentRemaining": 99, "allowance": 1000, "used": 10, "remaining": 990,
               "periodStart": "…", "periodEnd": "…", "resetsAt": "…", "billingPeriodVerified": true },
  "purchased": { "remaining": 0 },
  "purchaseProducts": ["<configured product id>"]
}
```

`percentRemaining` is rounded down. The response contains no ledger rows, provider IDs, keys, or dollar figures. The app shows only the percentage, the bar, the renewal date, and whether additional usage is available. Counts are returned so support can troubleshoot.

## Testing

- **Expo Go:** Settings → AI Usage works, with the real progress bar, every state, and Reduce Motion, against a development server. The paywall layout and animations also work there, but Expo Go cannot load store products: the paywall says purchases need a store build, and AI Usage says buying additional usage needs the store version. With a backend that has `REVENUECAT_SECRET_API_KEY` and an account that has an active entitlement (for example one granted from the RevenueCat dashboard), AI Usage shows real server values in Expo Go.
- **Android development build plus Google Play test track** (license tester): real monthly and annual subscription purchase, switching between them, restore, the localized prices and savings, buying additional usage (`purchaseStoreProduct`), and the webhook grant. Use `VOTIC_CREDIT_ALLOW_SANDBOX=true` only on a test server. Play test subscriptions renew every few minutes, and each renewal is a new verified period, so expect a fresh allowance with each one.
- **Automated tests:** the server math, periods, concurrency, purchases, refunds, and deletion are tested in `code_checks/ai_credits.test.js` and `code_checks/ai_usage_api.test.js`. The screens are tested with mocked server answers in `apps/mobile/tests/components/aiUsage.component.test.tsx` and `paywallAccount.component.test.tsx`. Mocked balances are never shown to customers.
