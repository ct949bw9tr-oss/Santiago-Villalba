import Link from "next/link";
import { avatarTone, initials } from "@/lib/ui/format";

type Props = { first: string; last?: string; id?: string; size?: "sm" | "md" | "lg" | "xl" };

/** Initials avatar with a stable color per person (no photos are stored yet). */
export function Avatar({ first, last, id, size = "md" }: Props) {
  const tone = avatarTone(id ?? `${first} ${last ?? ""}`);
  return (
    <span className={`avatar av-${tone} ${size === "md" ? "" : size}`} aria-hidden="true">
      {initials(first, last)}
    </span>
  );
}

export function Person({
  first,
  last,
  id,
  sub,
  href,
  size = "md",
}: Props & { sub?: React.ReactNode; href?: string }) {
  const name = `${first} ${last ?? ""}`.trim();
  return (
    <div className="person">
      <Avatar first={first} last={last} id={id} size={size} />
      <div className="who">
        {href ? (
          <Link className="cell-title truncate" href={href} style={{ display: "block" }}>
            {name}
          </Link>
        ) : (
          <div className="cell-title truncate">{name}</div>
        )}
        {sub && <div className="cell-sub truncate">{sub}</div>}
      </div>
    </div>
  );
}
