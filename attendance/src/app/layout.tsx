import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "School Attendance",
  description: "NFC-based class attendance for schools",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
