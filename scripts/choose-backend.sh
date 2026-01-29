#!/bin/bash

set -e

REPO_ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$REPO_ROOT"

echo ""
echo "Which backend do you want to keep?"
echo ""
echo "  [1] Elysia  (removes Convex)"
echo "  [2] Convex  (removes Elysia)"
echo ""
read -p "Enter choice (1 or 2): " CHOICE

case "$CHOICE" in
  1) KEEP="elysia" ;;
  2) KEEP="convex" ;;
  *)
    echo "Invalid choice. Exiting."
    exit 1
    ;;
esac

echo ""

if [ "$KEEP" = "elysia" ]; then
  echo "Keeping Elysia, removing Convex..."
  echo ""

  # 1. Delete packages/convex/
  rm -rf packages/convex
  echo "  Removed packages/convex/"

  # 2. Clean apps/web/package.json — remove @repo/convex and convex deps
  cd apps/web
  jq 'del(.dependencies["@repo/convex"]) | del(.dependencies["convex"])' package.json > package.json.tmp
  mv package.json.tmp package.json
  cd "$REPO_ROOT"
  echo "  Cleaned apps/web/package.json"

  # 3. Clean apps/web/src/main.tsx — remove commented-out Convex lines
  sed -i '/^\/\/ Initialize Convex client$/d' apps/web/src/main.tsx
  sed -i '/^\/\/ const convex = new ConvexReactClient/d' apps/web/src/main.tsx
  sed -i '/^ *{\/\* <ConvexProvider client={convex}> \*\/}$/d' apps/web/src/main.tsx
  sed -i '/^ *{\/\* <\/ConvexProvider> \*\/}$/d' apps/web/src/main.tsx
  echo "  Cleaned apps/web/src/main.tsx"

  # 4. Remove VITE_CONVEX_URL from .env.example
  sed -i '/^# Convex deployment URL/d' apps/web/.env.example
  sed -i '/^VITE_CONVEX_URL=/d' apps/web/.env.example
  echo "  Cleaned apps/web/.env.example"

  # 5. Clean root package.json — remove convex from catalog, dev:convex script, dev:test, and update dev command
  jq '
    del(.catalog["convex"]) |
    del(.scripts["dev:convex"]) |
    (.scripts.dev = (.scripts.dev | gsub("'"'"'WEB,CONVEX,ELYSIA'"'"'"; "'"'"'WEB,ELYSIA'"'"'") | gsub("'"'"'blue,magenta,yellow'"'"'"; "'"'"'blue,yellow'"'"'") | gsub(" '"'"'bun run dev:convex'"'"'"; "")))
  ' package.json > package.json.tmp
  mv package.json.tmp package.json
  echo "  Cleaned root package.json"

  # 6. Clean scripts/setup.sh — remove Convex init section (lines 78-103) and output references
  # Remove the Convex initialization block
  sed -i '/^# Initialize Convex/,/^fi$/d' scripts/setup.sh
  # Remove Convex-related output lines
  sed -i '/^echo "Convex is configured:"/d' scripts/setup.sh
  sed -i '/Deployment config: packages\/convex/d' scripts/setup.sh
  sed -i '/Web app URL: apps\/web\/.env (VITE_CONVEX_URL)/d' scripts/setup.sh
  sed -i '/bun run dev:convex/d' scripts/setup.sh
  echo "  Cleaned scripts/setup.sh"

  # 7. Remove port 3210 from kill-dev-ports.sh
  sed -i 's/ 3210//' scripts/kill-dev-ports.sh
  sed -i '/# - 3210: Convex/d' scripts/kill-dev-ports.sh
  echo "  Cleaned scripts/kill-dev-ports.sh"

  echo ""
  echo "Done! Convex has been removed. Elysia is your backend."

