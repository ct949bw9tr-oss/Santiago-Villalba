import Link from "next/link";
import { BookOpen, Library, Search } from "lucide-react";
import { requireRole } from "@/server/auth/session";
import { createSupabaseServerClient } from "@/server/db/supabase-server";
import { Person } from "@/components/ui/avatar";
import { Card } from "@/components/ui/card";
import { EmptyState } from "@/components/ui/empty-state";
import { PageHeader } from "@/components/ui/page-header";

export const metadata = { title: "Búsqueda" };

export default async function SearchPage({ params, searchParams }: PageProps<"/s/[schoolSlug]/search">) {
  const { schoolSlug } = await params;
  const { q } = await searchParams;
  const access = await requireRole(schoolSlug, "school_admin");
  const supabase = await createSupabaseServerClient();
  const schoolId = access.school.id;
  const query = (typeof q === "string" ? q : "").trim().slice(0, 100);
  // Strip PostgREST filter syntax characters from user input.
  const term = query.replace(/[,()*%]/g, " ").trim();
  const base = `/s/${schoolSlug}/admin`;

  const [students, classes, teachers, courses] = term
    ? await Promise.all([
        supabase
          .from("students")
          .select("id, first_name, last_name, student_number, grade_level")
          .eq("school_id", schoolId)
          .or(`first_name.ilike.*${term}*,last_name.ilike.*${term}*,student_number.ilike.*${term}*`)
          .order("last_name")
          .limit(20),
        supabase.from("class_sections").select("id, name, room").eq("school_id", schoolId).ilike("name", `*${term}*`).order("name").limit(10),
        supabase
          .from("teachers")
          .select("id, first_name, last_name")
          .eq("school_id", schoolId)
          .or(`first_name.ilike.*${term}*,last_name.ilike.*${term}*`)
          .limit(10),
        supabase.from("courses").select("id, code, name").eq("school_id", schoolId).or(`name.ilike.*${term}*,code.ilike.*${term}*`).limit(10),
      ])
    : [{ data: [] }, { data: [] }, { data: [] }, { data: [] }];

  const s = students.data ?? [];
  const c = classes.data ?? [];
  const t = teachers.data ?? [];
  const k = courses.data ?? [];
  const total = s.length + c.length + t.length + k.length;

  return (
    <div className="stack-lg">
      <PageHeader title="Búsqueda" subtitle={term ? `${total} resultados para “${query}”` : "Busca estudiantes, clases, cursos y docentes."} />
      <form className="search" action={`/s/${schoolSlug}/search`} style={{ maxWidth: 560 }}>
        <Search size={17} />
        <input name="q" type="search" defaultValue={query} placeholder="Buscar estudiante, clase, reporte…" autoFocus />
      </form>

      {term && total === 0 && (
        <div className="card">
          <EmptyState icon={Search} title="Sin resultados">
            Prueba con otro nombre, código o parte del nombre de la clase.
          </EmptyState>
        </div>
      )}

      {s.length > 0 && (
        <Card title={`Estudiantes (${s.length})`}>
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
            {s.map((x) => (
              <div key={x.id} className="session-card" style={{ padding: "0.75rem" }}>
                <Person
                  first={x.first_name}
                  last={x.last_name}
                  id={x.id}
                  sub={`${x.student_number}${x.grade_level ? ` · Grado ${x.grade_level}` : ""}`}
                  href={`${base}/students/${x.id}`}
                />
              </div>
            ))}
          </div>
        </Card>
      )}

      {(c.length > 0 || k.length > 0) && (
        <div className="grid-2">
          {c.length > 0 && (
            <Card title={`Clases (${c.length})`}>
              <ul className="list">
                {c.map((x) => (
                  <li key={x.id} className="list-item">
                    <span className="feed-icon tone-blue">
                      <BookOpen size={15} />
                    </span>
                    <Link className="cell-title grow" href={`${base}/classes/${x.id}`}>
                      {x.name}
                    </Link>
                    {x.room && <span className="muted small-text">Salón {x.room}</span>}
                  </li>
                ))}
              </ul>
            </Card>
          )}
          {k.length > 0 && (
            <Card title={`Cursos (${k.length})`}>
              <ul className="list">
                {k.map((x) => (
                  <li key={x.id} className="list-item">
                    <span className="feed-icon tone-violet">
                      <Library size={15} />
                    </span>
                    <Link className="cell-title grow" href={`${base}/courses/${x.id}`}>
                      {x.name}
                    </Link>
                    <span className="badge info mono">{x.code}</span>
                  </li>
                ))}
              </ul>
            </Card>
          )}
        </div>
      )}

      {t.length > 0 && (
        <Card title={`Docentes (${t.length})`}>
          <div className="grid" style={{ gridTemplateColumns: "repeat(auto-fill, minmax(240px, 1fr))" }}>
            {t.map((x) => (
              <div key={x.id} className="session-card" style={{ padding: "0.75rem" }}>
                <Person first={x.first_name} last={x.last_name} id={x.id} sub="Docente" href={`${base}/teachers/${x.id}`} />
              </div>
            ))}
          </div>
        </Card>
      )}
    </div>
  );
}
