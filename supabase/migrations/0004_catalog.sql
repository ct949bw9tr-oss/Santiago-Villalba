create table categories (
  id uuid primary key default gen_random_uuid(),
  slug text unique not null,
  name text not null,
  name_en text not null,
  icon text not null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger trg_categories_updated_at before update on categories
  for each row execute function set_updated_at();

create table subcategories (
  id uuid primary key default gen_random_uuid(),
  category_id uuid not null references categories(id) on delete cascade,
  slug text not null,
  name text not null,
  name_en text not null,
  sort_order int not null default 0,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (category_id, slug)
);
create trigger trg_subcategories_updated_at before update on subcategories
  for each row execute function set_updated_at();

create table services (
  id uuid primary key default gen_random_uuid(),
  subcategory_id uuid not null references subcategories(id) on delete cascade,
  slug text not null,
  name text not null,
  name_en text not null,
  description text,
  default_duration_minutes int,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (subcategory_id, slug)
);
create trigger trg_services_updated_at before update on services
  for each row execute function set_updated_at();

create table provider_profiles (
  id uuid primary key references users(id) on delete cascade,
  headline text not null,
  bio text,
  years_experience int,
  languages text[] not null default '{}',
  verification_state text not null default 'unverified'
    check (verification_state in ('unverified','phone_verified','identity_pending','identity_verified','rejected','suspended')),
  is_verified boolean not null default false,
  rating_average numeric(3,2) not null default 0,
  rating_count int not null default 0,
  completed_jobs_count int not null default 0,
  response_time_minutes int,
  is_online boolean not null default false,
  accepts_instant_requests boolean not null default false,
  travels_to_customer boolean not null default true,
  customer_travels_to_provider boolean not null default false,
  offers_remote_service boolean not null default false,
  country_code text not null references countries(country_code),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_provider_profiles_country on provider_profiles(country_code);
create index idx_provider_profiles_online on provider_profiles(is_online) where is_online = true;
create trigger trg_provider_profiles_updated_at before update on provider_profiles
  for each row execute function set_updated_at();

create table provider_services (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references provider_profiles(id) on delete cascade,
  service_id uuid not null references services(id) on delete cascade,
  pricing_model text not null check (pricing_model in ('fixed','starting_at','hourly','custom_quote')),
  price numeric(12,2),
  currency text not null,
  estimated_duration_minutes int,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (provider_id, service_id)
);
create index idx_provider_services_provider on provider_services(provider_id);
create index idx_provider_services_service on provider_services(service_id);
create trigger trg_provider_services_updated_at before update on provider_services
  for each row execute function set_updated_at();

create table provider_service_areas (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references provider_profiles(id) on delete cascade,
  center_lat double precision not null,
  center_lng double precision not null,
  radius_km numeric(6,2) not null default 5,
  city text not null,
  created_at timestamptz not null default now()
);
create index idx_provider_service_areas_provider on provider_service_areas(provider_id);

create table provider_availability_slots (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references provider_profiles(id) on delete cascade,
  day_of_week smallint not null check (day_of_week between 0 and 6),
  start_time time not null,
  end_time time not null,
  is_active boolean not null default true
);
create index idx_provider_availability_slots_provider on provider_availability_slots(provider_id);

create table provider_availability_exceptions (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references provider_profiles(id) on delete cascade,
  date date not null,
  is_available boolean not null,
  start_time time,
  end_time time,
  reason text,
  unique (provider_id, date)
);

create table portfolio_items (
  id uuid primary key default gen_random_uuid(),
  provider_id uuid not null references provider_profiles(id) on delete cascade,
  category_id uuid references categories(id),
  media_type text not null check (media_type in ('image','video')),
  media_url text not null,
  before_media_url text,
  caption text,
  sort_order int not null default 0,
  created_at timestamptz not null default now()
);
create index idx_portfolio_items_provider on portfolio_items(provider_id);
