/** PortfolioEngine + RiskEngine — valorisation des comptes, expositions, VaR, Sharpe, drawdown, marge. */
import type { Account, Currency, GameState, Position } from "./types";
import { cashBalances, bal, marginAcc } from "./ledger";
import { fx, multiplier, toEur } from "./core";
import { blackScholes } from "./pricing";
import { optionIV, rateFor, dividendYield } from "./market";
import { MIN_PER_DAY } from "./time";

export interface PositionView {
  instrumentId: string; name: string; cls: string; qty: number; avgPrice: number; price: number; currency: Currency;
  mvLocal: number; mvEur: number; costEur: number; unrealizedEur: number; unrealizedPct: number; dayChangePct: number;
  sector?: string; zone: string; weight: number; delta?: number; notionalEur: number; realizedEur: number;
}

/** Valeur de marché « comptable » d'une position (EUR). Futures : uniquement le P&L non encore réglé. */
export function positionValueEur(s: GameState, p: Position) {
  const d = s.instruments[p.instrumentId];
  const q = s.quotes[p.instrumentId];
  if (!d || !q) return 0;
  const m = multiplier(d);
  if (d.future) return toEur(s, (q.price - (p.lastSettle ?? p.avgPrice)) * p.qty * m, d.currency);
  return toEur(s, q.price * p.qty * m, d.currency);
}
export function cashEur(s: GameState, accId: string) {
  let v = 0;
  for (const [cur, c] of Object.entries(cashBalances(s, accId))) v += toEur(s, c! / 100, cur as Currency);
  return v;
}
export function lockedMarginEur(s: GameState, accId: string) {
  let v = 0;
  for (const cur of ["EUR", "USD", "GBP", "CHF", "JPY", "CAD", "AUD", "CNY"] as Currency[]) v += toEur(s, bal(s, marginAcc(accId), cur) / 100, cur);
  return v;
}
export function accountEquity(s: GameState, accId: string) {
  const a = s.accounts[accId];
  if (!a) return 0;
  let v = cashEur(s, accId) + lockedMarginEur(s, accId);
  for (const p of Object.values(a.positions)) v += positionValueEur(s, p);
  for (const h of s.structuredHoldings) if (h.account === accId && h.status === "actif") v += structuredValueEur(s, h.productId, h.nominal / 100);
  return v;
}
/** Valeur indicative d'un produit structuré (approximation : proportion de la performance du pire sous-jacent, bornée) */
export function structuredValueEur(s: GameState, productId: string, nominal: number) {
  const p = s.structuredProducts.find((x) => x.id === productId);
  if (!p) return nominal;
  const perf = Math.min(...p.underlyings.map((u) => s.quotes[u].price / p.initial[u]));
  const issuerStress = p.issuerStock ? s.quotes[p.issuerStock]?.stress ?? 0 : 0;
  let v: number;
  if (p.kind === "capital_protege") v = nominal * Math.max(p.capitalProtection, 0.97 + 0.5 * Math.max(0, perf - 1) * p.participation);
  else if (p.kind === "participation") v = nominal * Math.max(0.05, 1 + (perf - 1) * p.participation);
  else if (perf >= p.protectionBarrier) v = nominal * Math.min(1.02, 0.96 + 0.08 * (perf - p.protectionBarrier) / Math.max(0.01, 1 - p.protectionBarrier));
  else v = nominal * perf * 0.98;
  return v * (1 - issuerStress * 0.5);
}

export function positionViews(s: GameState, accId: string): PositionView[] {
  const a = s.accounts[accId];
  if (!a) return [];
  const eq = Math.max(1, accountEquity(s, accId));
  return Object.values(a.positions).map((p) => {
    const d = s.instruments[p.instrumentId], q = s.quotes[p.instrumentId];
    const m = multiplier(d);
    const mvLocal = q.price * p.qty * m;
    const mvEur = toEur(s, mvLocal, d.currency);
    const costEur = toEur(s, p.avgPrice * p.qty * m, d.currency);
    const unrealizedEur = mvEur - costEur;
    let delta: number | undefined;
    let notionalEur = Math.abs(mvEur);
    if (d.option) {
      const u = s.quotes[d.option.underlying];
      const T = Math.max(0, (d.option.expiryDay * MIN_PER_DAY + 17.5 * 60 - s.t) / (365 * MIN_PER_DAY));
      const g = blackScholes(d.option.type, u.price, d.option.strike, T, rateFor(s, d.currency) / 100, optionIV(s, d.option.underlying, d.option.strike, T), dividendYield(s, s.instruments[d.option.underlying]));
      delta = g.delta * p.qty * m;
      notionalEur = Math.abs(toEur(s, delta * u.price, d.currency));
    }
    if (d.future) notionalEur = Math.abs(mvEur);
    return {
      instrumentId: p.instrumentId, name: d.name, cls: d.cls, qty: p.qty, avgPrice: p.avgPrice, price: q.price, currency: d.currency,
      mvLocal, mvEur: d.future ? positionValueEur(s, p) : mvEur, costEur, unrealizedEur: d.future ? toEur(s, (q.price - p.avgPrice) * p.qty * m, d.currency) : unrealizedEur,
      unrealizedPct: costEur !== 0 ? (unrealizedEur / Math.abs(costEur)) * 100 : 0,
      dayChangePct: q.prevClose > 0 ? (q.price / q.prevClose - 1) * 100 : 0, sector: d.sector, zone: d.zone, weight: (notionalEur / eq) * 100 * Math.sign(p.qty), delta, notionalEur, realizedEur: p.realized / 100,
    };
  });
}

