-- Two-school fixture used by every database test. Loaded as the database
-- owner (bypasses RLS). IDs are fixed so tests can reference them.
--
--   School A "alpha"                       School B "bravo"
--   admin_a, teacher_a (teaches c_a1),     admin_b, teacher_b (teaches c_b1)
--   teacher_a2 (teaches nothing),          student s_b1 in c_b1
--   student_a (login, = s_a1)
--   students s_a1, s_a2 in c_a1; s_a3 in c_a2
--   outsider: an account with no membership anywhere

-- ---------------------------------------------------------------------------
-- Test helpers
-- ---------------------------------------------------------------------------
create schema tests;
grant usage on schema tests to anon, authenticated, service_role;

-- Impersonate a user for the rest of the current transaction.
-- Call as the owner, then `set local role authenticated`.
create function tests.login_as(p_user_id uuid)
returns void
language sql
as $$
  select set_config(
    'request.jwt.claims',
    json_build_object('sub', p_user_id, 'role', 'authenticated')::text,
    true
  );
$$;

create function tests.assert_eq(actual anyelement, expected anyelement, message text)
returns void
language plpgsql
as $$
begin
  if actual is distinct from expected then
    raise exception 'FAILED: % (expected %, got %)', message, expected, actual;
  end if;
end;
$$;

create function tests.assert_true(condition boolean, message text)
returns void
language plpgsql
as $$
begin
  if condition is distinct from true then
    raise exception 'FAILED: %', message;
  end if;
end;
$$;

grant execute on all functions in schema tests to anon, authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Accounts (auth.users -> profiles via trigger)
-- ---------------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000a001', 'admin@alpha.test',    '{"full_name":"Alice Admin"}'),
  ('00000000-0000-0000-0000-00000000a002', 'teacher@alpha.test',  '{"full_name":"Tomas Teacher"}'),
  ('00000000-0000-0000-0000-00000000a003', 'teacher2@alpha.test', '{"full_name":"Tina Idle"}'),
  ('00000000-0000-0000-0000-00000000a004', 'student@alpha.test',  '{"full_name":"Sara Student"}'),
  ('00000000-0000-0000-0000-00000000b001', 'admin@bravo.test',    '{"full_name":"Bob Admin"}'),
  ('00000000-0000-0000-0000-00000000b002', 'teacher@bravo.test',  '{"full_name":"Bea Teacher"}'),
  ('00000000-0000-0000-0000-00000000f001', 'outsider@nowhere.test', '{"full_name":"Oscar Outsider"}');

-- ---------------------------------------------------------------------------
-- Schools (bootstrap trigger adds default rule + simulator device)
-- ---------------------------------------------------------------------------
insert into public.schools (id, name, slug) values
  ('0000000a-0000-0000-0000-000000000000', 'Alpha School', 'alpha'),
  ('0000000b-0000-0000-0000-000000000000', 'Bravo School', 'bravo');

insert into public.school_memberships (school_id, user_id, role) values
  ('0000000a-0000-0000-0000-000000000000', '00000000-0000-0000-0000-00000000a001', 'school_admin'),
  ('0000000a-0000-0000-0000-000000000000', '00000000-0000-0000-0000-00000000a002', 'teacher'),
  ('0000000a-0000-0000-0000-000000000000', '00000000-0000-0000-0000-00000000a003', 'teacher'),
  ('0000000a-0000-0000-0000-000000000000', '00000000-0000-0000-0000-00000000a004', 'student'),
  ('0000000b-0000-0000-0000-000000000000', '00000000-0000-0000-0000-00000000b001', 'school_admin'),
  ('0000000b-0000-0000-0000-000000000000', '00000000-0000-0000-0000-00000000b002', 'teacher');

