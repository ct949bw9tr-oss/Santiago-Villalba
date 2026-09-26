-- Phase 5: attendance reports.
--
-- Both functions run with the CALLER's rights (security invoker), so Row Level
-- Security decides what is counted: admins see their whole school, teachers
-- only their classes, other schools nothing. Dates are school-local.
--
-- Attendance rate = (present + late) / (present + late + absent); excused
-- sessions are left out of the rate. Keep this file pure ASCII.

create function public.attendance_summary_by_student(
  p_school_id uuid,
  p_from date,
  p_to date,
  p_class_section_id uuid default null
)
returns table (
  student_id uuid,
  student_number text,
  first_name text,
  last_name text,
  present bigint,
  late bigint,
  absent bigint,
  excused bigint,
  total bigint,
  attendance_rate numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    st.id,
    st.student_number,
    st.first_name,
    st.last_name,
    count(*) filter (where ar.status = 'present'),
    count(*) filter (where ar.status = 'late'),
    count(*) filter (where ar.status = 'absent'),
    count(*) filter (where ar.status = 'excused'),
    count(*),
    round(
      100.0 * count(*) filter (where ar.status in ('present', 'late'))
      / nullif(count(*) filter (where ar.status in ('present', 'late', 'absent')), 0),
      1)
  from public.attendance_records ar
  join public.class_sessions cs on cs.id = ar.class_session_id
  join public.students st on st.id = ar.student_id
  join public.schools s on s.id = ar.school_id
  where ar.school_id = p_school_id
    and (cs.starts_at at time zone s.timezone)::date between p_from and p_to
    and (p_class_section_id is null or cs.class_section_id = p_class_section_id)
  group by st.id, st.student_number, st.first_name, st.last_name
  order by st.last_name, st.first_name;
$$;

create function public.attendance_summary_by_class(
  p_school_id uuid,
  p_from date,
  p_to date
)
returns table (
  class_section_id uuid,
  class_name text,
  sessions bigint,
  present bigint,
  late bigint,
  absent bigint,
  excused bigint,
  attendance_rate numeric
)
language sql
stable
security invoker
set search_path = ''
as $$
  select
    c.id,
    c.name,
    count(distinct ar.class_session_id),
    count(*) filter (where ar.status = 'present'),
    count(*) filter (where ar.status = 'late'),
    count(*) filter (where ar.status = 'absent'),
    count(*) filter (where ar.status = 'excused'),
    round(
      100.0 * count(*) filter (where ar.status in ('present', 'late'))
      / nullif(count(*) filter (where ar.status in ('present', 'late', 'absent')), 0),
      1)
  from public.attendance_records ar
  join public.class_sessions cs on cs.id = ar.class_session_id
  join public.class_sections c on c.id = cs.class_section_id
  join public.schools s on s.id = ar.school_id
  where ar.school_id = p_school_id
    and (cs.starts_at at time zone s.timezone)::date between p_from and p_to
  group by c.id, c.name
  order by c.name;
$$;

revoke all on function public.attendance_summary_by_student(uuid, date, date, uuid) from public, anon;
revoke all on function public.attendance_summary_by_class(uuid, date, date) from public, anon;
grant execute on function public.attendance_summary_by_student(uuid, date, date, uuid) to authenticated, service_role;
grant execute on function public.attendance_summary_by_class(uuid, date, date) to authenticated, service_role;
