#!/usr/bin/env bash
# Run in Google Cloud Shell. Creates (or reuses) Votic's small test server in project votic-da5c4:
# one e2-micro VM in us-east1 with a 30 GB standard persistent disk, a static IP and HTTP/HTTPS open,
# then installs the backend on it with vm-bootstrap.sh. Existing resources are reused.
# Eligible VM/disk usage can fit Google's Free Tier, but external IPv4 and excess usage can incur charges.
set -euo pipefail
PROJECT=votic-da5c4 REGION=us-east1 ZONE=us-east1-b VM=votic-backend BRANCH="${BRANCH:-claude/v1-internal-test}"
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
gcloud compute ssh "$VM" --zone "$ZONE" --quiet --command \
  "curl -fsSL https://raw.githubusercontent.com/Bmajor1997/Votic/$BRANCH/deploy/backend/vm-bootstrap.sh | sudo VOTIC_BACKEND_HOST=$HOST BRANCH=$BRANCH bash"
echo
echo "Votic server address: https://$HOST"
