#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
export GIT_CONFIG_COUNT=1
export GIT_CONFIG_KEY_0=safe.directory
export GIT_CONFIG_VALUE_0="$(pwd)"
git add -A
git status
git commit -m "$(cat <<'EOF'
Initial sport-app with Couche 2 complete (AT Protocol identity, steps 2.1–2.3).

Local PDS integration: performance publishing, peer ID records, DID-based blob verification via PLC directory.
EOF
)"
bash scripts/push.sh
