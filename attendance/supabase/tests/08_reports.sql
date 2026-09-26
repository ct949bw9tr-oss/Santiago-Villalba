-- Attendance report functions. Fixture: S1 (Math 7A, 2026-09-28): s_a1 present.
-- S2 (Math 7B, same day): s_a3 absent. School B: Bruno late in Science 8A.

-- Admin A sees the whole school.
begin;
select tests.login_as('00000000-0000-0000-0000-00000000a001');
set local role authenticated;
select tests.assert_eq(
  (select string_agg(class_name || ':' || present || '/' || late || '/' || absent || '/' || coalesce(attendance_rate::text, '-'), ',' order by class_name)
   from public.attendance_summary_by_class('0000000a-0000-0000-0000-000000000000', '2026-09-01', '2026-09-30')),
  'Math 7A:1/0/0/100.0,Math 7B:0/0/1/0.0', 'class summary for admin');
select tests.assert_eq(
  (select count(*) from public.attendance_summary_by_student('0000000a-0000-0000-0000-000000000000', '2026-09-01', '2026-09-30')),
  2::bigint, 'two students with records');
select tests.assert_eq(
  (select attendance_rate from public.attendance_summary_by_student('0000000a-0000-0000-0000-000000000000', '2026-09-01', '2026-09-30')
   where student_number = 'A-001'),
  100.0, 'present student has 100%');
select tests.assert_eq(
  (select count(*) from public.attendance_summary_by_student('0000000a-0000-0000-0000-000000000000', '2026-09-01', '2026-09-30',
                                                              '0000000a-0000-0000-0004-000000000002')),
  1::bigint, 'class filter');
select tests.assert_eq(
  (select count(*) from public.attendance_summary_by_class('0000000a-0000-0000-0000-000000000000', '2026-10-01', '2026-10-31')),
  0::bigint, 'date filter (school-local dates)');
rollback;

-- Rate: excused is left out; late counts as attended.
begin;
insert into public.attendance_records (school_id, class_session_id, student_id, status, source) values
  ('0000000a-0000-0000-0000-000000000000', '0000000a-0000-0000-0006-000000000001', '0000000a-0000-0000-0002-000000000002', 'excused', 'manual');
insert into public.class_sessions (id, school_id, class_section_id, starts_at, ends_at) values
  ('0000000a-0000-0000-0006-0000000000cc', '0000000a-0000-0000-0000-000000000000', '0000000a-0000-0000-0004-000000000001',
   '2026-09-29 13:00Z', '2026-09-29 14:00Z');
insert into public.attendance_records (school_id, class_session_id, student_id, status, source) values
  ('0000000a-0000-0000-0000-000000000000', '0000000a-0000-0000-0006-0000000000cc', '0000000a-0000-0000-0002-000000000001', 'late', 'nfc'),
  ('0000000a-0000-0000-0000-000000000000', '0000000a-0000-0000-0006-0000000000cc', '0000000a-0000-0000-0002-000000000002', 'absent', 'system');
select tests.login_as('00000000-0000-0000-0000-00000000a001');
set local role authenticated;
select tests.assert_eq(
  (select sessions || '|' || present || '|' || late || '|' || absent || '|' || excused || '|' || attendance_rate
   from public.attendance_summary_by_class('0000000a-0000-0000-0000-000000000000', '2026-09-01', '2026-09-30')
   where class_name = 'Math 7A'),
  '2|1|1|1|1|66.7', 'rate = (present+late)/(present+late+absent), excused excluded');
select tests.assert_true(
  (select attendance_rate is null from public.attendance_summary_by_student('0000000a-0000-0000-0000-000000000000', '2026-09-28', '2026-09-28')
   where student_number = 'A-002'),
  'only-excused student has no rate');
rollback;

-- RLS decides what is counted.
begin;
select tests.login_as('00000000-0000-0000-0000-00000000a002'); -- teacher of Math 7A only
set local role authenticated;
select tests.assert_eq(
  (select string_agg(class_name, ',') from public.attendance_summary_by_class('0000000a-0000-0000-0000-000000000000', '2026-09-01', '2026-09-30')),
  'Math 7A', 'teacher sees only their class');
rollback;

begin;
select tests.login_as('00000000-0000-0000-0000-00000000b001'); -- admin of school B
set local role authenticated;
select tests.assert_eq(
  (select count(*) from public.attendance_summary_by_class('0000000a-0000-0000-0000-000000000000', '2026-09-01', '2026-09-30')),
  0::bigint, 'admin B gets nothing for school A');
select tests.assert_eq(
  (select count(*) from public.attendance_summary_by_student('0000000a-0000-0000-0000-000000000000', '2026-09-01', '2026-09-30')),
  0::bigint, 'admin B gets no students of school A');
rollback;

begin;
set local role anon;
do $$
begin
  perform public.attendance_summary_by_class('0000000a-0000-0000-0000-000000000000', '2026-09-01', '2026-09-30');
  raise exception 'FAILED: anon ran a report';
exception when insufficient_privilege then null;
end;
$$;
rollback;
