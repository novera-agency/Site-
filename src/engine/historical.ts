/**
 * Mode historique « 2000 → 2025 » : le moteur de marché est guidé vers des trajectoires réelles approchées
 * (indices, matières premières, changes, taux), les banques centrales appliquent les décisions réelles,
 * les régimes de marché suivent la chronologie et les grands événements sont publiés à leur date.
 * Les cours restent bruités par le modèle : seules les tendances et les points de retournement sont imposés.
 * Au-delà du dernier repère (fin 2025), la simulation redevient libre.
 */
import type { Currency, GameState, InstrumentDef, RegimeId, ZoneId } from "./types";
import { EPOCH_UTC, MIN_PER_DAY, dayIndex, nextBusinessDay, dayOfDate, fmtDate } from "./time";
import { SERIES_SRC, POLICY_SRC, MACRO_YEARLY, REGIME_TIMELINE, HIST_EVENTS, HIST_END, CB_REAL_NAMES, HIST_EPOCH } from "./data/history2000";
import { notify, pushNews, pause } from "./core";

export { HIST_EPOCH };

// ───────────── Séries ─────────────
type Pt = [number, number]; // [jour absolu (depuis 1970), valeur]
const absDay = (y: number, m: number, d: number) => Math.floor(Date.UTC(y, m, d) / 86400000);
function parseDate(txt: string): number {
  const [y, m, d] = txt.split("-").map(Number);
  return m ? absDay(y, m - 1, d || 15) : absDay(y, 11, 31);
}
function parseSeries(src: string): Pt[] {
  return src.split("|").map((x) => { const [d, v] = x.trim().split(/\s+/); return [parseDate(d), Number(v)] as Pt; }).sort((a, b) => a[0] - b[0]);
}
const SERIES: Record<string, Pt[]> = Object.fromEntries(Object.entries(SERIES_SRC).map(([k, v]) => [k, parseSeries(v)]));
const POLICY: Record<string, Pt[]> = Object.fromEntries(Object.entries(POLICY_SRC).map(([k, v]) => [k, parseSeries(v)]));
export const HIST_END_ABS = parseDate(HIST_END);

/** Jour absolu (fractionnaire) correspondant à un instant de jeu */
const absOf = (t: number) => EPOCH_UTC / 86400000 + t / MIN_PER_DAY;
const LOG_SERIES = new Set(Object.keys(SERIES).filter((k) => !k.startsWith("Y10_") && !k.startsWith("SPREAD_")));

/** Valeur interpolée d'une série au jour absolu `a` (log-linéaire pour les prix, linéaire pour les taux) */
export function seriesAt(key: string, a: number): number {
  const pts = SERIES[key];
  if (!pts?.length) return NaN;
  if (a <= pts[0][0]) return pts[0][1];
  if (a >= pts[pts.length - 1][0]) return pts[pts.length - 1][1];
  let lo = 0, hi = pts.length - 1;
  while (hi - lo > 1) { const mid = (lo + hi) >> 1; if (pts[mid][0] <= a) lo = mid; else hi = mid; }
  const [a0, v0] = pts[lo], [a1, v1] = pts[hi];
  const w = (a - a0) / (a1 - a0);
  return LOG_SERIES.has(key) ? Math.exp(Math.log(v0) + w * (Math.log(v1) - Math.log(v0))) : v0 + w * (v1 - v0);
}
export const seriesAtT = (key: string, t: number) => seriesAt(key, absOf(t));
export function firstAbs(key: string) { return SERIES[key]?.[0]?.[0] ?? 0; }
/** Taux directeur en vigueur (fonction en escalier) */
export function policyAt(zone: string, a: number): number | null {
  const pts = POLICY[zone];
  if (!pts) return null;
  let v = pts[0][1];
  for (const [d, r] of pts) { if (d <= a) v = r; else break; }
  return v;
}
/** Prochaine date de changement de taux (index de jour de jeu) après le jour `day` */
function nextPolicyChangeDay(zone: string, day: number): number {
  const pts = POLICY[zone];
  const a = absOf(day * MIN_PER_DAY);
  for (const [d] of pts ?? []) if (d > a + 0.5) return nextBusinessDay(Math.round(d - EPOCH_UTC / 86400000));
  return 10_000_000;
}
function macroAt(zone: keyof typeof MACRO_YEARLY, field: "growth" | "inflation" | "unemployment", a: number) {
  const arr = MACRO_YEARLY[zone][field];
  // valeur de l'année Y centrée au 1er juillet Y
  const yf = (a - absDay(2000, 6, 1)) / 365.25;
  if (yf <= 0) return arr[0];
  if (yf >= arr.length - 1) return arr[arr.length - 1];
  const i = Math.floor(yf), w = yf - i;
  return arr[i] + w * (arr[i + 1] - arr[i]);
}

