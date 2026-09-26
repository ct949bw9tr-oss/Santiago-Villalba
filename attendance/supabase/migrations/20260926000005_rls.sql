-- Row Level Security and table privileges.
--
-- Model:
--   * anon: no access to any table.
--   * authenticated: table privileges are granted explicitly below and every
--     row is then filtered by RLS policies built on the app.* helpers.
--   * service_role (server only): bypasses RLS; used by the scan ingestion
--     path and trusted jobs, where the tenant is derived from a verified
--     credential. Composite FKs still enforce same-school references.
--   * Tables with no grant for a command (e.g. INSERT on attendance_records)
--     can only be written through SECURITY DEFINER RPCs or the server.

-- ---------------------------------------------------------------------------
-- Class-scoped helpers
-- ---------------------------------------------------------------------------

-- The caller is an active teacher (active membership + active teacher row)
-- currently assigned to the class section.
create function app.teaches_class(p_class_section_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.class_teachers ct
    join public.teachers t on t.id = ct.teacher_id and t.school_id = ct.school_id
    join public.school_memberships m
      on m.school_id = t.school_id and m.user_id = t.user_id
     and m.role = 'teacher' and m.status = 'active'
    where ct.class_section_id = p_class_section_id
      and t.user_id = auth.uid()
      and t.status = 'active'
      and (ct.valid_from is null or ct.valid_from <= current_date)
      and (ct.valid_to is null or ct.valid_to >= current_date)
  );
$$;

create function app.teaches_session(p_class_session_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.class_sessions s
    where s.id = p_class_session_id and app.teaches_class(s.class_section_id)
  );
$$;

-- The student is (or was) enrolled in a class the caller teaches.
create function app.teaches_student(p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.enrollments e
    where e.student_id = p_student_id and app.teaches_class(e.class_section_id)
  );
$$;

-- Student rows linked to the caller's login (only via an active student membership).
create function app.is_my_student(p_student_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.students st
    join public.school_memberships m
      on m.school_id = st.school_id and m.user_id = st.user_id
     and m.role = 'student' and m.status = 'active'
    where st.id = p_student_id and st.user_id = auth.uid()
  );
$$;

create function app.is_enrolled_in(p_class_section_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.enrollments e
    where e.class_section_id = p_class_section_id and app.is_my_student(e.student_id)
  );
$$;

create function app.can_view_class(p_class_section_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.class_sections c
    where c.id = p_class_section_id
      and (app.is_admin(c.school_id)
           or app.teaches_class(c.id)
           or app.is_enrolled_in(c.id))
  );
$$;

