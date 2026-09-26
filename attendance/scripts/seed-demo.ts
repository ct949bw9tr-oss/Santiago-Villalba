// Creates a fully populated demo school for development and demos:
// admin, two teachers, a student login, 12 students with NFC cards, two
// classes meeting every weekday, and sessions for the next two weeks.
//
//   npm run seed:demo -- [--slug demo] [--password demo-password-2026]
//
// Never run this against production.

import { parseArgs } from "node:util";
import { adminClient, check, findOrCreateUser } from "./lib/admin";

const TIMEZONE = "America/Bogota";

const STUDENT_NAMES: [string, string][] = [
  ["Sofía", "Rodríguez"], ["Mateo", "Gómez"], ["Valentina", "López"], ["Santiago", "Martínez"],
  ["Isabella", "García"], ["Samuel", "Hernández"], ["Mariana", "Pérez"], ["Nicolás", "Sánchez"],
  ["Gabriela", "Ramírez"], ["Emiliano", "Torres"], ["Luciana", "Díaz"], ["Tomás", "Castro"],
];

function localToday(tz: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(new Date());
}

function addDays(isoDate: string, days: number): string {
  const d = new Date(`${isoDate}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

/** Deterministic 7-byte NFC UID (uppercase hex, as stored in nfc_credentials). */
function demoUid(index: number): string {
  return `04DE${index.toString(16).toUpperCase().padStart(10, "0")}`;
}

async function main() {
  const { values } = parseArgs({
    options: {
      slug: { type: "string", default: "demo" },
      password: { type: "string", default: "demo-password-2026" },
    },
  });
  const slug = values.slug!;
  const password = values.password!;
  const supabase = adminClient();

  const exists = check(await supabase.from("schools").select("id").eq("slug", slug).maybeSingle(), "Checking slug");
  if (exists) {
    console.error(`School "${slug}" already exists; pick another --slug.`);
    process.exit(1);
  }

  const mail = (who: string) => `${who}+${slug}@example.com`;
  const admin = await findOrCreateUser(supabase, { email: mail("admin"), fullName: "Andrea Admin", password });
  const teacher1 = await findOrCreateUser(supabase, { email: mail("teacher1"), fullName: "Carlos Ruiz", password });
  const teacher2 = await findOrCreateUser(supabase, { email: mail("teacher2"), fullName: "Laura Méndez", password });
  const studentUser = await findOrCreateUser(supabase, { email: mail("student"), fullName: "Sofía Rodríguez", password });

  const schoolId = check(
    await supabase.rpc("provision_school", {
      p_name: "Demo School",
      p_slug: slug,
      p_timezone: TIMEZONE,
      p_locale: "es-CO",
      p_admin_user_id: admin.id,
    }),
    "Provisioning school",
  ) as string;

  check(
    await supabase.from("school_memberships").insert([
      { school_id: schoolId, user_id: teacher1.id, role: "teacher" },
      { school_id: schoolId, user_id: teacher2.id, role: "teacher" },
      { school_id: schoolId, user_id: studentUser.id, role: "student" },
    ]),
    "Adding memberships",
  );

  const teachers = check(
    await supabase
      .from("teachers")
      .insert([
        { school_id: schoolId, user_id: teacher1.id, employee_number: "T-001", first_name: "Carlos", last_name: "Ruiz" },
        { school_id: schoolId, user_id: teacher2.id, employee_number: "T-002", first_name: "Laura", last_name: "Méndez" },
      ])
      .select("id, employee_number")
      .order("employee_number"),
    "Creating teachers",
  )!;

  const students = check(
    await supabase
      .from("students")
      .insert(
        STUDENT_NAMES.map(([first, last], i) => ({
          school_id: schoolId,
          user_id: i === 0 ? studentUser.id : null,
          student_number: `S-${String(i + 1).padStart(3, "0")}`,
          first_name: first,
          last_name: last,
          grade_level: "7",
        })),
      )
      .select("id, student_number")
      .order("student_number"),
    "Creating students",
  )!;

  const courses = check(
    await supabase
      .from("courses")
      .insert([
        { school_id: schoolId, code: "MAT7", name: "Mathematics 7" },
        { school_id: schoolId, code: "SCI7", name: "Science 7" },
      ])
      .select("id, code")
      .order("code"),
    "Creating courses",
  )!;
  const courseId = (code: string) => courses.find((c) => c.code === code)!.id;

  const classes = check(
    await supabase
      .from("class_sections")
      .insert([
        { school_id: schoolId, course_id: courseId("MAT7"), name: "Math 7A", room: "101" },
        { school_id: schoolId, course_id: courseId("SCI7"), name: "Science 7A", room: "Lab 2" },
      ])
      .select("id, name")
      .order("name"),
    "Creating classes",
  )!;
  const math = classes.find((c) => c.name === "Math 7A")!.id;
  const science = classes.find((c) => c.name === "Science 7A")!.id;

  check(
    await supabase.from("class_teachers").insert([
      { school_id: schoolId, class_section_id: math, teacher_id: teachers[0].id },
      { school_id: schoolId, class_section_id: science, teacher_id: teachers[1].id },
    ]),
    "Assigning teachers",
  );

  const today = localToday(TIMEZONE);
  check(
    await supabase.from("enrollments").insert([
      ...students.slice(0, 8).map((s) => ({ school_id: schoolId, class_section_id: math, student_id: s.id, enrolled_on: today })),
      ...students.slice(4).map((s) => ({ school_id: schoolId, class_section_id: science, student_id: s.id, enrolled_on: today })),
    ]),
    "Enrolling students",
  );

  const weekdays = [1, 2, 3, 4, 5];
  check(
    await supabase.from("class_schedules").insert([
      ...weekdays.map((weekday) => ({
        school_id: schoolId, class_section_id: math, weekday, start_time: "07:30", end_time: "08:30", valid_from: today,
      })),
      ...weekdays.map((weekday) => ({
        school_id: schoolId, class_section_id: science, weekday, start_time: "09:00", end_time: "10:00", valid_from: today,
      })),
    ]),
    "Creating schedules",
  );

  const created = check(
    await supabase.rpc("generate_class_sessions", { p_school_id: schoolId, p_from: today, p_to: addDays(today, 14) }),
    "Generating sessions",
  );

  check(
    await supabase.from("nfc_credentials").insert(
      students.map((s, i) => ({ school_id: schoolId, student_id: s.id, uid_normalized: demoUid(i + 1), label: "Demo card" })),
    ),
    "Issuing NFC cards",
  );

  console.log(`Demo school "${slug}" ready (${created} class sessions generated).`);
  console.log(`Sign in with password "${password}" as:`);
  for (const who of ["admin", "teacher1", "teacher2", "student"]) console.log(`  ${mail(who)}`);
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