export function isHist(s: GameState) { return !!s.historical; }
/** Le guidage historique est actif tant que l'on n'a pas dépassé le dernier repère */
export function histActive(s: GameState, t = s.t) { return !!s.historical && absOf(t) <= HIST_END_ABS + 1; }

// ───────────── Correspondances avec l'univers du jeu ─────────────
const ZONE_EQ: Record<ZoneId, string> = { US: "EQ_US", EZ: "EQ_EZ", UK: "EQ_UK", JP: "EQ_JP", CN: "EQ_CN", EM: "EQ_EM" };
const ZONE_Y10: Record<ZoneId, string> = { US: "Y10_US", EZ: "Y10_EZ", UK: "Y10_UK", JP: "Y10_JP", CN: "Y10_CN", EM: "Y10_EM" };
export const COMMO_KEY: Record<string, string> = { GOLD: "GOLD", SILV: "SILV", BRENT: "BRENT", WTI: "WTI", NGAS: "NGAS", COPR: "COPR", WHEA: "WHEA" };
export const CRYPTO_KEY: Record<string, string> = { AURC: "CRY_1", NEBL: "CRY_2", QNTA: "CRY_3", HLIO: "CRY_4" };
export const SPREAD_KEY: Record<string, string> = { FR10Y: "SPREAD_FR", IT10Y: "SPREAD_IT" };

function commoLevel(id: string, a: number) {
  if (id === "WTI") return seriesAt("BRENT", a) * seriesAt("WTI_RATIO", a);
  return seriesAt(COMMO_KEY[id], a);
}
/** log de la valeur d'une devise exprimée en dollars */
export function fxLogAt(cur: Currency, a: number): number {
  switch (cur) {
    case "USD": return 0;
    case "EUR": return Math.log(seriesAt("EURUSD", a));
    case "GBP": return Math.log(seriesAt("GBPUSD", a));
    case "JPY": return -Math.log(seriesAt("USDJPY", a));
    case "CHF": return Math.log(seriesAt("EURUSD", a) / seriesAt("EURCHF", a));
    case "CAD": return -Math.log(seriesAt("USDCAD", a));
    case "AUD": return Math.log(seriesAt("AUDUSD", a));
    case "CNY": return -Math.log(seriesAt("USDCNY", a));
  }
}
/** Ajustements sectoriels (log) par rapport à l'indice de la zone */
function sectorLog(d: InstrumentDef, a: number): number {
  switch (d.sector) {
    case "Technologie": return (d.zone === "US" ? 1 : 0.6) * Math.log(seriesAt("EQ_TECH", a) / seriesAt("EQ_US", a));
    case "Banque": return (d.zone === "EZ" ? 1 : 0.55) * Math.log(seriesAt("EQ_BANK", a) / seriesAt("EQ_EZ", a));
    case "Assurance": return 0.35 * Math.log(seriesAt("EQ_BANK", a) / seriesAt("EQ_EZ", a));
    case "Énergie": return 0.35 * Math.log(seriesAt("BRENT", a));
    case "Matériaux": return 0.3 * Math.log(seriesAt("COPR", a));
    default: return 0;
  }
}
/**
 * Normalisation des ajustements sectoriels d'une zone : log de la moyenne pondérée (capitalisations de départ) des
 * rapports exp(A(t) − A(t0)). Ainsi la somme des capitalisations cibles de la zone suit exactement l'indice de référence.
 */
