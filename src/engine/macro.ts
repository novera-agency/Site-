/**
 * MacroEconomyEngine — zones économiques, banques centrales, statistiques, régimes de marché.
 * Dynamiques : retour vers le potentiel, loi d'Okun, courbe de Phillips simplifiée, règle de Taylor bruitée.
 */
import type { CalendarEvent, GameState, MacroState, RegimeId, Zone, ZoneId } from "./types";
import { Rng } from "./rng";
import { REGIMES, TRANSITIONS } from "./regimes";
import { applyShock, shockFx } from "./market";
import { isSessionOpen, stepYearFraction, dayIndex, nextBusinessDay, fmtDate } from "./time";
import { notify, pushNews, pause, ZONE_NAMES, clamp, nextId } from "./core";

const POTENTIAL: Record<ZoneId, number> = { US: 2.0, EZ: 1.2, UK: 1.3, JP: 0.8, CN: 4.5, EM: 3.8 };
const NEUTRAL_REAL: Record<ZoneId, number> = { US: 0.8, EZ: 0.2, UK: 0.6, JP: -0.6, CN: 0.5, EM: 1.5 };
const INFL_TARGET: Record<ZoneId, number> = { US: 2, EZ: 2, UK: 2, JP: 2, CN: 2.5, EM: 4 };
const CB_TIME: Record<ZoneId, number> = { US: 20 * 60, EZ: 14 * 60 + 15, UK: 13 * 60, JP: 4 * 60, CN: 3 * 60, EM: 15 * 60 };
const ZONE_SESSION = { US: "US", EZ: "EU", UK: "EU", JP: "ASIA", CN: "ASIA", EM: "US" } as const;

export function initMacro(startDay: number): MacroState {
  const mk = (id: ZoneId, name: string, currency: Zone["currency"], cbName: string, gdp: number, growth: number, inflation: number, unemployment: number, policyRate: number, y2: number, y10: number, y30: number, debt: number, deficit: number, tb: number, cbOffset: number): Zone => ({
    id, name, currency, gdp, growth, inflation, unemployment, policyRate, y2, y10, y30, debt, deficit, tradeBalance: tb, confidence: 100, industrial: growth * 1.2, finConditions: 0, inflationExp: inflation, nextCbDay: nextBusinessDay(startDay + cbOffset), cbName, history: [],
  });
  return {
    zones: {
      US: mk("US", "États-Unis", "USD", "Réserve fédérale (simulée)", 29000, 2.1, 2.8, 4.2, 3.75, 3.6, 4.1, 4.5, 122, -6, -3, 23),
      EZ: mk("EZ", "Zone euro", "EUR", "Banque centrale européenne (simulée)", 16500, 1.0, 2.1, 6.3, 2.25, 2.1, 2.7, 3.1, 88, -3, 2, 30),
      UK: mk("UK", "Royaume-Uni", "GBP", "Banque d'Angleterre (simulée)", 3600, 1.2, 3.0, 4.6, 3.75, 3.8, 4.4, 4.9, 100, -4, -3, 37),
      JP: mk("JP", "Japon", "JPY", "Banque du Japon (simulée)", 4300, 0.8, 2.0, 2.5, 0.75, 0.9, 1.6, 2.6, 250, -4, 1, 20),
      CN: mk("CN", "Chine", "CNY", "Banque populaire (simulée)", 19000, 4.5, 0.6, 5.2, 1.4, 1.5, 1.9, 2.2, 90, -7, 3, 45),
      EM: mk("EM", "Économies émergentes", "USD", "Banques centrales émergentes (agrégat)", 22000, 3.8, 4.5, 6.5, 6.0, 6.2, 7.0, 7.4, 65, -4, 0, 28),
    },
    regime: "expansion", regimeSinceDay: startDay, riskAversion: 0.3, liquidity: 1, geopolitics: 0.2, oilSupplyShock: 0,
    fxLog: { USD: 0, EUR: 0, GBP: 0, CHF: 0, JPY: 0, CAD: 0, AUD: 0, CNY: 0 }, factors: {}, regimeHistory: [{ day: startDay, regime: "expansion" }],
  };
}

