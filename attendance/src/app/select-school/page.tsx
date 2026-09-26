import Link from "next/link";
import { redirect } from "next/navigation";
import { groupBySchool, ROLE_LABELS, schoolHomePath } from "@/lib/auth/roles";
import { getMyMemberships, requireUser } from "@/server/auth/session";
import { SignOutButton } from "@/components/sign-out-button";

export default async function SelectSchoolPage() {
  await requireUser();
  const schools = groupBySchool(await getMyMemberships());
  if (schools.length === 0) redirect("/no-access");

  return (
    <main className="narrow">
      <div className="card stack">
        <h1>Choose a school</h1>
        <ul className="stack" style={{ listStyle: "none", padding: 0, margin: 0 }}>
          {schools.map((access) => (
            <li key={access.school.id}>
              <Link href={schoolHomePath(access)}>{access.school.name}</Link>{" "}
              <span className="muted">· {access.roles.map((r) => ROLE_LABELS[r]).join(", ")}</span>
            </li>
          ))}
        </ul>
        <SignOutButton />
      </div>
    </main>
  );
}