const meanCache = new Map<string, Record<string, number>>();
function zoneMeanAdj(s: GameState, zone: ZoneId, a: number) {
  const key = `${s.seed}|${s.createdAt}|${a}`;
  let m = meanCache.get(key);
  if (!m) {
    const a0 = s.flags["histA0"] as number;
    const num: Record<string, number> = {}, den: Record<string, number> = {};
    for (const d of Object.values(s.instruments)) {
      if (d.cls !== "action") continue;
      const w = ((s.flags[`hp0_${d.id}`] as number) ?? 1) * (d.shares ?? 1);
      num[d.zone] = (num[d.zone] ?? 0) + w * Math.exp(sectorLog(d, a) - sectorLog(d, a0)); den[d.zone] = (den[d.zone] ?? 0) + w;
    }
    m = {}; for (const z of Object.keys(num)) m[z] = Math.log(num[z] / den[z]);
    if (meanCache.size > 8) meanCache.clear();
    meanCache.set(key, m);
  }
  return m[zone] ?? 0;
}
/** log de la trajectoire cible d'une action (à une constante près) */
function stockLog(s: GameState, d: InstrumentDef, a: number) { return Math.log(seriesAt(ZONE_EQ[d.zone], a)) + sectorLog(d, a) - (a === s.flags["histA0"] ? 0 : zoneMeanAdj(s, d.zone, a)); }

/** Valeur cible (log) d'un instrument primaire à l'instant t, recalée sur son prix de départ */
let tlKey = "";
const tlCache = new Map<string, number | null>();
const base0 = new Map<string, number>();
export function targetLog(s: GameState, id: string, t: number): number | null {
  const key = `${s.seed}|${s.createdAt}|${t}`;
  if (key !== tlKey) { tlKey = key; tlCache.clear(); }
  const c = tlCache.get(id);
  if (c !== undefined) return c;
  const v = targetLogRaw(s, id, t);
  tlCache.set(id, v);
  return v;
}
function targetLogRaw(s: GameState, id: string, t: number): number | null {
  const d = s.instruments[id];
  const a = absOf(t), a0 = s.flags["histA0"] as number;
  if (d.cls === "action") {
    const bk = `${s.seed}|${s.createdAt}|${id}`;
    let b0 = base0.get(bk);
    if (b0 === undefined) { b0 = Math.log(s.flags[`hp0_${id}`] as number) - stockLog(s, d, a0); if (base0.size > 2000) base0.clear(); base0.set(bk, b0); }
    return b0 + stockLog(s, d, a);
  }
  if (d.cls === "matiere" && COMMO_KEY[id]) return Math.log(commoLevel(id, a));
  if (d.cls === "crypto" && CRYPTO_KEY[id]) return Math.log(seriesAt(CRYPTO_KEY[id], a));
  return null;
}
/** Rapport multiplicatif « cible au jour day / cible au départ » (sert à reconstituer l'historique 1999) */
export function histAdjust(s: GameState) {
  return {
    prim: (id: string, day: number) => { const L = targetLog(s, id, day * MIN_PER_DAY + 17 * 60); return L === null ? 1 : Math.exp(L); },
    fx: (cur: Currency, day: number) => fxLogAt(cur, absOf(day * MIN_PER_DAY + 17 * 60)),
  };
}

/** Rendement logarithmique de guidage pour un pas : avance de la cible + rappel vers la cible */
export function steer(s: GameState, key: string, Lnow: number, current: number, k: number, dt: number) {
  const fk = `hl_${key}`;
  const Lp = (s.macro.factors[fk] as number | undefined) ?? Lnow;
  s.macro.factors[fk] = Lnow;
  return (Lnow - Lp) + k * (Lnow - current) * dt;
}
export function y10Target(z: ZoneId, t: number) { return seriesAtT(ZONE_Y10[z], t); }
export function spreadTarget(id: string, t: number) { const k = SPREAD_KEY[id]; return k ? seriesAtT(k, t) : null; }

// ───────────── Initialisation d'une partie historique ─────────────
const CATALOG_Y10: Record<ZoneId, number> = { US: 4.1, EZ: 2.7, UK: 4.4, JP: 1.6, CN: 1.9, EM: 7.0 };
const fmtPct2 = (x: number) => x.toFixed(2).replace(".", ",");

