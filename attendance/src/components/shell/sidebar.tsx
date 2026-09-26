"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Settings2 } from "lucide-react";
import { Avatar } from "@/components/ui/avatar";
import { BrandMark, BrandName } from "@/components/ui/brand";
import { NAV_ICONS } from "./icons";
import { activeKey, type NavItem } from "./nav";

export type ShellUser = { id: string; name: string; email: string; roleLabel: string };

export function Sidebar({
  items,
  homeHref,
  user,
  onNavigate,
}: {
  items: NavItem[];
  homeHref: string;
  user: ShellUser;
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  const active = activeKey(items, pathname);
  const main = items.filter((i) => i.key !== "ai" && i.key !== "settings");
  const tail = items.filter((i) => i.key === "ai" || i.key === "settings");

  const link = (item: NavItem) => {
    const Icon = NAV_ICONS[item.icon];
    return (
      <Link
        key={item.key}
        href={item.href}
        onClick={onNavigate}
        className={`nav-item${active === item.key ? " active" : ""}${item.key === "ai" ? " nav-ai" : ""}`}
        aria-current={active === item.key ? "page" : undefined}
      >
        <Icon size={19} strokeWidth={1.9} className={item.key === "ai" && active !== "ai" ? "ai-spark" : undefined} />
        <span>{item.label}</span>
        {item.soon && <span className="badge soon">PRONTO</span>}
      </Link>
    );
  };

  return (
    <aside className="sidebar" aria-label="Navegación principal">
      <Link href={homeHref} className="brand" onClick={onNavigate}>
        <BrandMark />
        <BrandName />
      </Link>
      <nav className="nav">{main.map(link)}</nav>
      {tail.length > 0 && (
        <>
          <div className="nav-label">Herramientas</div>
          <nav className="nav">{tail.map(link)}</nav>
        </>
      )}
      <div className="sidebar-footer">
        <div className="sidebar-user">
          <Avatar first={user.name} id={user.id} size="sm" />
          <div className="who">
            <div className="name truncate">{user.name}</div>
            <div className="role truncate">{user.roleLabel}</div>
          </div>
          <Link href="/account/password" title="Cuenta y contraseña" aria-label="Cuenta y contraseña" onClick={onNavigate}>
            <Settings2 size={17} />
          </Link>
        </div>
      </div>
    </aside>
  );
}
