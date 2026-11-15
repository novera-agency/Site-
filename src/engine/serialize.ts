/** Sérialisation compacte des parties (séries de prix empaquetées), commune au serveur et à l'édition navigateur. */
import type { Bar, GameState } from "./types";
import { migrate } from "./engine";
import { buildCatalog } from "./data/catalog";

/* ── Compaction des séries de prix (taille des sauvegardes) ── */
const r = (x: number) => (Math.abs(x) >= 1 ? Math.round(x * 10000) / 10000 : Number(x.toPrecision(6)));
export function packBars(b: Bar[]) { const o: number[] = []; for (const x of b) o.push(x.t, r(x.o), r(x.h), r(x.l), r(x.c), Math.round(x.v)); return o; }
export function unpackBars(a: number[] | Bar[]): Bar[] { if (!a.length || typeof a[0] === "object") return a as Bar[]; const o: Bar[] = []; const n = a as number[]; for (let i = 0; i < n.length; i += 6) o.push({ t: n[i], o: n[i + 1], h: n[i + 2], l: n[i + 3], c: n[i + 4], v: n[i + 5] }); return o; }
/**
 * Univers étendu : seules les clôtures journalières sont conservées (4-5 chiffres significatifs) avec l'écart en jours ;
 * ouverture, plus haut, plus bas et volume sont reconstitués au chargement. Divise la taille des sauvegardes par ~6.
 */
const p5 = (x: number) => Number(x.toPrecision(5));
export function packLite(b: Bar[]) {
  if (!b.length) return { lc: [] as number[], d0: 0, dd: "" };
  const d0 = Math.floor(b[0].t / 1440);
  let dd = "", prev = d0;
  for (const x of b) { const d = Math.floor(x.t / 1440); dd += String.fromCharCode(48 + Math.min(74, d - prev)); prev = d; }
  return { lc: b.map((x) => p5(x.c)), d0, dd, v: b.length ? Math.round(b.reduce((a, x) => a + x.v, 0) / b.length) : 0 };
}
export function unpackLite(p: { lc: number[]; d0: number; dd: string; v?: number }): Bar[] {
  const out: Bar[] = [];
  let d = p.d0;
  p.lc.forEach((c, i) => {
    d += p.dd.charCodeAt(i) - 48;
    const o = i ? p.lc[i - 1] : c;
    const sp = Math.abs(c / o - 1) * 0.5 + 0.004;
    out.push({ t: d * 1440, o, h: Math.max(o, c) * (1 + sp), l: Math.min(o, c) * (1 - sp), c, v: p.v ?? 0 });
  });
  if (out.length) { const last = out[out.length - 1]; last.h = Math.max(last.o, last.c); last.l = Math.min(last.o, last.c); }
  return out;
}
export function serialize(s: GameState) {
  const quotes: Record<string, unknown> = {};
  for (const [k, q] of Object.entries(s.quotes)) {
    const lite = s.instruments[k]?.lite && !s.watchlist.includes(k) && !Object.values(s.accounts).some((a) => a.positions[k]);
    quotes[k] = lite ? { ...q, daily: packLite(q.daily), intraday: [] } : { ...q, daily: packBars(q.daily), intraday: packBars(q.intraday) };
  }
  // Les définitions de l'univers étendu sont déterministes : elles ne sont pas sauvegardées mais reconstruites au chargement
  const instruments: Record<string, unknown> = {};
  for (const [k, d] of Object.entries(s.instruments)) if (!d.lite) instruments[k] = d;
  return JSON.stringify({ ...s, quotes, instruments, liteFromCatalog: true });
}
export function deserialize(txt: string): GameState {
  const raw = JSON.parse(txt) as GameState & { liteFromCatalog?: boolean };
  if (raw.liteFromCatalog) {
    for (const d of buildCatalog().defs) if (d.lite && raw.quotes[d.id] && !raw.instruments[d.id]) raw.instruments[d.id] = d;
    delete raw.liteFromCatalog;
  }
  for (const q of Object.values(raw.quotes)) {
    const dl = q.daily as unknown as { lc?: number[] } | number[];
    q.daily = !Array.isArray(dl) && dl?.lc ? unpackLite(dl as { lc: number[]; d0: number; dd: string; v?: number }) : unpackBars(dl as number[]);
    q.intraday = unpackBars(q.intraday as unknown as number[]);
  }
  return migrate(raw);
}
