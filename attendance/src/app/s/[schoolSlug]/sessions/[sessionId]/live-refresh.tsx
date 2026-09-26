"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";

const FALLBACK_REFRESH_MS = 10_000;

/**
 * Keeps the roster current. Supabase Realtime pushes attendance changes for
 * this session (RLS-filtered); a periodic refresh is kept as a fallback in
 * case the socket can't connect. Either way the page re-renders on the server,
 * so what's shown is always the authoritative data.
 */
export function LiveRefresh({ sessionId }: { sessionId: string }) {
  const router = useRouter();
  const [realtime, setRealtime] = useState(false);

  useEffect(() => {
    const supabase = supabaseBrowser();
    const channel = supabase
      .channel(`attendance-${sessionId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "attendance_records", filter: `class_session_id=eq.${sessionId}` },
        () => router.refresh(),
      )
      .subscribe((status: string) => setRealtime(status === "SUBSCRIBED"));
    const timer = setInterval(() => router.refresh(), FALLBACK_REFRESH_MS);
    return () => {
      clearInterval(timer);
      supabase.removeChannel(channel);
    };
  }, [sessionId, router]);

  return (
    <span className="badge" title={realtime ? "Updates instantly" : "Refreshes every 10 seconds"}>
      <span style={{ color: "#2e7d32" }}>●</span> Live{realtime ? "" : " (auto-refresh)"}
    </span>
  );
}