/** Prix de départ des instruments guidés (avant construction des paniers) */
export function histInitialPrices(t0: number, initialPrices: Record<string, number>, fxInit: Record<Currency, number>) {
  const a0 = absOf(t0);
  for (const id of Object.keys(COMMO_KEY)) if (initialPrices[id] !== undefined) initialPrices[id] = commoLevel(id, a0);
  if (initialPrices["IDX-US"] !== undefined) initialPrices["IDX-US"] = seriesAt("EQ_US", a0);
  if (initialPrices["IDX-EU"] !== undefined) initialPrices["IDX-EU"] = seriesAt("EQ_EZ", a0);
  for (const c of Object.keys(fxInit) as Currency[]) fxInit[c] = Math.exp(fxLogAt(c, a0));
}

/** Adapte l'état d'une partie nouvellement créée au 3 janvier 2000 */
export function initHistorical(s: GameState) {
  const t0 = s.t, a0 = absOf(t0), day0 = dayIndex(t0);
  s.flags["histA0"] = a0;
  for (const d of Object.values(s.instruments)) if (d.cls === "action") s.flags[`hp0_${d.id}`] = s.quotes[d.id].price;
  // Économie au 1er janvier 2000
  for (const z of Object.values(s.macro.zones)) {
    const zk = z.id as keyof typeof MACRO_YEARLY;
    z.growth = macroAt(zk, "growth", a0); z.inflation = macroAt(zk, "inflation", a0); z.inflationExp = z.inflation; z.unemployment = macroAt(zk, "unemployment", a0);
    z.y10 = y10Target(z.id, t0);
    const pr = policyAt(z.id, a0);
    if (pr !== null) { z.policyRate = pr; z.nextCbDay = nextPolicyChangeDay(z.id, day0); }
    else z.policyRate = 9;
    z.y2 = z.policyRate + 0.3; z.y30 = z.y10 + 0.3;
    z.cbName = CB_REAL_NAMES[z.id] ?? z.cbName;
    s.macro.factors[`y10_0_${z.id}`] = z.y10;
    z.history = [];
  }
  s.macro.regime = "bulle"; s.macro.regimeSinceDay = day0; s.macro.regimeHistory = [{ day: day0, regime: "bulle" }]; s.macro.riskAversion = 0.25;
  s.flags["histRegimeIdx"] = REGIME_TIMELINE.findIndex(([d]) => parseDate(d) > a0) - 1;
  // Obligations : coupons au niveau des taux de 2000, années d'échéance cohérentes
  for (const d of Object.values(s.instruments)) {
    if (!d.bond) continue;
    const b = d.bond;
    s.flags[`tenor_${d.id}`] = Math.max(1, Math.round((b.maturityDay - day0) / 365 * 2) / 2);
    if (!b.floating) {
      const nc = Math.max(0.005, Math.round((b.couponRate + (s.macro.zones[d.zone].y10 - CATALOG_Y10[d.zone]) / 100) * 800) / 800);
      d.name = d.name.replace(/\d+,\d+ %/, `${fmtPct2(nc * 100)} %`);
      b.couponRate = nc;
    }
    d.name = d.name.replace(/\b20(2\d|3\d)\b/, (y) => String(Number(y) - (2027 - HIST_EPOCH)));
    d.description = (d.description ?? "").replace(/\b20(2\d|3\d)\b/g, (y) => String(Number(y) - (2027 - HIST_EPOCH))).replace(/coupon \d+\.\d+ %/, `coupon ${(b.couponRate * 100).toFixed(2)} %`);
  }
  const note: Record<string, string> = { "IDX-US": " Suit approximativement le S&P 500.", "IDX-EU": " Suit approximativement l'Euro Stoxx 50 et le FTSE 100.", "IDX-AS": " Suit approximativement le Nikkei et le Hang Seng.", "IDX-WD": " Suit approximativement les grandes bourses mondiales." };
  for (const [id, n] of Object.entries(note)) if (s.instruments[id]) s.instruments[id].description = (s.instruments[id].description ?? "") + n;
  for (const [id, k] of Object.entries(CRYPTO_KEY)) {
    if (!s.instruments[id]) continue;
    s.instruments[id].description = (s.instruments[id].description ?? "") + ` Mode historique : apparaît le ${fmtDate(Math.round((firstAbs(k) - EPOCH_UTC / 86400000)) * MIN_PER_DAY, false)}.`;
  }
  delete s.flags["scriptedCrisisDay"];
  s.flags["histEventIdx"] = 0;
}

