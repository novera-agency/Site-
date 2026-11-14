/** Génère un historique pré-partie (≈ 1 an de séances) avec le même modèle multi-facteurs, au pas journalier. */
import type { Bar, Currency, GameState, ZoneId } from "./types";
import { Rng } from "./rng";
import { REGIMES } from "./regimes";
import { MIN_PER_DAY, isWeekend } from "./time";
import { multiplier, fx } from "./core";
import { bondPrice, realizedVol } from "./market";

export function simulateHistory(s: GameState, rng: Rng, startDay: number, nDays: number) {
  const reg = REGIMES[s.macro.regime];
  const ids = Object.keys(s.instruments);
  const dt = 1 / 252, sq = Math.sqrt(dt);
  const zones = Object.keys(s.macro.zones) as ZoneId[];
  const sectors = [...new Set(Object.values(s.instruments).map((d) => d.sector).filter(Boolean))] as string[];
  // Les cours finaux doivent rester proches des valeurs du catalogue : on simule les rendements puis on les « recolle » à la fin.
  const paths: Record<string, number[]> = {};
  const fxPaths: Record<string, number[]> = {};
  for (const id of ids) paths[id] = [];
  const logs: Record<string, number> = {};
  for (const id of ids) logs[id] = 0;
  const fxl: Record<string, number> = {};
  for (const c of Object.keys(s.macro.fxLog)) { fxl[c] = 0; fxPaths[c] = []; }
  const days: number[] = [];
  let d = startDay - 1;
  while (days.length < nDays) { if (!isWeekend(d * MIN_PER_DAY)) days.unshift(d); d--; }
  for (let k = 0; k < days.length; k++) {
    const zG = rng.normal();
    const zZ: Record<string, number> = {}; for (const z of zones) zZ[z] = rng.normal();
    const zS: Record<string, number> = {}; for (const sc of sectors) zS[sc] = rng.normal();
    const zC = rng.normal(), zK = rng.normal();
    for (const id of ids) {
      const def = s.instruments[id];
      let r = 0;
      if (def.cls === "action") {
        const sigM = 0.15 * reg.volMult, sigS = 0.1 * reg.volMult, vol = def.vol * reg.volMult;
        const sys = (def.beta * sigM) ** 2 + (0.8 * sigS) ** 2;
        const idio = Math.sqrt(Math.max(0.04 * vol * vol, vol * vol - sys));
        r = (0.06 - 0.5 * vol * vol) * dt + def.beta * sigM * sq * (Math.sqrt(reg.corr) * zG + Math.sqrt(1 - reg.corr) * zZ[def.zone]) + 0.8 * sigS * sq * zS[def.sector!] + idio * sq * rng.normal();
      } else if (def.cls === "matiere") r = -0.5 * def.vol ** 2 * dt + def.vol * sq * ((def.id === "BRENT" || def.id === "WTI") ? 0.9 * zC + 0.436 * rng.normal() : rng.normal()) + def.beta * 0.12 * sq * zG;
      else if (def.cls === "crypto") r = (0.3 - 0.5 * def.vol ** 2) * dt + def.vol * sq * (0.75 * zK + 0.66 * rng.normal());
      logs[id] += r;
      paths[id].push(logs[id]);
    }
    for (const c of Object.keys(fxl)) { if (c !== "USD") fxl[c] += 0.08 * sq * rng.normal(); fxPaths[c].push(fxl[c]); }
  }
  // Recollage : le dernier point = prix actuel
  for (const id of ids) {
    const def = s.instruments[id];
    const q = s.quotes[id];
    const bars: Bar[] = [];
    const isPrimary = def.cls === "action" || def.cls === "matiere" || def.cls === "crypto";
    if (!isPrimary) continue;
    const last = paths[id][paths[id].length - 1];
    let prev = q.price * Math.exp(paths[id][0] - last - 0.005);
    for (let k = 0; k < days.length; k++) {
      const c = q.price * Math.exp(paths[id][k] - last);
      const dv = def.vol * Math.sqrt(dt);
      const o = prev * Math.exp(rng.normal() * dv * 0.3);
      const h = Math.max(o, c) * (1 + Math.abs(rng.normal()) * dv * 0.5);
      const l = Math.min(o, c) * (1 - Math.abs(rng.normal()) * dv * 0.5);
      bars.push({ t: days[k] * MIN_PER_DAY, o, h, l, c, v: 0 });
      prev = c;
    }
    q.daily = bars;
  }
  // Devises
  const fxNow = { ...s.macro.fxLog };
  const fxAt = (k: number): Record<Currency, number> => { const o = {} as Record<Currency, number>; for (const c of Object.keys(fxNow) as Currency[]) o[c] = fxNow[c] + fxPaths[c][k] - fxPaths[c][days.length - 1]; return o; };
  for (const def of Object.values(s.instruments)) {
    if (def.cls !== "devise") continue;
    const b = def.id.slice(0, 3) as Currency, qt = def.id.slice(3) as Currency;
    s.quotes[def.id].daily = days.map((dd, k) => { const f = fxAt(k); const c = Math.exp(f[b] - f[qt]); return { t: dd * MIN_PER_DAY, o: c, h: c * 1.002, l: c * 0.998, c, v: 0 }; });
  }
  // Obligations (taux constants + bruit léger), ETF et indices recalculés à partir des paniers
  for (const def of Object.values(s.instruments)) {
    if (def.cls === "obligation") {
      const p = bondPrice(s, def, startDay);
      let y = 0;
      s.quotes[def.id].daily = days.map((dd) => { y += rng.normal() * 0.0006; const c = p * (1 + y); return { t: dd * MIN_PER_DAY, o: c, h: c * 1.001, l: c * 0.999, c, v: 0 }; });
    }
  }
  for (const def of Object.values(s.instruments)) {
    if (!def.basket) continue;
    const q = s.quotes[def.id];
    q.daily = days.map((dd, k) => {
      let v = 0;
      const f = fxAt(k);
      for (const m of def.basket!) {
        const md = s.instruments[m.id];
        const px = s.quotes[m.id].daily[k]?.c ?? s.quotes[m.id].price;
        v += m.w * px * multiplier(md) * Math.exp(f[md.currency] - f[def.currency]);
      }
      return { t: dd * MIN_PER_DAY, o: v, h: v, l: v, c: v, v: 0 };
    });
    for (let k = 1; k < q.daily.length; k++) { const b = q.daily[k]; b.o = q.daily[k - 1].c; b.h = Math.max(b.o, b.c) * 1.002; b.l = Math.min(b.o, b.c) * 0.998; }
  }
  for (const def of Object.values(s.instruments)) {
    const q = s.quotes[def.id];
    if (q.daily.length) { q.prevClose = q.daily[q.daily.length - 1].c; q.lastBarDay = dayOf(q.daily[q.daily.length - 1].t); }
    q.rv = realizedVol(q, 60, def.session === "CRYPTO" ? 365 : 252);
  }
  void fx;
}
const dayOf = (t: number) => Math.floor(t / MIN_PER_DAY);
