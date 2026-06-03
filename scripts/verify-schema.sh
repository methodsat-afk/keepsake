#!/usr/bin/env bash
# Verify the Keepsake migrations are applied, using the service key in .env.local.
# Pass = photos.category 200, cleanup_runs 200, cleanup_items 200.
set -euo pipefail
cd "$(dirname "$0")/.."

URL=$(grep '^NEXT_PUBLIC_SUPABASE_URL=' .env.local | sed -E 's/.*=//')
KEY=$(grep '^SUPABASE_SERVICE_ROLE_KEY=' .env.local | sed -E 's/.*=//')
h=(-H "apikey: $KEY" -H "Authorization: Bearer $KEY")

check() { # name, url
  code=$(curl -sS -o /dev/null -w "%{http_code}" --max-time 15 "${h[@]}" "$2")
  if [ "$code" = "200" ]; then echo "  ✓ $1 ($code)"; else echo "  ✗ $1 ($code) — migration not applied"; fi
}

echo "Schema check against $URL"
check "photos.category" "$URL/rest/v1/photos?select=category&limit=1"
check "cleanup_runs"    "$URL/rest/v1/cleanup_runs?select=id&limit=1"
check "cleanup_items"   "$URL/rest/v1/cleanup_items?select=id&limit=1"
