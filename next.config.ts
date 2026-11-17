import type { NextConfig } from "next";
/**
 * Deux cibles :
 * - serveur Node (par défaut) : API autoritaire, persistance disque ;
 * - édition navigateur (NEXT_PUBLIC_STATIC=1) : export statique pour GitHub Pages, moteur exécuté côté client.
 */
const isStatic = !!process.env.NEXT_PUBLIC_STATIC;
const basePath = process.env.BASE_PATH || "";
const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  ...(isStatic ? { output: "export" as const, trailingSlash: true, basePath, assetPrefix: basePath || undefined, images: { unoptimized: true } } : {}),
};
export default nextConfig;
