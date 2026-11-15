/** Gestion des portefeuilles clients : allocation, rééquilibrage, satisfaction, frais, retraits. */
import type { Account, Client, GameState } from "./types";
import { Rng } from "./rng";
import { cashAcc, cashOf, post } from "./ledger";
import { toCents, fromCents } from "./money";
import { accountEquity, exposures, performance } from "./portfolio";
import { placeOrder, executeFill } from "./orders";
import { quoteBook } from "./market";
import { changeRep, changeTrust, clamp, gainXp, notify, toEur, nextId, logDecision } from "./core";
import { ALLOC_BUCKETS, CLIENT_SEEDS, makeClient } from "./people";
import { MIN_PER_DAY } from "./time";

const EXT_DEPOSITS = "ext:depots_clients", EXT_BANK_FEES = "ext:commissions_banque";

export function newAccount(id: string, kind: Account["kind"], label: string, allowShort: boolean, capital = 0): Account {
  return { id, kind, label, baseCurrency: "EUR", positions: {}, allowShort, maxLeverage: 1, equityHistory: [], capitalAllocated: toCents(capital), realizedTotal: 0, feesTotal: 0, incomeTotal: 0 };
}

/** Constitution initiale d'une position à un prix de marché sans frais (transfert de titres à l'ouverture du compte) */
export function seedPosition(s: GameState, accId: string, id: string, valueEur: number) {
  const d = s.instruments[id];
  const px = s.quotes[id].price;
  const unit = toEur(s, px, d.currency) * (d.bond ? d.bond.nominal / 100 : 1);
  const qty = Math.floor(valueEur / unit);
  if (qty <= 0) return;
  const o = { id: nextId(s, "ord"), account: accId, instrumentId: id, side: "buy" as const, type: "market" as const, qty, filled: 0, status: "en_attente" as const, createdT: s.t, updatedT: s.t, fees: 0, tag: "rebalance" as const };
  s.orders.unshift(o);
  executeFill(s, o, qty, px);
}

export function onboardClient(s: GameState, seedIndex: number) { return onboardSeed(s, CLIENT_SEEDS[seedIndex]); }
/** Ouverture d'un mandat à partir d'un profil (client historique ou prospect converti) */
export function onboardSeed(s: GameState, seed: (typeof CLIENT_SEEDS)[number]) {
  const c = makeClient(s, seed);
  s.clients.push(c);
  const acc = newAccount(c.accountId, "client", `Mandat ${c.name}`, false, seed.aum);
  s.accounts[acc.id] = acc;
  post(s, cashAcc(acc.id), EXT_DEPOSITS, toCents(seed.aum), "EUR", `Apport initial du client ${c.name}`);
  for (const [k, w] of Object.entries(c.targetAllocation)) if (k !== "CASH" && w > 0) seedPosition(s, acc.id, k, seed.aum * w);
  acc.equityHistory.push({ t: s.t, v: accountEquity(s, acc.id) });
  return c;
}

export function equityWeight(s: GameState, accId: string) {
  const eq = Math.max(1, accountEquity(s, accId));
  let e = 0;
  for (const p of Object.values(s.accounts[accId].positions)) {
    const b = ALLOC_BUCKETS.find((x) => x.id === p.instrumentId);
    const d = s.instruments[p.instrumentId];
    const w = b ? b.equity : d.cls === "action" ? 1 : d.cls === "crypto" ? 1.5 : d.cls === "obligation" ? 0 : 0.5;
    e += w * toEur(s, s.quotes[p.instrumentId].price * p.qty, d.currency);
  }
  return e / eq;
}
/** Bande d'exposition actions adaptée au profil de risque (1 à 7) */
export function suitableEquityBand(risk: number): [number, number] { return [Math.max(0, (risk - 2) * 0.12), Math.min(1, 0.15 + risk * 0.12)]; }

export function currentAllocation(s: GameState, c: Client) {
  const acc = s.accounts[c.accountId];
  const eq = Math.max(1, accountEquity(s, acc.id));
  const out: Record<string, number> = {};
  for (const p of Object.values(acc.positions)) out[p.instrumentId] = toEur(s, s.quotes[p.instrumentId].price * p.qty, s.instruments[p.instrumentId].currency) / eq;
  out.CASH = (cashOf(s, acc.id, "EUR") / 100) / eq;
  return out;
}

