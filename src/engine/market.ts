/**
 * MarketEngine — moteur boursier autonome.
 * Modèle multi-facteurs : facteur global + facteurs régionaux + facteurs sectoriels + idiosyncratique,
 * volatilité modulée par le régime de marché, retour à la valeur fondamentale, effet des taux longs,
 * chocs d'actualité intégrés progressivement (pending), liquidité et spreads variables.
 */
import type { Bar, Currency, GameState, InstrumentDef, InstrumentState, ZoneId } from "./types";
import { Rng } from "./rng";
import { REGIMES, EQUITY_DURATION } from "./regimes";
import { isSessionOpen, stepYearFraction, dayIndex, MIN_PER_DAY, STEP_MIN, SESSIONS, type SessionId, minuteOfDay, isWeekend, EPOCH_UTC } from "./time";
import { bondPriceFromYield, zoneYield, blackScholes, modelIV, futurePrice } from "./pricing";
import { fx, multiplier, toEur, usdValue } from "./core";
import { histActive, targetLog, steer, fxLogAt, spreadTarget } from "./historical";

export const CUR_ZONE: Record<Currency, ZoneId> = { EUR: "EZ", USD: "US", GBP: "UK", JPY: "JP", CHF: "EZ", CNY: "CN", CAD: "US", AUD: "EM" };
const FX_VOL: Record<Currency, number> = { USD: 0, EUR: 0.075, GBP: 0.085, JPY: 0.1, CHF: 0.07, CAD: 0.065, AUD: 0.1, CNY: 0.035 };
const SAFE_HAVEN: Partial<Record<Currency, number>> = { JPY: 0.25, CHF: 0.2, USD: 0, AUD: -0.25, GBP: -0.05, EUR: -0.05, CAD: -0.1 };
const ZONE_SESSION: Record<ZoneId, SessionId> = { US: "US", EZ: "EU", UK: "EU", JP: "ASIA", CN: "ASIA", EM: "US" };
const SECTORS = Object.keys(EQUITY_DURATION) as (keyof typeof EQUITY_DURATION)[];

export function newQuote(price: number): InstrumentState {
  return { price, prevClose: price, dayOpen: price, dayHigh: price, dayLow: price, dayVolume: 0, ivBump: 0, stress: 0, daily: [], intraday: [], pending: 0, rv: 0, lastBarDay: -1 };
}

/** Volume quotidien moyen en notionnel EUR (sert à la liquidité, aux volumes et à l'impact de marché) */
export function advNotionalEur(s: GameState, def: InstrumentDef): number {
  const q = s.quotes[def.id];
  const liq = def.liquidity * s.macro.liquidity;
  switch (def.cls) {
    case "action": return toEur(s, q.price * def.shares! * 1e6, def.currency) * 0.004 * liq;
    case "etf": return 400e6 * liq;
    case "obligation": return (def.bond!.gov ? 2e9 : 150e6) * liq;
    case "devise": return 50e9 * liq;
    case "matiere": return 3e9 * liq;
    case "crypto": return 2e9 * liq;
    case "option": return 8e6 * liq;
    case "future": return 6e9 * liq;
    default: return 1e8;
  }
}
export function advUnits(s: GameState, id: string) {
  const def = s.instruments[id];
  const unitEur = toEur(s, s.quotes[id].price * multiplier(def), def.currency);
  return unitEur > 0 ? advNotionalEur(s, def) / unitEur : 0;
}

export function isOpen(s: GameState, def: InstrumentDef, t = s.t) {
  if (s.quotes[def.id]?.halted) return false;
  if (def.option || def.future) {
    const u = s.instruments[def.option?.underlying ?? def.future!.underlying];
    return isSessionOpen(u.session, t);
  }
  return isSessionOpen(def.session, t);
}

