-- Row Level Security: users only ever read/write data they are authorized to see.
-- These policies assume Supabase Auth, where auth.uid() is the logged-in user's
-- auth.users id, mapped to our `users.auth_user_id`. Admin operations run through
-- a service-role key (bypasses RLS) via the admin API, never through client policies.

-- Compatibility shim for local/non-Supabase Postgres (e.g. `pnpm db:migrate` against a
-- plain `postgres` container): only creates auth.uid() when it doesn't already exist, so
-- this never overrides Supabase's own implementation on a real Supabase project.
do $$
begin
  if not exists (select 1 from pg_namespace where nspname = 'auth') then
    create schema auth;
  end if;

  if not exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'auth' and p.proname = 'uid'
  ) then
    create function auth.uid() returns uuid
    language sql stable
    as $fn$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $fn$;
  end if;
end $$;

create or replace function current_taskswift_user_id()
returns uuid
language sql stable
as $$
  select id from users where auth_user_id = auth.uid();
$$;

alter table users enable row level security;
alter table addresses enable row level security;
alter table provider_verifications enable row level security;
alter table provider_profiles enable row level security;
alter table provider_services enable row level security;
alter table provider_service_areas enable row level security;
alter table provider_availability_slots enable row level security;
alter table provider_availability_exceptions enable row level security;
alter table portfolio_items enable row level security;
alter table service_requests enable row level security;
alter table bookings enable row level security;
alter table booking_status_history enable row level security;
alter table payment_methods enable row level security;
alter table payments enable row level security;
alter table transactions enable row level security;
alter table payouts enable row level security;
alter table reviews enable row level security;
alter table favorites enable row level security;
alter table recent_searches enable row level security;
alter table messages enable row level security;
alter table notifications enable row level security;
alter table reports enable row level security;
alter table disputes enable row level security;

-- Users: self read/update; provider profiles are publicly readable (marketplace discovery).
create policy users_select_self on users for select using (id = current_taskswift_user_id());
create policy users_update_self on users for update using (id = current_taskswift_user_id());

create policy provider_profiles_public_read on provider_profiles for select using (true);
create policy provider_profiles_self_write on provider_profiles
  for all using (id = current_taskswift_user_id()) with check (id = current_taskswift_user_id());

create policy provider_services_public_read on provider_services for select using (is_active = true);
create policy provider_services_owner_write on provider_services
  for all using (provider_id = current_taskswift_user_id()) with check (provider_id = current_taskswift_user_id());

create policy portfolio_items_public_read on portfolio_items for select using (true);
create policy portfolio_items_owner_write on portfolio_items
  for all using (provider_id = current_taskswift_user_id()) with check (provider_id = current_taskswift_user_id());

create policy addresses_owner_only on addresses
  for all using (user_id = current_taskswift_user_id()) with check (user_id = current_taskswift_user_id());

create policy provider_verifications_owner_read on provider_verifications
  for select using (provider_id = current_taskswift_user_id());

-- Bookings: visible only to the customer and provider on the booking.
create policy bookings_participants on bookings
  for select using (customer_id = current_taskswift_user_id() or provider_id = current_taskswift_user_id());
create policy bookings_participants_update on bookings
  for update using (customer_id = current_taskswift_user_id() or provider_id = current_taskswift_user_id());
create policy bookings_customer_insert on bookings
  for insert with check (customer_id = current_taskswift_user_id());

create policy service_requests_participants on service_requests
  for select using (customer_id = current_taskswift_user_id() or provider_id = current_taskswift_user_id());
create policy service_requests_customer_insert on service_requests
  for insert with check (customer_id = current_taskswift_user_id());

create policy booking_status_history_participants on booking_status_history
  for select using (exists (
    select 1 from bookings b where b.id = booking_id
      and (b.customer_id = current_taskswift_user_id() or b.provider_id = current_taskswift_user_id())
  ));

create policy messages_participants on messages
  for select using (exists (
    select 1 from bookings b where b.id = booking_id
      and (b.customer_id = current_taskswift_user_id() or b.provider_id = current_taskswift_user_id())
  ));
create policy messages_participants_insert on messages
  for insert with check (exists (
    select 1 from bookings b where b.id = booking_id
      and (b.customer_id = current_taskswift_user_id() or b.provider_id = current_taskswift_user_id())
  ));

create policy payment_methods_owner_only on payment_methods
  for all using (user_id = current_taskswift_user_id()) with check (user_id = current_taskswift_user_id());

create policy payments_participants_read on payments
  for select using (exists (
    select 1 from bookings b where b.id = booking_id
      and (b.customer_id = current_taskswift_user_id() or b.provider_id = current_taskswift_user_id())
  ));

create policy transactions_related_user_read on transactions
  for select using (related_user_id = current_taskswift_user_id());

create policy payouts_owner_read on payouts
  for select using (provider_id = current_taskswift_user_id());

create policy reviews_public_read on reviews for select using (true);
create policy reviews_author_insert on reviews for insert with check (author_id = current_taskswift_user_id());

create policy favorites_owner_only on favorites
  for all using (customer_id = current_taskswift_user_id()) with check (customer_id = current_taskswift_user_id());

create policy recent_searches_owner_only on recent_searches
  for all using (user_id = current_taskswift_user_id()) with check (user_id = current_taskswift_user_id());

create policy notifications_owner_only on notifications
  for all using (user_id = current_taskswift_user_id()) with check (user_id = current_taskswift_user_id());

create policy reports_reporter_read on reports for select using (reporter_id = current_taskswift_user_id());
create policy reports_reporter_insert on reports for insert with check (reporter_id = current_taskswift_user_id());

create policy disputes_participants_read on disputes
  for select using (exists (
    select 1 from bookings b where b.id = booking_id
      and (b.customer_id = current_taskswift_user_id() or b.provider_id = current_taskswift_user_id())
  ));

-- Reference/catalog data is public read, admin-only write (writes happen via service role).
alter table categories enable row level security;
alter table subcategories enable row level security;
alter table services enable row level security;
alter table countries enable row level security;
alter table platform_fees enable row level security;
create policy categories_public_read on categories for select using (is_active = true);
create policy subcategories_public_read on subcategories for select using (is_active = true);
create policy services_public_read on services for select using (is_active = true);
create policy countries_public_read on countries for select using (true);
create policy platform_fees_public_read on platform_fees for select using (is_active = true);
