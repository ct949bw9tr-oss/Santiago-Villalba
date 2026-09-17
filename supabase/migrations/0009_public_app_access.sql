-- Fixes and additions needed to run the mobile app against Supabase directly from the
-- client (publishable/anon key), on top of the RLS policies in 0008:
--
-- 1. Three tables had `enable row level security` but no policies in 0008, which makes
--    them completely inaccessible (RLS with zero policies denies all rows, even to the
--    owner). Add the missing owner/public policies.
-- 2. Self-registration (phone OTP flow) needs an insert policy so a freshly
--    Supabase-Auth'd user can create their own `users` row.
-- 3. The mobile app authenticates via Supabase Anonymous Sign-In and "claims" one of the
--    seeded demo identities (Santiago Villalba / Andrés Ramírez) rather than running a
--    real SMS OTP provider. `claim_demo_user` lets a signed-in anonymous session attach
--    itself to a demo user row whose `auth_user_id` is still unclaimed.
-- 4. Marketplace browsing needs provider (and booking-counterpart) *names*, which live on
--    `users` — a table that's intentionally not public-readable (it also holds
--    phone/email). `list_providers` / `list_provider_reviews` / `get_user_public_name`
--    are SECURITY DEFINER functions that expose only the safe, public-facing columns.

create policy provider_service_areas_public_read on provider_service_areas for select using (true);
create policy provider_service_areas_owner_write on provider_service_areas
  for all using (provider_id = current_taskswift_user_id()) with check (provider_id = current_taskswift_user_id());

create policy provider_availability_slots_public_read on provider_availability_slots for select using (true);
create policy provider_availability_slots_owner_write on provider_availability_slots
  for all using (provider_id = current_taskswift_user_id()) with check (provider_id = current_taskswift_user_id());

create policy provider_availability_exceptions_owner_only on provider_availability_exceptions
  for all using (provider_id = current_taskswift_user_id()) with check (provider_id = current_taskswift_user_id());

create policy users_insert_self on users for insert with check (auth_user_id = auth.uid());

-- Lets a signed-in (anonymous) session claim a seeded demo user row for the "Acceso
-- rápido de prueba" quick-login buttons. Releases any demo identity this session
-- previously held, then attaches to the target row only if it isn't already claimed by
-- someone else.
create or replace function claim_demo_user(target_user_id uuid)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;

  update users set auth_user_id = null where auth_user_id = auth.uid() and id <> target_user_id;

  update users set auth_user_id = auth.uid()
  where id = target_user_id and (auth_user_id is null or auth_user_id = auth.uid());
end;
$$;

grant execute on function claim_demo_user(uuid) to anon, authenticated;

create or replace function list_user_public_names(target_ids uuid[])
returns table (id uuid, first_name text, last_name text, avatar_url text)
language sql
security definer
stable
set search_path = public
as $$
  select id, first_name, last_name, avatar_url from users where id = any(target_ids);
$$;

grant execute on function list_user_public_names(uuid[]) to anon, authenticated;

-- Reviews are written by whichever party is the author (often the customer), but the
-- aggregate rating lives on provider_profiles, which only the provider themselves can
-- write to per `provider_profiles_self_write`. Recompute it via a SECURITY DEFINER
-- trigger instead of asking the client to update someone else's row.
create or replace function recompute_provider_rating()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.direction = 'customer_to_provider' then
    update provider_profiles pp
    set rating_count = agg.cnt, rating_average = agg.avg
    from (
      select count(*) as cnt, round(avg(rating_overall)::numeric, 2) as avg
      from reviews where subject_id = new.subject_id and direction = 'customer_to_provider'
    ) agg
    where pp.id = new.subject_id;
  end if;
  return new;
end;
$$;

create trigger trg_reviews_recompute_rating after insert on reviews
  for each row execute function recompute_provider_rating();

-- Same problem for the provider's completed-jobs counter: it's bumped when the
-- *customer* confirms completion, so it has to happen as the table owner, not the caller.
create or replace function bump_provider_completed_jobs()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'completed' and old.status is distinct from 'completed' then
    update provider_profiles set completed_jobs_count = completed_jobs_count + 1 where id = new.provider_id;
  end if;
  return new;
end;
$$;

create trigger trg_bookings_bump_completed_jobs after update on bookings
  for each row execute function bump_provider_completed_jobs();

-- A booking's full address (line1, label, etc.) belongs to the customer per
-- `addresses_owner_only`, so the provider side of the booking can't read it directly.
-- Expose it read-only to either participant instead.
create or replace function get_booking_address(target_booking_id uuid)
returns table (
  id uuid, user_id uuid, label text, line1 text, line2 text, city text, state text,
  country_code text, postal_code text, lat double precision, lng double precision,
  is_default boolean, created_at timestamptz, updated_at timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select a.id, a.user_id, a.label, a.line1, a.line2, a.city, a.state, a.country_code,
         a.postal_code, a.lat, a.lng, a.is_default, a.created_at, a.updated_at
  from addresses a
  join bookings b on b.address_id = a.id
  where b.id = target_booking_id
    and (b.customer_id = current_taskswift_user_id() or b.provider_id = current_taskswift_user_id());
$$;

grant execute on function get_booking_address(uuid) to authenticated;

create or replace function list_providers()
returns table (
  provider_id uuid,
  first_name text,
  last_name text,
  avatar_url text,
  headline text,
  bio text,
  years_experience int,
  rating_average numeric,
  rating_count int,
  completed_jobs_count int,
  is_online boolean,
  is_verified boolean,
  response_time_minutes int,
  service_id uuid,
  service_name text,
  service_slug text,
  category_slug text,
  provider_service_id uuid,
  pricing_model text,
  price numeric,
  currency text,
  city text,
  area_lat double precision,
  area_lng double precision,
  radius_km numeric
)
language sql
security definer
stable
set search_path = public
as $$
  select
    u.id, u.first_name, u.last_name, u.avatar_url,
    pp.headline, pp.bio, pp.years_experience, pp.rating_average, pp.rating_count,
    pp.completed_jobs_count, pp.is_online, pp.is_verified, pp.response_time_minutes,
    s.id, s.name, s.slug, cat.slug,
    ps.id, ps.pricing_model, ps.price, ps.currency,
    sa.city, sa.center_lat, sa.center_lng, sa.radius_km
  from provider_profiles pp
  join users u on u.id = pp.id
  join provider_services ps on ps.provider_id = pp.id and ps.is_active = true
  join services s on s.id = ps.service_id
  join subcategories sub on sub.id = s.subcategory_id
  join categories cat on cat.id = sub.category_id
  left join provider_service_areas sa on sa.provider_id = pp.id
  where u.deleted_at is null;
$$;

grant execute on function list_providers() to anon, authenticated;

create or replace function list_provider_reviews(target_provider_id uuid)
returns table (
  id uuid,
  booking_id uuid,
  author_id uuid,
  author_first_name text,
  author_last_name text,
  rating_overall smallint,
  rating_quality smallint,
  rating_punctuality smallint,
  rating_communication smallint,
  rating_professionalism smallint,
  comment text,
  created_at timestamptz
)
language sql
security definer
stable
set search_path = public
as $$
  select
    r.id, r.booking_id, r.author_id, u.first_name, u.last_name,
    r.rating_overall, r.rating_quality, r.rating_punctuality, r.rating_communication, r.rating_professionalism,
    r.comment, r.created_at
  from reviews r
  join users u on u.id = r.author_id
  where r.subject_id = target_provider_id and r.direction = 'customer_to_provider'
  order by r.created_at desc;
$$;

grant execute on function list_provider_reviews(uuid) to anon, authenticated;