-- ---------------------------------------------------------------------------
-- School A data
-- ---------------------------------------------------------------------------
insert into public.teachers (id, school_id, user_id, first_name, last_name) values
  ('0000000a-0000-0000-0001-000000000001', '0000000a-0000-0000-0000-000000000000', '00000000-0000-0000-0000-00000000a002', 'Tomas', 'Teacher'),
  ('0000000a-0000-0000-0001-000000000002', '0000000a-0000-0000-0000-000000000000', '00000000-0000-0000-0000-00000000a003', 'Tina', 'Idle');

insert into public.students (id, school_id, user_id, student_number, first_name, last_name) values
  ('0000000a-0000-0000-0002-000000000001', '0000000a-0000-0000-0000-000000000000', '00000000-0000-0000-0000-00000000a004', 'A-001', 'Sara', 'Student'),
  ('0000000a-0000-0000-0002-000000000002', '0000000a-0000-0000-0000-000000000000', null, 'A-002', 'Diego', 'Diaz'),
  ('0000000a-0000-0000-0002-000000000003', '0000000a-0000-0000-0000-000000000000', null, 'A-003', 'Lucia', 'Lopez');

insert into public.courses (id, school_id, code, name) values
  ('0000000a-0000-0000-0003-000000000001', '0000000a-0000-0000-0000-000000000000', 'MATH7', 'Mathematics 7');

insert into public.class_sections (id, school_id, course_id, name) values
  ('0000000a-0000-0000-0004-000000000001', '0000000a-0000-0000-0000-000000000000', '0000000a-0000-0000-0003-000000000001', 'Math 7A'),
  ('0000000a-0000-0000-0004-000000000002', '0000000a-0000-0000-0000-000000000000', '0000000a-0000-0000-0003-000000000001', 'Math 7B');

insert into public.class_teachers (school_id, class_section_id, teacher_id) values
  ('0000000a-0000-0000-0000-000000000000', '0000000a-0000-0000-0004-000000000001', '0000000a-0000-0000-0001-000000000001');

insert into public.enrollments (school_id, class_section_id, student_id, enrolled_on) values
  ('0000000a-0000-0000-0000-000000000000', '0000000a-0000-0000-0004-000000000001', '0000000a-0000-0000-0002-000000000001', '2026-01-01'),
  ('0000000a-0000-0000-0000-000000000000', '0000000a-0000-0000-0004-000000000001', '0000000a-0000-0000-0002-000000000002', '2026-01-01'),
  ('0000000a-0000-0000-0000-000000000000', '0000000a-0000-0000-0004-000000000002', '0000000a-0000-0000-0002-000000000003', '2026-01-01');

insert into public.class_schedules (id, school_id, class_section_id, weekday, start_time, end_time, valid_from) values
  ('0000000a-0000-0000-0005-000000000001', '0000000a-0000-0000-0000-000000000000', '0000000a-0000-0000-0004-000000000001', 1, '08:00', '09:00', '2026-01-01');

insert into public.class_sessions (id, school_id, class_section_id, schedule_id, starts_at, ends_at) values
  ('0000000a-0000-0000-0006-000000000001', '0000000a-0000-0000-0000-000000000000', '0000000a-0000-0000-0004-000000000001', '0000000a-0000-0000-0005-000000000001', '2026-09-28 13:00Z', '2026-09-28 14:00Z'),
  ('0000000a-0000-0000-0006-000000000002', '0000000a-0000-0000-0000-000000000000', '0000000a-0000-0000-0004-000000000002', null, '2026-09-28 15:00Z', '2026-09-28 16:00Z');

insert into public.nfc_credentials (id, school_id, student_id, uid_normalized) values
  ('0000000a-0000-0000-0007-000000000001', '0000000a-0000-0000-0000-000000000000', '0000000a-0000-0000-0002-000000000001', '04A22B1C9F5E80');

insert into public.scan_events (id, school_id, device_id, idempotency_key, uid_normalized, credential_id, student_id,
                                class_session_id, effective_at, outcome)
