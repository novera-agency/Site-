import type { Metadata, Viewport } from "next";
import "./globals.css";
import { PREFS_BOOT } from "@/lib/prefs-boot";
import { ZoomReset } from "@/components/ZoomReset";

export const metadata: Metadata = {
  title: "FINANCIAL EMPIRE — Simulateur de carrière en finance de marché",
  description: "Simulation pédagogique : marchés fictifs autonomes, monnaie virtuelle, aucune transaction réelle.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#05070b" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head><script dangerouslySetInnerHTML={{ __html: PREFS_BOOT }} /></head>
      <body className="min-h-screen">{children}<ZoomReset /></body>
    </html>
  );
}
