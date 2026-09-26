-- Data integrity: bootstrap, uniqueness, audit trail, append-only logs.

-- New schools get a default rule and exactly one simulator device.
select tests.assert_eq(
  (select count(*) from public.attendance_rules where is_default), 2::bigint,
  'each school has one default attendance rule');
select tests.assert_eq(
  (select count(*) from public.devices where kind = 'simulator'), 2::bigint,
  'each school has one simulator device');

-- A second simulator for the same school is rejected.
do $$
begin
  insert into public.devices (school_id, name, kind)
  values ('0000000a-0000-0000-0000-000000000000', 'Another sim', 'simulator');
  raise exception 'FAILED: second simulator accepted';
exception when unique_violation then null;
end;
$$;

-- Invalid timezone / slug are rejected.
do $$
begin
  insert into public.schools (name, slug, timezone) values ('X', 'x-school', 'Mars/Olympus');
  raise exception 'FAILED: invalid timezone accepted';
exception when check_violation then null;
end;
$$;
do $$
begin
  insert into public.schools (name, slug) values ('X', 'Bad Slug!');
  raise exception 'FAILED: invalid slug accepted';
exception when check_violation then null;
end;
$$;

-- ---------------------------------------------------------------------------
-- NFC credentials
-- ---------------------------------------------------------------------------
-- Same UID active twice in one school: rejected.
do $$
begin
  insert into public.nfc_credentials (school_id, student_id, uid_normalized)
  values ('0000000a-0000-0000-0000-000000000000', '0000000a-0000-0000-0002-000000000002', '04A22B1C9F5E80');
  raise exception 'FAILED: duplicate active UID accepted';
exception when unique_violation then null;
end;
$$;

-- Non-normalized UIDs are rejected.
do $$
begin
  insert into public.nfc_credentials (school_id, student_id, uid_normalized)
  values ('0000000a-0000-0000-0000-000000000000', '0000000a-0000-0000-0002-000000000002', '04:a2:2b:1c');
  raise exception 'FAILED: non-normalized UID accepted';
exception when check_violation then null;
end;
$$;

-- After revoking, the UID can be re-issued (lost card found / reassigned).
begin;
update public.nfc_credentials set status = 'revoked', revoked_at = now()
where id = '0000000a-0000-0000-0007-000000000001';
insert into public.nfc_credentials (school_id, student_id, uid_normalized)
values ('0000000a-0000-0000-0000-000000000000', '0000000a-0000-0000-0002-000000000002', '04A22B1C9F5E80');
rollback;

-- ---------------------------------------------------------------------------
-- Person <-> login linkage requires a matching membership.
-- ---------------------------------------------------------------------------
do $$
begin
  update public.students set user_id = '00000000-0000-0000-0000-00000000f001'
  where id = '0000000a-0000-0000-0002-000000000002';
  raise exception 'FAILED: student linked to an account without a student membership';
exception when foreign_key_violation then null;
end;
$$;
do $$
begin
  insert into public.teachers (school_id, user_id, first_name, last_name)
  values ('0000000a-0000-0000-0000-000000000000', '00000000-0000-0000-0000-00000000b002', 'Cross', 'School');
  raise exception 'FAILED: teacher row linked to another school''s teacher';
exception when foreign_key_violation then null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Attendance records: one per student per session; version bumps; audited.
-- ---------------------------------------------------------------------------
do $$
begin
  insert into public.attendance_records (school_id, class_session_id, student_id, status, source)
  values ('0000000a-0000-0000-0000-000000000000', '0000000a-0000-0000-0006-000000000001',
          '0000000a-0000-0000-0002-000000000001', 'late', 'nfc');
  raise exception 'FAILED: duplicate attendance record accepted';
exception when unique_violation then null;
end;
$$;

begin;
select set_config('app.audit_reason', 'Arrived with a note from the nurse', true);
select tests.login_as('00000000-0000-0000-0000-00000000a002');
update public.attendance_records set status = 'excused', source = 'manual', is_manual_override = true
where id = '0000000a-0000-0000-0009-000000000001';

