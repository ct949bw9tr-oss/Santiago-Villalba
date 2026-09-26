-- Phase 4: manual attendance corrections by teachers (and admins), the
-- teacher's view of the audit trail, and live updates.
--
-- Keep this file pure ASCII (it is pasted into the SQL Editor from tablets).

-- ---------------------------------------------------------------------------
-- correct_attendance: set a student's status for a session by hand.
--   * Allowed for teachers of the class and admins of the school.
--   * A reason is mandatory; it is stored on the record and in the audit log.
--   * The record becomes a manual override: later card taps never change it.
--   * p_expected_version (optional) rejects the change if someone else edited
--     the record since the caller loaded it (optimistic locking).
-- ---------------------------------------------------------------------------
create function public.correct_attendance(
  p_session_id uuid,
  p_student_id uuid,
  p_status public.attendance_status,
  p_reason text,
  p_expected_version integer default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_session public.class_sessions%rowtype;
  v_day date;
  v_reason text := btrim(coalesce(p_reason, ''));
  v_record public.attendance_records%rowtype;
begin
  select * into v_session from public.class_sessions where id = p_session_id;
  if not found or not (app.teaches_session(p_session_id) or app.is_admin(v_session.school_id)) then
    raise exception 'not allowed to change attendance for this class' using errcode = 'insufficient_privilege';
  end if;

  if length(v_reason) < 3 or length(v_reason) > 500 then
    raise exception 'a reason of 3 to 500 characters is required' using errcode = 'check_violation';
  end if;

  select (v_session.starts_at at time zone s.timezone)::date into v_day
  from public.schools s where s.id = v_session.school_id;

  -- Serialize with card taps for the same student and session.
  perform pg_advisory_xact_lock(hashtextextended(p_session_id::text || '|' || p_student_id::text, 1));

  select * into v_record from public.attendance_records
  where class_session_id = p_session_id and student_id = p_student_id
  for update;

  if not found and not app.enrolled_on(p_student_id, v_session.class_section_id, v_day) then
    raise exception 'student is not enrolled in this class on that date' using errcode = 'foreign_key_violation';
  end if;

  if found and p_expected_version is not null and v_record.version <> p_expected_version then
    -- PT409 makes PostgREST answer HTTP 409. (Not 40001: PostgREST retries
    -- serialization failures, which would loop forever on a stale version.)
    raise exception 'record was changed by someone else' using errcode = 'PT409';
  end if;

  perform set_config('app.audit_reason', v_reason, true);

  if v_record.id is null then
    insert into public.attendance_records (
      school_id, class_session_id, student_id, status, source, is_manual_override, note, updated_by
    ) values (
      v_session.school_id, p_session_id, p_student_id, p_status, 'manual', true, v_reason, auth.uid()
    )
    returning * into v_record;
  else
    update public.attendance_records
    set status = p_status, source = 'manual', is_manual_override = true, note = v_reason, updated_by = auth.uid()
    where id = v_record.id
    returning * into v_record;
  end if;

  return jsonb_build_object('record_id', v_record.id, 'status', v_record.status, 'version', v_record.version);
end;
$$;

revoke all on function public.correct_attendance(uuid, uuid, public.attendance_status, text, integer) from public, anon;
grant execute on function public.correct_attendance(uuid, uuid, public.attendance_status, text, integer)
  to authenticated, service_role;

-- ---------------------------------------------------------------------------
-- Teachers may read the audit trail of attendance records in their classes.
-- ---------------------------------------------------------------------------
create function app.can_view_record_audit(p_record_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.attendance_records ar
    where ar.id = p_record_id and app.teaches_session(ar.class_session_id)
  );
$$;

revoke all on function app.can_view_record_audit(uuid) from public;
grant execute on function app.can_view_record_audit(uuid) to authenticated, service_role;

create policy audit_logs_select_teacher on public.audit_logs for select to authenticated
  using (entity_type = 'attendance_records' and app.can_view_record_audit(entity_id));

-- ---------------------------------------------------------------------------
-- Live updates: stream attendance_records changes over Supabase Realtime
-- (RLS applies to subscribers). Skipped where the publication doesn't exist.
-- ---------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'attendance_records'
     ) then
    alter publication supabase_realtime add table public.attendance_records;
  end if;
exception when others then
  raise notice 'realtime publication not updated: %', sqlerrm;
end;
$$;
