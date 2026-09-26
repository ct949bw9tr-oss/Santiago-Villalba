-- Re-creates public.process_scan from migration 8 with an ASCII-only source.
-- Databases set up by pasting SQL through tools that re-encode UTF-8 could end
-- up with a garbled em dash in scan messages; this replaces the function body.
-- Privileges are kept by CREATE OR REPLACE.

create or replace function public.process_scan(
  p_device_id uuid,
  p_uid text,
  p_idempotency_key text,
  p_effective_at timestamptz,
  p_device_scanned_at timestamptz default null,
  p_request_id text default null,
  p_detail text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid text := upper(regexp_replace(coalesce(p_uid, ''), '[\s:.-]', '', 'g'));
  v_device public.devices%rowtype;
  v_school public.schools%rowtype;
  v_existing public.scan_events%rowtype;
  v_default_rule public.attendance_rules%rowtype;
  v_credential_id uuid;
  v_student public.students%rowtype;
  v_student_found boolean := false;
  v_session_id uuid;
  v_session_starts timestamptz;
  v_class_name text;
  v_next_starts timestamptz;
  v_next_class text;
  v_rule jsonb;
  v_day date;
  v_delta_min numeric;
  v_status public.attendance_status;
  v_outcome public.scan_outcome;
  v_detail text := p_detail;
  v_record public.attendance_records%rowtype;
  v_record_found boolean := false;
  v_scan_id uuid;
  v_feedback text;
  v_message text;
  v_response jsonb;
  v_dash constant text := ' ' || chr(8212) || ' ';  -- em dash, kept ASCII-only in source
begin
  -- Idempotency: one result per (device, key), even under concurrent retries.
  perform pg_advisory_xact_lock(hashtextextended(p_device_id::text || '|' || p_idempotency_key, 0));
  select * into v_existing
  from public.scan_events
  where device_id = p_device_id and idempotency_key = p_idempotency_key;
  if found then
    if v_existing.uid_normalized <> v_uid then
      return jsonb_build_object('error', 'idempotency_conflict');
    end if;
    return v_existing.response || jsonb_build_object('replayed', true);
  end if;

  select * into v_device from public.devices where id = p_device_id;
  if not found then
    raise exception 'unknown device %', p_device_id using errcode = 'no_data_found';
  end if;
  select * into v_school from public.schools where id = v_device.school_id;
  select * into v_default_rule from public.attendance_rules where school_id = v_school.id and is_default;
  v_day := (p_effective_at at time zone v_school.timezone)::date;

  -- Attribute every write in this transaction to the device (audit trigger).
  perform set_config('app.actor_type', 'device', true);
  perform set_config('app.actor_device_id', p_device_id::text, true);
  perform set_config('app.request_id', coalesce(p_request_id, ''), true);

  -- 1. Device / school state
  if v_device.status <> 'active' then
    v_outcome := 'device_disabled';
  elsif v_school.status <> 'active' then
    v_outcome := 'school_suspended';
  elsif v_uid !~ '^([0-9A-F]{8}|[0-9A-F]{14}|[0-9A-F]{20})$' then
    v_outcome := 'unknown_credential';
    v_detail := coalesce(v_detail, 'malformed uid');
  end if;

  -- 2. Identify the student. The credential must belong to the DEVICE's
  --    school, so a card from another school is simply unknown here.
  if v_outcome is null then
    select c.id into v_credential_id
    from public.nfc_credentials c
    where c.school_id = v_school.id and c.uid_normalized = v_uid and c.status = 'active';

    if v_credential_id is null then
      v_outcome := case
        when exists (select 1 from public.nfc_credentials c where c.school_id = v_school.id and c.uid_normalized = v_uid)
          then 'inactive_credential'::public.scan_outcome
        else 'unknown_credential'::public.scan_outcome
      end;
    else
      select s.* into v_student
      from public.students s
      join public.nfc_credentials c on c.student_id = s.id
      where c.id = v_credential_id;
      v_student_found := true;
      if v_student.status <> 'active' then
        v_outcome := 'inactive_student';
      end if;
    end if;
  end if;

  -- 3. Debounce: the same card on the same reader within the window is a repeat.
  if v_outcome is null and exists (
    select 1 from public.scan_events se
    where se.device_id = p_device_id
      and se.uid_normalized = v_uid
      and se.outcome in ('recorded', 'duplicate')
      and se.received_at > now() - make_interval(secs => v_default_rule.duplicate_window_seconds)
  ) then
    select ar.* into v_record
    from public.scan_events se
    join public.attendance_records ar on ar.id = se.attendance_record_id
    where se.device_id = p_device_id and se.uid_normalized = v_uid
    order by se.received_at desc
    limit 1;
    v_record_found := found;
    v_outcome := 'duplicate';
    v_detail := coalesce(v_detail, 'repeated tap');
    if v_record_found then
      select cs.id, c.name into v_session_id, v_class_name
      from public.class_sessions cs join public.class_sections c on c.id = cs.class_section_id
      where cs.id = v_record.class_session_id;
    end if;
  end if;

  -- 4. Which session should the student be in right now?
  if v_outcome is null then
    select cs.id, cs.starts_at, c.name, app.session_rule(cs.id)
    into v_session_id, v_session_starts, v_class_name, v_rule
    from public.class_sessions cs
    join public.class_sections c on c.id = cs.class_section_id and c.status = 'active'
    where cs.school_id = v_school.id
      and cs.status = 'scheduled'
      and (v_device.class_section_id is null or cs.class_section_id = v_device.class_section_id)
      and app.enrolled_on(v_student.id, cs.class_section_id, (cs.starts_at at time zone v_school.timezone)::date)
      and p_effective_at >= cs.starts_at - make_interval(mins => (app.session_rule(cs.id) ->> 'early_checkin_minutes')::int)
      and p_effective_at <= greatest(cs.ends_at, cs.starts_at + make_interval(mins => (app.session_rule(cs.id) ->> 'absent_after_minutes')::int))
    order by
      exists (                                                  -- sessions not already attended first
        select 1 from public.attendance_records ar
        where ar.class_session_id = cs.id and ar.student_id = v_student.id and ar.source <> 'system'
      ),
      (p_effective_at >= cs.ends_at),                           -- then sessions still running
      abs(extract(epoch from (cs.starts_at - p_effective_at))), -- then the nearest start
      cs.id
    limit 1;

    if v_session_id is null then
      if v_device.class_section_id is not null and exists (
        select 1 from public.class_sessions cs
        where cs.class_section_id = v_device.class_section_id and cs.status = 'scheduled'
          and p_effective_at between cs.starts_at - interval '1 hour' and cs.ends_at
      ) then
        v_outcome := 'not_enrolled';
        select c.name into v_detail from public.class_sections c where c.id = v_device.class_section_id;
      else
        -- A class of theirs later today -> too early; otherwise nothing now.
        select cs.starts_at, c.name into v_next_starts, v_next_class
        from public.class_sessions cs
        join public.class_sections c on c.id = cs.class_section_id and c.status = 'active'
        where cs.school_id = v_school.id and cs.status = 'scheduled'
          and cs.starts_at > p_effective_at
          and (cs.starts_at at time zone v_school.timezone)::date = v_day
          and (v_device.class_section_id is null or cs.class_section_id = v_device.class_section_id)
          and app.enrolled_on(v_student.id, cs.class_section_id, v_day)
        order by cs.starts_at
        limit 1;
        v_outcome := case when v_next_starts is not null then 'too_early'::public.scan_outcome else 'no_active_session'::public.scan_outcome end;
      end if;
    end if;
  end if;

  -- 5. Classify against the session's rule.
  if v_outcome is null then
    v_delta_min := extract(epoch from (p_effective_at - v_session_starts)) / 60.0;
    if v_delta_min <= (v_rule ->> 'late_after_minutes')::int then
      v_status := 'present';
    elsif v_delta_min <= (v_rule ->> 'absent_after_minutes')::int then
      v_status := 'late';
    else
      case v_rule ->> 'scan_after_cutoff'
        when 'late' then v_status := 'late';
        when 'absent' then v_status := 'absent'; v_outcome := 'after_cutoff';
        else v_outcome := 'after_cutoff'; -- reject: logged, no record
      end case;
    end if;

    -- Freeze the rule for this session on its first scan.
    update public.class_sessions set rule_snapshot = v_rule where id = v_session_id and rule_snapshot is null;
  end if;

  -- 6. One record per student per session (serialized per pair).
  if v_status is not null then
    perform pg_advisory_xact_lock(hashtextextended(v_session_id::text || '|' || v_student.id::text, 1));
    select * into v_record from public.attendance_records
    where class_session_id = v_session_id and student_id = v_student.id;
    v_record_found := found;

    if v_record_found then
      if not v_record.is_manual_override and v_record.status = 'absent' and v_record.source = 'system'
         and v_status in ('present', 'late') then
        v_outcome := 'recorded';       -- arrived after the absence was auto-marked
        v_detail := coalesce(v_detail, 'replaced automatic absence');
      else
        v_outcome := 'duplicate';      -- already recorded (or a teacher decided): keep it
        v_status := null;
      end if;
    else
      v_outcome := coalesce(v_outcome, 'recorded');
    end if;
  end if;

  -- 7. Log the tap (append-only) ...
  insert into public.scan_events (
    school_id, device_id, idempotency_key, uid_normalized, credential_id, student_id,
    class_session_id, device_scanned_at, effective_at, outcome, outcome_detail, request_id
  ) values (
    v_school.id, p_device_id, p_idempotency_key, v_uid, v_credential_id,
    case when v_student_found then v_student.id end,
    v_session_id, p_device_scanned_at, p_effective_at, v_outcome, v_detail, p_request_id
  )
  returning id into v_scan_id;

  -- ... then write the attendance record.
  if v_status is not null then
    if v_record_found then
      update public.attendance_records
      set status = v_status, source = 'nfc', checked_in_at = p_effective_at, first_scan_event_id = v_scan_id, updated_by = null
      where id = v_record.id
      returning * into v_record;
    else
      insert into public.attendance_records (
        school_id, class_session_id, student_id, status, source, checked_in_at, first_scan_event_id
      ) values (
        v_school.id, v_session_id, v_student.id, v_status, 'nfc', p_effective_at, v_scan_id
      )
      on conflict (class_session_id, student_id) do nothing
      returning * into v_record;
      if not found then
        -- The absence job inserted concurrently; its row is 'absent'/'system'.
        update public.attendance_records
        set status = v_status, source = 'nfc', checked_in_at = p_effective_at, first_scan_event_id = v_scan_id
        where class_session_id = v_session_id and student_id = v_student.id
          and source = 'system' and not is_manual_override
        returning * into v_record;
      end if;
    end if;
    v_record_found := v_record.id is not null;
  end if;

  -- 8. Build the response a reader (or the simulator) shows.
  v_feedback := case
    when v_outcome = 'recorded' and v_record.status = 'present' then 'accept'
    when v_outcome in ('recorded', 'duplicate') then 'warn'
    when v_outcome = 'after_cutoff' and v_record_found then 'warn'
    else 'reject'
  end;
  v_message := case v_outcome
    when 'recorded' then initcap(v_record.status::text) || v_dash || v_class_name
    when 'duplicate' then 'Already checked in' || coalesce(v_dash || v_class_name, '')
    when 'after_cutoff' then case when v_record_found then 'Too late, marked absent' else 'Too late, scan rejected' end || v_dash || v_class_name
    when 'unknown_credential' then 'Unknown card'
    when 'inactive_credential' then 'This card is no longer active'
    when 'inactive_student' then 'Student is not active'
    when 'no_active_session' then 'No class right now'
    when 'too_early' then 'Too early' || v_dash || v_next_class || ' starts at '
      || to_char(v_next_starts at time zone v_school.timezone, 'HH24:MI')
    when 'not_enrolled' then 'Not enrolled in ' || coalesce(v_detail, 'this class')
    when 'device_disabled' then 'This reader is disabled'
    when 'school_suspended' then 'School account suspended'
  end;

  v_response := jsonb_build_object(
    'scan_id', v_scan_id,
    'outcome', v_outcome,
    'feedback', v_feedback,
    'message', v_message,
    'effective_at', p_effective_at,
    'attendance', case when v_record_found then jsonb_build_object(
      'record_id', v_record.id,
      'status', v_record.status,
      'class_session_id', v_record.class_session_id,
      'class_name', v_class_name,
      'checked_in_at', v_record.checked_in_at
    ) end,
    'student', case when v_student_found then jsonb_build_object(
      'display_name', v_student.first_name || ' ' || left(v_student.last_name, 1) || '.'
    ) end
  );

  update public.scan_events
  set attendance_record_id = case when v_record_found then v_record.id end, response = v_response
  where id = v_scan_id;

  update public.devices set last_seen_at = now() where id = p_device_id;

  return v_response;
end;
$$;
