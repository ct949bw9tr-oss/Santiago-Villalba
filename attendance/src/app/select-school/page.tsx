import Link from "next/link";
import { redirect } from "next/navigation";
import { ChevronRight } from "lucide-react";
import { groupBySchool, schoolHomePath } from "@/lib/auth/roles";
import { ROLE_LABEL } from "@/lib/ui/format";
import { getMyMemberships, requireUser } from "@/server/auth/session";
import { SignOutButton } from "@/components/sign-out-button";
import { AuthShell } from "@/components/ui/auth-shell";

export const metadata = { title: "Elegir colegio" };

export default async function SelectSchoolPage() {
  await requireUser();
  const schools = groupBySchool(await getMyMemberships());
  if (schools.length === 0) redirect("/no-access");

  return (
    <AuthShell>
      <div>
        <h1>Elige un colegio</h1>
        <p className="text-2" style={{ margin: 0 }}>
          Tu cuenta tiene acceso a varios colegios.
        </p>
      </div>
      <div className="stack-sm">
        {schools.map((access) => (
          <Link key={access.school.id} href={schoolHomePath(access)} className="session-card row">
            <span className="school-chip" style={{ width: 38, height: 38 }}>
              {access.school.name.slice(0, 2).toUpperCase()}
            </span>
            <div className="grow">
              <div className="cell-title">{access.school.name}</div>
              <div className="cell-sub">{access.roles.map((r) => ROLE_LABEL[r]).join(" · ")}</div>
            </div>
            <ChevronRight size={18} color="var(--muted)" />
          </Link>
        ))}
      </div>
      <SignOutButton />
    </AuthShell>
  );
}
