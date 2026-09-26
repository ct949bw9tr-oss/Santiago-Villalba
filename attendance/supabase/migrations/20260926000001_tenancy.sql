-- Tenancy & identity: schools, profiles, per-school role memberships, and the
-- SECURITY DEFINER helpers that every RLS policy is built on.
--
-- Conventions used by every migration:
--   * Every tenant-owned table has `school_id` and `unique (school_id, id)`, and
--     children reference parents with composite FKs `(school_id, parent_id)`,
--     so a row can never point at another school's data.
--   * All instants are timestamptz; wall-clock times are interpreted in
--     schools.timezone.
--   * `app` schema holds private helpers; it is not exposed through the API.

create schema if not exists app;
revoke all on schema app from public;
grant usage on schema app to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Enums
-- ---------------------------------------------------------------------------
create type public.school_status as enum ('active', 'suspended');
create type public.membership_role as enum ('school_admin', 'teacher', 'student');
create type public.membership_status as enum ('invited', 'active', 'disabled');

-- ---------------------------------------------------------------------------
-- Shared trigger: updated_at
-- ---------------------------------------------------------------------------
create function app.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create function app.is_valid_timezone(tz text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (select 1 from pg_catalog.pg_timezone_names where name = tz);
$$;

-- ---------------------------------------------------------------------------
-- schools
-- ---------------------------------------------------------------------------
create table public.schools (
  id          uuid primary key default gen_random_uuid(),
  name        text not null check (length(trim(name)) between 1 and 200),
  slug        text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and length(slug) <= 63),
  timezone    text not null default 'America/Bogota' check (app.is_valid_timezone(timezone)),
  locale      text not null default 'es-CO',
  status      public.school_status not null default 'active',
  settings    jsonb not null default '{}'::jsonb check (jsonb_typeof(settings) = 'object'),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create trigger schools_updated_at before update on public.schools
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- profiles (1:1 with auth.users). Holds no school or role information.
-- ---------------------------------------------------------------------------
create table public.profiles (
  id                 uuid primary key references auth.users (id) on delete cascade,
  email              text,
  full_name          text not null default '',
  is_platform_admin  boolean not null default false,
  created_at         timestamptz not null default now(),
  updated_at         timestamptz not null default now()
);

create trigger profiles_updated_at before update on public.profiles
  for each row execute function app.set_updated_at();

create function app.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data ->> 'full_name', '')
  )
  on conflict (id) do nothing;
  return new;
end;
$$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function app.handle_new_auth_user();

-- ---------------------------------------------------------------------------
-- school_memberships: the ONLY source of truth for roles.
-- ---------------------------------------------------------------------------
create table public.school_memberships (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.schools (id) on delete cascade,
  user_id     uuid not null references public.profiles (id) on delete cascade,
  role        public.membership_role not null,
  status      public.membership_status not null default 'active',
  invited_by  uuid references public.profiles (id) on delete set null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (school_id, user_id, role)
);

create index school_memberships_user_idx on public.school_memberships (user_id);

create trigger school_memberships_updated_at before update on public.school_memberships
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- Authorization helpers.
--
-- SECURITY DEFINER so policies can consult school_memberships without
-- recursing into school_memberships' own RLS. search_path is pinned and every
-- object is schema-qualified.
-- ---------------------------------------------------------------------------
create function app.is_platform_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (select p.is_platform_admin from public.profiles p where p.id = auth.uid()),
    false
  );
$$;

create function app.has_role(p_school_id uuid, p_role public.membership_role)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.school_memberships m
    where m.school_id = p_school_id
      and m.user_id = auth.uid()
      and m.role = p_role
      and m.status = 'active'
  );
$$;

create function app.is_member(p_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.school_memberships m
    where m.school_id = p_school_id
      and m.user_id = auth.uid()
      and m.status = 'active'
  );
$$;

create function app.is_admin(p_school_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select app.has_role(p_school_id, 'school_admin');
$$;

revoke all on all functions in schema app from public;
grant execute on function
  app.is_platform_admin(),
  app.has_role(uuid, public.membership_role),
  app.is_member(uuid),
  app.is_admin(uuid),
  app.is_valid_timezone(text)
to authenticated, service_role;