/** Après la reconstitution de l'historique : les cryptoactifs pas encore créés sont suspendus */
export function histAfterHistory(s: GameState) {
  for (const id of Object.keys(CRYPTO_KEY)) {
    const q = s.quotes[id];
    if (!q) continue;
    if (absOf(s.t) < firstAbs(CRYPTO_KEY[id])) { q.halted = true; q.daily = []; q.intraday = []; q.price = seriesAt(CRYPTO_KEY[id], firstAbs(CRYPTO_KEY[id])); q.prevClose = q.price; }
  }
}

// ───────────── Chaque jour ─────────────
/** Décision réelle d'une banque centrale (appelée à la date du changement) */
export function histCbDecision(s: GameState, zoneId: ZoneId) {
  const z = s.macro.zones[zoneId];
  const day = dayIndex(s.t);
  const a = absOf(s.t + 6 * 60);
  const r = policyAt(zoneId, a);
  if (r === null) return null;
  const move = Math.round((r - z.policyRate) * 100) / 100;
  z.policyRate = r;
  z.nextCbDay = nextPolicyChangeDay(zoneId, day);
  if (move !== 0) {
    const bp = Math.round(move * 100);
    const verb = bp > 0 ? `relève son taux directeur de ${bp} points de base` : `abaisse son taux directeur de ${-bp} points de base`;
    pushNews(s, { category: "banques_centrales", title: `La ${z.cbName} ${verb}, à ${r.toFixed(2).replace(".", ",")} %`, body: `${verb.charAt(0).toUpperCase() + verb.slice(1)}. Inflation : ${z.inflation.toFixed(1)} %, croissance : ${z.growth.toFixed(1)} %, chômage : ${z.unemployment.toFixed(1)} %. (Décision historique.)`, impact: Math.abs(bp) >= 50 ? "fort" : "moyen", tickers: [], zones: [zoneId], sentiment: -move });
    z.y2 += move * 0.5;
  }
  return { move, surprise: 0 };
}

/** Prochain jour de décision (pour le calendrier) */
export function histNextCbDay(zoneId: ZoneId, day: number) { return POLICY[zoneId] ? nextPolicyChangeDay(zoneId, day) : null; }

/** Rappel quotidien de l'économie, des régimes et publication des événements de la chronologie */
export function histDaily(s: GameState, setRegime: (s: GameState, r: RegimeId, cause?: string) => void) {
  if (!s.historical) return;
  const a = absOf(s.t + 12 * 60);
  if (!histActive(s)) {
    if (!s.flags["histEnded"]) {
      s.flags["histEnded"] = true;
      notify(s, "info", "Fin des repères historiques", "Depuis le 1er janvier 2026, les marchés évoluent librement selon le modèle de simulation.", "/play/actualites");
    }
    return;
  }
  // Économie : rappel vers les moyennes annuelles réelles
  const dt = 1 / 252;
  for (const z of Object.values(s.macro.zones)) {
    const zk = z.id as keyof typeof MACRO_YEARLY;
    z.growth += 30 * (macroAt(zk, "growth", a) - z.growth) * dt;
    z.inflation += 30 * (macroAt(zk, "inflation", a) - z.inflation) * dt;
    z.unemployment += 30 * (macroAt(zk, "unemployment", a) - z.unemployment) * dt;
  }
  // Régime de marché selon la chronologie
  let idx = (s.flags["histRegimeIdx"] as number) ?? -1;
  while (idx + 1 < REGIME_TIMELINE.length && parseDate(REGIME_TIMELINE[idx + 1][0]) <= a) {
    idx++;
    const r = REGIME_TIMELINE[idx][1] as RegimeId;
    if (s.macro.regime !== r) setRegime(s, r);
  }
  s.flags["histRegimeIdx"] = idx;
  // Événements datés
  let e = (s.flags["histEventIdx"] as number) ?? 0;
  while (e < HIST_EVENTS.length && parseDate(HIST_EVENTS[e][0]) <= a) {
    const [date, cat, imp, title, body] = HIST_EVENTS[e];
    const late = a - parseDate(date) > 3; // événements « rattrapés » après un saut de temps : pas de pause
    pushNews(s, { category: cat, title, body: body || title, impact: imp === 3 ? "fort" : imp === 2 ? "moyen" : "faible", tickers: [], zones: [], sentiment: 0 });
    if (imp === 3) {
      for (const q of Object.values(s.quotes)) q.ivBump = Math.min(2, q.ivBump + 0.4);
      notify(s, "critique", title, body || undefined, "/play/actualites");
      if (!late) pause(s, `${fmtDate(s.t, false)} — ${title}`);
    } else if (imp === 2) notify(s, "alerte", title, undefined, "/play/actualites");
    e++;
  }
  s.flags["histEventIdx"] = e;
  // Cryptoactifs : première cotation
  for (const [id, k] of Object.entries(CRYPTO_KEY)) {
    const q = s.quotes[id];
    if (!q?.halted || q.defaulted) continue;
    if (a >= firstAbs(k)) {
      q.halted = false; q.price = seriesAt(k, a); q.prevClose = q.price; q.dayOpen = q.dayHigh = q.dayLow = q.price;
      delete s.macro.factors[`hl_${id}`];
      pushNews(s, { category: "marches", title: `Nouveau cryptoactif : ${s.instruments[id].name} commence à s'échanger`, body: `${s.instruments[id].description ?? ""} Premier cours : ${q.price < 1 ? q.price.toPrecision(2) : q.price.toFixed(2)} $.`, impact: "faible", tickers: [id], zones: [], sentiment: 0.2 });
    }
  }
  // Obligations arrivées à échéance : réémission d'une nouvelle souche (même durée, coupon au taux du marché)
  rollBonds(s);
}

