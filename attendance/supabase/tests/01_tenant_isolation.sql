-- Tenant isolation: nobody can read or write another school's rows.

-- Counts rows belonging to p_school_id in every tenant table, as the CURRENT
-- role (so RLS applies). Returns the tables where any row was visible.
create function tests.visible_tables_for_school(p_school_id uuid)
returns text[]
language plpgsql
as $$
declare
  t text;
  n bigint;
  leaked text[] := '{}';
begin
  foreach t in array array[
    'school_memberships', 'students', 'teachers', 'attendance_rules', 'academic_terms',
    'courses', 'class_sections', 'class_teachers', 'enrollments', 'class_schedules',
    'class_sessions', 'nfc_credentials', 'attendance_records', 'scan_events', 'audit_logs'
  ] loop
    execute format('select count(*) from public.%I where school_id = $1', t) into n using p_school_id;
    if n > 0 then
      leaked := leaked || t;
    end if;
  end loop;
  -- devices: token_hash is not selectable, so count via a permitted column.
  select count(id) into n from public.devices where school_id = p_school_id;
  if n > 0 then leaked := leaked || 'devices'::text; end if;
  select count(*) into n from public.schools where id = p_school_id;
  if n > 0 then leaked := leaked || 'schools'::text; end if;
  return leaked;
end;
$$;
grant execute on function tests.visible_tables_for_school(uuid) to authenticated, anon;

-- ---------------------------------------------------------------------------
-- Every School A user sees nothing of School B, and vice versa.
-- ---------------------------------------------------------------------------
do $$
declare
  u record;
  leaked text[];
begin
  for u in
    select * from (values
      ('00000000-0000-0000-0000-00000000a001'::uuid, '0000000b-0000-0000-0000-000000000000'::uuid, 'admin A'),
      ('00000000-0000-0000-0000-00000000a002', '0000000b-0000-0000-0000-000000000000', 'teacher A'),
      ('00000000-0000-0000-0000-00000000a003', '0000000b-0000-0000-0000-000000000000', 'idle teacher A'),
      ('00000000-0000-0000-0000-00000000a004', '0000000b-0000-0000-0000-000000000000', 'student A'),
      ('00000000-0000-0000-0000-00000000b001', '0000000a-0000-0000-0000-000000000000', 'admin B'),
      ('00000000-0000-0000-0000-00000000b002', '0000000a-0000-0000-0000-000000000000', 'teacher B'),
      ('00000000-0000-0000-0000-00000000f001', '0000000a-0000-0000-0000-000000000000', 'outsider (A)'),
      ('00000000-0000-0000-0000-00000000f001', '0000000b-0000-0000-0000-000000000000', 'outsider (B)')
    ) as v(user_id, other_school, label)
  loop
    perform tests.login_as(u.user_id);
    set local role authenticated;
    leaked := tests.visible_tables_for_school(u.other_school);
    reset role;
    perform tests.assert_eq(leaked, '{}'::text[], u.label || ' must not see foreign school rows');
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Admin A cannot write into School B.
-- ---------------------------------------------------------------------------
begin;
select tests.login_as('00000000-0000-0000-0000-00000000a001');
set local role authenticated;

do $$
begin
  insert into public.students (school_id, student_number, first_name, last_name)
  values ('0000000b-0000-0000-0000-000000000000', 'X-1', 'Evil', 'Insert');
  raise exception 'FAILED: admin A inserted a student into school B';
exception when insufficient_privilege then null;
end;
$$;

do $$
declare n int;
begin
  update public.students set first_name = 'Hacked'
  where school_id = '0000000b-0000-0000-0000-000000000000';
  get diagnostics n = row_count;
  perform tests.assert_eq(n, 0, 'admin A updates 0 school B students');

  delete from public.class_sections where school_id = '0000000b-0000-0000-0000-000000000000';
  get diagnostics n = row_count;
  perform tests.assert_eq(n, 0, 'admin A deletes 0 school B classes');

  update public.schools set name = 'Hacked' where id = '0000000b-0000-0000-0000-000000000000';
  get diagnostics n = row_count;
  perform tests.assert_eq(n, 0, 'admin A cannot rename school B');
end;
$$;

-- Moving an own row into another school is rejected by WITH CHECK.
do $$
begin
  update public.courses set school_id = '0000000b-0000-0000-0000-000000000000'
  where id = '0000000a-0000-0000-0003-000000000001';
  raise exception 'FAILED: admin A moved a course into school B';
exception when insufficient_privilege then null;
end;
$$;

-- Within its own school, linking to a foreign student is rejected by the composite FK.
do $$
begin
  insert into public.enrollments (school_id, class_section_id, student_id)
  values ('0000000a-0000-0000-0000-000000000000', '0000000a-0000-0000-0004-000000000001',
          '0000000b-0000-0000-0002-000000000001');
  raise exception 'FAILED: cross-school enrollment accepted';
exception when foreign_key_violation then null;
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- Composite FKs hold even for privileged (RLS-bypassing) writers.
-- ---------------------------------------------------------------------------
begin;
set local role service_role;
do $$
begin
  insert into public.attendance_records (school_id, class_session_id, student_id, status, source)
  values ('0000000a-0000-0000-0000-000000000000', '0000000a-0000-0000-0006-000000000001',
          '0000000b-0000-0000-0002-000000000001', 'present', 'nfc');
  raise exception 'FAILED: service role recorded a school B student in a school A session';
exception when foreign_key_violation then null;
end;
$$;

do $$
begin
  insert into public.nfc_credentials (school_id, student_id, uid_normalized)
  values ('0000000a-0000-0000-0000-000000000000', '0000000b-0000-0000-0002-000000000001', 'AABBCCDD');
  raise exception 'FAILED: credential linked to a foreign student';
exception when foreign_key_violation then null;
end;
$$;
rollback;

-- ---------------------------------------------------------------------------
-- anon has no table access at all.
-- ---------------------------------------------------------------------------
begin;
set local role anon;
do $$
begin
  perform count(*) from public.students;
  raise exception 'FAILED: anon can read students';
exception when insufficient_privilege then null;
end;
$$;
do $$
begin
  perform count(*) from public.schools;
  raise exception 'FAILED: anon can read schools';
exception when insufficient_privilege then null;
end;
$$;
rollback;
