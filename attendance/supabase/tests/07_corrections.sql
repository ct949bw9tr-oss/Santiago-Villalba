-- Manual corrections (correct_attendance) and the teacher's audit view.
-- S1 = Math 7A session (teacher A teaches it): s_a1 has a 'present' record,
-- s_a2 is enrolled without a record, s_a3 is NOT enrolled in Math 7A.

-- Teacher marks a student without a record as excused.
begin;
select tests.login_as('00000000-0000-0000-0000-00000000a002');
set local role authenticated;
do $$
declare r jsonb;
begin
  r := public.correct_attendance('0000000a-0000-0000-0006-000000000001', '0000000a-0000-0000-0002-000000000002',
                                 'excused', '  Doctor appointment  ');
  perform tests.assert_eq(r ->> 'status', 'excused', 'teacher can excuse a student');
end;
$$;
reset role;
select tests.assert_true(
  exists (select 1 from public.attendance_records
          where class_session_id = '0000000a-0000-0000-0006-000000000001'
            and student_id = '0000000a-0000-0000-0002-000000000002'
            and status = 'excused' and source = 'manual' and is_manual_override
            and note = 'Doctor appointment'
            and updated_by = '00000000-0000-0000-0000-00000000a002'),
  'record is a manual override with the trimmed reason');
select tests.assert_true(
  exists (select 1 from public.audit_logs
          where entity_type = 'attendance_records' and action = 'insert'
            and actor_type = 'user' and actor_user_id = '00000000-0000-0000-0000-00000000a002'
            and reason = 'Doctor appointment' and after ->> 'status' = 'excused'),
  'correction audited with actor and reason');
rollback;

-- Changing an existing record: version bump, before/after in the audit log,
-- and card taps can no longer change it.
begin;
select tests.login_as('00000000-0000-0000-0000-00000000a002');
set local role authenticated;
select public.correct_attendance('0000000a-0000-0000-0006-000000000001', '0000000a-0000-0000-0002-000000000001',
                                 'late', 'Arrived after roll call', 1);
reset role;
select tests.assert_eq(
  (select version from public.attendance_records where id = '0000000a-0000-0000-0009-000000000001'), 2,
  'version bumped');
select tests.assert_true(
  exists (select 1 from public.audit_logs
          where entity_id = '0000000a-0000-0000-0009-000000000001' and action = 'update'
            and before ->> 'status' = 'present' and after ->> 'status' = 'late'
            and reason = 'Arrived after roll call'),
  'audit keeps before and after');
select tests.assert_eq(
  public.process_scan(
    (select id from public.devices where school_id = '0000000a-0000-0000-0000-000000000000' and kind = 'simulator'),
    '04A22B1C9F5E80', 'after-correction-1', '2026-09-28 13:02Z') ->> 'outcome',
  'duplicate', 'a later tap does not override the correction');
select tests.assert_eq(
  (select status::text from public.attendance_records where id = '0000000a-0000-0000-0009-000000000001'), 'late',
  'status stays as corrected');
rollback;

-- Stale version is rejected.
begin;
select tests.login_as('00000000-0000-0000-0000-00000000a002');
set local role authenticated;
do $$
begin
  perform public.correct_attendance('0000000a-0000-0000-0006-000000000001', '0000000a-0000-0000-0002-000000000001',
                                    'absent', 'Left early', 7);
  raise exception 'FAILED: stale version accepted';
exception when sqlstate 'PT409' then null;
end;
$$;
-- A reason is required.
do $$
begin
  perform public.correct_attendance('0000000a-0000-0000-0006-000000000001', '0000000a-0000-0000-0002-000000000001',
                                    'absent', '  ');
  raise exception 'FAILED: empty reason accepted';
exception when check_violation then null;
end;
$$;
-- The student must belong to the class.
do $$
begin
  perform public.correct_attendance('0000000a-0000-0000-0006-000000000001', '0000000a-0000-0000-0002-000000000003',
                                    'present', 'Visiting student');
  raise exception 'FAILED: correction for a student not in the class';
exception when foreign_key_violation then null;
end;
$$;
rollback;

-- Who may correct.
begin;
select tests.login_as('00000000-0000-0000-0000-00000000a003'); -- teacher without this class
set local role authenticated;
do $$
begin
  perform public.correct_attendance('0000000a-0000-0000-0006-000000000001', '0000000a-0000-0000-0002-000000000002',
                                    'present', 'Trying anyway');
  raise exception 'FAILED: another teacher corrected the class';
exception when insufficient_privilege then null;
end;
$$;
rollback;

begin;
select tests.login_as('00000000-0000-0000-0000-00000000b001'); -- admin of school B
set local role authenticated;
do $$
begin
  perform public.correct_attendance('0000000a-0000-0000-0006-000000000001', '0000000a-0000-0000-0002-000000000002',
                                    'present', 'Cross-school attempt');
  raise exception 'FAILED: admin B corrected school A';
exception when insufficient_privilege then null;
end;
$$;
rollback;

begin;
select tests.login_as('00000000-0000-0000-0000-00000000a004'); -- student
set local role authenticated;
do $$
begin
  perform public.correct_attendance('0000000a-0000-0000-0006-000000000001', '0000000a-0000-0000-0002-000000000001',
                                    'present', 'I was there');
  raise exception 'FAILED: a student corrected attendance';
exception when insufficient_privilege then null;
end;
$$;
rollback;

begin;
select tests.login_as('00000000-0000-0000-0000-00000000a001'); -- admin of school A
set local role authenticated;
select tests.assert_eq(
  public.correct_attendance('0000000a-0000-0000-0006-000000000001', '0000000a-0000-0000-0002-000000000002',
                            'absent', 'Parent called in') ->> 'status',
  'absent', 'school admin can correct');
rollback;

-- Teachers see the audit trail of their own classes only.
begin;
select tests.login_as('00000000-0000-0000-0000-00000000a002');
set local role authenticated;
select public.correct_attendance('0000000a-0000-0000-0006-000000000001', '0000000a-0000-0000-0002-000000000002',
                                 'excused', 'Field trip');
select tests.assert_true(
  (select count(*) from public.audit_logs where reason = 'Field trip') = 1,
  'teacher sees the audit of their class');
select tests.assert_eq(
  (select count(*) from public.audit_logs
   where entity_type = 'attendance_records'
     and entity_id = '0000000a-0000-0000-0009-000000000002'), 0::bigint,
  'teacher does not see audit of another class (Math 7B)');
select tests.assert_eq(
  (select count(*) from public.audit_logs where entity_type <> 'attendance_records'), 0::bigint,
  'teacher sees no other audit entries');
reset role;
select tests.login_as('00000000-0000-0000-0000-00000000a003');
set local role authenticated;
select tests.assert_eq((select count(*) from public.audit_logs), 0::bigint, 'teacher without the class sees nothing');
rollback;
