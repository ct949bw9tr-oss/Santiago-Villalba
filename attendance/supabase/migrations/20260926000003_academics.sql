-- Academic structure: attendance rules, terms, courses, class sections,
-- teacher assignments, enrollments, recurring schedules and dated sessions.

create type public.scan_after_cutoff as enum ('late', 'absent', 'reject');
create type public.class_status as enum ('active', 'archived');
create type public.class_teacher_role as enum ('primary', 'assistant', 'substitute');
create type public.session_status as enum ('scheduled', 'cancelled', 'completed');

-- ---------------------------------------------------------------------------
-- attendance_rules. Minutes are relative to a session's starts_at.
--   scan at or before starts_at + late_after_minutes   -> present
--   scan at or before starts_at + absent_after_minutes -> late
--   later scans                                        -> scan_after_cutoff
--   no scan by starts_at + absent_after_minutes        -> absent (finalizer)
-- ---------------------------------------------------------------------------
create table public.attendance_rules (
  id                        uuid primary key default gen_random_uuid(),
  school_id                 uuid not null references public.schools (id) on delete cascade,
  name                      text not null check (length(trim(name)) between 1 and 100),
  is_default                boolean not null default false,
  early_checkin_minutes     integer not null default 10 check (early_checkin_minutes between 0 and 240),
  late_after_minutes        integer not null default 5 check (late_after_minutes between 0 and 240),
  absent_after_minutes      integer not null default 20 check (absent_after_minutes between 0 and 480),
  scan_after_cutoff         public.scan_after_cutoff not null default 'late',
  duplicate_window_seconds  integer not null default 60 check (duplicate_window_seconds between 0 and 3600),
  auto_finalize             boolean not null default true,
  created_at                timestamptz not null default now(),
  updated_at                timestamptz not null default now(),
  unique (school_id, id),
  unique (school_id, name),
  check (absent_after_minutes >= late_after_minutes)
);

create unique index attendance_rules_one_default_per_school
  on public.attendance_rules (school_id) where is_default;

create trigger attendance_rules_updated_at before update on public.attendance_rules
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- academic_terms
-- ---------------------------------------------------------------------------
create table public.academic_terms (
  id          uuid primary key default gen_random_uuid(),
  school_id   uuid not null references public.schools (id) on delete cascade,
  name        text not null check (length(trim(name)) between 1 and 100),
  starts_on   date not null,
  ends_on     date not null,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (school_id, id),
  unique (school_id, name),
  check (ends_on >= starts_on)
);

create trigger academic_terms_updated_at before update on public.academic_terms
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- courses (the subject, e.g. "Mathematics 7")
-- ---------------------------------------------------------------------------
create table public.courses (
  id           uuid primary key default gen_random_uuid(),
  school_id    uuid not null references public.schools (id) on delete cascade,
  code         text not null check (length(trim(code)) between 1 and 32),
  name         text not null check (length(trim(name)) between 1 and 200),
  description  text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (school_id, id),
  unique (school_id, code)
);

create trigger courses_updated_at before update on public.courses
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- class_sections ("the class" teachers teach and students enroll in)
-- ---------------------------------------------------------------------------
create table public.class_sections (
  id                  uuid primary key default gen_random_uuid(),
  school_id           uuid not null references public.schools (id) on delete cascade,
  course_id           uuid not null,
  term_id             uuid,
  name                text not null check (length(trim(name)) between 1 and 200),
  room                text,
  attendance_rule_id  uuid,
  status              public.class_status not null default 'active',
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique (school_id, id),
  foreign key (school_id, course_id) references public.courses (school_id, id),
  foreign key (school_id, term_id) references public.academic_terms (school_id, id),
  foreign key (school_id, attendance_rule_id) references public.attendance_rules (school_id, id)
);

create index class_sections_course_idx on public.class_sections (school_id, course_id);

