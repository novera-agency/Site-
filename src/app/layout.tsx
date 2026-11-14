import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "FINANCIAL EMPIRE — Simulateur de carrière en finance de marché",
  description: "Simulation pédagogique : marchés fictifs autonomes, monnaie virtuelle, aucune transaction réelle.",
};
export const viewport: Viewport = { width: "device-width", initialScale: 1, themeColor: "#05070b" };

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
