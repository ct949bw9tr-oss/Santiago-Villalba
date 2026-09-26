"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Menu } from "lucide-react";
import { useEffect, useState } from "react";
import { NAV_ICONS } from "./icons";
import { activeKey, type Navigation } from "./nav";
import { Sidebar, type ShellUser } from "./sidebar";

/** Phone/tablet navigation: bottom tab bar + slide-in drawer with the full menu. */
export function MobileNav({ nav, homeHref, user }: { nav: Navigation; homeHref: string; user: ShellUser }) {
  const pathname = usePathname();
  // Remember which page the menu was opened on, so navigating closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const setOpen = (v: boolean | ((o: boolean) => boolean)) =>
    setOpenOn((typeof v === "function" ? v(open) : v) ? pathname : null);
  const active = activeKey(nav.items, pathname);

  useEffect(() => {
    document.body.style.overflow = open ? "hidden" : "";
    return () => {
      document.body.style.overflow = "";
    };
  }, [open]);

  const tabs = nav.mobile.map((k) => nav.items.find((i) => i.key === k)).filter((i) => !!i);

  return (
    <>
      <button type="button" className="icon-btn mobile-only" aria-label="Abrir menú" onClick={() => setOpen(true)}>
        <Menu size={20} />
      </button>
      <nav className="bottom-nav" aria-label="Navegación rápida">
        {tabs.map((item) => {
          const Icon = NAV_ICONS[item.icon];
          if (item.key === nav.fab) {
            return (
              <Link key={item.key} href={item.href} className="fab" aria-current={active === item.key ? "page" : undefined}>
                <span className="fab-circle">
                  <Icon size={22} />
                </span>
                <em>{item.label}</em>
              </Link>
            );
          }
          return (
            <Link key={item.key} href={item.href} className={active === item.key ? "active" : undefined} aria-current={active === item.key ? "page" : undefined}>
              <Icon size={21} strokeWidth={1.9} />
              {item.label}
            </Link>
          );
        })}
        <button type="button" onClick={() => setOpen(true)}>
          <Menu size={21} strokeWidth={1.9} />
          Más
        </button>
      </nav>
      {open && (
        <>
          <div className="drawer-backdrop" onClick={() => setOpen(false)} />
          <div className="drawer" role="dialog" aria-modal="true" aria-label="Menú">
            <Sidebar items={nav.items} homeHref={homeHref} user={user} onNavigate={() => setOpen(false)} />
          </div>
        </>
      )}
    </>
  );
}