select '0000000a-0000-0000-0008-000000000001', d.school_id, d.id, 'fixture-scan-0001', '04A22B1C9F5E80',
       '0000000a-0000-0000-0007-000000000001', '0000000a-0000-0000-0002-000000000001',
       '0000000a-0000-0000-0006-000000000001', '2026-09-28 13:02Z', 'recorded'
from public.devices d
where d.school_id = '0000000a-0000-0000-0000-000000000000' and d.kind = 'simulator';

insert into public.attendance_records (id, school_id, class_session_id, student_id, status, source, checked_in_at, first_scan_event_id) values
  ('0000000a-0000-0000-0009-000000000001', '0000000a-0000-0000-0000-000000000000', '0000000a-0000-0000-0006-000000000001', '0000000a-0000-0000-0002-000000000001', 'present', 'nfc', '2026-09-28 13:02Z', '0000000a-0000-0000-0008-000000000001'),
  ('0000000a-0000-0000-0009-000000000002', '0000000a-0000-0000-0000-000000000000', '0000000a-0000-0000-0006-000000000002', '0000000a-0000-0000-0002-000000000003', 'absent', 'system', null, null);

update public.scan_events set attendance_record_id = '0000000a-0000-0000-0009-000000000001'
where id = '0000000a-0000-0000-0008-000000000001';

-- ---------------------------------------------------------------------------
-- School B data (same NFC UID as school A on purpose: UIDs are per-school)
-- ---------------------------------------------------------------------------
insert into public.teachers (id, school_id, user_id, first_name, last_name) values
  ('0000000b-0000-0000-0001-000000000001', '0000000b-0000-0000-0000-000000000000', '00000000-0000-0000-0000-00000000b002', 'Bea', 'Teacher');

insert into public.students (id, school_id, student_number, first_name, last_name) values
  ('0000000b-0000-0000-0002-000000000001', '0000000b-0000-0000-0000-000000000000', 'B-001', 'Bruno', 'Bravo');

insert into public.courses (id, school_id, code, name) values
  ('0000000b-0000-0000-0003-000000000001', '0000000b-0000-0000-0000-000000000000', 'SCI8', 'Science 8');

insert into public.class_sections (id, school_id, course_id, name) values
  ('0000000b-0000-0000-0004-000000000001', '0000000b-0000-0000-0000-000000000000', '0000000b-0000-0000-0003-000000000001', 'Science 8A');

insert into public.class_teachers (school_id, class_section_id, teacher_id) values
  ('0000000b-0000-0000-0000-000000000000', '0000000b-0000-0000-0004-000000000001', '0000000b-0000-0000-0001-000000000001');

insert into public.enrollments (school_id, class_section_id, student_id, enrolled_on) values
  ('0000000b-0000-0000-0000-000000000000', '0000000b-0000-0000-0004-000000000001', '0000000b-0000-0000-0002-000000000001', '2026-01-01');

insert into public.class_sessions (id, school_id, class_section_id, starts_at, ends_at) values
  ('0000000b-0000-0000-0006-000000000001', '0000000b-0000-0000-0000-000000000000', '0000000b-0000-0000-0004-000000000001', '2026-09-28 13:00Z', '2026-09-28 14:00Z');

insert into public.nfc_credentials (id, school_id, student_id, uid_normalized) values
  ('0000000b-0000-0000-0007-000000000001', '0000000b-0000-0000-0000-000000000000', '0000000b-0000-0000-0002-000000000001', '04A22B1C9F5E80');

insert into public.attendance_records (school_id, class_session_id, student_id, status, source) values
  ('0000000b-0000-0000-0000-000000000000', '0000000b-0000-0000-0006-000000000001', '0000000b-0000-0000-0002-000000000001', 'late', 'nfc');

-- Give device B a token hash so we can check it is never readable.
update public.devices set token_hash = encode(sha256('bravo-reader-token'::bytea), 'hex'), token_last4 = 'oken'
where school_id = '0000000b-0000-0000-0000-000000000000';
