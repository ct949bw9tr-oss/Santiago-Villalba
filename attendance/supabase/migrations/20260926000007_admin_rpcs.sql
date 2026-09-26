-- Phase 2: admin-callable RPCs for schedule management, plus a daily job that
-- keeps upcoming class sessions materialized.

-- ---------------------------------------------------------------------------
-- admin_generate_class_sessions: an admin (re)generates sessions for the next
-- p_days days of their own school. Idempotent.
-- ---------------------------------------------------------------------------
create function public.admin_generate_class_sessions(p_school_id uuid, p_days integer default 28)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_today date;
begin
  if not app.is_admin(p_school_id) then
    raise exception 'not an admin of this school' using errcode = 'insufficient_privilege';
  end if;
  if p_days not between 1 and 120 then
    raise exception 'p_days must be between 1 and 120';
  end if;

  select (now() at time zone s.timezone)::date into v_today
  from public.schools s where s.id = p_school_id;

  return public.generate_class_sessions(p_school_id, v_today, v_today + p_days);
end;
$$;

-- ---------------------------------------------------------------------------
-- remove_class_schedule: delete a recurring slot and its FUTURE sessions that
-- have no attendance yet. Past sessions and any session with attendance are
-- kept (their schedule_id becomes null). Returns the number of sessions removed.
-- ---------------------------------------------------------------------------
create function public.remove_class_schedule(p_schedule_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_school_id uuid;
  v_count integer;
begin
  select school_id into v_school_id from public.class_schedules where id = p_schedule_id;
  if v_school_id is null or not app.is_admin(v_school_id) then
    raise exception 'schedule not found' using errcode = 'insufficient_privilege';
  end if;

  delete from public.class_sessions cs
  where cs.schedule_id = p_schedule_id
    and cs.starts_at > now()
    and not exists (select 1 from public.attendance_records ar where ar.class_session_id = cs.id)
    and not exists (select 1 from public.scan_events se where se.class_session_id = cs.id);
  get diagnostics v_count = row_count;

  delete from public.class_schedules where id = p_schedule_id;
  return v_count;
end;
$$;

-- ---------------------------------------------------------------------------
-- generate_upcoming_sessions: for every active school, materialize sessions
-- for the next p_days days (in each school's own timezone). Run daily.
-- ---------------------------------------------------------------------------
create function public.generate_upcoming_sessions(p_days integer default 28)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  s record;
  v_total integer := 0;
  v_today date;
begin
  for s in select id, timezone from public.schools where status = 'active' loop
    v_today := (now() at time zone s.timezone)::date;
    v_total := v_total + public.generate_class_sessions(s.id, v_today, v_today + p_days);
  end loop;
  return v_total;
end;
$$;

revoke all on function public.admin_generate_class_sessions(uuid, integer) from public, anon;
revoke all on function public.remove_class_schedule(uuid) from public, anon;
revoke all on function public.generate_upcoming_sessions(integer) from public, anon, authenticated;
grant execute on function public.admin_generate_class_sessions(uuid, integer) to authenticated, service_role;
grant execute on function public.remove_class_schedule(uuid) to authenticated, service_role;
grant execute on function public.generate_upcoming_sessions(integer) to service_role;

-- ---------------------------------------------------------------------------
-- Daily job (Supabase ships pg_cron). Skipped where pg_cron isn't available,
-- e.g. the plain-Postgres test database.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron') then
    create extension if not exists pg_cron with schema pg_catalog;
    perform cron.schedule(
      'generate-upcoming-class-sessions',
      '17 7 * * *',  -- daily 07:17 UTC (02:17 in Bogotá)
      'select public.generate_upcoming_sessions(28)'
    );
  end if;
exception when others then
  -- Never fail the migration over the scheduler; sessions can still be
  -- generated from the admin UI. Enable pg_cron in the dashboard and re-run
  -- this block to get the daily job.
  raise notice 'pg_cron job not scheduled: %', sqlerrm;
end;
$$;