select tests.assert_eq(
  (select version from public.attendance_records where id = '0000000a-0000-0000-0009-000000000001'),
  2, 'update bumps version');

select tests.assert_true(
  exists (
    select 1 from public.audit_logs
    where entity_type = 'attendance_records'
      and entity_id = '0000000a-0000-0000-0009-000000000001'
      and action = 'update'
      and actor_type = 'user'
      and actor_user_id = '00000000-0000-0000-0000-00000000a002'
      and before ->> 'status' = 'present'
      and after ->> 'status' = 'excused'
      and reason = 'Arrived with a note from the nurse'
  ),
  'attendance change is audited with actor, before/after and reason');
rollback;

-- Device-originated writes are attributed to the device.
begin;
select set_config('app.actor_device_id', d.id::text, true)
from public.devices d where d.school_id = '0000000a-0000-0000-0000-000000000000' and d.kind = 'simulator';
insert into public.attendance_records (school_id, class_session_id, student_id, status, source)
values ('0000000a-0000-0000-0000-000000000000', '0000000a-0000-0000-0006-000000000001',
        '0000000a-0000-0000-0002-000000000002', 'late', 'nfc');
select tests.assert_true(
  exists (
    select 1 from public.audit_logs
    where entity_type = 'attendance_records' and action = 'insert'
      and actor_type = 'device' and actor_device_id is not null and actor_user_id is null
      and after ->> 'student_id' = '0000000a-0000-0000-0002-000000000002'
  ),
  'device write is audited as actor_type=device');
rollback;

-- Secrets never reach the audit log.
select tests.assert_true(
  not exists (select 1 from public.audit_logs where entity_type = 'devices' and (after ? 'token_hash' or before ? 'token_hash')),
  'token_hash is stripped from audit entries');

-- ---------------------------------------------------------------------------
-- Append-only logs (even for privileged roles).
-- ---------------------------------------------------------------------------
do $$
begin
  update public.audit_logs set reason = 'tampered';
  raise exception 'FAILED: audit log updated';
exception when insufficient_privilege then null;
end;
$$;
do $$
begin
  delete from public.audit_logs;
  raise exception 'FAILED: audit log deleted';
exception when insufficient_privilege then null;
end;
$$;
do $$
begin
  update public.scan_events set outcome = 'duplicate';
  raise exception 'FAILED: scan event rewritten';
exception when insufficient_privilege then null;
end;
$$;
do $$
begin
  delete from public.scan_events;
  raise exception 'FAILED: scan event deleted';
exception when insufficient_privilege then null;
end;
$$;

-- Idempotency key is unique per device.
do $$
begin
  insert into public.scan_events (school_id, device_id, idempotency_key, uid_normalized, effective_at, outcome)
  select school_id, device_id, idempotency_key, uid_normalized, effective_at, outcome
  from public.scan_events where id = '0000000a-0000-0000-0008-000000000001';
  raise exception 'FAILED: duplicate idempotency key accepted';
exception when unique_violation then null;
end;
$$;

-- ---------------------------------------------------------------------------
-- Rules & schedules sanity checks.
-- ---------------------------------------------------------------------------
do $$
begin
  insert into public.attendance_rules (school_id, name, late_after_minutes, absent_after_minutes)
  values ('0000000a-0000-0000-0000-000000000000', 'Broken', 30, 10);
  raise exception 'FAILED: absent_after < late_after accepted';
exception when check_violation then null;
end;
$$;
do $$
begin
  insert into public.attendance_rules (school_id, name, is_default)
  values ('0000000a-0000-0000-0000-000000000000', 'Second default', true);
  raise exception 'FAILED: two default rules accepted';
exception when unique_violation then null;
end;
$$;
do $$
begin
  insert into public.class_schedules (school_id, class_section_id, weekday, start_time, end_time, valid_from)
  values ('0000000a-0000-0000-0000-000000000000', '0000000a-0000-0000-0004-000000000001', 8, '08:00', '09:00', current_date);
  raise exception 'FAILED: weekday 8 accepted';
exception when check_violation then null;
end;
$$;
