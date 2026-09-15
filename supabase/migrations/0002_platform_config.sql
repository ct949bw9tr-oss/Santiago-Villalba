-- Country / currency / global settings tables. This is the seam that lets
-- TaskSwift expand from Colombia to Ecuador, the US, etc. without app rebuilds.

create table countries (
  country_code text primary key check (country_code ~ '^[A-Z]{2}$'),
  name text not null,
  currency_code text not null,
  default_locale text not null,
  supported_locales text[] not null default '{}',
  is_live boolean not null default false,
  cities text[] not null default '{}',
  legal jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_countries_updated_at before update on countries
  for each row execute function set_updated_at();

create table currencies (
  currency_code text primary key check (currency_code ~ '^[A-Z]{3}$'),
  name text not null,
  is_zero_decimal boolean not null default false
);

create table payment_provider_configs (
  id uuid primary key default gen_random_uuid(),
  country_code text not null references countries(country_code),
  provider text not null check (provider in ('wompi','mercadopago','payu','stripe','mock')),
  enabled boolean not null default false,
  supports_cards boolean not null default false,
  supports_bank_transfer boolean not null default false,
  supports_cash boolean not null default false,
  public_key_env_var text,
  created_at timestamptz not null default now(),
  unique (country_code, provider)
);

create table app_settings (
  key text primary key,
  value jsonb not null,
  description text,
  updated_at timestamptz not null default now()
);
create trigger trg_app_settings_updated_at before update on app_settings
  for each row execute function set_updated_at();

create table admin_users (
  id uuid primary key default gen_random_uuid(),
  auth_user_id uuid unique, -- references auth.users(id) when running on Supabase Auth
  email text unique not null,
  first_name text not null,
  last_name text not null,
  role text not null check (role in ('super_admin','operations','support','finance')),
  created_at timestamptz not null default now()
);
