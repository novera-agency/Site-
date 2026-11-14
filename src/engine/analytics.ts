/** Indicateurs d'analyse partagés (réunions, missions, interface). */
import type { GameState } from "./types";
import { bondPriceFromYield } from "./pricing";
import { bondYield } from "./market";
import { toEur, multiplier } from "./core";
import { dayIndex } from "./time";

export function bondStats(s: GameState, accId: string) {
  const acc = s.accounts[accId];
  const day = dayIndex(s.t);
  let mv = 0, dv01 = 0, durW = 0, change5 = 0;
  const rows: { id: string; mv: number; dur: number; ytm: number; dv01: number }[] = [];
  if (!acc) return { mv, dv01, modDur: 0, change5Pct: 0, rows };
  for (const p of Object.values(acc.positions)) {
    const d = s.instruments[p.instrumentId];
    if (d.cls !== "obligation" || p.qty <= 0) continue;
    const y = bondYield(s, d, day);
    const a = bondPriceFromYield(d, day, y, s.macro.zones[d.zone].policyRate);
    const v = toEur(s, s.quotes[d.id].price * p.qty * multiplier(d), d.currency);
    const dv = toEur(s, a.dv01 * p.qty * multiplier(d), d.currency);
    mv += v; dv01 += dv; durW += a.modified * v;
    const bars = s.quotes[d.id].daily;
    const ref = bars.length > 5 ? bars[bars.length - 6].c : bars[0]?.c ?? s.quotes[d.id].price;
    change5 += v * (s.quotes[d.id].price / ref - 1);
    rows.push({ id: d.id, mv: v, dur: a.modified, ytm: y * 100, dv01: dv });
  }
  return { mv, dv01, modDur: mv > 0 ? durW / mv : 0, change5Pct: mv > 0 ? (change5 / mv) * 100 : 0, rows };
}

export function futureDv01(s: GameState, futId: string) {
  const d = s.instruments[futId];
  if (!d?.future) return 0;
  const ud = s.instruments[d.future.underlying];
  if (ud.cls !== "obligation") return 0;
  const day = dayIndex(s.t);
  const a = bondPriceFromYield(ud, day, bondYield(s, ud, day), s.macro.zones[ud.zone].policyRate);
  return toEur(s, a.dv01 * d.future.multiplier, d.currency);
}
export function frontFuture(s: GameState, root: string) {
  return Object.values(s.instruments).filter((d) => d.future && d.id.startsWith(root)).sort((a, b) => a.future!.expiryDay - b.future!.expiryDay)[0]?.id;
}

export function sectorExposureEur(s: GameState, accId: string, sector: string) {
  const acc = s.accounts[accId];
  if (!acc) return 0;
  let v = 0;
  for (const p of Object.values(acc.positions)) {
    const d = s.instruments[p.instrumentId];
    const mv = toEur(s, s.quotes[d.id].price * p.qty * multiplier(d), d.currency);
    if (d.sector === sector) v += mv;
    else if (sector === "Banque" && d.bond?.issuerStock && s.instruments[d.bond.issuerStock]?.sector === "Banque") v += mv;
    else if (sector === "Banque" && d.id === "XBNK") v += mv;
  }
  return v;
}
