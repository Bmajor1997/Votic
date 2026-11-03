# Founder lifetime offer

A one-time purchase of **$79.99** that unlocks Votic Plus for good. It's a thank-you for beta testers:

- **Who sees it:** only accounts that used Votic during the beta. The server remembers each beta tester (as a
  one-way hash of the account ID) the first time beta access lets them in, so they stay eligible after
  `VOTIC_BETA_ACCESS_MODE` is switched off at launch. Everyone else sees the normal paywall.
- **When it closes:** whichever comes first, the first **100** founder purchases or the end date (planned as 30
  days after launch).
- **Where it shows:** at the top of the paywall, above the monthly and annual plans, which stay available. A
  beta tester only reaches the paywall once beta access is off, so during the beta nobody sees it.
- **What founders get:** Votic Plus with no expiry and the same monthly AI allowance as Votic Plus (the server's
  calendar-month allowance for lifetime grants). Settings shows "Founder lifetime · yours for good".

Nothing on the phone decides any of this. The server tells the app whether to show the offer, the store sets the
price, and access starts only when RevenueCat confirms the purchase.

## Set up before launch

1. **Google Play Console** → Monetize → Products → **In-app products** → create a one-time product, for example
   `votic_founder_lifetime`, priced at **$79.99**. (App Store Connect later: a **Non-Consumable** with the same ID.)
2. **RevenueCat** → Products → add `votic_founder_lifetime`, then attach it to the **`premium`** entitlement (the
   same one as the subscriptions). That is what makes it unlock Votic Plus.
3. **Votic server** (Google Cloud) environment:
   - `VOTIC_FOUNDER_PRODUCT_ID=votic_founder_lifetime`
   - `VOTIC_FOUNDER_ENDS_AT=` launch date + 30 days, as a date and time, e.g. `2027-02-01T05:00:00Z`
   - `VOTIC_FOUNDER_LIMIT=100` (optional; 100 is the default)
   - Keep `VOTIC_AI_USAGE_DB` on persistent storage: the beta-tester list and founder count live there.
4. **At launch**, set `VOTIC_BETA_ACCESS_MODE=off`. Beta testers then hit the paywall and see the founder offer.
5. Test with a Play license tester on a development build: buy it, confirm Votic opens, and check Settings.

Leaving `VOTIC_FOUNDER_PRODUCT_ID` unset turns the offer off. The server's startup summary prints whether it's
on, the product, the cap and the end date.

## How the cap is counted

A spot is counted once per account the first time the server verifies a founder purchase with RevenueCat (the app
checks right after buying). Two people buying at the very same moment as the last spot could both get it, so the
cap can run over by one or two; it never runs under. A refund doesn't give the spot back. Deleting an account
forgets that it was a beta tester; a spot it used stays counted.