/** Fourchette de prix et carnet d'ordres simplifié (5 niveaux) */
export function quoteBook(s: GameState, id: string) {
  const def = s.instruments[id], q = s.quotes[id];
  const reg = REGIMES[s.macro.regime];
  const open = isOpen(s, def);
  let bps = (def.baseSpreadBps * (1 + 0.6 * (reg.volMult - 1)) * (1 + 6 * q.stress * q.stress)) / Math.max(0.3, s.macro.liquidity);
  if (def.option) bps = Math.max(bps, 150 * (1 / Math.max(0.05, q.price)) ** 0.3);
  if (!open) bps *= 2;
  const half = (q.price * bps) / 20000;
  const bid = Math.max(q.price - half, q.price * 0.0001), ask = q.price + half;
  const adv = advUnits(s, id);
  const lvl = Math.max(1, adv * 0.004);
  // tailles pseudo-aléatoires déterministes (hachage du temps) — purement indicatif
  const h = (k: number) => 0.6 + ((Math.sin((s.t / STEP_MIN) * 12.9898 + k * 78.233 + id.length) * 43758.5453) % 1 + 1) % 1;
  const depth = [0, 1, 2, 3, 4].map((k) => ({ bid: bid - k * half * 0.8, ask: ask + k * half * 0.8, bidQty: Math.round(lvl * h(k) * (1 + k * 0.6)), askQty: Math.round(lvl * h(k + 9) * (1 + k * 0.6)) }));
  return { bid, ask, mid: q.price, spreadBps: bps, open, depth, adv };
}

/** Choc de prix progressif (actualité → marché). logRet appliqué principalement dans les premières minutes d'ouverture. */
export function applyShock(s: GameState, target: { kind: "instrument" | "sector" | "zone" | "class" | "global"; id: string }, logRet: number, volBoost = 0, label = "") {
  const ids = Object.values(s.instruments).filter((d) => {
    if (d.option || d.future || d.cls === "indice" || d.cls === "etf" || d.cls === "obligation") return false;
    switch (target.kind) {
      case "instrument": return d.id === target.id;
      case "sector": return d.sector === target.id;
      case "zone": return d.cls === "action" && d.zone === target.id;
      case "class": return d.cls === target.id;
      case "global": return d.cls === "action" || d.cls === "crypto";
    }
  });
  for (const d of ids) {
    const q = s.quotes[d.id];
    const scale = target.kind === "global" || target.kind === "zone" ? d.beta : 1;
    q.pending += logRet * scale;
    q.ivBump = Math.min(1.5, q.ivBump + volBoost * 0.5);
  }
  if (label) {
    s.impulses.unshift({ id: `imp${s.seq++}`, target, totalLogReturn: logRet, remainingSteps: 0, volBoost, source: label });
    if (s.impulses.length > 60) s.impulses.length = 60;
  }
  return ids.length;
}
export function shockFx(s: GameState, cur: Currency, logRet: number) {
  const key = `fxpend_${cur}`;
  s.macro.factors[key] = (s.macro.factors[key] ?? 0) + logRet;
}

/** Nombre de séances conservées pour les valeurs de l'univers étendu */
export const LITE_DAILY = 130;
function updateBars(q: InstrumentState, t: number, price: number, vol: number, dayStart: boolean, lite = false) {
  const day = dayIndex(t);
  if (dayStart || q.lastBarDay !== day) {
    if (q.lastBarDay !== day) {
      q.prevClose = q.daily.length ? q.daily[q.daily.length - 1].c : price;
      q.daily.push({ t: day * MIN_PER_DAY, o: price, h: price, l: price, c: price, v: 0 });
      const cap = lite ? LITE_DAILY : 520;
      if (q.daily.length > cap) q.daily.splice(0, q.daily.length - cap);
      q.lastBarDay = day;
      q.dayOpen = price; q.dayHigh = price; q.dayLow = price; q.dayVolume = 0;
    }
  }
  const b = q.daily[q.daily.length - 1];
  b.c = price; b.h = Math.max(b.h, price); b.l = Math.min(b.l, price); b.v += vol;
  q.dayHigh = b.h; q.dayLow = b.l; q.dayVolume = b.v;
  if (lite) { if (q.intraday.length) q.intraday = []; return; } // barres 15 min seulement pour les valeurs suivies
  const bt = Math.floor(t / 15) * 15;
  const ib = q.intraday[q.intraday.length - 1];
  if (!ib || ib.t !== bt) {
    q.intraday.push({ t: bt, o: ib ? ib.c : price, h: Math.max(price, ib ? ib.c : price), l: Math.min(price, ib ? ib.c : price), c: price, v: vol });
    if (q.intraday.length > 300) q.intraday.splice(0, q.intraday.length - 300);
  } else { ib.c = price; ib.h = Math.max(ib.h, price); ib.l = Math.min(ib.l, price); ib.v += vol; }
}

