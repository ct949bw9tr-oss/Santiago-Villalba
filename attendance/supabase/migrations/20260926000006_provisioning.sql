-- Server-side provisioning RPCs. Executable by service_role only (the Next.js
-- server and operator scripts), never by browser sessions.

-- ---------------------------------------------------------------------------
-- provision_school: create a school and its first admin atomically.
-- Schools are never hard-deleted (audit logs are append-only), so creation
-- must not leave half-built tenants behind.
-- ---------------------------------------------------------------------------
create function public.provision_school(
  p_name text,
  p_slug text,
  p_timezone text,
  p_locale text,
  p_admin_user_id uuid
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_school_id uuid;
begin
  if not exists (select 1 from public.profiles where id = p_admin_user_id) then
    raise exception 'admin user % has no profile', p_admin_user_id using errcode = 'foreign_key_violation';
  end if;

  perform set_config('app.actor_type', 'system', true);
  perform set_config('app.audit_reason', 'school provisioned', true);

  insert into public.schools (name, slug, timezone, locale)
  values (p_name, p_slug, p_timezone, coalesce(p_locale, 'es-CO'))
  returning id into v_school_id;

  insert into public.school_memberships (school_id, user_id, role, status)
  values (v_school_id, p_admin_user_id, 'school_admin', 'active');

  return v_school_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- generate_class_sessions: materialize dated sessions from recurring
-- schedules for [p_from, p_to] (school-local dates). Idempotent thanks to
-- unique (schedule_id, starts_at). Wall-clock times are converted with the
-- school's timezone, so DST shifts are handled by Postgres.
-- Returns the number of sessions created.
-- ---------------------------------------------------------------------------
create function public.generate_class_sessions(p_school_id uuid, p_from date, p_to date)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
begin
  if p_to < p_from then
    raise exception 'p_to must be on or after p_from';
  end if;
  if p_to - p_from > 120 then
    raise exception 'refusing to generate more than 120 days at once';
  end if;

  insert into public.class_sessions (school_id, class_section_id, schedule_id, starts_at, ends_at, room)
  select
    sch.school_id,
    sch.class_section_id,
    sch.id,
    (d.day + sch.start_time) at time zone s.timezone,
    (d.day + sch.end_time) at time zone s.timezone,
    coalesce(sch.room, c.room)
  from public.class_schedules sch
  join public.schools s on s.id = sch.school_id
  join public.class_sections c on c.id = sch.class_section_id and c.status = 'active'
  left join public.academic_terms t on t.id = c.term_id
  cross join lateral (
    select g::date as day
    from generate_series(
      greatest(p_from, sch.valid_from, coalesce(t.starts_on, p_from)),
      least(p_to, coalesce(sch.valid_to, p_to), coalesce(t.ends_on, p_to)),
      interval '1 day'
    ) g
  ) d
  where sch.school_id = p_school_id
    and extract(isodow from d.day) = sch.weekday
  on conflict (schedule_id, starts_at) do nothing;

  get diagnostics v_count = row_count;
  return v_count;
end;
$$;

revoke all on function public.provision_school(text, text, text, text, uuid) from public, anon, authenticated;
revoke all on function public.generate_class_sessions(uuid, date, date) from public, anon, authenticated;
grant execute on function public.provision_school(text, text, text, text, uuid) to service_role;
grant execute on function public.generate_class_sessions(uuid, date, date) to service_role;