/** Évolution intrajournalière de la courbe des taux (renvoie Δy10 par zone, en points de %) */
export function stepYields(s: GameState, rng: Rng): Partial<Record<ZoneId, number>> {
  const out: Partial<Record<ZoneId, number>> = {};
  const reg = REGIMES[s.macro.regime];
  for (const z of Object.values(s.macro.zones)) {
    const ses = ZONE_SESSION[z.id];
    if (!isSessionOpen(ses, s.t)) continue;
    const dt = stepYearFraction(ses), sq = Math.sqrt(dt);
    const exp2 = expectedPolicy(z);
    const t10 = 0.45 * exp2 + 0.55 * (NEUTRAL_REAL[z.id] + 1.2 + z.inflationExp) + termPremium(s, z);
    const t30 = t10 + 0.35 + z.debt / 400;
    const flight = s.macro.riskAversion > 0.7 && (z.id === "US" || z.id === "EZ") ? -0.6 : 0;
    const dz = rng.normal();
    const d2 = 1.5 * (exp2 - z.y2) * dt + 0.9 * reg.volMult ** 0.5 * sq * (0.7 * dz + 0.71 * rng.normal());
    const d10 = 0.9 * (t10 + flight - z.y10) * dt + 0.8 * reg.volMult ** 0.5 * sq * dz + (s.macro.factors[`ypend_${z.id}`] ?? 0) * 0.3;
    s.macro.factors[`ypend_${z.id}`] = (s.macro.factors[`ypend_${z.id}`] ?? 0) * 0.7;
    const d30 = 0.6 * (t30 - z.y30) * dt + 0.7 * sq * dz;
    z.y2 += d2; z.y10 += d10; z.y30 += d30;
    out[z.id] = d10;
  }
  return out;
}
function expectedPolicy(z: Zone) { return taylor(z) * 0.6 + z.policyRate * 0.4; }
function termPremium(s: GameState, z: Zone) { return 0.2 + (z.debt - 90) / 300 + (z.inflation - 2) * 0.1 + (s.macro.regime === "stagflation" ? 0.4 : 0); }
export function taylor(z: Zone) {
  const pot = POTENTIAL[z.id];
  return NEUTRAL_REAL[z.id] + z.inflation + 0.5 * (z.inflation - INFL_TARGET[z.id]) + 0.5 * (z.growth - pot);
}

/** Mise à jour journalière (jours ouvrés) */
export function dailyMacro(s: GameState, rng: Rng) {
  const dt = 1 / 252, sq = Math.sqrt(dt);
  const reg = REGIMES[s.macro.regime];
  const m = s.macro;
  const regGrowth: Partial<Record<RegimeId, number>> = { crise: -3.5, recession: -2.5, expansion: 0.8, reprise: 1.2, stagflation: -1.2, bulle: 0.6, baissier: -0.6, haussier: 0.4 };
  const oil = s.quotes["BRENT"] ? Math.log(s.quotes["BRENT"].price / (m.factors["anchor_BRENT"] ?? 78)) : 0;
  for (const z of Object.values(m.zones)) {
    const pot = POTENTIAL[z.id];
    const target = pot + (regGrowth[m.regime] ?? 0) - 0.8 * z.finConditions + (z.id === "CN" ? 0 : -0.3 * (z.policyRate - taylor(z)) * 0.3);
    z.growth += 3 * (target - z.growth) * dt + 0.8 * sq * rng.normal();
    const inflTarget = INFL_TARGET[z.id] + 0.35 * (z.growth - pot) + 3 * oil + (m.regime === "stagflation" ? 3 : 0) + (m.regime === "crise" ? -0.8 : 0) + 0.4 * (z.inflationExp - INFL_TARGET[z.id]);
    z.inflation += 1.6 * (inflTarget - z.inflation) * dt + 0.5 * sq * rng.normal();
    z.unemployment = clamp(z.unemployment - 0.45 * (z.growth - pot) * dt * 2 + 0.15 * sq * rng.normal(), 2, 20);
    z.inflationExp += 0.5 * (z.inflation - z.inflationExp) * dt;
    z.confidence = 100 + (z.growth - pot) * 4 - (z.unemployment - 5) * 1.5 - m.riskAversion * 15 + rng.normal() * 0.5;
    z.industrial = z.growth * 1.4 - 0.8 + rng.normal() * 0.3;
    z.finConditions = clamp(z.finConditions + 2 * (m.riskAversion * 1.6 - 0.45 + (z.policyRate - taylor(z)) * 0.15 + (1 - m.liquidity) * 2 - z.finConditions) * dt, -1.5, 4);
    z.deficit = clamp(z.deficit + (0.5 * (z.growth - pot) - 0.1 * (z.deficit + 3)) * dt, -15, 3);
    z.debt = clamp(z.debt - z.deficit * dt, 20, 400);
    z.gdp *= Math.exp((z.growth + z.inflation) / 100 * dt);
    if (dayIndex(s.t) % 7 === 0 || z.history.length === 0) {
      z.history.push({ day: dayIndex(s.t), growth: r2(z.growth), inflation: r2(z.inflation), unemployment: r2(z.unemployment), policyRate: r2(z.policyRate), y10: r2(z.y10) });
      if (z.history.length > 300) z.history.shift();
    }
  }
  // Aversion au risque & liquidité
  const crisisPressure = s.crises.filter((c) => !c.resolved).reduce((a, c) => a + c.severity * (c.phase >= 2 ? 0.5 : 0.2), 0);
  m.riskAversion = clamp(m.riskAversion + 4 * (reg.riskAversion + crisisPressure * 0.3 + m.geopolitics * 0.2 - m.riskAversion) * dt + 0.05 * rng.normal(), 0.02, 1.2);
  m.liquidity = clamp(m.liquidity + 5 * (reg.liquidity - crisisPressure * 0.25 - m.liquidity) * dt + 0.01 * rng.normal(), 0.25, 1.2);
  m.geopolitics = clamp(m.geopolitics * (1 - 0.6 * dt) + 0.004 * rng.normal(), 0, 1);
  m.oilSupplyShock = m.oilSupplyShock * (1 - 3 * dt);
  // Décroissance des chocs de volatilité spécifiques
  for (const q of Object.values(s.quotes)) { q.ivBump *= 0.85; q.stress *= 0.995; }
  regimeTransition(s, rng);
}

