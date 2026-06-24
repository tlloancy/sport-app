#!/usr/bin/env bash
# Second local PDS (port 2584) — do not modify scripts/start_pds.sh
set -euo pipefail

docker rm -f pds_local_2 2>/dev/null || true

PLC_KEY=$(node -e 'console.log(require("crypto").randomBytes(32).toString("hex"))')
echo "Using PLC rotation key (${#PLC_KEY} hex chars) for pds_local_2"

docker run -d \
  --name pds_local_2 \
  -p 2584:2584 \
  -e PDS_PORT=2584 \
  -e PDS_HOSTNAME=localhost \
  -e PDS_JWT_SECRET=devsecret2 \
  -e PDS_ADMIN_PASSWORD=adminpass2 \
  -e PDS_DATA_DIRECTORY=/data \
  -e PDS_BLOBSTORE_DISK_LOCATION=/data/blocks \
  -e PDS_DEV_MODE=true \
  -e PDS_SERVICE_HANDLE_DOMAINS=.test \
  -e PDS_INVITE_REQUIRED=false \
  -e PDS_PLC_ROTATION_KEY_K256_PRIVATE_KEY_HEX="${PLC_KEY}" \
  -v pds_local_2_data:/data \
  ghcr.io/bluesky-social/pds:latest

for i in $(seq 1 30); do
  if curl -sf http://localhost:2584/xrpc/_health >/dev/null; then
    echo "HEALTH_OK pds_local_2"
    curl -s http://localhost:2584/xrpc/_health
    exit 0
  fi
  echo "waiting... ($i/30)"
  sleep 2
done

echo "HEALTH_FAIL — docker logs:"
docker logs pds_local_2 2>&1 | tail -50
exit 1
