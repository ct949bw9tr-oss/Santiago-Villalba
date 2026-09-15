create table users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique, -- references auth.users(id) when running on Supabase Auth
  phone text unique,
  email text unique,
  first_name text not null,
  last_name text not null,
  avatar_url text,
  locale text not null default 'es-CO',
  country_code text not null references countries(country_code),
  auth_providers text[] not null default '{}',
  is_provider boolean not null default false,
  active_mode text not null default 'customer' check (active_mode in ('customer','provider')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index idx_users_country on users(country_code);
create trigger trg_users_updated_at before update on users
  for each row execute function set_updated_at();

create table addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  label text not null,
  line1 text not null,
  line2 text,
  city text not null,
  state text,
  country_code text not null references countries(country_code),
  postal_code text,
  lat double precision not null,
  lng double precision not null,
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_addresses_user on addresses(user_id);
create trigger trg_addresses_updated_at before update on addresses
  for each row execute function set_updated_at();

create table provider_verifications (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references users(id) on delete cascade,
  state text not null default 'unverified'
    check (state in ('unverified','phone_verified','identity_pending','identity_verified','rejected','suspended')),
  document_type text check (document_type in ('cedula','passport','other')),
  document_ref text,
  reviewed_by uuid references admin_users(id),
  reviewed_at timestamptz,
  rejection_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_provider_verifications_provider on provider_verifications(provider_id);
create trigger trg_provider_verifications_updated_at before update on provider_verifications
  for each row execute function set_updated_at();
