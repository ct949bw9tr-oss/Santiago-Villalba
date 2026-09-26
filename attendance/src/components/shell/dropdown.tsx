"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

/** Small menu that closes on outside click, Escape and navigation. */
export function Dropdown({
  trigger,
  label,
  triggerClassName = "dropdown-trigger",
  width,
  children,
}: {
  trigger: React.ReactNode;
  label: string;
  triggerClassName?: string;
  width?: number;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname();
  // Remember which page the menu was opened on, so navigating closes it.
  const [openOn, setOpenOn] = useState<string | null>(null);
  const open = openOn === pathname;
  const setOpen = (v: boolean | ((o: boolean) => boolean)) =>
    setOpenOn((typeof v === "function" ? v(open) : v) ? pathname : null);


  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpenOn(null);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpenOn(null);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div className="dropdown" ref={ref}>
      <button type="button" className={triggerClassName} aria-label={label} aria-expanded={open} onClick={() => setOpen((o) => !o)}>
        {trigger}
      </button>
      {open && (
        <div className="dropdown-menu" role="menu" style={width ? { minWidth: width } : undefined}>
          {children}
        </div>
      )}
    </div>
  );
}
