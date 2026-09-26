import Link from "next/link";

// Navigation only; every admin page and action checks the role itself.
export default async function AdminLayout({ children, params }: LayoutProps<"/s/[schoolSlug]/admin">) {
  const { schoolSlug } = await params;
  const base = `/s/${schoolSlug}/admin`;
  const links = [
    { href: base, label: "Overview" },
    { href: `${base}/students`, label: "Students" },
    { href: `${base}/teachers`, label: "Teachers" },
    { href: `${base}/courses`, label: "Courses" },
    { href: `${base}/classes`, label: "Classes" },
    { href: `${base}/rules`, label: "Attendance rules" },
    { href: `${base}/devices`, label: "Devices" },
    { href: `${base}/simulator`, label: "NFC simulator" },
  ];

  return (
    <>
      <nav className="subnav" aria-label="Admin">
        {links.map((l) => (
          <Link key={l.href} href={l.href}>
            {l.label}
          </Link>
        ))}
      </nav>
      {children}
    </>
  );
}