function releasePending(q: InstrumentState) {
  if (Math.abs(q.pending) < 1e-7) { q.pending = 0; return 0; }
  const r = q.pending * 0.3; // ~85 % intégré en 30 minutes de cotation
  q.pending -= r;
  return r;
}

export function fairValue(s: GameState, d: InstrumentDef) {
  const q = s.quotes[d.id];
  const z = s.macro.zones[d.zone];
  const y0 = s.macro.factors[`y10_0_${d.zone}`] ?? z.y10;
  const dur = EQUITY_DURATION[d.sector!] ?? 8;
  const reg = REGIMES[s.macro.regime];
  const sentiment = 1 + (s.macro.regime === "bulle" ? 0.15 : 0) - (reg.riskAversion > 0.8 ? 0.12 : 0);
  return q.eps! * d.fairPE! * Math.exp((-dur * (z.y10 - y0)) / 100) * sentiment * (1 - q.stress * 0.8);
}

/** Listes d'instruments par catégorie, mises en cache (invalidées quand un instrument est créé ou supprimé) */
interface Cats { stocks: { d: InstrumentDef; q: InstrumentState }[]; bonds: InstrumentDef[]; baskets: InstrumentDef[]; derivs: InstrumentDef[]; fx: InstrumentDef[]; commo: InstrumentDef[]; crypto: InstrumentDef[] }
const catCache = new WeakMap<object, Cats>();
export function invalidateInstruments(s: GameState) { catCache.delete(s.instruments); }
export function catsOf(s: GameState): Cats {
  let c = catCache.get(s.instruments);
  if (!c || (c.stocks.length && c.stocks[0].q !== s.quotes[c.stocks[0].d.id])) {
    const all = Object.values(s.instruments);
    c = { stocks: all.filter((d) => d.cls === "action").map((d) => ({ d, q: s.quotes[d.id] })), bonds: all.filter((d) => d.cls === "obligation"), baskets: all.filter((d) => !!d.basket), derivs: all.filter((d) => !!(d.future || d.option)), fx: all.filter((d) => d.cls === "devise"), commo: all.filter((d) => d.cls === "matiere"), crypto: all.filter((d) => d.cls === "crypto") };
    catCache.set(s.instruments, c);
  }
  return c;
}
export function stocksOf(s: GameState) { return catsOf(s).stocks; }
/** Membres d'un panier résolus une fois pour toutes (cotation, devise, multiplicateur) */
const basketCache = new WeakMap<object, { w: number; q: InstrumentState; cur: Currency; mult: number }[]>();
function basketOf(s: GameState, d: InstrumentDef) {
  let l = basketCache.get(d.basket!);
  if (!l || l.some((x, i) => x.w !== d.basket![i].w) || (l.length && l[0].q !== s.quotes[d.basket![0].id])) {
    l = d.basket!.map((m) => { const md = s.instruments[m.id]; return { w: m.w, q: s.quotes[m.id], cur: md.currency, mult: md.cls === "action" ? 1 : multiplier(md) }; });
    basketCache.set(d.basket!, l);
  }
  return l;
}
/** Instruments « suivis » par le joueur (liste de surveillance, positions, ordres) : historique complet même pour l'univers étendu */
let trackedKey = "", trackedCache = new Set<string>();
export function trackedSet(s: GameState) {
  const key = `${s.seed}|${s.watchlist.length}|${s.orders.length}|${Object.values(s.accounts).reduce((a, x) => a + Object.keys(x.positions).length, 0)}|${s.missions.length}`;
  if (key !== trackedKey) {
    trackedKey = key;
    trackedCache = new Set<string>(s.watchlist);
    for (const a of Object.values(s.accounts)) for (const id of Object.keys(a.positions)) trackedCache.add(id);
    for (const o of s.orders) if (o.status === "en_attente" || o.status === "partiel") trackedCache.add(o.instrumentId);
    for (const m of s.missions) if (m.status === "active" && typeof m.params.instrument === "string") trackedCache.add(m.params.instrument);
  }
  return trackedCache;
}
/** Avance le marché d'un pas de 5 minutes */
export function stepMarket(s: GameState, rng: Rng, dyByZone: Partial<Record<ZoneId, number>>) {
  const t = s.t;
  const hist = histActive(s);
  const tracked = trackedSet(s);
  const reg = REGIMES[s.macro.regime];
  const zG = rng.normal();
  const open: Record<SessionId, boolean> = { EU: isSessionOpen("EU", t), US: isSessionOpen("US", t), ASIA: isSessionOpen("ASIA", t), FX: isSessionOpen("FX", t), CRYPTO: isSessionOpen("CRYPTO", t), COMMO: isSessionOpen("COMMO", t) };
  const zoneZ: Partial<Record<ZoneId, number>> = {};
  const secZ: Record<string, number> = {};
  if (open.EU || open.US || open.ASIA) {
    for (const z of Object.keys(s.macro.zones) as ZoneId[]) zoneZ[z] = rng.normal();
    for (const sec of SECTORS) secZ[sec] = rng.normal();
  }
  const sigM = 0.15 * reg.volMult, sigS = 0.1 * reg.volMult;
  // Mode historique : écart (log) entre l'indice de chaque zone et sa trajectoire cible, corrigé collectivement
  const zoneGap: Partial<Record<ZoneId, number>> = {};
  if (hist) {
    const sp: Record<string, number> = {}, st: Record<string, number> = {};
    for (const { d, q: sq0 } of catsOf(s).stocks) {
      if (sq0.defaulted || sq0.halted) continue;
      const L = targetLog(s, d.id, t); if (L === null) continue;
      const w = d.shares ?? 1;
      sp[d.zone] = (sp[d.zone] ?? 0) + w * s.quotes[d.id].price; st[d.zone] = (st[d.zone] ?? 0) + w * Math.exp(L);
    }
    for (const z of Object.keys(sp) as ZoneId[]) zoneGap[z] = Math.log(sp[z] / st[z]);
  }
  const rho = Math.sqrt(reg.corr);
  const yf: Partial<Record<SessionId, number>> = {};
  for (const { d, q } of stocksOf(s)) {
    if (!open[d.session]) continue;
    if (q.halted || q.defaulted) continue;
    // Univers étendu non suivi : mise à jour toutes les 30 minutes (pas sextuple) pour alléger le calcul
    const slow = d.lite && !tracked.has(d.id);
    if (slow && Math.floor(t / STEP_MIN) % 6 !== 0) continue;
    const dt = (yf[d.session] ?? (yf[d.session] = stepYearFraction(d.session))) * (slow ? 6 : 1), sq = Math.sqrt(dt);
    const fZone = sigM * sq * (rho * zG + Math.sqrt(1 - reg.corr) * (zoneZ[d.zone] ?? 0));
    const fSec = sigS * sq * (secZ[d.sector!] ?? 0);
    const volEff = d.vol * reg.volMult * (1 + 0.5 * q.ivBump) * (1 + 1.5 * q.stress);
    const sysVar = (d.beta * sigM) ** 2 + ((d.sectorBeta ?? 0.8) * sigS) ** 2;
    const idio = Math.sqrt(Math.max(0.04 * volEff * volEff, volEff * volEff - sysVar));
    const zone = s.macro.zones[d.zone];
    const drift = 0.03 + reg.drift * d.beta * 0.8 + (reg.sectorTilt[d.sector!] ?? 0) + (zone.growth - 2) * 0.01 - 0.15 * q.stress;
    const fair = fairValue(s, d); q.fair = fair;
    const mr = (s.macro.regime === "bulle" ? 0.1 : 0.35) * (Math.log(fair) - Math.log(q.price));
    const dur = EQUITY_DURATION[d.sector!] ?? 8;
    const rateEff = -(dur * (dyByZone[d.zone] ?? 0)) / 100;
    const L = hist ? targetLog(s, d.id, t) : null;
    const ret = L !== null && L !== undefined
      ? steer(s, d.id, L, Math.log(q.price), 6, dt) - 25 * (zoneGap[d.zone] ?? 0) * dt - 0.5 * volEff * volEff * dt + d.beta * fZone + (d.sectorBeta ?? 0.8) * fSec + idio * sq * rng.normal() + releasePending(q)
      : (drift + mr - 0.5 * volEff * volEff) * dt + d.beta * fZone + (d.sectorBeta ?? 0.8) * fSec + idio * sq * rng.normal() + rateEff + releasePending(q);
    q.price = Math.max(0.01, q.price * Math.exp(ret));
    const vol = (d.shares! * 1e6 * 0.004 * d.liquidity * STEP_MIN) / (SESSIONS[d.session].close - SESSIONS[d.session].open) * (0.5 + Math.abs(ret) / (volEff * sq + 1e-9));
    updateBars(q, t, q.price, Math.round(vol), false, !!d.lite && !tracked.has(d.id));
  }
  // Devises (log-valeur vs USD)
  if (open.FX) {
    const dt = stepYearFraction("FX"), sq = Math.sqrt(dt);
    const usdRate = s.macro.zones.US.policyRate;
    for (const cur of Object.keys(s.macro.fxLog) as Currency[]) {
      if (cur === "USD") continue;
      const z = s.macro.zones[CUR_ZONE[cur]];
      const rate = cur === "CHF" ? z.policyRate - 1.5 : cur === "CAD" ? usdRate - 0.5 : z.policyRate;
      const carry = (0.4 * (rate - usdRate)) / 100;
      const haven = (SAFE_HAVEN[cur] ?? 0) * (s.macro.riskAversion - 0.4) * 0.3;
      const key = `fxpend_${cur}`;
      const pend = s.macro.factors[key] ?? 0;
      const rel = pend * 0.3; s.macro.factors[key] = pend - rel;
      if (hist) s.macro.fxLog[cur] += steer(s, `fx_${cur}`, fxLogAt(cur, t / MIN_PER_DAY + EPOCH_UTC / 86400000), s.macro.fxLog[cur], 10, dt) + FX_VOL[cur] * 0.7 * reg.volMult ** 0.5 * sq * rng.normal() + rel;
      else s.macro.fxLog[cur] += (carry + haven) * dt + FX_VOL[cur] * reg.volMult ** 0.5 * sq * rng.normal() + rel;
    }
    for (const d of catsOf(s).fx) {
      const base = d.id.slice(0, 3) as Currency, quote = d.id.slice(3) as Currency;
      const q = s.quotes[d.id];
      q.price = Math.exp(s.macro.fxLog[base] - s.macro.fxLog[quote]);
      updateBars(q, t, q.price, Math.round(1e9 * d.liquidity * rng.range(0.5, 1.5) / 288), false);
    }
  }
  // Matières premières
  if (open.COMMO) {
    const dt = stepYearFraction("COMMO"), sq = Math.sqrt(dt);
    const zC = rng.normal();
    for (const d of catsOf(s).commo) {
      const q = s.quotes[d.id];
      const anchor = s.macro.factors[`anchor_${d.id}`] ?? q.price;
      const isEnergy = d.id === "BRENT" || d.id === "WTI" || d.id === "NGAS";
      const volEff = d.vol * (0.7 + 0.3 * reg.volMult) * (1 + 0.5 * q.ivBump);
      const oil = d.id === "BRENT" || d.id === "WTI";
      const z = oil ? 0.9 * zC + 0.436 * rng.normal() : rng.normal();
      const geo = isEnergy ? s.macro.geopolitics * 0.15 + s.macro.oilSupplyShock * 0.4 : d.id === "GOLD" ? (s.macro.riskAversion - 0.35) * 0.25 + (s.macro.zones.US.inflation - 2.5) * 0.02 : 0;
      const growthDrift = (d.beta * (s.macro.zones.CN.growth + s.macro.zones.US.growth - 6)) * 0.02;
      const L = hist ? targetLog(s, d.id, t) : null;
      const ret = L !== null && L !== undefined
        ? steer(s, d.id, L, Math.log(q.price), 6, dt) - 0.5 * volEff * volEff * dt + 0.8 * volEff * sq * z + releasePending(q)
        : (geo + growthDrift - 0.5 * volEff * volEff + (d.meanRevert ?? 0) * (Math.log(anchor) - Math.log(q.price))) * dt + d.beta * 0.12 * reg.volMult * sq * zG + volEff * sq * z + releasePending(q);
      q.price = Math.max(0.01, q.price * Math.exp(ret));
      updateBars(q, t, q.price, Math.round(advUnits(s, d.id) / 168), false);
    }
  }
  // Cryptoactifs (24/7, sauts)
  if (open.CRYPTO) {
    const dt = stepYearFraction("CRYPTO"), sq = Math.sqrt(dt);
    const zK = rng.normal();
    const jump = rng.chance(0.0015) ? rng.normal() * 0.06 : 0;
    for (const d of catsOf(s).crypto) {
      const q = s.quotes[d.id];
      if (q.halted) continue;
      const volEff = d.vol * (0.8 + 0.2 * reg.volMult) * (1 + 0.5 * q.ivBump);
      const L = hist ? targetLog(s, d.id, t) : null;
      if (L !== null && L !== undefined) {
        const r = steer(s, d.id, L, Math.log(q.price), 6, dt) - 0.5 * volEff * volEff * dt + 0.7 * volEff * sq * (0.75 * zK + 0.66 * rng.normal()) + releasePending(q);
        q.price = Math.max(1e-6, q.price * Math.exp(r));
        updateBars(q, t, q.price, Math.round(advUnits(s, d.id) / 288), false);
        continue;
      }
      const ret = (reg.cryptoDrift - 0.5 * volEff * volEff - 1.2 * (s.macro.riskAversion - 0.35)) * dt + volEff * sq * (0.75 * zK + 0.66 * rng.normal()) + 0.3 * zG * sq * 0.5 + jump * (d.vol / 0.7) + releasePending(q);
      q.price = Math.max(1e-6, q.price * Math.exp(ret));
      updateBars(q, t, q.price, Math.round(advUnits(s, d.id) / 288), false);
    }
  }
  refreshDerived(s, rng, open);
}

