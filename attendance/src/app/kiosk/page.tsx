import type { Metadata } from "next";
import { Kiosk } from "./kiosk";

// Public on purpose: the reader authenticates with its device token (kept in
// this browser), not with a user session. No school data is rendered here on
// the server.
export const metadata: Metadata = { title: "Lector NFC", robots: { index: false } };

export default function KioskPage() {
  return <Kiosk />;
}