/** Valide une allocation cible et génère les ordres de rééquilibrage */
export function rebalanceClient(s: GameState, clientId: string, target: Record<string, number>) {
  const c = s.clients.find((x) => x.id === clientId);
  if (!c || c.lost) return { ok: false as const, error: "Client introuvable." };
  const sum = Object.values(target).reduce((a, b) => a + b, 0);
  if (Math.abs(sum - 1) > 0.011) return { ok: false as const, error: `Les pondérations doivent totaliser 100 % (actuellement ${(sum * 100).toFixed(1)} %).` };
  for (const k of Object.keys(target)) if (!ALLOC_BUCKETS.some((b) => b.id === k)) return { ok: false as const, error: `Classe d'actifs inconnue : ${k}` };
  const eqW = ALLOC_BUCKETS.reduce((a, b) => a + (target[b.id] ?? 0) * b.equity, 0);
  const [lo, hi] = suitableEquityBand(c.riskTolerance);
  const warnings: string[] = [];
  if (eqW > hi + 0.001) warnings.push(`Exposition actions ${(eqW * 100).toFixed(0)} % supérieure au profil du client (max ${(hi * 100).toFixed(0)} %).`);
  if (eqW < lo - 0.001) warnings.push(`Exposition actions ${(eqW * 100).toFixed(0)} % inférieure à ce que le profil permet (min ${(lo * 100).toFixed(0)} %) : risque de ne pas atteindre l'objectif.`);
  if (c.constraints.some((x) => x.includes("énergie fossile")) && (target.XNRG ?? 0) > 0) warnings.push("Le mandat exclut les énergies fossiles.");
  if (c.constraints.some((x) => x.includes("High yield ≤ 10")) && (target.XHYD ?? 0) > 0.1) warnings.push("Le mandat limite le high yield à 10 %.");
  if (c.liquidityNeed >= 0.3 && (target.CASH ?? 0) < 0.2) warnings.push("Le client a un besoin de liquidité élevé (≥ 20 % de liquidités recommandé).");
  const acc = s.accounts[c.accountId];
  const eq = accountEquity(s, acc.id);
  const orders: string[] = [];
  const ids = new Set([...Object.keys(target).filter((k) => k !== "CASH"), ...Object.keys(acc.positions)]);
  // ventes d'abord, achats ensuite
  const plan: { id: string; delta: number }[] = [];
  for (const id of ids) {
    const d = s.instruments[id];
    const curV = acc.positions[id] ? toEur(s, s.quotes[id].price * acc.positions[id].qty, d.currency) : 0;
    const tgtV = (target[id] ?? 0) * eq;
    const unit = toEur(s, quoteBook(s, id).mid, d.currency);
    const dq = Math.trunc((tgtV - curV) / unit);
    if (dq !== 0 && Math.abs(dq * unit) > eq * 0.005) plan.push({ id, delta: dq });
  }
  plan.sort((a, b) => a.delta - b.delta);
  for (const p of plan) {
    const qty = p.delta < 0 ? Math.min(-p.delta, acc.positions[p.id]?.qty ?? 0) : p.delta;
    if (qty <= 0) continue;
    const r = placeOrder(s, { account: acc.id, instrumentId: p.id, side: p.delta < 0 ? "sell" : "buy", type: "market", qty, tag: p.delta < 0 ? "rebalance" : undefined });
    orders.push(r.ok ? r.message : `${p.id} : ${r.error}`);
  }
  c.targetAllocation = target;
  c.history.unshift({ t: s.t, text: `Allocation modifiée (actions ${(eqW * 100).toFixed(0)} %)` });
  if (warnings.length) { changeRep(s, "conformite", -3, `Allocation inadaptée pour ${c.name}`); c.history.unshift({ t: s.t, text: "⚠ Alerte d'adéquation : " + warnings.join(" ") }); }
  else gainXp(s, "client", 15, "Allocation adaptée au profil client");
  logDecision(s, "client", `Rééquilibrage du mandat ${c.name}${warnings.length ? " (alerte d'adéquation)" : ""}`);
  return { ok: true as const, warnings, orders };
}

