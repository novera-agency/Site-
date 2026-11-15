"use client";
/** Tableau d'honneur local (scores de fin de partie enregistrés sur cet appareil) */
import { useGame } from "./store";
export interface HallEntry { name: string; title: string; score: number; ending: string; date: string; epoch: number; }
const KEY = "fe_hall";
export function hallOfFame(): HallEntry[] { try { return JSON.parse(localStorage.getItem(KEY) ?? "[]"); } catch { return []; } }
export function saveToHallOfFame() {
  const snap = useGame.getState().snap;
  if (!snap?.ended) return;
  const e: HallEntry = { name: snap.player.name, title: snap.player.title, score: snap.ended.score, ending: snap.ended.id, date: new Date().toISOString(), epoch: snap.epochYear ?? 2027 };
  const list = [e, ...hallOfFame()].sort((a, b) => b.score - a.score).slice(0, 20);
  try { localStorage.setItem(KEY, JSON.stringify(list)); } catch { /* */ }
}
