/** Sérialisation compacte des parties (séries de prix empaquetées), commune au serveur et à l'édition navigateur. */
import type { Bar, GameState } from "./types";
import { migrate } from "./engine";

/* ── Compaction des séries de prix (taille des sauvegardes) ── */
const r = (x: number) => (Math.abs(x) >= 1 ? Math.round(x * 10000) / 10000 : Number(x.toPrecision(6)));
export function packBars(b: Bar[]) { const o: number[] = []; for (const x of b) o.push(x.t, r(x.o), r(x.h), r(x.l), r(x.c), Math.round(x.v)); return o; }
export function unpackBars(a: number[] | Bar[]): Bar[] { if (!a.length || typeof a[0] === "object") return a as Bar[]; const o: Bar[] = []; const n = a as number[]; for (let i = 0; i < n.length; i += 6) o.push({ t: n[i], o: n[i + 1], h: n[i + 2], l: n[i + 3], c: n[i + 4], v: n[i + 5] }); return o; }
export function serialize(s: GameState) {
  const quotes: Record<string, unknown> = {};
  for (const [k, q] of Object.entries(s.quotes)) quotes[k] = { ...q, daily: packBars(q.daily), intraday: packBars(q.intraday) };
  return JSON.stringify({ ...s, quotes });
}
export function deserialize(txt: string): GameState {
  const raw = JSON.parse(txt) as GameState;
  for (const q of Object.values(raw.quotes)) { q.daily = unpackBars(q.daily as unknown as number[]); q.intraday = unpackBars(q.intraday as unknown as number[]); }
  return migrate(raw);
}