/** Mise à jour mensuelle : frais, satisfaction, flux entrants/sortants */
export function monthlyClients(s: GameState, rng: Rng) {
  for (const c of s.clients) {
    if (c.lost) continue;
    const acc = s.accounts[c.accountId];
    const eq = accountEquity(s, acc.id);
    // Frais de gestion (revenu de la banque)
    const fee = toCents(eq * c.feeBps / 10000 / 12);
    if (fee > 0 && cashOf(s, acc.id, "EUR") >= fee) post(s, EXT_BANK_FEES, cashAcc(acc.id), fee, "EUR", `Frais de gestion mensuels ${c.name}`);
    s.flags["feesYtd"] = ((s.flags["feesYtd"] as number) ?? 0) + fee;
    // Satisfaction
    const h = acc.equityHistory;
    const back = h.length > 22 ? h[h.length - 22].v : h[0]?.v ?? eq;
    const monthRet = back > 0 ? eq / back - 1 : 0;
    const expected = c.expectedReturn / 12;
    const perf = performance(acc);
    const eqW = equityWeight(s, acc.id);
    const [lo, hi] = suitableEquityBand(c.riskTolerance);
    let delta = (monthRet - expected) * 250;
    if (perf.maxDrawdown > 0.05 * c.riskTolerance / 2) delta -= 4;
    if (eqW > hi + 0.05) delta -= 3;
    if (s.t - c.lastContactT > 45 * MIN_PER_DAY) delta -= 3;
    delta += (s.npcs[c.npcId].trust - 50) / 25;
    delta -= (c.feeBps - 50) / 100;
    c.satisfaction = clamp(c.satisfaction + clamp(delta, -15, 12) + rng.normal() * 1.5, 0, 100);
    if (c.satisfaction > 78 && rng.chance(0.35)) {
      const add = Math.round(eq * rng.range(0.03, 0.08));
      post(s, cashAcc(acc.id), EXT_DEPOSITS, toCents(add), "EUR", `Versement complémentaire de ${c.name}`);
      acc.capitalAllocated = (acc.capitalAllocated ?? 0) + toCents(add);
      notify(s, "succes", `${c.name} vous confie ${fromCents(toCents(add)).toLocaleString("fr-FR")} € supplémentaires`, "Récompense de la qualité de votre gestion.", "/play/clients");
      changeRep(s, "commerciale", 2); changeRep(s, "clients", 2);
    }
    if (c.satisfaction < 18) {
      const strikes = ((s.flags[`strike_${c.id}`] as number) ?? 0) + 1;
      s.flags[`strike_${c.id}`] = strikes;
      if (strikes >= 2) loseClient(s, c, "satisfaction trop faible");
      else notify(s, "alerte", `${c.name} envisage de retirer ses capitaux`, "Un geste rapide est nécessaire.", "/play/clients");
    } else s.flags[`strike_${c.id}`] = 0;
  }
}

export function loseClient(s: GameState, c: Client, reason: string) {
  const acc = s.accounts[c.accountId];
  for (const p of Object.values(acc.positions)) {
    const d = s.instruments[p.instrumentId];
    const o = { id: nextId(s, "ord"), account: acc.id, instrumentId: d.id, side: "sell" as const, type: "market" as const, qty: p.qty, filled: 0, status: "en_attente" as const, createdT: s.t, updatedT: s.t, fees: 0, tag: "liquidation" as const };
    s.orders.unshift(o);
    executeFill(s, o, p.qty, quoteBook(s, d.id).bid);
  }
  for (const cur of ["EUR", "USD", "GBP", "CHF", "JPY", "CAD", "AUD", "CNY"] as const) {
    const bal = cashOf(s, acc.id, cur);
    if (bal !== 0) post(s, EXT_DEPOSITS, cashAcc(acc.id), bal, cur, `Transfert sortant : départ du client ${c.name}`);
  }
  c.lost = true;
  c.history.unshift({ t: s.t, text: `Client perdu : ${reason}` });
  notify(s, "critique", `Client perdu : ${c.name}`, `Motif : ${reason}. Les capitaux ont été transférés vers un concurrent.`, "/play/clients");
  changeRep(s, "commerciale", -8); changeRep(s, "clients", -6);
  changeTrust(s, "boss", -8, `Perte du client ${c.name}`);
  logDecision(s, "client", `Perte du client ${c.name} (${reason})`);
}

export function totalAum(s: GameState) { return s.clients.filter((c) => !c.lost).reduce((a, c) => a + accountEquity(s, c.accountId), 0); }
export { exposures };
