# Android V1 billing launch setup

Verified in the service dashboards on 2026-10-28. These are setup observations, not evidence of a successful purchase.

## Existing resources to reuse

- Firebase / Google Cloud project: `votic-da5c4`, project number `562186959755`, active.
- Android package: `com.votic.app`.
- RevenueCat project: Votic (`113f36f7`); Play Store app: `app713897a509`.
- Enabled service account: `revenuecat-play-billing@votic-da5c4.iam.gserviceaccount.com`. Cloud listed no keys.
- RevenueCat entitlement: `premium` (`entl6db1775fa5`). Do not create a second entitlement named `pro`.
- Default offering: `default` (`ofrng0adbe6ddc5`).
- The offering contains Monthly (`$rc_monthly`) and Annual (`$rc_annual`) packages, both attached only to Test Store products. The entitlement also contains only those two Test Store products.
- RevenueCat's Play app has the correct package but no uploaded service-account JSON. Developer notifications cannot connect until credentials are saved.
- The Votic Apps personal Play developer account home displayed “Create your first app.” No existing Play app was listed.
- Project IAM listed the owner and Firebase Admin SDK service account; no project role grant for the RevenueCat service account was listed.

## Approved scope for this setup

US $9.99 per month and 1,000 monthly credits. Do not create or activate annual plans, trials, extra-credit products, or additional subscriptions as part of this setup without separate direction. Older documents describe broader plans; they do not expand this setup's approved scope.

## Deployment configuration

The application and backend retain the fallback entitlement `pro`. Set both explicitly to the EXISTING `premium` entitlement:

- Mobile build: `EXPO_PUBLIC_REVENUECAT_ENTITLEMENT_ID=premium`.
- Backend: `REVENUECAT_ENTITLEMENT_ID=premium`.
- Both Firebase project settings: `votic-da5c4`.
- Backend: `VOTIC_MONTHLY_CREDITS=1000`; verify any `VOTIC_SUBSCRIPTION_TIERS_JSON` does not override this allowance.
- Mobile: configure the Play app's public Android SDK key in `EXPO_PUBLIC_REVENUECAT_ANDROID_API_KEY`. Never use a Test Store key for release.
- Backend: configure `REVENUECAT_SECRET_API_KEY` in the hosting provider's private secrets. Never put it in Expo public variables.
- Production also needs valid Firebase app configuration, a public HTTPS API endpoint, HTTPS terms/privacy links, an EAS project ID, and a private persistent usage database.

Environment examples are templates, not deployed configuration. Copying them does not update EAS, a running server, an installed build, or service dashboards.

## Remaining console work

1. Verify Play identity/account requirements and create the app only after confirming no existing app exists. Stop for legal declarations that require the account holder.
2. Check Google Play Android Developer API, Google Play Developer Reporting API, and Cloud Pub/Sub are enabled in the existing Cloud project.
3. Add the needed Cloud Pub/Sub and Monitoring permissions to the existing service account. RevenueCat currently documents Pub/Sub Editor and Monitoring Viewer. Access expansion and persistent key creation require action-time authorization.
4. Grant the existing service account the required Play Console access. Inspect the precise app and account permissions before saving; do not grant administrator access.
5. Create one JSON key for the existing account if no usable key exists, upload it directly to RevenueCat, and validate the credential checks. Do not paste key contents into chat, source files, logs, or a pull request.
6. Connect RevenueCat's Google developer notifications; reuse existing Pub/Sub resources if present. Configure the resulting topic in the Play app and send a test notification.
7. Inspect existing Play products before creating anything. Reuse the approved monthly subscription/base plan when present; confirm US $9.99 monthly. Import the real Play product into RevenueCat and attach it to `premium` and the existing `$rc_monthly` package.
8. Verify deployed environment values and build a signed Play test release. With a license tester, verify purchase, entitlement, restore, renewal, cancellation/refund updates, and the backend's 1,000-credit allowance.

## Reference

[RevenueCat Play service credentials](https://www.revenuecat.com/docs/service-credentials/creating-play-service-credentials). Credential propagation can take up to 36 hours. Successful dashboard setup alone does not verify end-to-end billing.
