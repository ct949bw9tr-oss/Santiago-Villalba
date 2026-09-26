-- Role-based access inside one school.

-- ---------------------------------------------------------------------------
-- School admin
-- ---------------------------------------------------------------------------
begin;
select tests.login_as('00000000-0000-0000-0000-00000000a001');
set local role authenticated;

select tests.assert_eq((select count(*) from public.students), 3::bigint, 'admin sees all school students');
select tests.assert_eq((select count(*) from public.teachers), 2::bigint, 'admin sees all teachers');
select tests.assert_eq((select count(*) from public.class_sections), 2::bigint, 'admin sees all classes');
select tests.assert_eq((select count(*) from public.attendance_records), 2::bigint, 'admin sees all records');
select tests.assert_eq((select count(*) from public.nfc_credentials), 1::bigint, 'admin sees credentials');
select tests.assert_eq((select count(*) from public.school_memberships), 4::bigint, 'admin sees memberships');
select tests.assert_eq((select count(*) from public.profiles), 4::bigint, 'admin sees profiles of own school members');
select tests.assert_true((select count(*) > 0 from public.audit_logs), 'admin sees audit log');

-- Admin can manage own-school data.
insert into public.students (school_id, student_number, first_name, last_name)
values ('0000000a-0000-0000-0000-000000000000', 'A-100', 'New', 'Kid');
select tests.assert_eq((select count(*) from public.students), 4::bigint, 'admin can add a student');

-- ...but cannot write attendance or scans directly.
do $$
begin
  insert into public.attendance_records (school_id, class_session_id, student_id, status, source)
  values ('0000000a-0000-0000-0000-000000000000', '0000000a-0000-0000-0006-000000000001',
          '0000000a-0000-0000-0002-000000000002', 'present', 'manual');
  raise exception 'FAILED: admin inserted an attendance record directly';
exception when insufficient_privilege then null;
end;
$$;

do $$
begin
  update public.attendance_records set status = 'excused';
  raise exception 'FAILED: admin updated attendance directly';
exception when insufficient_privilege then null;
end;
$$;

do $$
begin
  delete from public.audit_logs;
  raise exception 'FAILED: admin deleted audit logs';
exception when insufficient_privilege then null;
end;
$$;

-- Device secrets are never readable, and simulator devices cannot be created via the API.
do $$
begin
  perform token_hash from public.devices;
  raise exception 'FAILED: admin read devices.token_hash';
exception when insufficient_privilege then null;
end;
$$;

do $$
begin
  insert into public.devices (school_id, name, kind)
  values ('0000000a-0000-0000-0000-000000000000', 'Fake sim', 'simulator');
  raise exception 'FAILED: admin created a simulator device';
exception when insufficient_privilege then null;
end;
$$;

-- No privilege escalation through memberships or profiles.
do $$
begin
  insert into public.school_memberships (school_id, user_id, role)
  values ('0000000a-0000-0000-0000-000000000000', '00000000-0000-0000-0000-00000000f001', 'school_admin');
  raise exception 'FAILED: admin inserted a membership directly (must go through the server invite flow)';
exception when insufficient_privilege then null;
end;
$$;

do $$
begin
  update public.school_memberships set role = 'school_admin'
  where user_id = '00000000-0000-0000-0000-00000000a002';
  raise exception 'FAILED: membership role is updatable';
exception when insufficient_privilege then null;
end;
$$;

do $$
begin
  update public.profiles set is_platform_admin = true where id = auth.uid();
  raise exception 'FAILED: user made themselves platform admin';
exception when insufficient_privilege then null;
end;
$$;

-- Admin cannot disable their own membership (lock-out protection).
do $$
declare n int;
begin
  update public.school_memberships set status = 'disabled' where user_id = auth.uid();
  get diagnostics n = row_count;
  perform tests.assert_eq(n, 0, 'admin cannot disable own membership');
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- Teacher assigned to Math 7A
-- ---------------------------------------------------------------------------
begin;
select tests.login_as('00000000-0000-0000-0000-00000000a002');
set local role authenticated;

