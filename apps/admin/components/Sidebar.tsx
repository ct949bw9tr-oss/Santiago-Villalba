"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_SECTIONS: { label: string; items: { href: string; label: string }[] }[] = [
  {
    label: "General",
    items: [{ href: "/", label: "Dashboard" }],
  },
  {
    label: "Marketplace",
    items: [
      { href: "/users", label: "Usuarios" },
      { href: "/providers", label: "Proveedores" },
      { href: "/bookings", label: "Reservas" },
      { href: "/reviews", label: "Reseñas" },
      { href: "/disputes", label: "Disputas" },
    ],
  },
  {
    label: "Finanzas",
    items: [
      { href: "/payments", label: "Pagos" },
      { href: "/fees", label: "Comisiones" },
    ],
  },
  {
    label: "Catálogo",
    items: [{ href: "/categories", label: "Categorías" }],
  },
];

export function Sidebar() {
  const pathname = usePathname();
  return (
    <nav className="sidebar">
      <div className="brand">
        <div className="brand-mark">TS</div>
        <div className="brand-name">TaskSwift Admin</div>
      </div>
      {NAV_SECTIONS.map((section) => (
        <div key={section.label}>
          <div className="nav-section-label">{section.label}</div>
          {section.items.map((item) => (
            <Link key={item.href} href={item.href} className={`nav-link ${pathname === item.href ? "active" : ""}`}>
              {item.label}
            </Link>
          ))}
        </div>
      ))}
    </nav>
  );
}
