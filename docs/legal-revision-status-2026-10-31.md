# Legal revision status — October 31, 2026

Draft revision of the October 30 policies on claude/legal-updates, based on Votic_Legal_Review_2026-10-31.md. This is drafting assistance, not a legal opinion or launch clearance. Do not publish until the decisions and operational checks below are resolved. No application controls or deployed services are changed by this revision.

## Wording revised

- Cancellation, store-management links, refund routes and developer assistance; mandatory rights preserved.
- Monthly allowance, conditional annual billing and additional-purchase rules. No new price, trial or launch product is promised. Rules grounded in app_parts/ai_credits.js and docs/ai-credit-policy.md; deployed configuration still needs checking.
- Proposed minimum age of 13, any higher local minimum, and guardian authorization for minors. This is a proposed contractual rule, not a verified age-control implementation or an approved audience decision.
- Scope extended to support and deletion forms; Gmail and the linked Framer host identified. Submission destination, fields and website tracking remain unverified.
- Privacy access/correction/deletion and other applicable rights, verification, agents, appeals, regulator complaints and consent withdrawal.
- AI context can include an entire short document, history, notes and scans; endpoint retention differs. No zero-retention promise.
- Local history, temporary copies, Recently Deleted, device services, backup and shared-device exposure clarified.
- Actual indefinite hash retention disclosed without calling it anonymous or inventing an expiry. External deletion page corrected to match the request-age-based 90-day rule.
- Content authority, app license, output rights, infringement contact, proportionate suspension, shutdown remedies, mandatory liability exceptions and general contract clauses.
- Prospective material changes and legally required fresh agreement/consent distinguished from privacy notice receipt.

## Decisions Ben needs to confirm

1. Launch countries and Android-only versus iOS. International lawful bases, transfer mechanisms, representatives and market-specific disclosures remain unresolved. Do not use the general rights section as evidence of GDPR readiness.
2. Age policy: adopt the proposed 13-plus/guardian approach, choose adults only, or another reviewed policy. Align onboarding and store audience settings before publication. The existing privacy notice still says the service is not directed to under-13s.
3. Which subscription periods and additional-usage products will actually be available. Repository documentation describes annual billing and top-ups, but this does not prove the live offer. Match purchase screens, unit disclosures and limits to the offer.
4. Whether to prohibit highly sensitive/regulated documents or support them with appropriate controls. The revision preserves the existing caution and adds authority and regulated-use limits; it does not establish a special-category lawful basis.

## Operational blockers and verification

| Review finding | Remaining work |
| --- | --- |
| 1. AI-sharing permission | Build and test disclosure before relevant transfers; name OpenAI, identify data and purpose, provide cancel, and record permission appropriately. The policy does not claim this control exists. |
| 2–3. Paid benefits | Verify localized offer, reset behavior, failed-request releases, top-up grants/refunds and usable management links in release builds. Confirm refund support and safeguards do not defeat purchased benefits. |
| 4. Children | Implement the selected eligibility rule and underage-account handling; evaluate applicable parental-consent requirements. |
| 5. External deletion | Verify Framer form fields, receipt destination, cookies/analytics, access controls and retention. Test email fallback through verification and completion. Gmail naming is based on the support address, not an inbox audit. |
| 6. Privacy requests | Establish an operating process for applicable response deadlines, proportionate verification, authorized agents, exceptions, appeals and complaints. Rights text alone does not implement it. |
| 7. International | Determine distribution and marketing scope; assess lawful bases, processor agreements, transfers and local contacts before targeting covered markets. Do not assert unverified safeguards. |
| 8. Sensitive content | Decide scope and confirm any necessary contractual and technical controls. |
| 9. Retention/security | Set and operate justified retention for support mail, forms, verification evidence, logs, usage history, backups and deletion hashes. Hash has no coded expiry; do not imply a pruning job exists. Confirm restoration does not reinstate deleted data. Verify US hosting region and access-control assertions retained from the existing policy. |
| 10. OpenAI | Verify endpoint configuration, provider terms and account data-sharing settings before maintaining no-training commitments. |
| 11. Device lifecycle | Verify Recently Deleted and scan-draft cleanup, OS backups, account isolation and widget exposure against the release. Correct the paywall's absolute on-device speech claim where network speech is possible. |
| 12. Acceptance | Working accessible legal links across signup methods; implement suitable agreement/version evidence and notice mechanics. Replace revision-prepared wording with an actual effective date when publication is scheduled. |
| 13–15. Contract terms | Counsel should review output assignment, minor authorization, paid-feature restrictions, shutdown/export handling and liability cap for launch markets. No arbitration or class waiver added. |
| 16. iOS EULA | If shipping iOS, determine whether Apple's standard EULA or a complete custom EULA applies. These revisions do not complete a custom Apple EULA. |

The external deletion email route is a concrete wording improvement; actual request fulfillment is still required. Do not present this draft as fixing the consent UI, retention automation, account deletion implementation or store declarations.

## Validation and references

Existing HTML structure and internal /privacy, /terms and /delete-account routes retained. Structural checks cover parse errors, duplicate IDs, empty links, required reciprocal links and absence of inline scripts/styles. No application behavior changed. Full server and mobile tests require a repository checkout with its dependencies; do not claim they ran from this draft-only workspace.

Primary guidance checked during drafting:

- Google Play User Data: https://support.google.com/googleplay/android-developer/answer/10144311
- Google Play refunds: https://support.google.com/googleplay/android-developer/answer/2741495
- Google Play subscription management: https://developer.android.com/google/play/billing/manage-purchases
- FTC COPPA FAQ: https://www.ftc.gov/business-guidance/resources/complying-coppa-frequently-asked-questions
- ICO privacy information: https://ico.org.uk/for-organisations/uk-gdpr-guidance-and-resources/individual-rights/the-right-to-be-informed/what-privacy-information-should-we-provide/
- OpenAI API data controls: https://developers.openai.com/api/docs/guides/your-data

The original review remains the detailed source for the 16 findings and conditional legal applicability. Have qualified counsel assess the final market-specific documents and deployed practices before launch.
