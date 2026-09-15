create table service_requests (
  id uuid primary key default gen_random_uuid(),
  customer_id uuid not null references users(id),
  provider_id uuid not null references provider_profiles(id),
  provider_service_id uuid not null references provider_services(id),
  timing text not null check (timing in ('scheduled','now')),
  scheduled_for timestamptz,
  address_id uuid not null references addresses(id),
  location_lat double precision not null,
  location_lng double precision not null,
  notes text,
  photo_urls text[] not null default '{}',
  estimated_duration_minutes int,
  pricing_model text not null check (pricing_model in ('fixed','starting_at','hourly','custom_quote')),
  service_price numeric(12,2) not null,
  customer_fee numeric(12,2) not null,
  total_amount numeric(12,2) not null,
  currency text not null,
  provider_commission numeric(12,2) not null default 0,
  provider_payout numeric(12,2) not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null default (now() + interval '15 minutes'),
  constraint chk_scheduled_requires_time check (timing != 'scheduled' or scheduled_for is not null)
);
create index idx_service_requests_customer on service_requests(customer_id);
create index idx_service_requests_provider on service_requests(provider_id);

create table bookings (
  id uuid primary key default gen_random_uuid(),
  request_id uuid not null references service_requests(id),
  customer_id uuid not null references users(id),
  provider_id uuid not null references provider_profiles(id),
  provider_service_id uuid not null references provider_services(id),
  category_id uuid not null references categories(id),
  status text not null default 'draft' check (status in (
    'draft','requested','pending_provider','accepted','provider_en_route','in_progress',
    'awaiting_completion_confirmation','completed','cancelled_customer','cancelled_provider',
    'expired','disputed','refunded'
  )),
  timing text not null check (timing in ('scheduled','now')),
  scheduled_for timestamptz,
  address_id uuid not null references addresses(id),
  location_lat double precision not null,
  location_lng double precision not null,
  notes text,
  photo_urls text[] not null default '{}',
  service_price numeric(12,2) not null,
  customer_fee numeric(12,2) not null,
  total_amount numeric(12,2) not null,
  currency text not null,
  provider_commission numeric(12,2) not null default 0,
  provider_payout numeric(12,2) not null,
  quote_amount numeric(12,2),
  country_code text not null references countries(country_code),
  accepted_at timestamptz,
  en_route_at timestamptz,
  started_at timestamptz,
  completed_by_provider_at timestamptz,
  completed_by_customer_at timestamptz,
  cancelled_at timestamptz,
  cancelled_by uuid references users(id),
  cancellation_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_bookings_customer on bookings(customer_id);
create index idx_bookings_provider on bookings(provider_id);
create index idx_bookings_status on bookings(status);
create trigger trg_bookings_updated_at before update on bookings
  for each row execute function set_updated_at();

create table booking_status_history (
  id uuid primary key default gen_random_uuid(),
  booking_id uuid not null references bookings(id) on delete cascade,
  from_status text,
  to_status text not null,
  changed_by uuid, -- users.id, or null for system-driven transitions
  reason text,
  created_at timestamptz not null default now()
);
create index idx_booking_status_history_booking on booking_status_history(booking_id);
