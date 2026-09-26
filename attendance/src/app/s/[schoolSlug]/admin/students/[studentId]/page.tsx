import Link from "next/link";
import { notFound } from "next/navigation";
import { ActionForm } from "@/components/action-form";
import { SchoolSlugInput } from "@/components/school-slug-input";
import { formatUid } from "@/lib/nfc/uid";
import { formatLocalDate } from "@/lib/time";
import { requireRole } from "@/server/auth/session";
import { createSupabaseServerClient } from "@/server/db/supabase-server";
import { assignCard, revokeCard, updateStudent } from "@/server/admin/students";

type Student = {
  id: string;
  student_number: string;
  first_name: string;
  last_name: string;
  grade_level: string | null;
  status: string;
};
type Card = { id: string; uid_normalized: string; label: string | null; status: string; issued_at: string; revoked_at: string | null };
type Enrollment = { id: string; enrolled_on: string; withdrawn_on: string | null; class: { id: string; name: string } };

export default async function StudentPage({ params }: PageProps<"/s/[schoolSlug]/admin/students/[studentId]">) {
  const { schoolSlug, studentId } = await params;
  const access = await requireRole(schoolSlug, "school_admin");
  const supabase = await createSupabaseServerClient();
  const tz = access.school.timezone;

  const { data: student } = await supabase
    .from("students")
    .select("id, student_number, first_name, last_name, grade_level, status")
    .eq("school_id", access.school.id)
    .eq("id", studentId)
    .returns<Student[]>()
    .maybeSingle();
  if (!student) notFound();

  const [{ data: cards }, { data: enrollments }] = await Promise.all([
    supabase
      .from("nfc_credentials")
      .select("id, uid_normalized, label, status, issued_at, revoked_at")
      .eq("school_id", access.school.id)
      .eq("student_id", student.id)
      .order("issued_at", { ascending: false })
      .returns<Card[]>(),
    supabase
      .from("enrollments")
      .select("id, enrolled_on, withdrawn_on, class:class_sections!inner(id, name)")
      .eq("school_id", access.school.id)
      .eq("student_id", student.id)
      .order("enrolled_on", { ascending: false })
      .returns<Enrollment[]>(),
  ]);
  const activeCard = (cards ?? []).find((c) => c.status === "active");
  const base = `/s/${schoolSlug}/admin`;

  return (
    <div className="stack">
      <p>
        <Link href={`${base}/students`}>← Students</Link>
      </p>
      <h1>
        {student.first_name} {student.last_name}
      </h1>

      <section className="card stack">
        <h2>Details</h2>
        <ActionForm action={updateStudent} submitLabel="Save">
          <SchoolSlugInput slug={schoolSlug} />
          <input type="hidden" name="studentId" value={student.id} />
          <div className="form-grid">
            <label>
              Student number
              <input name="student_number" defaultValue={student.student_number} required maxLength={64} />
            </label>
            <label>
              First name
              <input name="first_name" defaultValue={student.first_name} required maxLength={100} />
            </label>
            <label>
              Last name
              <input name="last_name" defaultValue={student.last_name} required maxLength={100} />
            </label>
            <label>
              Grade
              <input name="grade_level" defaultValue={student.grade_level ?? ""} maxLength={32} />
            </label>
            <label>
              Status
              <select name="status" defaultValue={student.status}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
                <option value="graduated">Graduated</option>
                <option value="withdrawn">Withdrawn</option>
              </select>
            </label>
          </div>
        </ActionForm>
      </section>

      <section className="card stack">
        <h2>NFC card</h2>
        {activeCard ? (
          <div className="stack">
            <p>
              Active card: <strong style={{ fontFamily: "monospace" }}>{formatUid(activeCard.uid_normalized)}</strong>
              {activeCard.label && <span className="muted"> · {activeCard.label}</span>}
              <span className="muted"> · issued {formatLocalDate(activeCard.issued_at, tz)}</span>
            </p>
            <div className="inline">
              <ActionForm
                action={revokeCard}
                submitLabel="Mark as lost"
                variant="secondary"
                className="inline small"
                confirmText="Mark this card as lost? It will stop working immediately."
              >
                <SchoolSlugInput slug={schoolSlug} />
                <input type="hidden" name="cardId" value={activeCard.id} />
                <input type="hidden" name="status" value="lost" />
              </ActionForm>
              <ActionForm
                action={revokeCard}
                submitLabel="Revoke"
                variant="secondary"
                className="inline small"
                confirmText="Revoke this card? It will stop working immediately."
              >
                <SchoolSlugInput slug={schoolSlug} />
                <input type="hidden" name="cardId" value={activeCard.id} />
                <input type="hidden" name="status" value="revoked" />
              </ActionForm>
            </div>
          </div>
        ) : (
          <ActionForm action={assignCard} submitLabel="Assign card" resetOnSuccess>
            <SchoolSlugInput slug={schoolSlug} />
            <input type="hidden" name="studentId" value={student.id} />
            <div className="form-grid">
              <label>
                Card UID
                <input
                  name="uid"
                  required
                  maxLength={64}
                  placeholder="04:A2:2B:1C:9F:5E:80"
                  autoCapitalize="characters"
                  autoComplete="off"
                  spellCheck={false}
                />
              </label>
              <label>
                Label (optional)
                <input name="label" maxLength={64} placeholder="e.g. Blue card #12" />
              </label>
            </div>
            <p className="muted" style={{ margin: 0, fontSize: "0.85rem" }}>
              The UID is printed on the card or shown by any NFC reader app. Colons and spaces are optional.
            </p>
          </ActionForm>
        )}

        {(cards ?? []).some((c) => c.status !== "active") && (
          <details>
            <summary className="muted">Previous cards</summary>
            <ul>
              {(cards ?? [])
                .filter((c) => c.status !== "active")
                .map((c) => (
                  <li key={c.id}>
                    <span style={{ fontFamily: "monospace" }}>{formatUid(c.uid_normalized)}</span> — {c.status}
                    {c.revoked_at && ` on ${formatLocalDate(c.revoked_at, tz)}`}
                  </li>
                ))}
            </ul>
          </details>
        )}
      </section>

      <section className="card stack">
        <h2>Classes</h2>
        {(enrollments ?? []).length === 0 ? (
          <p className="muted">Not enrolled in any class. Enroll students from a class page.</p>
        ) : (
          <ul>
            {(enrollments ?? []).map((e) => (
              <li key={e.id}>
                <Link href={`${base}/classes/${e.class.id}`}>{e.class.name}</Link>{" "}
                <span className="muted">
                  since {e.enrolled_on}
                  {e.withdrawn_on && ` · left ${e.withdrawn_on}`}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
