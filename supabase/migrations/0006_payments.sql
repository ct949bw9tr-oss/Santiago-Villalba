create table payment_methods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references users(id) on delete cascade,
  type text not null check (type in ('card','pse','cash','apple_pay','google_pay','mock')),
  provider text not null check (provider in ('wompi','mercadopago','payu','stripe','mock')),
  provider_token text not null, -- opaque token from the gateway; never raw card data
  last4 text,
  brand text,
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create index idx_payment_methods_user on payment_methods(user_id);

create table payments (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id),
  customer_id uuid not null references users(id),
  payment_method_id uuid not null references payment_methods(id),
  status text not null default 'pending' check (status in (
    'pending','authorized','paid','held','completed','refunded','partially_refunded','failed','disputed'
  )),
  amount numeric(12,2) not null,
  currency text not null,
  provider_reference text,
  authorized_at timestamptz,
  captured_at timestamptz,
  refunded_at timestamptz,
  failure_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_payments_booking on payments(booking_id);
create trigger trg_payments_updated_at before update on payments
  for each row execute function set_updated_at();

create table transactions (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id),
  payment_id uuid not null references payments(id),
  type text not null check (type in ('charge','platform_fee','provider_payout','refund','adjustment')),
  amount numeric(12,2) not null,
  currency text not null,
  related_user_id uuid not null references users(id),
  created_at timestamptz not null default now()
);
create index idx_transactions_booking on transactions(booking_id);
create index idx_transactions_related_user on transactions(related_user_id);

create table payouts (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references provider_profiles(id),
  amount numeric(12,2) not null,
  currency text not null,
  status text not null default 'pending' check (status in ('pending','in_transit','paid','failed')),
  booking_ids uuid[] not null default '{}',
  scheduled_for timestamptz not null,
  paid_at timestamptz,
  failure_reason text,
  created_at timestamptz not null default now()
);
create index idx_payouts_provider on payouts(provider_id);

create table platform_fees (
  id uuid primary key default gen_random_uuid(),
  country_code text not null references countries(country_code),
  category_id uuid references categories(id), -- null = applies to all categories
  customer_fee_percent numeric(5,2) not null,
  provider_commission_percent numeric(5,2) not null default 0,
  min_fee_amount numeric(12,2) not null default 0,
  max_fee_amount numeric(12,2),
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
-- A plain `unique (country_code, category_id)` would not prevent duplicate
-- "applies to all categories" rows per country, because Postgres treats every
-- NULL category_id as distinct for uniqueness purposes. Split into two partial
-- indexes so both the per-category and the country-wide-default case are
-- each unique (and so `on conflict (country_code, category_id)` in the seed
-- script can actually detect a conflict for either case).
create unique index platform_fees_country_category_uniq on platform_fees (country_code, category_id) where category_id is not null;
create unique index platform_fees_country_default_uniq on platform_fees (country_code) where category_id is null;

create trigger trg_platform_fees_updated_at before update on platform_fees
  for each row execute function set_updated_at();

create table promo_codes (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,
  discount_type text not null check (discount_type in ('percent','fixed')),
  discount_value numeric(12,2) not null,
  country_code text references countries(country_code),
  max_redemptions int,
  redemption_count int not null default 0,
  expires_at timestamptz,
  is_active boolean not null default true,
  created_at timestamptz not null default now()
);
