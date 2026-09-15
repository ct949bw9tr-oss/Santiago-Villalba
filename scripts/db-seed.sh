#!/usr/bin/env bash
# Applies supabase/seed.sql against $DATABASE_URL. Safe to re-run.
set -euo pipefail

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is not set. Copy .env.example to .env and set it, or export it inline:"
  echo '  DATABASE_URL=postgres://user:pass@localhost:5432/taskswift_dev pnpm db:seed'
  exit 1
fi

cd "$(dirname "$0")/.."
psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/seed.sql
echo "Seed applied."
