-- Attendance: devices (readers + simulator), NFC credentials, raw scan log,
-- current attendance records, and the append-only audit log.

create type public.device_kind as enum ('reader', 'simulator');
create type public.device_status as enum ('active', 'disabled');
create type public.credential_status as enum ('active', 'lost', 'revoked');
create type public.attendance_status as enum ('present', 'late', 'absent', 'excused');
create type public.attendance_source as enum ('nfc', 'manual', 'system');
create type public.actor_type as enum ('user', 'device', 'system');
create type public.scan_outcome as enum (
  'recorded',
  'duplicate',
  'unknown_credential',
  'inactive_credential',
  'inactive_student',
  'no_active_session',
  'not_enrolled',
  'too_early',
  'after_cutoff',
  'device_disabled',
  'school_suspended'
);

-- ---------------------------------------------------------------------------
-- devices. Every scan comes from a device; the simulator is a device too.
-- token_hash = sha256 hex of the bearer token; the token itself is never stored.
-- ---------------------------------------------------------------------------
create table public.devices (
  id                uuid primary key default gen_random_uuid(),
  school_id         uuid not null references public.schools (id) on delete cascade,
  name              text not null check (length(trim(name)) between 1 and 100),
  kind              public.device_kind not null default 'reader',
  status            public.device_status not null default 'active',
  location          text,
  room              text,
  class_section_id  uuid,
  token_hash        text unique check (token_hash is null or token_hash ~ '^[0-9a-f]{64}$'),
  token_last4       text,
  last_seen_at      timestamptz,
  metadata          jsonb not null default '{}'::jsonb,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (school_id, id),
  foreign key (school_id, class_section_id) references public.class_sections (school_id, id) on delete set null (class_section_id)
);

create unique index devices_one_simulator_per_school
  on public.devices (school_id) where kind = 'simulator';

create trigger devices_updated_at before update on public.devices
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- nfc_credentials. uid_normalized = uppercase hex, no separators, 4/7/10 bytes.
-- One ACTIVE credential per UID per school; revoked/lost rows are history.
-- ---------------------------------------------------------------------------
create table public.nfc_credentials (
  id              uuid primary key default gen_random_uuid(),
  school_id       uuid not null references public.schools (id) on delete cascade,
  student_id      uuid not null,
  uid_normalized  text not null check (uid_normalized ~ '^([0-9A-F]{8}|[0-9A-F]{14}|[0-9A-F]{20})$'),
  label           text,
  status          public.credential_status not null default 'active',
  issued_at       timestamptz not null default now(),
  revoked_at      timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (school_id, id),
  foreign key (school_id, student_id) references public.students (school_id, id) on delete cascade,
  check ((status = 'active') = (revoked_at is null))
);

create unique index nfc_credentials_active_uid
  on public.nfc_credentials (school_id, uid_normalized) where status = 'active';
create index nfc_credentials_student_idx on public.nfc_credentials (student_id);

create trigger nfc_credentials_updated_at before update on public.nfc_credentials
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- attendance_records: the current answer, one row per student per session.
-- unique (class_session_id, student_id) is the core duplicate guard.
-- ---------------------------------------------------------------------------
create table public.attendance_records (
  id                   uuid primary key default gen_random_uuid(),
  school_id            uuid not null references public.schools (id) on delete cascade,
  class_session_id     uuid not null,
  student_id           uuid not null,
  status               public.attendance_status not null,
  source               public.attendance_source not null,
  checked_in_at        timestamptz,
  first_scan_event_id  uuid,
  is_manual_override   boolean not null default false,
  note                 text,
  version              integer not null default 1,
  updated_by           uuid references public.profiles (id) on delete set null,
  created_at           timestamptz not null default now(),
  updated_at           timestamptz not null default now(),
  unique (school_id, id),
  unique (class_session_id, student_id),
  foreign key (school_id, class_session_id) references public.class_sessions (school_id, id) on delete cascade,
  foreign key (school_id, student_id) references public.students (school_id, id) on delete cascade
);

create index attendance_records_student_idx on public.attendance_records (student_id, created_at desc);

create function app.bump_attendance_version()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.version := old.version + 1;
  new.updated_at := now();
  return new;
end;
$$;

create trigger attendance_records_version before update on public.attendance_records
  for each row execute function app.bump_attendance_version();

-- ---------------------------------------------------------------------------
-- scan_events: append-only log of every tap, including rejected ones.
-- (device_id, idempotency_key) makes network retries safe; `response` holds
-- the exact API response so a retry can be replayed.
-- ---------------------------------------------------------------------------
create table public.scan_events (
  id                    uuid primary key default gen_random_uuid(),
  school_id             uuid not null references public.schools (id) on delete cascade,
  device_id             uuid not null,
  idempotency_key       text not null check (length(idempotency_key) between 8 and 128),
  uid_normalized        text not null,
  credential_id         uuid,
  student_id            uuid,
  class_session_id      uuid,
  attendance_record_id  uuid,
  device_scanned_at     timestamptz,
  received_at           timestamptz not null default now(),
  effective_at          timestamptz not null,
  outcome               public.scan_outcome not null,
  outcome_detail        text,
  response              jsonb,
  request_id            text,
  unique (school_id, id),
  unique (device_id, idempotency_key),
  foreign key (school_id, device_id) references public.devices (school_id, id),
  foreign key (school_id, credential_id) references public.nfc_credentials (school_id, id),
  foreign key (school_id, student_id) references public.students (school_id, id),
  foreign key (school_id, class_session_id) references public.class_sessions (school_id, id),
  foreign key (school_id, attendance_record_id) references public.attendance_records (school_id, id)
);

