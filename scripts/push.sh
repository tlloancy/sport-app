#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
TOKEN_FILE="../../token"
TOKEN=$(grep -E '^github_pat_' "$TOKEN_FILE" | tail -1)
REMOTE=$(git remote get-url origin)
AUTH_URL=$(echo "$REMOTE" | sed -E "s|https://github.com/|https://x-access-token:${TOKEN}@github.com/|")
git push "$AUTH_URL" HEAD:main
echo "PUSH_OK sport-app"