export function exposures(s: GameState, accId: string) {
  const views = positionViews(s, accId);
  const eq = Math.max(1, accountEquity(s, accId));
  const sector: Record<string, number> = {}, zone: Record<string, number> = {}, currency: Record<string, number> = {}, cls: Record<string, number> = {};
  for (const v of views) {
    const signed = v.notionalEur * Math.sign(v.qty) * (v.delta !== undefined ? Math.sign(v.delta) * Math.sign(v.qty) : 1);
    const d = s.instruments[v.instrumentId];
    const sec = d.sector ?? (d.cls === "obligation" ? "Obligations" : d.cls === "etf" ? "ETF" : d.cls === "devise" ? "Devises" : d.cls === "matiere" ? "Matières premières" : d.cls === "crypto" ? "Crypto" : "Dérivés");
    sector[sec] = (sector[sec] ?? 0) + signed;
    zone[d.zone] = (zone[d.zone] ?? 0) + signed;
    cls[d.cls] = (cls[d.cls] ?? 0) + signed;
    if (d.cls === "devise") { const base = d.id.slice(0, 3), quote = d.id.slice(3); currency[base] = (currency[base] ?? 0) + signed; currency[quote] = (currency[quote] ?? 0) - signed; }
    else if (!d.future) currency[d.currency] = (currency[d.currency] ?? 0) + signed;
  }
  for (const [cur, c] of Object.entries(cashBalances(s, accId))) currency[cur] = (currency[cur] ?? 0) + toEur(s, c! / 100, cur as Currency);
  const pct = (o: Record<string, number>) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, (v / eq) * 100]));
  const largest = views.reduce((m, v) => Math.max(m, Math.abs(v.weight)), 0);
  const hhi = views.reduce((m, v) => m + (v.weight / 100) ** 2, 0);
  const gross = views.reduce((m, v) => m + v.notionalEur, 0);
  return { sector: pct(sector), zone: pct(zone), currency: pct(currency), cls: pct(cls), largestWeight: largest, hhi, grossLeverage: gross / eq, positions: views.length };
}

/** VaR historique 1 jour (simulation historique sur les 100 derniers jours de la simulation) */
export function valueAtRisk(s: GameState, accId: string, conf = 0.99, horizonDays = 1) {
  const a = s.accounts[accId];
  const views = positionViews(s, accId);
  if (!a || views.length === 0) return { var: 0, es: 0, scenarios: 0, stressed: [] as { name: string; pnl: number }[] };
  const N = 100;
  const pnl: number[] = new Array(N).fill(0);
  let used = 0;
  for (const v of views) {
    const d = s.instruments[v.instrumentId];
    const refId = d.option?.underlying ?? d.future?.underlying ?? v.instrumentId;
    const bars = s.quotes[refId].daily;
    if (bars.length < 3) continue;
    const exposure = d.option ? toEur(s, (v.delta ?? 0) * s.quotes[refId].price, d.currency) : d.future ? toEur(s, s.quotes[v.instrumentId].price * v.qty * multiplier(d), d.currency) : v.mvEur;
    const n = Math.min(N, bars.length - 1);
    used = Math.max(used, n);
    for (let k = 0; k < n; k++) {
      const i = bars.length - 1 - k;
      const r = bars[i].c / bars[i - 1].c - 1;
      pnl[k] += exposure * r;
    }
  }
  const arr = pnl.slice(0, Math.max(1, used)).sort((x, y) => x - y);
  const idx = Math.max(0, Math.floor((1 - conf) * arr.length));
  const varv = -arr[idx] * Math.sqrt(horizonDays);
  const tail = arr.slice(0, idx + 1);
  const es = -tail.reduce((m, x) => m + x, 0) / Math.max(1, tail.length) * Math.sqrt(horizonDays);
  return { var: Math.max(0, varv), es: Math.max(0, es), scenarios: arr.length, stressed: stressTests(s, accId) };
}

