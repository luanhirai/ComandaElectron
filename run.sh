#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$ROOT_DIR"
unset ELECTRON_RUN_AS_NODE

if [ ! -d "node_modules" ]; then
  npm install
fi

npm run build
npx electron .
