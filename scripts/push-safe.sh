#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
SD="-c safe.directory=$(pwd)"
TOKEN_FILE="../token"
TOKEN=$(grep -E '^github_pat_' "$TOKEN_FILE" | tail -1)
REMOTE=$(git $SD remote get-url origin)
AUTH_URL=$(echo "$REMOTE" | sed -E "s|https://github.com/|https://x-access-token:${TOKEN}@github.com/|")
git $SD push "$AUTH_URL" HEAD:main
echo "PUSH_OK $(basename "$(pwd)")"