select tests.assert_eq((select count(*) from public.schools), 1::bigint, 'teacher sees own school');
select tests.assert_eq((select array_agg(name) from public.class_sections), array['Math 7A'], 'teacher sees only own class');
select tests.assert_eq((select count(*) from public.students), 2::bigint, 'teacher sees only enrolled students');
select tests.assert_eq((select count(*) from public.enrollments), 2::bigint, 'teacher sees own class enrollments');
select tests.assert_eq((select count(*) from public.class_sessions), 1::bigint, 'teacher sees own sessions');
select tests.assert_eq((select count(*) from public.attendance_records), 1::bigint, 'teacher sees own class records');
select tests.assert_eq((select count(*) from public.scan_events), 1::bigint, 'teacher sees scans for own sessions');
select tests.assert_eq((select count(*) from public.nfc_credentials), 0::bigint, 'teacher cannot see credentials');
select tests.assert_eq((select count(id) from public.devices), 0::bigint, 'teacher cannot see devices');
select tests.assert_eq((select count(*) from public.audit_logs), 0::bigint, 'teacher cannot see audit log');
select tests.assert_eq((select count(*) from public.school_memberships), 1::bigint, 'teacher sees only own membership');
select tests.assert_eq((select count(*) from public.profiles), 1::bigint, 'teacher sees only own profile');

do $$
begin
  insert into public.students (school_id, student_number, first_name, last_name)
  values ('0000000a-0000-0000-0000-000000000000', 'T-1', 'Not', 'Allowed');
  raise exception 'FAILED: teacher created a student';
exception when insufficient_privilege then null;
end;
$$;

do $$
declare n int;
begin
  update public.class_sessions set status = 'cancelled';
  get diagnostics n = row_count;
  perform tests.assert_eq(n, 0, 'teacher cannot modify sessions directly');
end;
$$;
rollback;

-- A disabled teacher membership immediately removes access.
begin;
update public.school_memberships set status = 'disabled'
where user_id = '00000000-0000-0000-0000-00000000a002';
select tests.login_as('00000000-0000-0000-0000-00000000a002');
set local role authenticated;
select tests.assert_eq((select count(*) from public.schools), 0::bigint, 'disabled teacher sees no school');
select tests.assert_eq((select count(*) from public.class_sections), 0::bigint, 'disabled teacher sees no classes');
select tests.assert_eq((select count(*) from public.students), 0::bigint, 'disabled teacher sees no students');
rollback;

-- A substitute assignment outside its dates grants nothing.
begin;
update public.class_teachers set role = 'substitute', valid_from = current_date - 10, valid_to = current_date - 1
where teacher_id = '0000000a-0000-0000-0001-000000000001';
select tests.login_as('00000000-0000-0000-0000-00000000a002');
set local role authenticated;
select tests.assert_eq((select count(*) from public.class_sections), 0::bigint, 'expired substitute sees no classes');
rollback;

-- ---------------------------------------------------------------------------
-- Teacher with no class assignments
-- ---------------------------------------------------------------------------
begin;
select tests.login_as('00000000-0000-0000-0000-00000000a003');
set local role authenticated;
select tests.assert_eq((select count(*) from public.class_sections), 0::bigint, 'unassigned teacher sees no classes');
select tests.assert_eq((select count(*) from public.students), 0::bigint, 'unassigned teacher sees no students');
select tests.assert_eq((select count(*) from public.attendance_records), 0::bigint, 'unassigned teacher sees no records');
rollback;

-- ---------------------------------------------------------------------------
-- Student with a login
-- ---------------------------------------------------------------------------
begin;
select tests.login_as('00000000-0000-0000-0000-00000000a004');
set local role authenticated;
select tests.assert_eq((select array_agg(student_number) from public.students), array['A-001'], 'student sees only self');
select tests.assert_eq((select count(*) from public.class_sections), 1::bigint, 'student sees own class');
select tests.assert_eq((select count(*) from public.enrollments), 1::bigint, 'student sees own enrollment');
select tests.assert_eq((select count(*) from public.attendance_records), 1::bigint, 'student sees own record');
select tests.assert_eq((select count(*) from public.scan_events), 0::bigint, 'student cannot see scan log');
select tests.assert_eq((select count(*) from public.nfc_credentials), 0::bigint, 'student cannot see credentials');
rollback;

-- ---------------------------------------------------------------------------
-- Account with no membership
-- ---------------------------------------------------------------------------
begin;
select tests.login_as('00000000-0000-0000-0000-00000000f001');
set local role authenticated;
select tests.assert_eq((select count(*) from public.schools), 0::bigint, 'outsider sees no schools');
select tests.assert_eq((select count(*) from public.students), 0::bigint, 'outsider sees no students');
select tests.assert_eq((select count(*) from public.profiles), 1::bigint, 'outsider sees only own profile');
rollback;
