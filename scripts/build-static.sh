#!/usr/bin/env bash
# Construit l'édition navigateur (export statique) dans ./out sans toucher aux sources :
# les routes API (serveur uniquement) sont mises de côté le temps du build.
set -euo pipefail
cd "$(dirname "$0")/.."
TMP=$(mktemp -d)
mv src/app/api "$TMP/api"
trap 'mv "$TMP/api" src/app/api' EXIT
NEXT_PUBLIC_STATIC=1 BASE_PATH="${BASE_PATH:-}" npx next build
touch out/.nojekyll
