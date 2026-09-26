import Link from "next/link";

export type TabItem = { key: string; label: string; href: string; count?: number };

/** Link-based tabs: the server decides which one is active. */
export function Tabs({ items, active, label }: { items: TabItem[]; active: string; label: string }) {
  return (
    <nav className="tabs" aria-label={label}>
      {items.map((t) => (
        <Link key={t.key} href={t.href} className={`tab${t.key === active ? " active" : ""}`} aria-current={t.key === active ? "page" : undefined}>
          {t.label}
          {t.count !== undefined && <span className="count">{t.count}</span>}
        </Link>
      ))}
    </nav>
  );
}
