# Persistent test backend deployment

These files prepare a single Linux-host deployment. They do not provision infrastructure, link billing, change DNS, upload secrets, or start a public service. Hosting cost and external exposure need approval before execution.

## Why a single host

The current backend uses Node SQLite for subscription credits, usage reservations, refunds and reports. The database must survive restarts and stay on a local persistent filesystem. Do not deploy this configuration on an ephemeral container disk, network-mounted SQLite, or multiple independent hosts. A basic Cloud Run deployment does not satisfy that requirement.

Use one existing or approved Linux VM with at least 2 GB RAM, Node 24+, systemd and a persistent disk. The Node binary must be at /usr/bin/node for this unit; confirm its actual path and version before installing the unit. Keep /opt/votic read-only to the backend service.

## Required before starting

- The existing Google Cloud project currently reports billing disabled. An owner must choose/link a billing account before creating paid Google Cloud infrastructure. Do not create a duplicate project.
- Select a real backend hostname owned by the account holder and configure its DNS. No hostname is invented here.
- The selected machine, disk, network charges and backup storage must fit an approved budget.
- Configure the existing Firebase project and a RevenueCat backend REST key with customer-read access. The blank required RevenueCat key deliberately prevents production startup.
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
