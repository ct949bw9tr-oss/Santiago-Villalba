import type { LucideIcon } from "lucide-react";
import { CheckCircle2, Clock } from "lucide-react";
import { PageHeader } from "./page-header";

/**
 * Honest placeholder for a module that has no backend yet: explains what it
 * will do. Never shows invented data.
 */
export function ComingSoon({
  icon: Icon,
  title,
  subtitle,
  summary,
  features,
  children,
}: {
  icon: LucideIcon;
  title: string;
  subtitle: string;
  summary: string;
  features: string[];
  children?: React.ReactNode;
}) {
  return (
    <div className="stack-lg">
      <PageHeader title={title} subtitle={subtitle} />
      <section className="card soon-hero">
        <div className="stack">
          <span className="badge info" style={{ alignSelf: "flex-start" }}>
            <Clock size={12} /> Próximamente
          </span>
          <h2 style={{ fontSize: "1.35rem", margin: 0 }}>{summary}</h2>
          <ul className="feature-list">
            {features.map((f) => (
              <li key={f}>
                <CheckCircle2 size={17} />
                {f}
              </li>
            ))}
          </ul>
        </div>
        <div className="soon-art" aria-hidden="true">
          <div className="soon-orb">
            <Icon size={46} strokeWidth={1.6} />
          </div>
        </div>
      </section>
      {children}
    </div>
  );
}
