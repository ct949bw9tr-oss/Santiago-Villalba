"use client";

import { CheckCircle2, XCircle } from "lucide-react";
import { useEffect, useState } from "react";

type ToastKind = "success" | "error";
type ToastItem = { id: number; kind: ToastKind; text: string };

const EVENT = "edutrack:toast";

/** Show a toast from any client component. */
export function toast(text: string, kind: ToastKind = "success") {
  window.dispatchEvent(new CustomEvent(EVENT, { detail: { text, kind } }));
}

/** Mounted once in the app shell. */
export function ToastRegion() {
  const [items, setItems] = useState<ToastItem[]>([]);

  useEffect(() => {
    let next = 1;
    const onToast = (e: Event) => {
      const { text, kind } = (e as CustomEvent<{ text: string; kind: ToastKind }>).detail;
      const id = next++;
      setItems((cur) => [...cur.slice(-2), { id, kind, text }]);
      window.setTimeout(() => setItems((cur) => cur.filter((t) => t.id !== id)), 4200);
    };
    window.addEventListener(EVENT, onToast);
    return () => window.removeEventListener(EVENT, onToast);
  }, []);

  return (
    <div className="toast-region" role="status" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`toast ${t.kind}`}>
          <span className="t-icon">{t.kind === "success" ? <CheckCircle2 size={18} /> : <XCircle size={18} />}</span>
          <span>{t.text}</span>
        </div>
      ))}
    </div>
  );
}