/** Recalcule les instruments dérivés : obligations, ETF, indices, futures, options */
export function refreshDerived(s: GameState, rng: Rng | null, open?: Record<SessionId, boolean>) {
  const t = s.t, day = dayIndex(t);
  const usd: Partial<Record<Currency, number>> = {};
  const isOpenS = (ses: SessionId) => (open ? open[ses] : isSessionOpen(ses, t));
  for (const d of catsOf(s).bonds) {
    {
      if (!isOpenS(d.session) && open) continue;
      const q = s.quotes[d.id];
      q.price = bondPrice(s, d, day);
      if (open) updateBars(q, t, q.price, Math.round(advUnits(s, d.id) / 102), false);
    }
  }
  for (const d of catsOf(s).baskets) {
    if (open && !isOpenS(d.session)) continue;
    let v = 0;
    const den = usd[d.currency] ?? (usd[d.currency] = usdValue(s, d.currency));
    for (const m of basketOf(s, d)) v += m.w * m.q.price * m.mult * (usd[m.cur] ?? (usd[m.cur] = usdValue(s, m.cur)));
    v /= den;
    const q = s.quotes[d.id];
    q.price = v;
    if (open) updateBars(q, t, v, d.cls === "indice" ? 0 : Math.round(advUnits(s, d.id) / 102), false);
  }
  for (const d of catsOf(s).derivs) {
    const q = s.quotes[d.id];
    if (q.defaulted) continue;
    const und = d.option?.underlying ?? d.future!.underlying;
    const ud = s.instruments[und];
    if (open && !isOpenS(ud.session)) continue;
    const S = s.quotes[und].price;
    const expiryT = (d.option?.expiryDay ?? d.future!.expiryDay) * MIN_PER_DAY + 17 * 60 + 30;
    const T = Math.max(0, (expiryT - t) / (365 * MIN_PER_DAY));
    const r = rateFor(s, ud.currency) / 100;
    const qd = dividendYield(s, ud);
    if (d.future) q.price = ud.cls === "obligation" ? S : futurePrice(S, r, ud.cls === "matiere" ? 0 : qd, T);
    else {
      const o = d.option!;
      const iv = optionIV(s, und, o.strike, T);
      q.price = blackScholes(o.type, S, o.strike, T, r, iv, qd).price;
    }
    if (open) updateBars(q, t, q.price, 0, false);
  }
}