/** Stress tests déterministes : chocs instantanés sur les facteurs */
export function stressTests(s: GameState, accId: string) {
  const views = positionViews(s, accId);
  const scenarios: { name: string; eq: number; rates: number; credit: number; usd: number; oil: number; crypto: number; banks: number }[] = [
    { name: "Krach actions −20 %", eq: -0.2, rates: -0.5, credit: 1.5, usd: 0.03, oil: -0.15, crypto: -0.4, banks: -0.3 },
    { name: "Hausse des taux +100 pb", eq: -0.06, rates: 1, credit: 0.3, usd: 0.02, oil: 0, crypto: -0.1, banks: 0.02 },
    { name: "Crise bancaire", eq: -0.1, rates: -0.3, credit: 2, usd: 0.02, oil: -0.05, crypto: -0.2, banks: -0.35 },
    { name: "Choc pétrolier +40 %", eq: -0.05, rates: 0.3, credit: 0.4, usd: 0.01, oil: 0.4, crypto: -0.05, banks: -0.03 },
    { name: "Dollar −10 %", eq: 0, rates: 0, credit: 0, usd: -0.1, oil: 0.05, crypto: 0.05, banks: 0 },
  ];
  return scenarios.map((sc) => {
    let pnl = 0;
    for (const v of views) {
      const d = s.instruments[v.instrumentId];
      const ref = d.option ? s.instruments[d.option.underlying] : d.future ? s.instruments[d.future.underlying] : d;
      const exposure = d.option ? toEur(s, (v.delta ?? 0) * s.quotes[ref.id].price, d.currency) : d.future ? toEur(s, s.quotes[d.id].price * v.qty * multiplier(d), d.currency) : v.mvEur;
      let r = 0;
      if (ref.cls === "action" || ref.cls === "indice" || (ref.cls === "etf" && ref.beta > 0)) r = sc.eq * (ref.beta || 1) + (ref.sector === "Banque" ? sc.banks : 0);
      else if (ref.cls === "obligation") { const dur = ref.bond!.floating ? 0.3 : Math.min(15, (ref.bond!.maturityDay - s.t / MIN_PER_DAY) / 365 * 0.85); r = -dur * sc.rates / 100 - (ref.bond!.gov ? 0 : dur * sc.credit * ref.bond!.spreadBps / 10000); }
      else if (ref.cls === "etf" && ref.beta === 0) r = ref.id === "XGLD" ? -sc.eq * 0.3 : ref.id === "XCOM" ? sc.oil * 0.4 : -6 * sc.rates / 100 - 0.02 * sc.credit;
      else if (ref.cls === "matiere") r = ref.id === "GOLD" || ref.id === "SILV" ? -sc.eq * 0.4 : ref.id === "BRENT" || ref.id === "WTI" ? sc.oil : sc.eq * 0.5;
      else if (ref.cls === "crypto") r = sc.crypto;
      else if (ref.cls === "devise") r = ref.id.startsWith("USD") ? sc.usd : ref.id.endsWith("USD") ? -sc.usd : 0;
      const fxr = d.currency === "USD" ? sc.usd : 0;
      pnl += exposure * r + (d.future ? 0 : v.mvEur * fxr);
    }
    return { name: sc.name, pnl };
  });
}

/** Exigence de marge (initiale) d'un compte */
export function marginRequirement(s: GameState, accId: string) {
  const a = s.accounts[accId];
  if (!a) return 0;
  let req = 0;
  const mult = s.difficulty === "simulation" ? 1.2 : s.difficulty === "debutant" ? 0.8 : 1;
  for (const p of Object.values(a.positions)) {
    const d = s.instruments[p.instrumentId];
    if (!d) continue;
    const mv = Math.abs(toEur(s, s.quotes[d.id].price * p.qty * multiplier(d), d.currency));
    if (d.future) req += mv * d.future.marginPct;
    else if (d.option && p.qty < 0) {
      const u = s.quotes[d.option.underlying].price;
      const otm = Math.max(0, d.option.type === "call" ? d.option.strike - u : u - d.option.strike);
      req += mv + Math.max(0.1 * u, 0.2 * u - otm) * Math.abs(p.qty) * d.option.multiplier * fx(s, 1, d.currency, "EUR");
    } else if (p.qty < 0) req += mv * 0.5;
    else if (d.cls === "crypto" && a.maxLeverage > 1) req += mv * 0.5;
  }
  return req * mult;
}

export function performance(a: Account) {
  const h = a.equityHistory;
  if (h.length < 2) return { totalReturn: 0, annualized: 0, vol: 0, sharpe: 0, maxDrawdown: 0, dayReturn: 0 };
  const rets: number[] = [];
  let peak = h[0].v, mdd = 0;
  for (let i = 1; i < h.length; i++) {
    if (h[i - 1].v > 0) rets.push(h[i].v / h[i - 1].v - 1);
    peak = Math.max(peak, h[i].v);
    if (peak > 0) mdd = Math.max(mdd, 1 - h[i].v / peak);
  }
  const mean = rets.reduce((x, y) => x + y, 0) / Math.max(1, rets.length);
  const sd = Math.sqrt(rets.reduce((x, y) => x + (y - mean) ** 2, 0) / Math.max(1, rets.length - 1));
  const days = Math.max(1, (h[h.length - 1].t - h[0].t) / MIN_PER_DAY);
  const total = h[0].v > 0 ? h[h.length - 1].v / h[0].v - 1 : 0;
  const annualized = days > 30 ? Math.pow(1 + total, 365 / days) - 1 : total;
  const vol = sd * Math.sqrt(252);
  const rf = 0.02;
  return { totalReturn: total, annualized, vol, sharpe: vol > 0 ? (mean * 252 - rf) / vol : 0, maxDrawdown: mdd, dayReturn: rets[rets.length - 1] ?? 0 };
}
