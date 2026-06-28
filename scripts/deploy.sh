#!/bin/bash
set -euo pipefail

ROOT="${P2P_SPORT_ROOT:-/home/root/p2p-sport}"
BLOB_STORE_DIR="${BLOB_STORE_DIR:-/var/lib/sport-p2p/blobs}"

echo "==> Build core-p2p native"
cd "$ROOT/core-p2p"
git pull origin main
bash build.sh

echo "==> Build core-p2p WASM (browser)"
bash scripts/build-wasm.sh

echo "==> Deploy sport-app"
cd "$ROOT/sport-app"
git pull origin main
export CORE_P2P_ROOT="$ROOT/core-p2p"
export BLOB_STORE_DIR
mkdir -p "$BLOB_STORE_DIR"
npm install
npm run build
pm2 restart sport-app

echo "Deploy OK — $(date)"
echo "P2P native: curl -s http://127.0.0.1:3000/api/p2p/status"
echo "P2P WASM: $ROOT/sport-app/public/core-p2p/"
