# Release and operational acceptance

These procedures do not provision services or activate schedules. Execute on the private staging/hosting environment with approved credentials, then attach the resulting evidence. No Firebase or RevenueCat configuration was changed by the safety fixes.

## Private backend

1. Configure a single supported persistent ledger deployment. Verify GET /healthz and GET /readyz without exposing private statistics.
2. Schedule `node security/ops-check.js` hourly with the private environment loaded. Route nonzero exits AND scheduler/job failures to a tested alert destination. Generate a known staging threshold breach and verify actual alert delivery. A script committed in git is not a running monitor.
3. Schedule daily `node security/ledger-snapshot.js backup SOURCE NEW_DESTINATION`, then `verify NEW_DESTINATION`. Use private permissions, encryption at rest, off-site encrypted copies, retention and deletion reconciliation. Never expose snapshots as static files or copy a live WAL database as an ordinary file backup.
4. Perform a monthly isolated restore drill with `restore SNAPSHOT NEW_DRILL_PATH --backend-stopped`; verify readiness and a dedicated test account. Record restoration time, data loss window, and sign-off. Set recovery objectives before production. Follow docs/LIBRARY_IMPORT_RELEASE_SAFEGUARDS.md for rollback and reconciliation of account deletions and spend since a snapshot.
5. Verify server deployment order, request saturation, cancellation, report triage, disk monitoring, optional diagnostic consent/retention, and report backlog alerts.

## Device and store acceptance

- Android: signed install, email/Google sign-in, account switching, all import types including real HEIC and mixed PDF samples; low storage; background/foreground and process termination during save and restore; narration with screen off, headphone unplug, audio-focus loss, and notification controls.
- For an iOS release also install a signed device build, verify app group/widget snapshots and updates, narration interruptions, Apple sign-in and store flows. Simulator compilation alone is insufficient.
- Billing: dedicated sandbox customers, pending/refunded purchases, restore, unavailable store, delayed responses, and no duplicate purchase on retry. Verify production app/service URL and signing separately from empty-config CI builds.
- Deletion: live dedicated Firebase/RevenueCat test customers, interrupted/retried deletion, local data/widgets cleared, other account intact, second-device/foreground detection. Customer deletion does not cancel a store subscription; verify the UI explains this.
- Crash visibility: choose and configure an actual native crash/ANR reporting provider, validate privacy/consent, trigger a staging native crash and confirm receipt/alerting. Existing optional React screen counters do not satisfy this check. Provider/account setup is still required.
- Backups contain readable text and notes. Current export explicitly warns that it is unencrypted. Decide whether intended users require encrypted portable export before release; document a reviewed risk decision rather than claiming encryption exists.

## Dependencies and repository protection

October 20 review: fresh root npm audit returned no findings. Mobile production npm audit reported 52 affected package entries (47 high, 5 moderate), all tracing to three advisories already named in osv-scanner.toml. Package entries are not 52 distinct advisories. The unchanged exceptions expire November 15, 2026; their presence does not prove runtime reachability is absent. Do not downgrade Expo to an incompatible version simply because npm proposes it. Review each advisory, usage/build exposure, upstream fixes, and the build environment before renewal or release. Never extend expiry automatically.

Check repository rules through an authorized settings view. Require PR review, successful relevant CI checks, and review of exceptions; restrict direct pushes to main and verify bypass settings. The available integration could list rulesets but could not read classic branch protection, so settings were not verified or changed.

Copy release-evidence.example.json, use the exact release SHA, and attach real evidence for every applicable check. `node security/check-release-evidence.cjs PATH` rejects incomplete or mismatched records. Keep reviewer sign-off and release artifacts beyond the CI 90-day retention window. Do not label a build release-ready or NASA compliant because these procedures exist.
