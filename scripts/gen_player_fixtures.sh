#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "$0")/.."
node scripts/gen_player_fixtures.mjs
