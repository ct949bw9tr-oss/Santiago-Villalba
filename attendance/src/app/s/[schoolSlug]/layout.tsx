import Link from "next/link";
import { Bell, Check, ChevronDown, KeyRound, LogOut, Search } from "lucide-react";
import { groupBySchool, hasRole } from "@/lib/auth/roles";
import { firstName, ROLE_LABEL } from "@/lib/ui/format";
import { signOut } from "@/server/auth/actions";
import { getMyMemberships, getMyProfile, requireSchoolAccess } from "@/server/auth/session";
import { Avatar } from "@/components/ui/avatar";
import { BrandMark, BrandName } from "@/components/ui/brand";
import { ToastRegion } from "@/components/ui/toast";
import { Dropdown } from "@/components/shell/dropdown";
import { MobileNav } from "@/components/shell/mobile-nav";
import { buildNavigation } from "@/components/shell/nav";
import { Sidebar } from "@/components/shell/sidebar";
import { schoolHomePath } from "@/lib/auth/roles";

// Navigation chrome only. Each page performs its own authorization check.
export default async function SchoolLayout({ children, params }: LayoutProps<"/s/[schoolSlug]">) {
  const { schoolSlug } = await params;
  const access = await requireSchoolAccess(schoolSlug);
  const [memberships, profile] = await Promise.all([getMyMemberships(), getMyProfile()]);
  const schools = groupBySchool(memberships);
  const base = `/s/${access.school.slug}`;
  const nav = buildNavigation(access);
  const homeHref = schoolHomePath(access);
  const isAdmin = hasRole(access, "school_admin");

  const fullName = profile?.full_name?.trim() || firstName(null, access.user.email) || "Usuario";
  const user = {
    id: access.user.id,
    name: fullName,
    email: access.user.email ?? "",
    roleLabel: access.roles.map((r) => ROLE_LABEL[r]).join(" · "),
  };

  return (
    <div className="app">
      <Sidebar items={nav.items} homeHref={homeHref} user={user} />
      <div className="main">
        <header className="topbar">
          <MobileNav nav={nav} homeHref={homeHref} user={user} />
          <Link href={homeHref} className="mobile-brand">
            <BrandMark size={15} />
            <BrandName />
          </Link>

          {isAdmin && (
            <form className="search" action={`${base}/search`} role="search">
              <Search size={17} />
              <input name="q" type="search" placeholder="Buscar estudiante, clase, reporte…" aria-label="Buscar" autoComplete="off" />
            </form>
          )}

          <div className="topbar-actions">
            <Dropdown
              label="Notificaciones"
              triggerClassName="icon-btn"
              width={300}
              trigger={<Bell size={19} />}
            >
              <div className="dropdown-head">
                <strong>Notificaciones</strong>
              </div>
              <div className="empty compact">
                <div className="empty-icon">
                  <Bell size={20} />
                </div>
                <p>No tienes notificaciones nuevas.</p>
                {isAdmin && (
                  <Link className="card-link" href={`${base}/admin#alertas`}>
                    Ver alertas de hoy
                  </Link>
                )}
              </div>
            </Dropdown>

            <Dropdown
              label="Cambiar de colegio"
              width={280}
              trigger={
                <>
                  <span className="school-chip">{access.school.name.slice(0, 2).toUpperCase()}</span>
                  <span className="hide-mobile truncate" style={{ maxWidth: 180 }}>
                    {access.school.name}
                  </span>
                  <ChevronDown size={15} className="hide-mobile" />
                </>
              }
            >
              <div className="dropdown-head">
                <div className="small-text muted">Colegio actual</div>
                <strong>{access.school.name}</strong>
              </div>
              {schools.map((s) => (
                <Link
                  key={s.school.id}
                  href={schoolHomePath(s)}
                  className={`dropdown-item${s.school.id === access.school.id ? " active" : ""}`}
                >
                  <span className="school-chip">{s.school.name.slice(0, 2).toUpperCase()}</span>
                  <span className="grow truncate">{s.school.name}</span>
                  {s.school.id === access.school.id && <Check size={16} />}
                </Link>
              ))}
            </Dropdown>

            <Dropdown
              label="Mi cuenta"
              width={250}
              trigger={
                <>
                  <Avatar first={fullName} id={access.user.id} size="sm" />
                  <span className="hide-mobile" style={{ textAlign: "left", lineHeight: 1.2 }}>
                    <span style={{ display: "block", fontWeight: 600, fontSize: "0.85rem" }}>{fullName}</span>
                    <span style={{ display: "block", fontSize: "0.74rem", color: "var(--muted)" }}>{user.roleLabel}</span>
                  </span>
                  <ChevronDown size={15} className="hide-mobile" />
                </>
              }
            >
              <div className="dropdown-head">
                <strong className="truncate" style={{ display: "block" }}>
                  {fullName}
                </strong>
                <div className="small-text muted truncate">{access.user.email}</div>
              </div>
              <Link className="dropdown-item" href="/account/password">
                <KeyRound size={16} /> Cambiar contraseña
              </Link>
              <form action={signOut}>
                <button type="submit" className="dropdown-item">
                  <LogOut size={16} /> Cerrar sesión
                </button>
              </form>
            </Dropdown>
          </div>
        </header>
        <main className="container">{children}</main>
      </div>
      <ToastRegion />
    </div>
  );
}