function rollBonds(s: GameState) {
  const day = dayIndex(s.t);
  for (const d of Object.values(s.instruments)) {
    const b = d.bond, q = s.quotes[d.id];
    if (!b || !q.halted || q.defaulted || day < b.maturityDay) continue;
    const tenor = (s.flags[`tenor_${d.id}`] as number) ?? 5;
    const z = s.macro.zones[d.zone];
    const newMat = nextBusinessDay(day + Math.round(tenor * 365));
    const newYear = new Date(EPOCH_UTC + newMat * 86400000).getUTCFullYear();
    if (!b.floating) {
      const nc = Math.max(0.0025, Math.round((z.y10 + b.spreadBps / 100) * 8) / 800);
      b.couponRate = nc;
      d.name = d.name.replace(/\d+,\d+ %/, `${fmtPct2(nc * 100)} %`);
    }
    b.maturityDay = newMat;
    d.name = d.name.replace(/\b(19|20)\d\d\b/, String(newYear));
    d.description = (d.description ?? "").replace(/échéance (19|20)\d\d/, `échéance ${newYear}`);
    delete s.flags[`cpn_${d.id}`];
    q.halted = false;
    pushNews(s, { category: "marches", title: `Nouvelle émission : ${d.name}`, body: `${b.issuer} remplace sa souche arrivée à échéance par un nouvel emprunt à ${tenor} ans.`, impact: "faible", tickers: [d.id], zones: [d.zone], sentiment: 0 });
  }
}

/** Scénarios de crise du moteur rattachés à des dates réelles (récit autour des banques fictives) */
export const HIST_CRISES: [string, "liquidite_bancaire" | "defaut_souverain", string?][] = [
  ["2011-08-05", "defaut_souverain"],
  ["2023-03-08", "liquidite_bancaire", "PCBK"],
];
export function histScriptedCrisis(s: GameState): [string, "liquidite_bancaire" | "defaut_souverain", string?] | null {
  if (!histActive(s)) return null;
  const a = absOf(s.t);
  for (const c of HIST_CRISES) {
    const key = `histCrisis_${c[0]}`;
    if (!s.flags[key] && a >= parseDate(c[0]) && a - parseDate(c[0]) < 20) { s.flags[key] = true; return c; }
  }
  return null;
}

/** Jour de jeu d'une date réelle (pour les tests) */
export function histDay(y: number, m: number, d: number) { return dayOfDate(y, m, d); }
