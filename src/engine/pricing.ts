/**
 * PricingEngine — valorisation des instruments.
 * - Options européennes : Black-Scholes(-Merton) avec rendement continu q, grecques analytiques.
 * - Obligations : actualisation des flux (taux actuariel), duration, sensibilité, convexité, DV01.
 * - Futures : prix de portage (cost of carry).
 * - Produits structurés : Monte-Carlo déterministe (graine propre au produit) pour l'indication de valeur.
 */
import type { InstrumentDef, Zone } from "./types";
import { addMonthsDay, MIN_PER_DAY } from "./time";
import { Rng, seedRng } from "./rng";

/* ───── Loi normale ───── */
export function normCdf(x: number): number {
  // Approximation d'Abramowitz-Stegun (erreur < 7.5e-8)
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429, p = 0.3275911;
  const sign = x < 0 ? -1 : 1;
  const ax = Math.abs(x) / Math.SQRT2;
  const t = 1 / (1 + p * ax);
  const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-ax * ax);
  return 0.5 * (1 + sign * y);
}
export const normPdf = (x: number) => Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);

export interface Greeks { price: number; delta: number; gamma: number; theta: number; vega: number; rho: number; intrinsic: number; timeValue: number; d1: number; d2: number; }

/** Black-Scholes-Merton. T en années, r et q continus (décimaux), sigma décimal. theta par jour, vega/rho pour 1 point (1 %). */
export function blackScholes(type: "call" | "put", S: number, K: number, T: number, r: number, sigma: number, q = 0): Greeks {
  const intrinsic = Math.max(0, type === "call" ? S - K : K - S);
  if (T <= 1e-8 || sigma <= 1e-8) {
    const itm = intrinsic > 0;
    return { price: intrinsic, delta: itm ? (type === "call" ? 1 : -1) : 0, gamma: 0, theta: 0, vega: 0, rho: 0, intrinsic, timeValue: 0, d1: 0, d2: 0 };
  }
  const sq = Math.sqrt(T);
  const d1 = (Math.log(S / K) + (r - q + 0.5 * sigma * sigma) * T) / (sigma * sq);
  const d2 = d1 - sigma * sq;
  const dfq = Math.exp(-q * T), dfr = Math.exp(-r * T);
  let price: number, delta: number, theta: number, rho: number;
  if (type === "call") {
    price = S * dfq * normCdf(d1) - K * dfr * normCdf(d2);
    delta = dfq * normCdf(d1);
    theta = -(S * dfq * normPdf(d1) * sigma) / (2 * sq) - r * K * dfr * normCdf(d2) + q * S * dfq * normCdf(d1);
    rho = K * T * dfr * normCdf(d2);
  } else {
    price = K * dfr * normCdf(-d2) - S * dfq * normCdf(-d1);
    delta = -dfq * normCdf(-d1);
    theta = -(S * dfq * normPdf(d1) * sigma) / (2 * sq) + r * K * dfr * normCdf(-d2) - q * S * dfq * normCdf(-d1);
    rho = -K * T * dfr * normCdf(-d2);
  }
  const gamma = (dfq * normPdf(d1)) / (S * sigma * sq);
  const vega = S * dfq * normPdf(d1) * sq;
  price = Math.max(price, 0);
  return { price, delta, gamma, theta: theta / 365, vega: vega / 100, rho: rho / 100, intrinsic, timeValue: Math.max(0, price - intrinsic), d1, d2 };
}

/** Volatilité implicite par Newton-Raphson + bissection de secours */
export function impliedVol(type: "call" | "put", target: number, S: number, K: number, T: number, r: number, q = 0): number {
  let lo = 0.001, hi = 5, sig = 0.3;
  for (let i = 0; i < 60; i++) {
    const g = blackScholes(type, S, K, T, r, sig, q);
    const diff = g.price - target;
    if (Math.abs(diff) < 1e-6) return sig;
    if (diff > 0) hi = sig; else lo = sig;
    const v = g.vega * 100;
    sig = v > 1e-6 ? sig - diff / v : (lo + hi) / 2;
    if (sig <= lo || sig >= hi) sig = (lo + hi) / 2;
  }
  return sig;
}

/** Arbre binomial CRR (options américaines, méthode alternative) */
export function binomialAmerican(type: "call" | "put", S: number, K: number, T: number, r: number, sigma: number, q = 0, steps = 200): number {
  const dt = T / steps, u = Math.exp(sigma * Math.sqrt(dt)), d = 1 / u;
  const p = (Math.exp((r - q) * dt) - d) / (u - d), disc = Math.exp(-r * dt);
  const v: number[] = [];
  for (let i = 0; i <= steps; i++) { const s = S * u ** (steps - i) * d ** i; v[i] = Math.max(0, type === "call" ? s - K : K - s); }
  for (let n = steps - 1; n >= 0; n--) for (let i = 0; i <= n; i++) {
    const s = S * u ** (n - i) * d ** i;
    v[i] = Math.max(disc * (p * v[i] + (1 - p) * v[i + 1]), type === "call" ? s - K : K - s);
  }
  return v[0];
}

