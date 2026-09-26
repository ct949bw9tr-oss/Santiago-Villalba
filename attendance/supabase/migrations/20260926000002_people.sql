-- People: students and teachers belong to exactly one school.

create type public.student_status as enum ('active', 'inactive', 'graduated', 'withdrawn');
create type public.teacher_status as enum ('active', 'inactive');

-- ---------------------------------------------------------------------------
-- students. A login (user_id) is optional: young students may never have one.
-- ---------------------------------------------------------------------------
create table public.students (
  id              uuid primary key default gen_random_uuid(),
  school_id       uuid not null references public.schools (id) on delete cascade,
  user_id         uuid references public.profiles (id) on delete set null,
  student_number  text not null check (length(trim(student_number)) between 1 and 64),
  first_name      text not null check (length(trim(first_name)) between 1 and 100),
  last_name       text not null check (length(trim(last_name)) between 1 and 100),
  grade_level     text,
  status          public.student_status not null default 'active',
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (school_id, id),
  unique (school_id, student_number),
  unique (school_id, user_id)
);

create index students_user_idx on public.students (user_id) where user_id is not null;

create trigger students_updated_at before update on public.students
  for each row execute function app.set_updated_at();

-- ---------------------------------------------------------------------------
-- teachers. Always tied to a login; authorization additionally requires an
-- active 'teacher' membership in the same school (see app.teaches_class).
-- ---------------------------------------------------------------------------
create table public.teachers (
  id               uuid primary key default gen_random_uuid(),
  school_id        uuid not null references public.schools (id) on delete cascade,
  user_id          uuid not null references public.profiles (id) on delete restrict,
  employee_number  text,
  first_name       text not null check (length(trim(first_name)) between 1 and 100),
  last_name        text not null check (length(trim(last_name)) between 1 and 100),
  status           public.teacher_status not null default 'active',
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  unique (school_id, id),
  unique (school_id, user_id),
  unique (school_id, employee_number)
);

create index teachers_user_idx on public.teachers (user_id);

create trigger teachers_updated_at before update on public.teachers
  for each row execute function app.set_updated_at();

-- A student row may only be linked to a login that holds a 'student'
-- membership in the same school, and a teacher row to a 'teacher' membership.
-- This stops an admin from attaching an arbitrary account to their school's
-- records and so granting it access.
create function app.check_person_membership()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_role public.membership_role :=
    case tg_table_name when 'students' then 'student' else 'teacher' end;
begin
  if new.user_id is not null and not exists (
    select 1 from public.school_memberships m
    where m.school_id = new.school_id
      and m.user_id = new.user_id
      and m.role = v_role
  ) then
    raise exception 'user % has no % membership in school %', new.user_id, v_role, new.school_id
      using errcode = 'foreign_key_violation';
  end if;
  return new;
end;
$$;

create trigger students_membership_check
  before insert or update of user_id, school_id on public.students
  for each row execute function app.check_person_membership();

create trigger teachers_membership_check
  before insert or update of user_id, school_id on public.teachers
  for each row execute function app.check_person_membership();
