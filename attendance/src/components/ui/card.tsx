import Link from "next/link";
import { ChevronRight } from "lucide-react";

/** Card with a title row; used for every dashboard / chart / list panel. */
export function Card({
  title,
  subtitle,
  action,
  link,
  flush,
  className = "",
  id,
  children,
}: {
  title?: React.ReactNode;
  subtitle?: React.ReactNode;
  action?: React.ReactNode;
  link?: { href: string; label: string };
  flush?: boolean;
  className?: string;
  id?: string;
  children: React.ReactNode;
}) {
  return (
    <section id={id} className={`card${flush ? " card-flush" : ""} ${className}`}>
      {(title || action || link) && (
        <div className="card-head">
          <div>
            {title && <h2>{title}</h2>}
            {subtitle && <div className="sub">{subtitle}</div>}
          </div>
          {action}
          {link && (
            <Link className="card-link" href={link.href}>
              {link.label} <ChevronRight size={14} />
            </Link>
          )}
        </div>
      )}
      {children}
    </section>
  );
}