function regimeTransition(s: GameState, rng: Rng) {
  const m = s.macro;
  const day = dayIndex(s.t);
  if (day - m.regimeSinceDay < 8) return;
  const base = TRANSITIONS[m.regime];
  const avgGrowth = (m.zones.US.growth + m.zones.EZ.growth + m.zones.CN.growth / 2) / 2.5;
  const avgInfl = (m.zones.US.inflation + m.zones.EZ.inflation + m.zones.UK.inflation) / 3;
  const weights: { item: RegimeId; w: number }[] = [];
  let total = 0;
  for (const [k, p0] of Object.entries(base) as [RegimeId, number][]) {
    let p = p0;
    if (k === "crise") p *= 1 + 4 * Math.max(0, m.riskAversion - 0.6) + 3 * Math.max(0, 0.8 - m.liquidity);
    if (k === "recession") p *= avgGrowth < 0.8 ? 3 : avgGrowth > 2 ? 0.3 : 1;
    if (k === "stagflation") p *= avgInfl > 4 && avgGrowth < 1.2 ? 6 : 0.5;
    if (k === "reprise" || k === "haussier") p *= m.riskAversion < 0.5 ? 1.5 : 0.7;
    if (k === "bulle") p *= m.riskAversion < 0.25 ? 2 : 0.6;
    weights.push({ item: k, w: p }); total += p;
  }
  if (!rng.chance(Math.min(0.5, total))) return;
  setRegime(s, rng.weighted(weights));
}

export function setRegime(s: GameState, r: RegimeId, cause?: string) {
  const m = s.macro;
  if (m.regime === r) return;
  const prev = m.regime;
  m.regime = r; m.regimeSinceDay = dayIndex(s.t);
  m.regimeHistory.push({ day: m.regimeSinceDay, regime: r });
  const p = REGIMES[r];
  pushNews(s, { category: "marches", title: `Les marchés basculent : ${p.label.toLowerCase()}`, body: `${cause ? cause + " " : ""}Après une phase « ${REGIMES[prev].label.toLowerCase()} », les stratégistes décrivent désormais un environnement de ${p.label.toLowerCase()} : ${p.description}`, impact: r === "crise" ? "fort" : "moyen", tickers: [], zones: [], sentiment: p.drift > 0 ? 0.5 : -0.5 });
  notify(s, r === "crise" ? "critique" : "info", `Changement de régime : ${p.label}`, p.description, "/play/actualites");
  if (r === "crise") pause(s, "Les marchés entrent en régime de crise financière.");
}

