"use client";
import { useEffect } from "react";
import { api } from "@/lib/api";
import { useGame } from "@/lib/store";
import { makeCareerCode, careerCodeSupported } from "@/lib/career-code";
import { cloudConfigured, cloudPush, linkedCode } from "@/lib/career-cloud";

/** Envoie la partie en base toutes les 3 minutes (et quand l'onglet passe en arrière-plan) si elle a un code court. Silencieux en cas d'échec. */
export async function syncNow(gameId: string): Promise<boolean> {
  const code = linkedCode(gameId); if (!code || !cloudConfigured() || !careerCodeSupported()) return false;
  try {
    const r = await api<{ ok: boolean; data?: string }>("/api/saves", { action: "export_code", gameId });
    if (!r.ok || !r.data) return false;
    await cloudPush(code, await makeCareerCode(r.data)); return true;
  } catch { return false; }
}
export function CloudSync() {
  const gameId = useGame((s) => s.gameId);
  useEffect(() => {
    if (!gameId || !cloudConfigured()) return;
    const t = setInterval(() => { if (document.visibilityState === "visible") void syncNow(gameId); }, 180000);
    const vis = () => { if (document.visibilityState === "hidden") void syncNow(gameId); };
    document.addEventListener("visibilitychange", vis);
    return () => { clearInterval(t); document.removeEventListener("visibilitychange", vis); };
  }, [gameId]);
  return null;
}
