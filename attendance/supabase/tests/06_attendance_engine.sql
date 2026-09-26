-- Attendance engine: process_scan() and finalize_due_sessions().
--
-- Fixture recap (school A, timezone America/Bogota, default rule:
-- early 10 · late after 5 · absent after 20 · cutoff→late · debounce 60s):
--   S1 = Math 7A session 2026-09-28 13:00–14:00Z (08:00 local); s_a1 has a
--        'present' record, s_a2 (Diego) is enrolled with no record.
--   S2 = Math 7B session 2026-09-28 15:00–16:00Z; s_a3 has an 'absent'/system record.

-- Helper: scan with school A's simulator device.
create function tests.scan(p_uid text, p_at timestamptz, p_key text default null, p_device uuid default null)
returns jsonb
language sql
as $$
  select public.process_scan(
    coalesce(p_device, (select id from public.devices where school_id = '0000000a-0000-0000-0000-000000000000' and kind = 'simulator')),
    p_uid,
    coalesce(p_key, gen_random_uuid()::text),
    p_at
  );
$$;

-- Diego (s_a2) gets a card for all tests below.
create function tests.give_diego_a_card()
returns void
language sql
as $$
  insert into public.nfc_credentials (school_id, student_id, uid_normalized)
  values ('0000000a-0000-0000-0000-000000000000', '0000000a-0000-0000-0002-000000000002', 'AABBCCDD');
$$;

-- ---------------------------------------------------------------------------
-- Permissions
-- ---------------------------------------------------------------------------
begin;
select tests.login_as('00000000-0000-0000-0000-00000000a001');
set local role authenticated;
do $$
begin
  perform tests.scan('AABBCCDD', '2026-09-28 13:03Z');
  raise exception 'FAILED: an API user called process_scan directly';
exception when insufficient_privilege then null;
end;
$$;
do $$
begin
  perform public.finalize_due_sessions(null);
  raise exception 'FAILED: an API user ran the global absence job';
exception when insufficient_privilege then null;
end;
$$;
do $$
begin
  perform public.admin_finalize_due_sessions('0000000b-0000-0000-0000-000000000000');
  raise exception 'FAILED: admin A finalized school B';
