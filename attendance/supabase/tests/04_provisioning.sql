-- Provisioning RPCs: service-role only, atomic, timezone-correct.

-- Browser sessions cannot call them.
begin;
select tests.login_as('00000000-0000-0000-0000-00000000a001');
set local role authenticated;
do $$
begin
  perform public.provision_school('Evil', 'evil', 'UTC', null, auth.uid());
  raise exception 'FAILED: authenticated user provisioned a school';
exception when insufficient_privilege then null;
end;
$$;
do $$
begin
  perform public.generate_class_sessions('0000000a-0000-0000-0000-000000000000', current_date, current_date);
  raise exception 'FAILED: authenticated user generated sessions';
exception when insufficient_privilege then null;
end;
$$;
rollback;

-- provision_school creates school + default rule + simulator + admin membership.
begin;
set local role service_role;
do $$
declare
  v_id uuid;
begin
  v_id := public.provision_school('Charlie School', 'charlie', 'America/Bogota', 'es-CO',
                                  '00000000-0000-0000-0000-00000000f001');
  perform tests.assert_eq((select count(*) from public.attendance_rules where school_id = v_id and is_default), 1::bigint, 'default rule created');
  perform tests.assert_eq((select count(*) from public.devices where school_id = v_id and kind = 'simulator'), 1::bigint, 'simulator created');
  perform tests.assert_eq(
    (select role::text from public.school_memberships where school_id = v_id and user_id = '00000000-0000-0000-0000-00000000f001'),
    'school_admin', 'first admin membership created');
end;
$$;

-- Atomic: a bad admin id leaves no school behind.
do $$
begin
  perform public.provision_school('Broken', 'broken', 'UTC', null, gen_random_uuid());
  raise exception 'FAILED: provisioned with unknown admin';
exception when foreign_key_violation then null;
end;
$$;
select tests.assert_eq((select count(*) from public.schools where slug = 'broken'), 0::bigint, 'no half-created school');
rollback;

-- generate_class_sessions: weekday matching, local wall-clock -> UTC, idempotent.
begin;
set local role service_role;
-- Math 7A meets Mondays 08:00-09:00 (Bogotá, UTC-5, no DST).
-- 2026-10-05 .. 2026-10-18 contains two Mondays: Oct 5 and Oct 12.
select tests.assert_eq(
  public.generate_class_sessions('0000000a-0000-0000-0000-000000000000', '2026-10-05', '2026-10-18'),
  2, 'two Monday sessions generated');
select tests.assert_true(
  exists (select 1 from public.class_sessions
          where schedule_id = '0000000a-0000-0000-0005-000000000001'
            and starts_at = '2026-10-05 13:00:00+00' and ends_at = '2026-10-05 14:00:00+00'),
  '08:00 Bogotá is stored as 13:00 UTC');
select tests.assert_eq(
  public.generate_class_sessions('0000000a-0000-0000-0000-000000000000', '2026-10-05', '2026-10-18'),
  0, 'second run is a no-op');
rollback;

-- DST: a school in New York keeps 08:00 local across the November change.
begin;
update public.schools set timezone = 'America/New_York' where id = '0000000a-0000-0000-0000-000000000000';
set local role service_role;
select public.generate_class_sessions('0000000a-0000-0000-0000-000000000000', '2026-10-26', '2026-11-09');
select tests.assert_true(
  exists (select 1 from public.class_sessions where starts_at = '2026-10-26 12:00:00+00'),
  'EDT: 08:00 local = 12:00 UTC');
select tests.assert_true(
  exists (select 1 from public.class_sessions where starts_at = '2026-11-09 13:00:00+00'),
  'EST: 08:00 local = 13:00 UTC');
rollback;

-- Term bounds and archived classes are respected.
begin;
insert into public.academic_terms (id, school_id, name, starts_on, ends_on)
values ('0000000a-0000-0000-000a-000000000001', '0000000a-0000-0000-0000-000000000000', 'Short term', '2026-10-01', '2026-10-07');
update public.class_sections set term_id = '0000000a-0000-0000-000a-000000000001'
where id = '0000000a-0000-0000-0004-000000000001';
set local role service_role;
select tests.assert_eq(
  public.generate_class_sessions('0000000a-0000-0000-0000-000000000000', '2026-10-01', '2026-10-31'),
  1, 'only sessions inside the term');
reset role;
update public.class_sections set status = 'archived' where id = '0000000a-0000-0000-0004-000000000001';
set local role service_role;
select tests.assert_eq(
  public.generate_class_sessions('0000000a-0000-0000-0000-000000000000', '2026-11-01', '2026-11-30'),
  0, 'archived classes get no sessions');
rollback;