/** Volatilité implicite modélisée : volatilité de référence + smile/skew + terme */
export function modelIV(baseVol: number, S: number, K: number, T: number, cls: string) {
  const m = Math.log(K / S);
  const skew = cls === "crypto" ? -0.1 : -0.35;
  const smile = 0.6;
  const term = 1 + 0.08 * Math.exp(-T * 4);
  return Math.max(0.05, baseVol * term * (1 + skew * m + smile * m * m));
}

/* ───── Courbe des taux et obligations ───── */
export function zoneYield(z: Zone, years: number) {
  const pts: [number, number][] = [[0, z.policyRate], [2, z.y2], [10, z.y10], [30, z.y30]];
  if (years <= 0) return z.policyRate;
  for (let i = 1; i < pts.length; i++) {
    if (years <= pts[i][0]) {
      const [x0, y0] = pts[i - 1], [x1, y1] = pts[i];
      return y0 + ((y1 - y0) * (years - x0)) / (x1 - x0);
    }
  }
  return z.y30;
}

export function couponSchedule(def: InstrumentDef, fromDay: number): number[] {
  const b = def.bond!;
  const months = 12 / b.freq;
  const days: number[] = [];
  for (let k = 0; ; k++) {
    const d = addMonthsDay(b.maturityDay, -k * months);
    if (d <= fromDay) break;
    days.unshift(d);
    if (k > 400) break;
  }
  return days;
}

export interface BondAnalytics { price: number; ytm: number; macaulay: number; modified: number; convexity: number; dv01: number; accrued: number; nextCoupon?: number; yearsToMaturity: number; couponRate: number; }

/** Prix (en % du nominal, coupon couru inclus) actualisé au taux actuariel y (décimal) */
export function bondPriceFromYield(def: InstrumentDef, day: number, y: number, floatingIndex?: number): BondAnalytics {
  const b = def.bond!;
  const sched = couponSchedule(def, day);
  const yearsToMaturity = Math.max(0, (b.maturityDay - day) / 365);
  const cRate = b.floating ? (floatingIndex ?? 0) / 100 + b.couponRate : b.couponRate;
  if (sched.length === 0) return { price: 100, ytm: y, macaulay: 0, modified: 0, convexity: 0, dv01: 0, accrued: 0, yearsToMaturity: 0, couponRate: cRate };
  const cpn = (100 * cRate) / b.freq;
  let pv = 0, tw = 0, cx = 0;
  for (let i = 0; i < sched.length; i++) {
    const tau = (sched[i] - day) / 365;
    const cf = cpn + (i === sched.length - 1 ? 100 : 0);
    const df = Math.pow(1 + y, -tau);
    pv += cf * df; tw += tau * cf * df; cx += tau * (tau + 1) * cf * df;
  }
  const macaulay = pv > 0 ? tw / pv : 0;
  const modified = macaulay / (1 + y);
  const convexity = pv > 0 ? cx / (pv * (1 + y) ** 2) : 0;
  // couru approximatif (information)
  const prevCpnDay = addMonthsDay(sched[0], -12 / b.freq);
  const accrued = cpn * Math.min(1, Math.max(0, (day - prevCpnDay) / Math.max(1, sched[0] - prevCpnDay)));
  // FRN : la sensibilité aux taux se limite à la période jusqu'au prochain fixing
  const effMod = b.floating ? Math.min(modified, (sched[0] - day) / 365) : modified;
  return { price: pv, ytm: y, macaulay, modified: effMod, convexity, dv01: (effMod * pv) / 10000, accrued, nextCoupon: sched[0], yearsToMaturity, couponRate: cRate };
}

/** Taux actuariel d'un prix donné (bissection) */
export function yieldFromPrice(def: InstrumentDef, day: number, price: number, floatingIndex?: number) {
  let lo = -0.02, hi = 0.6;
  for (let i = 0; i < 80; i++) {
    const mid = (lo + hi) / 2;
    const p = bondPriceFromYield(def, day, mid, floatingIndex).price;
    if (p > price) lo = mid; else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Prix de portage d'un future : F = S·e^{(r−q)T} */
export function futurePrice(spot: number, r: number, q: number, T: number) { return spot * Math.exp((r - q) * Math.max(0, T)); }

/** Simulation Monte-Carlo log-normale corrélée simplifiée (paniers équipondérés, corrélation ρ) */
export function mcPaths(seed: string, s0: number[], vols: number[], rho: number, r: number, days: number[], nPaths: number): number[][][] {
  const rng = new Rng(seedRng(seed));
  const out: number[][][] = [];
  for (let p = 0; p < nPaths; p++) {
    const path: number[][] = [];
    const cur = s0.slice();
    let prev = 0;
    for (const d of days) {
      const dt = Math.max(1, d - prev) / 365; prev = d;
      const zc = rng.normal();
      for (let i = 0; i < cur.length; i++) {
        const z = Math.sqrt(rho) * zc + Math.sqrt(1 - rho) * rng.normal();
        cur[i] *= Math.exp((r - 0.5 * vols[i] ** 2) * dt + vols[i] * Math.sqrt(dt) * z);
      }
      path.push(cur.slice());
    }
    out.push(path);
  }
  return out;
}

export const minutesToYears = (min: number) => min / (365 * MIN_PER_DAY);