-- Admins of any school the profile belongs to may see that profile.
create function app.can_view_profile(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_profile_id = auth.uid()
      or app.is_platform_admin()
      or exists (
        select 1 from public.school_memberships m
        where m.user_id = p_profile_id and app.is_admin(m.school_id)
      );
$$;

revoke all on all functions in schema app from public;
grant execute on function
  app.is_platform_admin(),
  app.has_role(uuid, public.membership_role),
  app.is_member(uuid),
  app.is_admin(uuid),
  app.is_valid_timezone(text),
  app.teaches_class(uuid),
  app.teaches_session(uuid),
  app.teaches_student(uuid),
  app.is_my_student(uuid),
  app.is_enrolled_in(uuid),
  app.can_view_class(uuid),
  app.can_view_profile(uuid)
to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Privileges: start from nothing, then grant what each role needs.
-- ---------------------------------------------------------------------------
revoke all on all tables in schema public from anon, authenticated;
grant all on all tables in schema public to service_role;

grant select on public.schools to authenticated;
grant update (name, timezone, locale, settings) on public.schools to authenticated;

grant select on public.profiles to authenticated;
grant update (full_name) on public.profiles to authenticated;

grant select, delete on public.school_memberships to authenticated;
grant update (status) on public.school_memberships to authenticated;

grant select, insert, update, delete on
  public.students,
  public.teachers,
  public.attendance_rules,
  public.academic_terms,
  public.courses,
  public.class_sections,
  public.class_teachers,
  public.enrollments,
  public.class_schedules,
  public.class_sessions,
  public.nfc_credentials
to authenticated;

-- Devices: token_hash is never readable or writable by API users.
grant select (id, school_id, name, kind, status, location, room, class_section_id,
              token_last4, last_seen_at, metadata, created_at, updated_at)
  on public.devices to authenticated;
grant insert (school_id, name, location, room, class_section_id, metadata) on public.devices to authenticated;
grant update (name, status, location, room, class_section_id, metadata) on public.devices to authenticated;

-- Read-only for API users; written by the server / RPCs only.
grant select on public.attendance_records, public.scan_events, public.audit_logs to authenticated;

-- ---------------------------------------------------------------------------
-- Enable RLS everywhere
-- ---------------------------------------------------------------------------
alter table public.schools             enable row level security;
alter table public.profiles            enable row level security;
alter table public.school_memberships  enable row level security;
alter table public.students            enable row level security;
alter table public.teachers            enable row level security;
alter table public.attendance_rules    enable row level security;
alter table public.academic_terms      enable row level security;
alter table public.courses             enable row level security;
alter table public.class_sections      enable row level security;
alter table public.class_teachers      enable row level security;
alter table public.enrollments         enable row level security;
alter table public.class_schedules     enable row level security;
alter table public.class_sessions      enable row level security;
alter table public.devices             enable row level security;
alter table public.nfc_credentials     enable row level security;
alter table public.attendance_records  enable row level security;
alter table public.scan_events         enable row level security;
alter table public.audit_logs          enable row level security;

-- ---------------------------------------------------------------------------
-- Tenancy
-- ---------------------------------------------------------------------------
create policy schools_select on public.schools for select to authenticated
  using (app.is_member(id) or app.is_platform_admin());
create policy schools_update on public.schools for update to authenticated
  using (app.is_admin(id)) with check (app.is_admin(id));

create policy profiles_select on public.profiles for select to authenticated
  using (app.can_view_profile(id));
create policy profiles_update_self on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

create policy memberships_select on public.school_memberships for select to authenticated
  using (user_id = auth.uid() or app.is_admin(school_id));
create policy memberships_update on public.school_memberships for update to authenticated
  using (app.is_admin(school_id) and user_id <> auth.uid())
  with check (app.is_admin(school_id) and user_id <> auth.uid());
create policy memberships_delete on public.school_memberships for delete to authenticated
  using (app.is_admin(school_id) and user_id <> auth.uid());

-- ---------------------------------------------------------------------------
-- Admin-managed tables: admins have full CRUD within their school.
-- ---------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'students', 'teachers', 'attendance_rules', 'academic_terms', 'courses',
    'class_sections', 'class_teachers', 'enrollments', 'class_schedules',
    'class_sessions', 'devices', 'nfc_credentials'
  ] loop
    execute format(
      'create policy %1$s_admin_all on public.%1$I for all to authenticated
         using (app.is_admin(school_id)) with check (app.is_admin(school_id))', t);
  end loop;
end;
$$;

-- ---------------------------------------------------------------------------
-- Read access for teachers and students
-- ---------------------------------------------------------------------------
create policy students_select_teacher on public.students for select to authenticated
  using (app.teaches_student(id));
create policy students_select_self on public.students for select to authenticated
  using (app.is_my_student(id));

create policy teachers_select_member on public.teachers for select to authenticated
  using (app.is_member(school_id));

create policy attendance_rules_select_member on public.attendance_rules for select to authenticated
  using (app.is_member(school_id));
create policy academic_terms_select_member on public.academic_terms for select to authenticated
  using (app.is_member(school_id));
create policy courses_select_member on public.courses for select to authenticated
  using (app.is_member(school_id));

create policy class_sections_select on public.class_sections for select to authenticated
  using (app.teaches_class(id) or app.is_enrolled_in(id));
create policy class_teachers_select on public.class_teachers for select to authenticated
  using (app.can_view_class(class_section_id));
create policy class_schedules_select on public.class_schedules for select to authenticated
  using (app.can_view_class(class_section_id));
create policy class_sessions_select on public.class_sessions for select to authenticated
  using (app.can_view_class(class_section_id));

create policy enrollments_select_teacher on public.enrollments for select to authenticated
  using (app.teaches_class(class_section_id));
create policy enrollments_select_self on public.enrollments for select to authenticated
  using (app.is_my_student(student_id));

-- ---------------------------------------------------------------------------
-- Attendance data (read-only for API users)
-- ---------------------------------------------------------------------------
create policy attendance_records_select on public.attendance_records for select to authenticated
  using (
    app.is_admin(school_id)
    or app.teaches_session(class_session_id)
    or app.is_my_student(student_id)
  );

create policy scan_events_select on public.scan_events for select to authenticated
  using (
    app.is_admin(school_id)
    or (class_session_id is not null and app.teaches_session(class_session_id))
  );

create policy audit_logs_select on public.audit_logs for select to authenticated
  using (app.is_admin(school_id));
