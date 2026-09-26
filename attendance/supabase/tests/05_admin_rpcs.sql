-- Phase 2 admin RPCs.

-- Only admins of the school may generate sessions for it.
begin;
select tests.login_as('00000000-0000-0000-0000-00000000a002'); -- teacher A
set local role authenticated;
do $$
begin
  perform public.admin_generate_class_sessions('0000000a-0000-0000-0000-000000000000', 14);
  raise exception 'FAILED: teacher generated sessions';
exception when insufficient_privilege then null;
end;
$$;
rollback;

begin;
select tests.login_as('00000000-0000-0000-0000-00000000b001'); -- admin B
set local role authenticated;
do $$
begin
  perform public.admin_generate_class_sessions('0000000a-0000-0000-0000-000000000000', 14);
  raise exception 'FAILED: admin B generated sessions for school A';
exception when insufficient_privilege then null;
end;
$$;
rollback;

-- Admin A generates sessions for the next 14 days: Math 7A meets on Mondays.
begin;
select tests.login_as('00000000-0000-0000-0000-00000000a001');
set local role authenticated;
select tests.assert_true(
  public.admin_generate_class_sessions('0000000a-0000-0000-0000-000000000000', 14) >= 1,
  'sessions generated for upcoming Mondays');
-- Every Monday in the window now has exactly one Math 7A session.
select tests.assert_true(
  (select bool_and(n = 1) from (
     select (select count(*) from public.class_sessions cs
             where cs.schedule_id = '0000000a-0000-0000-0005-000000000001'
               and (cs.starts_at at time zone 'America/Bogota')::date = d::date) as n
     from generate_series((now() at time zone 'America/Bogota')::date,
                          (now() at time zone 'America/Bogota')::date + 14, interval '1 day') d
     where extract(isodow from d) = 1) x),
  'one session per Monday in the window');
select tests.assert_eq(
  public.admin_generate_class_sessions('0000000a-0000-0000-0000-000000000000', 14), 0,
  'regenerating is a no-op');
rollback;

-- remove_class_schedule: admin-only, removes future sessions without attendance only.
begin;
-- Fixture: one future session with attendance (from _fixtures), add two more future ones without.
insert into public.class_sessions (school_id, class_section_id, schedule_id, starts_at, ends_at) values
  ('0000000a-0000-0000-0000-000000000000', '0000000a-0000-0000-0004-000000000001', '0000000a-0000-0000-0005-000000000001', now() + interval '10 days', now() + interval '10 days 1 hour'),
  ('0000000a-0000-0000-0000-000000000000', '0000000a-0000-0000-0004-000000000001', '0000000a-0000-0000-0005-000000000001', now() + interval '17 days', now() + interval '17 days 1 hour');
update public.class_sessions set starts_at = now() + interval '3 days', ends_at = now() + interval '3 days 1 hour'
where id = '0000000a-0000-0000-0006-000000000001';  -- has an attendance record

select tests.login_as('00000000-0000-0000-0000-00000000b001'); -- admin B
set local role authenticated;
do $$
begin
  perform public.remove_class_schedule('0000000a-0000-0000-0005-000000000001');
  raise exception 'FAILED: admin B removed school A schedule';
exception when insufficient_privilege then null;
end;
$$;
reset role;

select tests.login_as('00000000-0000-0000-0000-00000000a001');
set local role authenticated;
select tests.assert_eq(public.remove_class_schedule('0000000a-0000-0000-0005-000000000001'), 2,
  'two future sessions without attendance removed');
reset role;
select tests.assert_eq((select count(*) from public.class_schedules where id = '0000000a-0000-0000-0005-000000000001'), 0::bigint,
  'schedule deleted');
select tests.assert_true(
  exists (select 1 from public.class_sessions where id = '0000000a-0000-0000-0006-000000000001' and schedule_id is null),
  'session with attendance kept and detached');
rollback;

-- generate_upcoming_sessions is not callable by API users.
begin;
select tests.login_as('00000000-0000-0000-0000-00000000a001');
set local role authenticated;
do $$
begin
  perform public.generate_upcoming_sessions(7);
  raise exception 'FAILED: user ran the global generator';
exception when insufficient_privilege then null;
end;
$$;
rollback;

begin;
set local role service_role;
select tests.assert_true(public.generate_upcoming_sessions(14) >= 1, 'daily job generates missing sessions');
rollback;