export function rateFor(s: GameState, cur: Currency) {
  const z = s.macro.zones[CUR_ZONE[cur]];
  return cur === "CHF" ? Math.max(0, z.policyRate - 1.5) : z.policyRate;
}
export function dividendYield(s: GameState, d: InstrumentDef) {
  const q = s.quotes[d.id];
  if (d.cls === "action") return q.dividend && q.price > 0 ? q.dividend / q.price : 0;
  if (d.cls === "etf" || d.cls === "indice") return 0.018;
  return 0;
}
export function baseVol(s: GameState, id: string) {
  const d = s.instruments[id], q = s.quotes[id];
  const reg = REGIMES[s.macro.regime];
  const param = d.vol > 0 ? d.vol : 0.16;
  const rv = q.rv > 0 ? q.rv : param;
  return (0.5 * param * reg.volMult + 0.5 * rv) * (1 + q.ivBump * 0.6) * (1 + q.stress);
}
export function optionIV(s: GameState, und: string, K: number, T: number) {
  const ud = s.instruments[und];
  return modelIV(baseVol(s, und), s.quotes[und].price, K, T, ud.cls);
}
export function bondYield(s: GameState, d: InstrumentDef, day: number) {
  const b = d.bond!;
  const z = s.macro.zones[d.zone];
  const years = (b.maturityDay - day) / 365;
  const base = zoneYield(z, years);
  const stress = b.issuerStock ? s.quotes[b.issuerStock]?.stress ?? 0 : 0;
  const ra = s.macro.riskAversion;
  const hy = b.rating.startsWith("B") && !b.rating.startsWith("BBB");
  const mult = Math.max(0.4, 1 + (hy ? 3 : 1.5) * (ra - 0.3)) * (1 + 10 * stress * stress);
  const hs = histActive(s) ? spreadTarget(d.id, day * MIN_PER_DAY) : null;
  const spread = hs !== null ? hs / 100 : (b.spreadBps * mult + (s.macro.factors[`spread_${d.id}`] ?? 0)) / 100;
  return (base + spread) / 100;
}
export function bondPrice(s: GameState, d: InstrumentDef, day: number) {
  const q = s.quotes[d.id];
  if (q?.defaulted) return q.price;
  const y = bondYield(s, d, day);
  return bondPriceFromYield(d, day, y, s.macro.zones[d.zone].policyRate).price;
}

/** Volatilité réalisée 60 jours sur clôtures journalières */
export function realizedVol(q: InstrumentState, days = 60, perYear = 252) {
  const b = q.daily;
  if (b.length < 10) return 0;
  const n = Math.min(days, b.length - 1);
  const rets: number[] = [];
  for (let i = b.length - n; i < b.length; i++) if (b[i - 1].c > 0 && b[i].c > 0) rets.push(Math.log(b[i].c / b[i - 1].c));
  const m = rets.reduce((a, x) => a + x, 0) / rets.length;
  const v = rets.reduce((a, x) => a + (x - m) ** 2, 0) / Math.max(1, rets.length - 1);
  return Math.sqrt(v * perYear);
}

export function sessionOf(s: GameState, id: string): SessionId {
  const d = s.instruments[id];
  if (d.option || d.future) return s.instruments[d.option?.underlying ?? d.future!.underlying].session;
  return d.session;
}
export function marketStatus(s: GameState) {
  return (Object.keys(SESSIONS) as SessionId[]).map((k) => ({ id: k, label: SESSIONS[k].label, open: isSessionOpen(k, s.t) }));
}
export { isWeekend, minuteOfDay };
export type { Bar };
