#!/usr/bin/env bash
# Applies every migration in supabase/migrations/ against $DATABASE_URL in order.
# Works against a plain Postgres instance or a Supabase project's connection string.
set -euo pipefail

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is not set. Copy .env.example to .env and set it, or export it inline:"
  echo '  DATABASE_URL=postgres://user:pass@localhost:5432/taskswift_dev pnpm db:migrate'
  exit 1
fi

cd "$(dirname "$0")/.."
for f in supabase/migrations/*.sql; do
  echo "Applying $f"
  psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f "$f"
done
echo "All migrations applied."
