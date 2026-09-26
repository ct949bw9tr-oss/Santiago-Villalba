import Link from "next/link";
import { groupBySchool, hasRole } from "@/lib/auth/roles";
import { getMyMemberships, requireSchoolAccess } from "@/server/auth/session";
import { SignOutButton } from "@/components/sign-out-button";

// Navigation chrome only. Each page performs its own authorization check.
export default async function SchoolLayout({ children, params }: LayoutProps<"/s/[schoolSlug]">) {
  const { schoolSlug } = await params;
  const access = await requireSchoolAccess(schoolSlug);
  const schoolCount = groupBySchool(await getMyMemberships()).length;
  const base = `/s/${access.school.slug}`;

  return (
    <>
      <header className="topbar">
        <div className="topbar-inner">
          <strong>{access.school.name}</strong>
          <nav>
            {hasRole(access, "school_admin") && <Link href={`${base}/admin`}>Admin</Link>}
            {hasRole(access, "teacher") && <Link href={`${base}/teacher`}>My classes</Link>}
            {hasRole(access, "student") && <Link href={`${base}/student`}>My attendance</Link>}
            {schoolCount > 1 && <Link href="/select-school">Switch school</Link>}
          </nav>
          <span className="muted" style={{ fontSize: "0.85rem" }}>
            {access.user.email}
          </span>
          <SignOutButton />
        </div>
      </header>
      <main className="container">{children}</main>
    </>
  );
}