/** Décision de politique monétaire */
export function centralBankDecision(s: GameState, zoneId: ZoneId, rng: Rng, consensus: number) {
  const z = s.macro.zones[zoneId];
  const tgt = taylor(z) - (s.macro.riskAversion > 0.8 ? 1.5 : 0) - (s.macro.liquidity < 0.6 ? 1 : 0);
  const diff = tgt - z.policyRate;
  let move = 0;
  if (Math.abs(diff) > 0.3) move = Math.sign(diff) * (Math.abs(diff) > 1.5 ? 0.5 : 0.25);
  if (s.macro.liquidity < 0.5 && diff < 0) move = -0.75;
  // composante imprévisible
  const u = rng.next();
  if (u < 0.08) move += 0.25; else if (u < 0.16) move -= 0.25;
  if (z.policyRate + move < -0.5) move = -0.5 - z.policyRate;
  move = Math.round(move * 4) / 4;
  const surprise = move - consensus;
  z.policyRate = Math.round((z.policyRate + move) * 100) / 100;
  z.nextCbDay = nextBusinessDay(dayIndex(s.t) + 42 + rng.int(-3, 3));
  // Transmission
  s.macro.factors[`ypend_${zoneId}`] = (s.macro.factors[`ypend_${zoneId}`] ?? 0) + surprise * 0.4;
  z.y2 += move * 0.5 + surprise * 0.6;
  const cur = z.currency === "USD" && zoneId === "EM" ? null : z.currency;
  if (cur && cur !== "USD") shockFx(s, cur, surprise * 0.015);
  if (zoneId === "US") { for (const c of ["EUR", "GBP", "JPY", "CHF", "AUD", "CAD"] as const) shockFx(s, c, -surprise * 0.012); }
  if (zoneId === "EZ") shockFx(s, "CHF", surprise * 0.004);
  applyShock(s, { kind: "zone", id: zoneId }, -surprise * 0.035, Math.abs(surprise) * 0.4, `Décision ${z.cbName}`);
  if (move !== 0) applyShock(s, { kind: "sector", id: "Immobilier" }, -move * 0.02, 0);
  const bp = Math.round(move * 100);
  const verb = bp > 0 ? `relève son taux directeur de ${bp} points de base` : bp < 0 ? `abaisse son taux directeur de ${-bp} points de base` : "maintient son taux directeur inchangé";
  const surpriseTxt = Math.abs(surprise) >= 0.24 ? ` Décision ${surprise > 0 ? "plus restrictive" : "plus accommodante"} qu'attendu (consensus : ${consensus >= 0 ? "+" : ""}${Math.round(consensus * 100)} pb).` : " Décision conforme aux attentes.";
  pushNews(s, { category: "banques_centrales", title: `La ${z.cbName.replace(" (simulée)", "")} ${verb} à ${z.policyRate.toFixed(2)} %`, body: `${verb.charAt(0).toUpperCase() + verb.slice(1)}. Inflation : ${z.inflation.toFixed(1)} %, croissance : ${z.growth.toFixed(1)} %, chômage : ${z.unemployment.toFixed(1)} %.${surpriseTxt}`, impact: Math.abs(surprise) >= 0.24 ? "fort" : move !== 0 ? "moyen" : "faible", tickers: [], zones: [zoneId], sentiment: -surprise * 2 });
  if (Math.abs(surprise) >= 0.24) {
    notify(s, "critique", `ALERTE : ${z.cbName.replace(" (simulée)", "")} — ${verb}`, `Surprise de ${Math.round(surprise * 100)} pb par rapport au consensus.`, "/play/actualites");
    pause(s, `ALERTE : la ${z.cbName.replace(" (simulée)", "")} ${verb} — décision inattendue.`);
    s.flags["lastRateShock"] = zoneId; s.flags["lastRateShockT"] = s.t; s.flags["lastRateShockBp"] = Math.round(surprise * 100);
  }
  return { move, surprise };
}

export function cbConsensus(z: Zone) {
  const diff = taylor(z) - z.policyRate;
  return Math.abs(diff) > 0.3 ? Math.sign(diff) * (Math.abs(diff) > 1.5 ? 0.5 : 0.25) : 0;
}