elif [ "$KEEP" = "convex" ]; then
  echo "Keeping Convex, removing Elysia..."
  echo ""

  # 1. Delete apps/elysia/
  rm -rf apps/elysia
  echo "  Removed apps/elysia/"

  # 2. Clean apps/web/package.json — remove elysia-related deps
  cd apps/web
  jq 'del(.dependencies["@elysiajs/eden"]) | del(.devDependencies["@repo/elysia"]) | del(.devDependencies["elysia"])' package.json > package.json.tmp
  mv package.json.tmp package.json
  cd "$REPO_ROOT"
  echo "  Cleaned apps/web/package.json"

  # 3. Delete Eden client and Elysia example
  rm -f apps/web/src/lib/api.ts
  echo "  Removed apps/web/src/lib/api.ts"
  rm -f apps/web/src/examples/elysia-tanstack-query-example.ts
  echo "  Removed apps/web/src/examples/elysia-tanstack-query-example.ts"

  # 4. Clean apps/web/src/routes/api-example.tsx — remove Elysia imports and section
  sed -i '/elysia-tanstack-query-example/d' apps/web/src/routes/api-example.tsx
  # Remove Elysia-specific hooks, variables, and comment
  sed -i '/\/\/ Elysia API$/d' apps/web/src/routes/api-example.tsx
  sed -i '/const { data: helloData/d' apps/web/src/routes/api-example.tsx
  sed -i '/const { data: healthData/d' apps/web/src/routes/api-example.tsx
  sed -i '/const elysiaError/d' apps/web/src/routes/api-example.tsx
  # Remove the Elysia API section from JSX (between the comment markers)
  sed -i '/{\/\* Elysia API Section \*\/}/,/^ *<\/section>/d' apps/web/src/routes/api-example.tsx
  echo "  Cleaned apps/web/src/routes/api-example.tsx"

  # 5. Remove VITE_API_URL from .env.example
  sed -i '/^# Elysia API URL/d' apps/web/.env.example
  sed -i '/^VITE_API_URL=/d' apps/web/.env.example
  echo "  Cleaned apps/web/.env.example"

  # 6. Clean root package.json — remove dev:elysia, dev:test, update dev command
  jq '
    del(.scripts["dev:elysia"]) |
    del(.scripts["dev:test"]) |
    (.scripts.dev = (.scripts.dev | gsub("'"'"'WEB,CONVEX,ELYSIA'"'"'"; "'"'"'WEB,CONVEX'"'"'") | gsub("'"'"'blue,magenta,yellow'"'"'"; "'"'"'blue,magenta'"'"'") | gsub(" '"'"'bun run dev:elysia'"'"'"; "")))
  ' package.json > package.json.tmp
  mv package.json.tmp package.json
  echo "  Cleaned root package.json"

  # 7. Clean scripts/setup.sh — remove Elysia .env copy block (if through fi)
  sed -i '/apps\/elysia\/.env.example.*then$/,/^fi$/d' scripts/setup.sh
  # Remove Elysia references from output
  sed -i '/bun run dev:elysia/d' scripts/setup.sh
  echo "  Cleaned scripts/setup.sh"

  # 8. Remove port 3001 from kill-dev-ports.sh
  sed -i 's/ 3001//' scripts/kill-dev-ports.sh
  sed -i '/# - 3001: Elysia API/d' scripts/kill-dev-ports.sh
  echo "  Cleaned scripts/kill-dev-ports.sh"

  # 9. Uncomment Convex provider in main.tsx
  sed -i 's|^// \(const convex = new ConvexReactClient.*\)|\1|' apps/web/src/main.tsx
  sed -i 's|^// Initialize Convex client|import { ConvexProvider, ConvexReactClient } from "convex/react";|' apps/web/src/main.tsx
  sed -i 's|{/\* <ConvexProvider client={convex}> \*/}|<ConvexProvider client={convex}>|' apps/web/src/main.tsx
  sed -i 's|{/\* </ConvexProvider> \*/}|</ConvexProvider>|' apps/web/src/main.tsx
  echo "  Activated Convex provider in apps/web/src/main.tsx"

  echo ""
  echo "Done! Elysia has been removed. Convex is your backend."
fi

echo ""
echo "Running bun install to update lockfile..."
bun install

echo ""
echo "Backend setup complete!"
echo ""