create trigger class_sections_updated_at before update on public.class_sections
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- class_teachers (many-to-many; supports dated substitutes)
-- ---------------------------------------------------------------------------
create table public.class_teachers (
  id                uuid primary key default gen_random_uuid(),
  school_id         uuid not null references public.schools (id) on delete cascade,
  class_section_id  uuid not null,
  teacher_id        uuid not null,
  role              public.class_teacher_role not null default 'primary',
  valid_from        date,
  valid_to          date,
  created_at        timestamptz not null default now(),
  unique (school_id, id),
  unique (class_section_id, teacher_id),
  foreign key (school_id, class_section_id) references public.class_sections (school_id, id) on delete cascade,
  foreign key (school_id, teacher_id) references public.teachers (school_id, id) on delete cascade,
  check (valid_to is null or valid_from is null or valid_to >= valid_from)
);

create index class_teachers_teacher_idx on public.class_teachers (teacher_id);

-- ---------------------------------------------------------------------------
-- enrollments (dated, so mid-term joiners are not marked absent retroactively)
-- ---------------------------------------------------------------------------
create table public.enrollments (
  id                uuid primary key default gen_random_uuid(),
  school_id         uuid not null references public.schools (id) on delete cascade,
  class_section_id  uuid not null,
  student_id        uuid not null,
  enrolled_on       date not null default current_date,
  withdrawn_on      date,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (school_id, id),
  foreign key (school_id, class_section_id) references public.class_sections (school_id, id) on delete cascade,
  foreign key (school_id, student_id) references public.students (school_id, id) on delete cascade,
  check (withdrawn_on is null or withdrawn_on >= enrolled_on)
);

create unique index enrollments_one_open_per_student
  on public.enrollments (class_section_id, student_id) where withdrawn_on is null;
create index enrollments_student_idx on public.enrollments (student_id);

create trigger enrollments_updated_at before update on public.enrollments
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- class_schedules: recurring rule in school-local wall-clock time.
-- ---------------------------------------------------------------------------
create table public.class_schedules (
  id                uuid primary key default gen_random_uuid(),
  school_id         uuid not null references public.schools (id) on delete cascade,
  class_section_id  uuid not null,
  weekday           smallint not null check (weekday between 1 and 7), -- ISO: 1 = Monday
  start_time        time not null,
  end_time          time not null,
  valid_from        date not null,
  valid_to          date,
  room              text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (school_id, id),
  foreign key (school_id, class_section_id) references public.class_sections (school_id, id) on delete cascade,
  check (end_time > start_time),
  check (valid_to is null or valid_to >= valid_from)
);

create index class_schedules_class_idx on public.class_schedules (class_section_id);

create trigger class_schedules_updated_at before update on public.class_schedules
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- class_sessions: concrete dated occurrences. Attendance hangs off these.
-- rule_snapshot freezes the effective attendance rule when the session opens
-- so later rule edits don't retroactively change results.
-- ---------------------------------------------------------------------------
create table public.class_sessions (
  id                uuid primary key default gen_random_uuid(),
  school_id         uuid not null references public.schools (id) on delete cascade,
  class_section_id  uuid not null,
  schedule_id       uuid,
  starts_at         timestamptz not null,
  ends_at           timestamptz not null,
  room              text,
  status            public.session_status not null default 'scheduled',
  cancelled_reason  text,
  rule_snapshot     jsonb,
  finalized_at      timestamptz,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique (school_id, id),
  unique (schedule_id, starts_at),
  foreign key (school_id, class_section_id) references public.class_sections (school_id, id) on delete cascade,
  foreign key (school_id, schedule_id) references public.class_schedules (school_id, id) on delete set null (schedule_id),
  check (ends_at > starts_at)
);

create index class_sessions_school_time_idx on public.class_sessions (school_id, starts_at);
create index class_sessions_class_time_idx on public.class_sessions (class_section_id, starts_at);

create trigger class_sessions_updated_at before update on public.class_sessions
  for each row execute function app.set_updated_at();
