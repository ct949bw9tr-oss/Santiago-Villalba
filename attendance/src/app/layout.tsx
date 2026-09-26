import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({ subsets: ["latin"], variable: "--font-sans", display: "swap" });

export const metadata: Metadata = {
  title: { default: "EduTrack", template: "%s · EduTrack" },
  description: "Gestión escolar inteligente: asistencia NFC, estudiantes, reportes y analítica.",
};

export const viewport: Viewport = {
  themeColor: "#0b1437",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es" className={inter.variable}>
      <body>{children}</body>
    </html>
  );
}