/** Publication statistique : consensus vs réalisé, chocs si surprise */
export function releaseStatistic(s: GameState, ev: CalendarEvent, rng: Rng) {
  const [kind, zid] = (ev.ref ?? "").split(":") as [string, ZoneId];
  const z = s.macro.zones[zid];
  if (!z) return;
  const cons = parseFloat(ev.consensus ?? "0");
  let actual = 0, surprise = 0, title = "", body = "";
  if (kind === "CPI") {
    actual = r1(z.inflation + rng.normal() * 0.1); surprise = actual - cons;
    title = `${ZONE_NAMES[zid]} : inflation à ${actual.toFixed(1)} % sur un an (consensus ${cons.toFixed(1)} %)`;
    body = surprise > 0.15 ? "L'inflation surprend à la hausse, ravivant les craintes d'un resserrement monétaire." : surprise < -0.15 ? "La désinflation se confirme, les marchés anticipent un assouplissement." : "Chiffre conforme aux attentes.";
    s.macro.factors[`ypend_${zid}`] = (s.macro.factors[`ypend_${zid}`] ?? 0) + surprise * 0.25;
    z.y2 += surprise * 0.2;
    applyShock(s, { kind: "zone", id: zid }, -surprise * 0.012, Math.abs(surprise) * 0.2);
  } else if (kind === "UNEMP") {
    actual = r1(z.unemployment + rng.normal() * 0.05); surprise = actual - cons;
    title = `${ZONE_NAMES[zid]} : taux de chômage à ${actual.toFixed(1)} % (consensus ${cons.toFixed(1)} %)`;
    body = surprise > 0.1 ? "Le marché du travail se dégrade plus vite que prévu ; les anticipations de récession progressent." : surprise < -0.1 ? "Le marché de l'emploi reste solide." : "Le marché du travail évolue comme prévu.";
    applyShock(s, { kind: "zone", id: zid }, -surprise * 0.01, 0);
    s.macro.factors[`ypend_${zid}`] = (s.macro.factors[`ypend_${zid}`] ?? 0) - surprise * 0.1;
  } else if (kind === "GDP") {
    actual = r1(z.growth + rng.normal() * 0.15); surprise = actual - cons;
    title = `${ZONE_NAMES[zid]} : croissance du PIB à ${actual.toFixed(1)} % en rythme annualisé (consensus ${cons.toFixed(1)} %)`;
    body = actual < 0 ? "L'économie se contracte : le spectre de la récession se précise." : surprise > 0.3 ? "La croissance dépasse les attentes." : surprise < -0.3 ? "La croissance déçoit nettement." : "Croissance conforme aux attentes.";
    applyShock(s, { kind: "zone", id: zid }, surprise * 0.01, 0);
  } else if (kind === "PMI") {
    actual = r1(50 + (z.growth - POTENTIAL[zid]) * 2.2 + z.industrial * 0.3 + rng.normal() * 0.6); surprise = actual - cons;
    title = `${ZONE_NAMES[zid]} : indice PMI manufacturier à ${actual.toFixed(1)} (consensus ${cons.toFixed(1)})`;
    body = actual < 50 ? "L'activité manufacturière se contracte (PMI < 50)." : "L'activité manufacturière est en expansion (PMI > 50).";
    applyShock(s, { kind: "sector", id: "Industrie" }, surprise * 0.003, 0);
  }
  ev.actual = kind === "PMI" ? actual.toFixed(1) : actual.toFixed(1) + " %";
  ev.done = true;
  const big = Math.abs(surprise) > (kind === "PMI" ? 1.5 : 0.25);
  pushNews(s, { category: "macro", title, body, impact: big ? "fort" : "faible", tickers: [], zones: [zid], sentiment: kind === "CPI" || kind === "UNEMP" ? -surprise : surprise });
  if (big && ev.importance === 3) notify(s, "alerte", title, body, "/play/calendrier");
}