create index scan_events_school_time_idx on public.scan_events (school_id, received_at desc);
create index scan_events_debounce_idx on public.scan_events (device_id, uid_normalized, received_at desc);
create index scan_events_session_idx on public.scan_events (class_session_id) where class_session_id is not null;

alter table public.attendance_records
  add foreign key (school_id, first_scan_event_id) references public.scan_events (school_id, id);

-- ---------------------------------------------------------------------------
-- audit_logs: append-only, written by triggers (and later by RPCs).
-- ---------------------------------------------------------------------------
create table public.audit_logs (
  id               uuid primary key default gen_random_uuid(),
  school_id        uuid not null references public.schools (id) on delete cascade,
  actor_type       public.actor_type not null,
  actor_user_id    uuid references public.profiles (id) on delete set null,
  actor_device_id  uuid,
  action           text not null,
  entity_type      text not null,
  entity_id        uuid not null,
  before           jsonb,
  after            jsonb,
  reason           text,
  request_id       text,
  created_at       timestamptz not null default now()
);

create index audit_logs_school_time_idx on public.audit_logs (school_id, created_at desc);
create index audit_logs_entity_idx on public.audit_logs (entity_type, entity_id);

create function app.prevent_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '% is append-only', tg_table_name using errcode = 'insufficient_privilege';
end;
$$;

create trigger audit_logs_append_only before update or delete on public.audit_logs
  for each row execute function app.prevent_mutation();

-- scan_events rows are written once; only the link to the record created in
-- the same transaction may be filled in afterwards.
create function app.scan_events_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'scan_events is append-only' using errcode = 'insufficient_privilege';
  end if;
  if (to_jsonb(new) - 'attendance_record_id' - 'response') <> (to_jsonb(old) - 'attendance_record_id' - 'response') then
    raise exception 'scan_events is append-only' using errcode = 'insufficient_privilege';
  end if;
  return new;
end;
$$;

create trigger scan_events_append_only before update or delete on public.scan_events
  for each row execute function app.scan_events_guard();

-- ---------------------------------------------------------------------------
-- Generic audit trigger. Actor comes from the JWT (auth.uid()) or, for
-- device/system writes made by the server, from transaction-local settings:
--   app.actor_type, app.actor_device_id, app.audit_reason, app.request_id
-- Secrets (token_hash) are never copied into the audit log.
-- ---------------------------------------------------------------------------
create function app.audit_row_change()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row        jsonb := to_jsonb(coalesce(new, old));
  v_before     jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) - 'token_hash' end;
  v_after      jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) - 'token_hash' end;
  v_user       uuid := auth.uid();
  v_actor_type public.actor_type;
  v_device     uuid := nullif(current_setting('app.actor_device_id', true), '')::uuid;
begin
  if tg_op = 'UPDATE' and v_before - 'updated_at' - 'version' = v_after - 'updated_at' - 'version' then
    return new;
  end if;

  v_actor_type := coalesce(
    nullif(current_setting('app.actor_type', true), '')::public.actor_type,
    case when v_user is not null then 'user' when v_device is not null then 'device' else 'system' end::public.actor_type
  );

  insert into public.audit_logs (
    school_id, actor_type, actor_user_id, actor_device_id,
    action, entity_type, entity_id, before, after, reason, request_id
  ) values (
    (v_row ->> 'school_id')::uuid,
    v_actor_type,
    v_user,
    v_device,
    lower(tg_op),
    tg_table_name,
    (v_row ->> 'id')::uuid,
    v_before,
    v_after,
    nullif(current_setting('app.audit_reason', true), ''),
    nullif(current_setting('app.request_id', true), '')
  );
  return coalesce(new, old);
end;
$$;

create trigger audit_attendance_records after insert or update or delete on public.attendance_records
  for each row execute function app.audit_row_change();
create trigger audit_nfc_credentials after insert or update or delete on public.nfc_credentials
  for each row execute function app.audit_row_change();
create trigger audit_devices after insert or update or delete on public.devices
  for each row execute function app.audit_row_change();
create trigger audit_attendance_rules after insert or update or delete on public.attendance_rules
  for each row execute function app.audit_row_change();
create trigger audit_school_memberships after insert or update or delete on public.school_memberships
  for each row execute function app.audit_row_change();
create trigger audit_enrollments after insert or update or delete on public.enrollments
  for each row execute function app.audit_row_change();

-- ---------------------------------------------------------------------------
-- New school bootstrap: default attendance rule + the simulator device.
-- ---------------------------------------------------------------------------
create function app.bootstrap_school()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.attendance_rules (school_id, name, is_default)
  values (new.id, 'Default', true);

  insert into public.devices (school_id, name, kind, location)
  values (new.id, 'NFC Simulator', 'simulator', 'Virtual');

  return new;
end;
$$;

create trigger schools_bootstrap after insert on public.schools
  for each row execute function app.bootstrap_school();