exception when insufficient_privilege then null;
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- Present / late / early window / cutoff
-- ---------------------------------------------------------------------------
begin;
select tests.give_diego_a_card();
do $$
declare r jsonb;
begin
  r := tests.scan('aa:bb:cc:dd', '2026-09-28 13:03Z');
  perform tests.assert_eq(r ->> 'outcome', 'recorded', 'on-time scan recorded (uid normalized)');
  perform tests.assert_eq(r #>> '{attendance,status}', 'present', 'on-time scan is present');
  perform tests.assert_eq(r ->> 'feedback', 'accept', 'present gives accept feedback');
  perform tests.assert_eq(r ->> 'message', 'Present — Math 7A', 'message names the class');
  perform tests.assert_eq(r #>> '{student,display_name}', 'Diego D.', 'student display name is minimal');
  perform tests.assert_true(
    exists (select 1 from public.audit_logs where entity_type = 'attendance_records' and actor_type = 'device'
            and actor_device_id is not null and after ->> 'student_id' = '0000000a-0000-0000-0002-000000000002'),
    'record creation audited as device');
  perform tests.assert_true(
    (select rule_snapshot is not null from public.class_sessions where id = '0000000a-0000-0000-0006-000000000001'),
    'rule frozen on first scan');
end;
$$;
rollback;

begin;
select tests.give_diego_a_card();
select tests.assert_eq(tests.scan('AABBCCDD', '2026-09-28 13:12Z') #>> '{attendance,status}', 'late', '12 min after start is late');
rollback;

begin;
select tests.give_diego_a_card();
select tests.assert_eq(tests.scan('AABBCCDD', '2026-09-28 12:52Z') #>> '{attendance,status}', 'present', '8 min early is present');
rollback;

begin;
select tests.give_diego_a_card();
do $$
declare r jsonb;
begin
  r := tests.scan('AABBCCDD', '2026-09-28 12:30Z');
  perform tests.assert_eq(r ->> 'outcome', 'too_early', '30 min early is too early');
  perform tests.assert_eq(r ->> 'message', 'Too early — Math 7A starts at 08:00', 'too-early message uses local time');
  perform tests.assert_true(r -> 'attendance' = 'null'::jsonb, 'too early creates no record');
end;
$$;
rollback;

begin;
select tests.give_diego_a_card();
select tests.assert_eq(tests.scan('AABBCCDD', '2026-09-28 13:25Z') #>> '{attendance,status}', 'late', 'after cutoff counts as late by default');
rollback;

begin;
select tests.give_diego_a_card();
update public.attendance_rules set scan_after_cutoff = 'absent' where school_id = '0000000a-0000-0000-0000-000000000000';
do $$
declare r jsonb;
begin
  r := tests.scan('AABBCCDD', '2026-09-28 13:25Z');
  perform tests.assert_eq(r ->> 'outcome', 'after_cutoff', 'cutoff=absent: outcome after_cutoff');
  perform tests.assert_eq(r #>> '{attendance,status}', 'absent', 'cutoff=absent: recorded absent');
end;
$$;
rollback;

begin;
select tests.give_diego_a_card();
update public.attendance_rules set scan_after_cutoff = 'reject' where school_id = '0000000a-0000-0000-0000-000000000000';
do $$
declare r jsonb;
begin
  r := tests.scan('AABBCCDD', '2026-09-28 13:25Z');
  perform tests.assert_eq(r ->> 'outcome', 'after_cutoff', 'cutoff=reject: outcome after_cutoff');
  perform tests.assert_eq(r ->> 'feedback', 'reject', 'cutoff=reject: reject feedback');
  perform tests.assert_eq(
    (select count(*) from public.attendance_records where student_id = '0000000a-0000-0000-0002-000000000002'),
    0::bigint, 'cutoff=reject: no record');
  perform tests.assert_eq(
    (select count(*) from public.scan_events where uid_normalized = 'AABBCCDD'), 1::bigint, 'rejected tap still logged');
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- Duplicates and idempotency
-- ---------------------------------------------------------------------------
begin;
select tests.give_diego_a_card();
insert into public.devices (id, school_id, name, kind) values
  ('0000000a-0000-0000-000d-000000000001', '0000000a-0000-0000-0000-000000000000', 'Door 2', 'reader');
do $$
declare r jsonb;
begin
  perform tests.scan('AABBCCDD', '2026-09-28 13:03Z');
  r := tests.scan('AABBCCDD', '2026-09-28 13:04Z');
  perform tests.assert_eq(r ->> 'outcome', 'duplicate', 'second tap on same reader is a duplicate');
  perform tests.assert_eq(r #>> '{attendance,status}', 'present', 'duplicate reports the existing status');
  r := tests.scan('AABBCCDD', '2026-09-28 13:10Z', null, '0000000a-0000-0000-000d-000000000001');
  perform tests.assert_eq(r ->> 'outcome', 'duplicate', 'tap on another reader is also a duplicate');
  perform tests.assert_eq(r #>> '{attendance,status}', 'present', 'status is not downgraded to late');
  perform tests.assert_eq(
    (select count(*) from public.attendance_records where student_id = '0000000a-0000-0000-0002-000000000002'),
    1::bigint, 'still one record');
end;
$$;
rollback;

begin;
select tests.give_diego_a_card();
do $$
declare r1 jsonb; r2 jsonb;
begin
  r1 := tests.scan('AABBCCDD', '2026-09-28 13:03Z', 'retry-key-0001');
  r2 := tests.scan('AABBCCDD', '2026-09-28 13:03Z', 'retry-key-0001');
  perform tests.assert_eq(r2 ->> 'scan_id', r1 ->> 'scan_id', 'retry returns the original result');
  perform tests.assert_eq(r2 ->> 'replayed', 'true', 'retry is flagged as replayed');
  perform tests.assert_eq(
    (select count(*) from public.scan_events where idempotency_key = 'retry-key-0001'), 1::bigint, 'retry logs nothing new');
  r2 := tests.scan('DEADBEEF', '2026-09-28 13:03Z', 'retry-key-0001');
  perform tests.assert_eq(r2 ->> 'error', 'idempotency_conflict', 'same key with another card is a conflict');
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- Rejections
-- ---------------------------------------------------------------------------
begin;
select tests.give_diego_a_card();
do $$
declare r jsonb;
begin
  r := tests.scan('DEADBEEF', '2026-09-28 13:03Z');
  perform tests.assert_eq(r ->> 'outcome', 'unknown_credential', 'unknown card');
  perform tests.assert_true(r -> 'student' = 'null'::jsonb, 'unknown card reveals no student');
  perform tests.assert_eq(tests.scan('not-a-uid', '2026-09-28 13:03Z') ->> 'outcome', 'unknown_credential', 'malformed uid');

  update public.nfc_credentials set status = 'lost', revoked_at = now() where uid_normalized = 'AABBCCDD';
  perform tests.assert_eq(tests.scan('AABBCCDD', '2026-09-28 13:03Z') ->> 'outcome', 'inactive_credential', 'lost card');
end;
$$;
rollback;

begin;
select tests.give_diego_a_card();
update public.students set status = 'inactive' where id = '0000000a-0000-0000-0002-000000000002';
select tests.assert_eq(tests.scan('AABBCCDD', '2026-09-28 13:03Z') ->> 'outcome', 'inactive_student', 'inactive student');
rollback;

begin;
select tests.give_diego_a_card();
select tests.assert_eq(tests.scan('AABBCCDD', '2026-09-28 20:00Z') ->> 'outcome', 'no_active_session', 'no class in the evening');
update public.enrollments set enrolled_on = '2026-10-01' where student_id = '0000000a-0000-0000-0002-000000000002';
select tests.assert_eq(tests.scan('AABBCCDD', '2026-09-28 13:03Z') ->> 'outcome', 'no_active_session', 'not yet enrolled on that date');
rollback;

begin;
select tests.give_diego_a_card();
update public.devices set status = 'disabled' where school_id = '0000000a-0000-0000-0000-000000000000' and kind = 'simulator';
select tests.assert_eq(tests.scan('AABBCCDD', '2026-09-28 13:03Z') ->> 'outcome', 'device_disabled', 'disabled device');
rollback;

-- ---------------------------------------------------------------------------
-- Readers bound to a classroom
-- ---------------------------------------------------------------------------
begin;
select tests.give_diego_a_card();
insert into public.nfc_credentials (school_id, student_id, uid_normalized)
values ('0000000a-0000-0000-0000-000000000000', '0000000a-0000-0000-0002-000000000003', '11223344'); -- Lucia (7B)
insert into public.devices (id, school_id, name, kind, class_section_id) values
  ('0000000a-0000-0000-000d-000000000002', '0000000a-0000-0000-0000-000000000000', 'Room 7B', 'reader', '0000000a-0000-0000-0004-000000000002');
do $$
declare r jsonb;
begin
  r := tests.scan('AABBCCDD', '2026-09-28 15:02Z', null, '0000000a-0000-0000-000d-000000000002');
  perform tests.assert_eq(r ->> 'outcome', 'not_enrolled', 'Diego at the 7B reader is not enrolled');
  perform tests.assert_eq(r ->> 'message', 'Not enrolled in Math 7B', 'not-enrolled message names the class');

  -- Lucia already has an automatic absence; her tap replaces it.
  r := tests.scan('11223344', '2026-09-28 15:02Z', null, '0000000a-0000-0000-000d-000000000002');
  perform tests.assert_eq(r ->> 'outcome', 'recorded', 'tap replaces automatic absence');
  perform tests.assert_eq(r #>> '{attendance,status}', 'present', 'now present');
end;
$$;
rollback;

-- A teacher's manual decision is never overwritten by a tap.
begin;
insert into public.nfc_credentials (school_id, student_id, uid_normalized)
values ('0000000a-0000-0000-0000-000000000000', '0000000a-0000-0000-0002-000000000003', '11223344');
update public.attendance_records set status = 'excused', source = 'manual', is_manual_override = true
where id = '0000000a-0000-0000-0009-000000000002';
do $$
declare r jsonb;
begin
  r := tests.scan('11223344', '2026-09-28 15:02Z');
  perform tests.assert_eq(r ->> 'outcome', 'duplicate', 'manual override wins');
  perform tests.assert_eq(r #>> '{attendance,status}', 'excused', 'status stays excused');
end;
$$;
rollback;

-- Back-to-back classes: a tap just before the next class counts for it.
begin;
select tests.give_diego_a_card();
insert into public.class_sessions (id, school_id, class_section_id, starts_at, ends_at) values
  ('0000000a-0000-0000-0006-000000000009', '0000000a-0000-0000-0000-000000000000', '0000000a-0000-0000-0004-000000000001',
   '2026-09-28 14:00Z', '2026-09-28 15:00Z');
-- Diego already attended the 13:00 session (recorded directly, no recent tap).
insert into public.attendance_records (school_id, class_session_id, student_id, status, source, checked_in_at) values
  ('0000000a-0000-0000-0000-000000000000', '0000000a-0000-0000-0006-000000000001', '0000000a-0000-0000-0002-000000000002',
   'present', 'nfc', '2026-09-28 13:02Z');
do $$
declare r jsonb;
begin
  r := tests.scan('AABBCCDD', '2026-09-28 13:55Z');
  perform tests.assert_eq(r ->> 'outcome', 'recorded', 'tap before next class is recorded');
  perform tests.assert_eq(r #>> '{attendance,class_session_id}', '0000000a-0000-0000-0006-000000000009', 'for the next class');
  perform tests.assert_eq(r #>> '{attendance,status}', 'present', 'as present');
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- Cross-school: the reader's school decides whose card it is.
-- ---------------------------------------------------------------------------
begin;
select tests.give_diego_a_card();
do $$
declare
  b_device uuid := (select id from public.devices where school_id = '0000000b-0000-0000-0000-000000000000' and kind = 'simulator');
  r jsonb;
begin
  r := tests.scan('AABBCCDD', '2026-09-28 13:03Z', null, b_device);
  perform tests.assert_eq(r ->> 'outcome', 'unknown_credential', 'school A card is unknown at school B');
  -- Same physical UID registered in both schools resolves to B's student at B.
  r := tests.scan('04A22B1C9F5E80', '2026-09-28 13:03Z', null, b_device);
  perform tests.assert_eq(r #>> '{student,display_name}', 'Bruno B.', 'shared UID resolves within the reader''s school');
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- Absence job
-- ---------------------------------------------------------------------------
begin;
select tests.give_diego_a_card();
-- A Math 7A session that started 30 minutes ago (past the 20-minute cutoff).
insert into public.class_sessions (id, school_id, class_section_id, starts_at, ends_at) values
  ('0000000a-0000-0000-0006-0000000000aa', '0000000a-0000-0000-0000-000000000000', '0000000a-0000-0000-0004-000000000001',
   now() - interval '30 minutes', now() + interval '30 minutes');
do $$
declare r jsonb;
begin
  perform tests.assert_true(public.finalize_due_sessions(null) >= 1, 'due session finalized');
  perform tests.assert_eq(
    (select count(*) from public.attendance_records
     where class_session_id = '0000000a-0000-0000-0006-0000000000aa' and status = 'absent' and source = 'system'),
    2::bigint, 'both enrolled students marked absent');
  perform tests.assert_true(
    (select finalized_at is not null from public.class_sessions where id = '0000000a-0000-0000-0006-0000000000aa'),
    'session marked finalized');
  perform tests.assert_true(
    exists (select 1 from public.audit_logs where entity_type = 'attendance_records' and actor_type = 'system'
            and after ->> 'class_session_id' = '0000000a-0000-0000-0006-0000000000aa'),
    'automatic absences audited as system');
  perform tests.assert_eq(public.finalize_due_sessions(null), 0, 'second run does nothing');

  -- Diego walks in late: the automatic absence becomes "late".
  r := tests.scan('AABBCCDD', now());
  perform tests.assert_eq(r ->> 'outcome', 'recorded', 'late arrival after absence job is recorded');
  perform tests.assert_eq(r #>> '{attendance,status}', 'late', 'absence upgraded to late');
end;
$$;
rollback;

-- Students enrolled after the session date are not marked absent.
begin;
insert into public.class_sessions (id, school_id, class_section_id, starts_at, ends_at) values
  ('0000000a-0000-0000-0006-0000000000bb', '0000000a-0000-0000-0000-000000000000', '0000000a-0000-0000-0004-000000000001',
   now() - interval '2 days', now() - interval '2 days' + interval '1 hour');
update public.enrollments set enrolled_on = current_date where student_id = '0000000a-0000-0000-0002-000000000002';
select public.finalize_due_sessions('0000000a-0000-0000-0000-000000000000');
select tests.assert_eq(
  (select count(*) from public.attendance_records where class_session_id = '0000000a-0000-0000-0006-0000000000bb'),
  1::bigint, 'only students enrolled on that date are marked absent');
rollback;

-- ---------------------------------------------------------------------------
-- Reader tokens
-- ---------------------------------------------------------------------------
begin;
insert into public.devices (id, school_id, name, kind) values
  ('0000000a-0000-0000-000d-000000000003', '0000000a-0000-0000-0000-000000000000', 'Gate', 'reader');
select tests.login_as('00000000-0000-0000-0000-00000000a001');
set local role authenticated;
select public.admin_set_device_token('0000000a-0000-0000-000d-000000000003', repeat('ab', 32), 'abcd');
do $$
begin
  perform public.admin_set_device_token(
    (select id from public.devices where school_id = '0000000a-0000-0000-0000-000000000000' and kind = 'simulator'),
    repeat('cd', 32), 'cdcd');
  raise exception 'FAILED: token set on the simulator';
exception when insufficient_privilege then null;
end;
$$;
reset role;
select tests.assert_eq((select token_hash from public.devices where id = '0000000a-0000-0000-000d-000000000003'), repeat('ab', 32), 'token hash stored');

select tests.login_as('00000000-0000-0000-0000-00000000b001');
set local role authenticated;
do $$
begin
  perform public.admin_set_device_token('0000000a-0000-0000-000d-000000000003', repeat('ef', 32), 'efef');
  raise exception 'FAILED: admin B set a token on a school A reader';
exception when insufficient_privilege then null;
end;
$$;
rollback;
