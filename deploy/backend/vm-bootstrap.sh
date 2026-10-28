#!/usr/bin/env bash
# Runs on the Votic VM as root (gce-create.sh calls it). Installs Node 24, Caddy and the backend from GitHub,
# keeps the credit ledger on the VM's persistent disk, and serves it at https://$VOTIC_BACKEND_HOST.
# Secrets are never written here: /etc/votic/backend.env is created with blank keys for the owner to fill in.
set -euo pipefail
: "${VOTIC_BACKEND_HOST:?set VOTIC_BACKEND_HOST}"
BRANCH="${BRANCH:-main}"
export DEBIAN_FRONTEND=noninteractive
# e2-micro has 1 GB of memory: add 2 GB of swap so document parsing doesn't run out.
if [ ! -f /swapfile ]; then
  fallocate -l 2G /swapfile && chmod 600 /swapfile && mkswap /swapfile && swapon /swapfile
  echo '/swapfile none swap sw 0 0' >> /etc/fstab
fi
apt-get update -q
apt-get install -y -q curl git ca-certificates gnupg debian-keyring debian-archive-keyring apt-transport-https sqlite3
if ! node --version 2>/dev/null | grep -q '^v24'; then
  curl -fsSL https://deb.nodesource.com/setup_24.x | bash -
  apt-get install -y -q nodejs
fi
if ! command -v caddy >/dev/null; then
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/gpg.key | gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
  curl -1sLf https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt > /etc/apt/sources.list.d/caddy-stable.list
  apt-get update -q && apt-get install -y -q caddy
fi
# The reviewed code, read-only to the service.
if [ -d /opt/votic/.git ]; then
  git -C /opt/votic fetch --depth 1 origin "$BRANCH" && git -C /opt/votic reset --hard FETCH_HEAD
else
  git clone --depth 1 --branch "$BRANCH" https://github.com/Bmajor1997/Votic.git /opt/votic
fi
(cd /opt/votic && (npm ci --omit=dev --no-audit --no-fund || npm install --omit=dev --no-audit --no-fund --no-package-lock))
# Private settings: created once with blank secrets; never overwritten.
install -d -m 0700 /etc/votic
if [ ! -f /etc/votic/backend.env ]; then
  install -m 0600 /opt/votic/deploy/backend/backend.env.example /etc/votic/backend.env
  # Test phase: cap all AI spending at $20 a month.
  sed -i 's/^VOTIC_AI_MONTHLY_BUDGET_USD=100$/VOTIC_AI_MONTHLY_BUDGET_USD=20/' /etc/votic/backend.env
fi
install -m 0644 /opt/votic/deploy/backend/votic-backend.service /etc/systemd/system/votic-backend.service
systemd-analyze verify /etc/systemd/system/votic-backend.service || true
systemctl daemon-reload
# HTTPS in front of the loopback-only backend.
printf '%s {\n    reverse_proxy 127.0.0.1:4173\n}\n' "$VOTIC_BACKEND_HOST" > /etc/caddy/Caddyfile
caddy validate --config /etc/caddy/Caddyfile --adapter caddyfile
systemctl enable --now caddy && systemctl reload caddy
systemctl enable votic-backend
if grep -qE '^(OPENAI_API_KEY|REVENUECAT_SECRET_API_KEY)=$' /etc/votic/backend.env; then
  echo "Votic is installed. Add the OpenAI and RevenueCat secret keys to /etc/votic/backend.env, then run: sudo systemctl restart votic-backend"
else
  systemctl restart votic-backend
  sleep 3
  curl -fsS "http://127.0.0.1:4173/healthz" && echo " backend healthy"
fi