/** Calendrier : planification des publications pour les jours à venir */
export function scheduleCalendar(s: GameState, upToDay: number) {
  const startDay = (s.flags["calendarUntil"] as number | undefined) ?? dayIndex(s.t) - 1;
  for (let d = startDay + 1; d <= upToDay; d++) {
    const date = new Date(Date.UTC(2027, 0, 1) + d * 86400000);
    const dom = date.getUTCDate(), wd = date.getUTCDay();
    if (wd === 0 || wd === 6) continue;
    const zonesStat: ZoneId[] = ["US", "EZ", "UK", "JP", "CN"];
    for (const zid of Object.keys(s.macro.zones) as ZoneId[]) {
      const z = s.macro.zones[zid];
      if (z.nextCbDay === d) s.calendar.push({ id: nextId(s, "cal"), day: d, minute: CB_TIME[zid], title: `Décision de politique monétaire — ${z.cbName.replace(" (simulée)", "")}`, zone: zid, kind: "banque_centrale", ref: zid, importance: zid === "US" || zid === "EZ" ? 3 : 2, consensus: "" });
    }
    zonesStat.forEach((zid, i) => {
      if (dom === 10 + i) s.calendar.push({ id: nextId(s, "cal"), day: d, minute: zid === "US" ? 14 * 60 + 30 : zid === "JP" || zid === "CN" ? 2 * 60 + 30 : 11 * 60, title: `Inflation (IPC) — ${ZONE_NAMES[zid]}`, zone: zid, kind: "statistique", ref: `CPI:${zid}`, importance: zid === "US" || zid === "EZ" ? 3 : 2 });
      if (dom >= 1 && dom <= 7 && wd === 5 && zid === "US") s.calendar.push({ id: nextId(s, "cal"), day: d, minute: 14 * 60 + 30, title: `Rapport sur l'emploi — États-Unis`, zone: "US", kind: "statistique", ref: `UNEMP:US`, importance: 3 });
      if (dom === 3 + i && zid !== "US") s.calendar.push({ id: nextId(s, "cal"), day: d, minute: 11 * 60, title: `Chômage — ${ZONE_NAMES[zid]}`, zone: zid, kind: "statistique", ref: `UNEMP:${zid}`, importance: 1 });
      if (dom === 1 + i) s.calendar.push({ id: nextId(s, "cal"), day: d, minute: zid === "US" ? 16 * 60 : 10 * 60, title: `PMI manufacturier — ${ZONE_NAMES[zid]}`, zone: zid, kind: "statistique", ref: `PMI:${zid}`, importance: 1 });
      if ([0, 3, 6, 9].includes(date.getUTCMonth()) && dom === 25 + i) s.calendar.push({ id: nextId(s, "cal"), day: d, minute: zid === "US" ? 14 * 60 + 30 : 11 * 60, title: `PIB trimestriel — ${ZONE_NAMES[zid]}`, zone: zid, kind: "statistique", ref: `GDP:${zid}`, importance: 3 });
    });
  }
  s.flags["calendarUntil"] = upToDay;
  // purge
  const cutoff = dayIndex(s.t) - 60;
  s.calendar = s.calendar.filter((c) => c.day >= cutoff);
  s.calendar.sort((a, b) => a.day - b.day || a.minute - b.minute);
}

/** Met à jour le consensus des publications du lendemain (anticipations des économistes) */
export function updateConsensus(s: GameState) {
  const today = dayIndex(s.t);
  for (const ev of s.calendar) {
    if (ev.done || ev.day > today + 2) continue;
    const z = ev.zone ? s.macro.zones[ev.zone] : undefined;
    if (!z) continue;
    if (ev.kind === "banque_centrale") { const c = cbConsensus(z); ev.consensus = String(c); }
    else if (ev.ref?.startsWith("CPI")) ev.consensus = r1(z.inflation - 0.05 * (z.inflation - z.inflationExp)).toFixed(1);
    else if (ev.ref?.startsWith("UNEMP")) ev.consensus = r1(z.unemployment).toFixed(1);
    else if (ev.ref?.startsWith("GDP")) ev.consensus = r1(z.growth * 0.8 + POTENTIAL[z.id] * 0.2).toFixed(1);
    else if (ev.ref?.startsWith("PMI")) ev.consensus = r1(50 + (z.growth - POTENTIAL[z.id]) * 2 + z.industrial * 0.3).toFixed(1);
  }
}

export function vixLike(s: GameState) { return Math.round((11 + 28 * s.macro.riskAversion * REGIMES[s.macro.regime].volMult) * 10) / 10; }
const r1 = (x: number) => Math.round(x * 10) / 10;
const r2 = (x: number) => Math.round(x * 100) / 100;
export { fmtDate };
