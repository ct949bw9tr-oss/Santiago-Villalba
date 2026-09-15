-- TaskSwift schema: extensions and shared helpers
--
-- Location columns use plain `double precision` lat/lng pairs rather than PostGIS
-- geography types, so this schema runs on any vanilla Postgres/Supabase project
-- without extra extensions. Distance/radius filtering is done in
-- packages/business-logic (haversineDistanceKm) at MVP scale; if geo query volume
-- grows, add PostGIS + a generated `geography` column and GiST index later without
-- changing the lat/lng columns themselves.
create extension if not exists "pgcrypto";

create or replace function set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;
