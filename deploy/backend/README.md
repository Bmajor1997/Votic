# Persistent test backend deployment

These files prepare a single Linux-host deployment. They do not provision infrastructure, link billing, change DNS, upload secrets, or start a public service. Hosting cost and external exposure need approval before execution.

## Why a single host

The current backend uses Node SQLite for subscription credits, usage reservations, refunds and reports. The database must survive restarts and stay on a local persistent filesystem. Do not deploy this configuration on an ephemeral container disk, network-mounted SQLite, or multiple independent hosts. A basic Cloud Run deployment does not satisfy that requirement.

Use one existing or approved Linux VM with at least 2 GB RAM, Node 24+, systemd and a persistent disk. The Node binary must be at /usr/bin/node for this unit; confirm its actual path and version before installing the unit. Keep /opt/votic read-only to the backend service.

## Required before starting

- The owner reports that the existing Google Cloud project is now linked to a billing account and the test VM is provisioned. This review did not authenticate to Cloud Console to recheck those settings. Do not create a duplicate project or VM.
- The reported test address is https://136-72-31-77.sslip.io. It is a third-party hostname based on the static IP, not a domain owned by Votic. Public health/readiness and legal-page checks returned HTTP 502 during the October 28 review; verify the service before using it in a build.
- The selected machine, disk, network charges and backup storage must fit an approved budget.
- Configure the existing Firebase project and a RevenueCat backend REST key with Customer information Read & write access (the existing deletion flow calls the REST v1 customer DELETE endpoint). The blank required RevenueCat key deliberately prevents production startup.
- AI can stay disabled until its key, spending safeguards and live smoke test are approved. Never copy a service-account JSON into these files.

## Installation on the approved host

1. Deploy the reviewed repository revision into /opt/votic. Install root production dependencies with npm ci --omit=dev using Node 24+. Do not transfer node_modules from Windows.
2. Create /etc/votic, owned by root with mode 0700. Copy backend.env.example to /etc/votic/backend.env and set mode 0600. Enter the actual backend-only keys directly in this private file, or adapt the unit to the host's secret-management mechanism.
3. Install votic-backend.service into /etc/systemd/system. The unit's DynamicUser and StateDirectory create a private /var/lib/votic directory on the persistent host disk. The unit binds Node to loopback, fixes the ledger location and runs with a read-only system view.
4. Run systemd-analyze verify against the installed unit, reload systemd, then start the backend. It must pass its existing production configuration checks.
5. Install Caddy from its official package source. Set VOTIC_BACKEND_HOST in the Caddy service environment, install the supplied Caddyfile, and run caddy validate before starting it. Configure DNS and allow inbound TCP 80/443 for certificate issuance and HTTPS. Keep port 4173 inaccessible externally. Restrict administrative access to the operator.
6. Use exactly one reverse proxy (Caddy) with this unit's VOTIC_TRUST_PROXY=1. If another proxy/CDN is introduced, review the trust boundary before changing that value.
7. Enable the services at boot only after health, readiness and persistence checks pass. Back up the private SQLite ledger with the existing repository ledger-snapshot tool to private storage and verify restoration before real testers spend credits.

## Verification before wiring a Play build

- HTTPS GET /healthz and /readyz return 200; readiness only checks the local ledger and does not establish live vendor access.
- A signed-out request to a protected API returns 401.
- A valid Firebase test account without Premium is denied before AI or parsing; a RevenueCat test subscriber with the existing premium entitlement is accepted.
- Restart the service and confirm the same test account's ledger and allowance remain intact. Do not reset real-user data.
- Test a small opt-in AI request only after approving provider spend. Confirm a completed accounting row without exposing text, tokens or keys in logs.
- Configure approved Terms and Privacy pages separately; this backend template does not invent or publish legal policies.
- Set the real HTTPS backend URL and public Firebase/RevenueCat settings in EAS. Build the existing AAB profile and upload only to Votic's internal-testing track. Building with the production profile does not itself submit or publish a release.

The templates were inspected alongside the existing backend tests on Windows. They have not been installed or validated on a Linux host; systemd and Caddy validation remain required deployment gates.

References: [systemd execution and state directories](https://www.freedesktop.org/software/systemd/man/latest/systemd.exec.html), [Caddy automatic HTTPS requirements](https://caddyserver.com/docs/automatic-https), [backend accounting and live checks](../../docs/openai-backend.md).


## Cost and current setup notes

The e2-micro VM and 30 GB standard disk can qualify for Google's Free Tier when eligible and within account-wide allowances. That does not make the entire deployment free: public IPv4, network traffic, backups and other usage can be billed. Google's listed in-use standard-VM IPv4 rate is $0.005/hour (about $3.65 for 730 hours before free allowance or credits). See [current network pricing](https://cloud.google.com/vpc/network-pricing) and [Free Tier conditions](https://docs.cloud.google.com/free/docs/free-cloud-features).

The bootstrap script sets an estimated OpenAI usage budget of $20/month in Votic's ledger when it first creates the private environment file. This is an application accounting safeguard, not a cap on the Google Cloud bill or all uses of an OpenAI key. Existing environment files are preserved, so verify the value on the host without printing keys.

Google Play real-time developer notifications reaching RevenueCat do not prove a RevenueCat-to-backend webhook is configured. The current webhook handler is enabled only with the separate purchased-credit wallet configuration, which remains outside the approved V1 setup. Monthly subscription access is rechecked against RevenueCat REST profiles with a short cache. Do not enable extra-credit products just to turn on the webhook; verify subscription expiry/refund behavior in live tests.

## Reviewed-commit deployment

The integration branch reviewed for this work is `claude/legal-updates` at `367a76e28f25eef2e68cf8a3edb7c6a3cabbd46e`; the fixes are on `codex/beta-readiness-20261031`. After approval, merge and review the resulting commit. From a local checkout containing that commit, set `COMMIT_SHA` to its full 40-character lowercase SHA and run `bash deploy/backend/gce-create.sh`. There is no branch-head default. The script uploads the bootstrap blob from that commit, verifies its SHA-256 on the VM, and the bootstrap checks out the same commit detached. Dependencies are installed with lifecycle scripts disabled. This pins application and bootstrap code, not Debian/Node/Caddy package versions. Running it mutates Cloud resources and can restart the live backend; it has not been run in this audit.

Keep beta off until the age/audience and legal review gates are resolved. To enable later, use `VOTIC_BETA_ACCESS_MODE=allowlist` and a comma-separated `VOTIC_BETA_TESTER_UIDS` list of Firebase UIDs in the private environment. Optional `all-signed-in` mode is explicitly broader. A Firebase verifier and durable usage DB are mandatory. The app asks `/api/access`; no client beta flag authorizes server work. Beta gets `VOTIC_MONTHLY_CREDITS` (default 1000) per UTC calendar month, shares existing token/USD and global budgets, and never mints a second allowance in an overlapping subscription period. Paid subscription verification takes priority. The production unit already sets the persistent DB path; otherwise set it explicitly. Beta access can work through a RevenueCat outage for allowlisted users; paying users outside beta retain the existing fail-closed behavior.

The server requires versioned AI-consent evidence on production content routes. Install the matching app before enabling this backend for testers; old clients fail with 428 and send nothing to OpenAI. Public `/privacy` and `/terms` remain readable, with a beta-review notice; that does not approve those drafts for launch.
