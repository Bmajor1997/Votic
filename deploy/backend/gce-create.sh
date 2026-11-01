#!/usr/bin/env bash
# Run in Google Cloud Shell. Creates (or reuses) Votic's small test server in project votic-da5c4:
# one e2-micro VM in us-east1 with a 30 GB standard persistent disk, a static IP and HTTP/HTTPS open,
# then installs the backend on it with vm-bootstrap.sh. Existing resources are reused.
# Eligible VM/disk usage can fit Google's Free Tier, but external IPv4 and excess usage can incur charges.
set -euo pipefail
PROJECT=votic-da5c4 REGION=us-east1 ZONE=us-east1-b VM=votic-backend
# Latest integration branch at review: claude/legal-updates. Deployment always requires its reviewed commit.
: "${COMMIT_SHA:?set COMMIT_SHA to the full reviewed 40-character commit ID}"
[[ "$COMMIT_SHA" =~ ^[0-9a-f]{40}$ ]] || { echo "COMMIT_SHA must be 40 lowercase hex characters" >&2; exit 1; }
REPO_ROOT=$(git rev-parse --show-toplevel)
[[ $(git -C "$REPO_ROOT" cat-file -t "$COMMIT_SHA") == commit ]] || exit 1
BOOTSTRAP_DIR=$(mktemp -d)
trap 'rm -rf "$BOOTSTRAP_DIR"' EXIT
git -C "$REPO_ROOT" show "$COMMIT_SHA:deploy/backend/vm-bootstrap.sh" > "$BOOTSTRAP_DIR/bootstrap.sh"
BOOTSTRAP_SHA=$(sha256sum "$BOOTSTRAP_DIR/bootstrap.sh" | cut -d ' ' -f1)
gcloud config set project "$PROJECT" >/dev/null
gcloud services enable compute.googleapis.com
gcloud compute addresses describe votic-backend-ip --region "$REGION" >/dev/null 2>&1 ||
  gcloud compute addresses create votic-backend-ip --region "$REGION"
IP=$(gcloud compute addresses describe votic-backend-ip --region "$REGION" --format='value(address)')
gcloud compute firewall-rules describe votic-allow-web >/dev/null 2>&1 ||
  gcloud compute firewall-rules create votic-allow-web --network default --allow tcp:80,tcp:443 --target-tags votic-web
gcloud compute instances describe "$VM" --zone "$ZONE" >/dev/null 2>&1 ||
  gcloud compute instances create "$VM" --zone "$ZONE" --machine-type e2-micro \
    --image-family debian-12 --image-project debian-cloud --boot-disk-size 30GB --boot-disk-type pd-standard \
    --address "$IP" --tags votic-web
HOST="${IP//./-}.sslip.io"
for attempt in 1 2 3 4 5 6; do
  gcloud compute ssh "$VM" --zone "$ZONE" --quiet --command "true" >/dev/null 2>&1 && break
  sleep 15
done
# SCP uploads the reviewed blob without executing network content as root. Verify bytes again on the VM.
REMOTE_BOOTSTRAP="/tmp/votic-bootstrap-$COMMIT_SHA-$BOOTSTRAP_SHA.sh"
gcloud compute scp "$BOOTSTRAP_DIR/bootstrap.sh" "$VM:$REMOTE_BOOTSTRAP" --zone "$ZONE" --quiet
gcloud compute ssh "$VM" --zone "$ZONE" --quiet --command \
  "set -eu; sudo install -m 0600 -o root -g root '$REMOTE_BOOTSTRAP' /root/votic-bootstrap.sh; rm -f '$REMOTE_BOOTSTRAP'; echo '$BOOTSTRAP_SHA  /root/votic-bootstrap.sh' | sudo sha256sum --check --status; sudo env VOTIC_BACKEND_HOST='$HOST' COMMIT_SHA='$COMMIT_SHA' bash /root/votic-bootstrap.sh"

echo
echo "Votic server address: https://$HOST"
