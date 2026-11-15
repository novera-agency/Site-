/**
 * OrderExecutionEngine — validation, déclenchement et exécution des ordres.
 * Garanties : une limite n'est jamais franchie, pas de double exécution (identifiant client idempotent),
 * contrôle de la trésorerie et de la marge avant et au moment de l'exécution, écritures en partie double.
 */
import type { Account, Currency, GameState, InstrumentDef, Order, OrderType, Position } from "./types";
import { cashAcc, cashOf, marginAcc, post, bal } from "./ledger";
import { toCents, mulToCents } from "./money";
import { fx, multiplier, nextId, notify, gainXp, toEur, logDecision } from "./core";
import { quoteBook, isOpen, advUnits, baseVol, refreshDerived, invalidateInstruments } from "./market";
import { accountEquity, marginRequirement, cashEur } from "./portfolio";
import { ACCESS_BY_RANK, TRACKS } from "./data/banks";
import { dayIndex, MIN_PER_DAY, thirdFriday, dateOf, fmtShortDate, SESSIONS, startOfDay } from "./time";
import { FUTURE_SPECS } from "./data/catalog";

export interface OrderRequest {
  account: string; instrumentId: string; side: "buy" | "sell"; type: OrderType; qty: number;
  limit?: number; stop?: number; duration?: "jour" | "gtc" | "date"; expiresT?: number;
  stopLoss?: number; takeProfit?: number; clientRef?: string; tag?: Order["tag"];
}
export type OrderResult = { ok: true; order: Order; message: string } | { ok: false; error: string };

const EXT_MARKET = "ext:marche", EXT_FEES = "ext:frais", EXT_FX = "ext:change", EXT_CCP = "ext:chambre_compensation";

export function feeFor(s: GameState, acc: Account, def: InstrumentDef, notionalLocal: number, qty: number): number {
  const pro = acc.kind !== "personnel";
  const n = Math.abs(notionalLocal);
  switch (def.cls) {
    case "devise": return 0; // rémunéré via le spread
    case "option": return Math.max(1, qty * (pro ? 0.25 : 0.75));
    case "future": return qty * (pro ? 0.5 : 1.5);
    case "crypto": return n * (pro ? 0.001 : 0.0025);
    case "obligation": return Math.max(pro ? 0 : 5, n * (pro ? 0.0001 : 0.0015));
    default: return pro ? n * 0.0002 : Math.max(1, n * 0.001);
  }
}

function qtyStep(def: InstrumentDef) { return def.cls === "crypto" ? 0.0001 : 1; }
function roundQty(def: InstrumentDef, q: number) { const st = qtyStep(def); return Math.floor(q / st + 1e-9) * st; }

/** Accès aux instruments selon le poste (comptes professionnels) */
export function canTradeOnDesk(s: GameState, def: InstrumentDef) {
  const cls = def.option ? "option" : def.future ? "future" : def.cls;
  const minRank = ACCESS_BY_RANK[cls] ?? 99;
  const track = TRACKS[s.career.track];
  const ok = s.career.rank >= minRank && track.instruments.includes(cls);
  return { ok, reason: ok ? "" : `Accès limité : les instruments « ${cls} » ne sont pas autorisés à votre poste (${track.ranks[s.career.rank]}).` };
}

/** Réserve de trésorerie des ordres d'achat en attente (EUR) */
function reservedEur(s: GameState, accId: string) {
  let r = 0;
  for (const o of s.orders) {
    if (o.account !== accId || o.side !== "buy" || (o.status !== "en_attente" && o.status !== "partiel")) continue;
    const d = s.instruments[o.instrumentId];
    if (!d || d.future) continue;
    const px = o.limit ?? o.stop ?? s.quotes[o.instrumentId].price;
    r += toEur(s, px * (o.qty - o.filled) * multiplier(d), d.currency);
  }
  return r;
}
export function buyingPower(s: GameState, accId: string) {
  return Math.max(0, cashEur(s, accId) - reservedEur(s, accId) - marginRequirement(s, accId) * 0.5);
}

export function placeOrder(s: GameState, req: OrderRequest): OrderResult {
  const acc = s.accounts[req.account];
  if (!acc) return { ok: false, error: "Compte inconnu." };
  if (acc.kind === "desk" && !s.career.employed) return { ok: false, error: "Vous n'avez plus accès au book de la banque." };
  if (req.clientRef && s.orders.some((o) => o.clientRef === req.clientRef)) return { ok: false, error: "Ordre déjà transmis (protection contre la double exécution)." };
  if (req.instrumentId.startsWith("OPT-")) { const r = ensureOption(s, req.instrumentId); if (!r.ok) return { ok: false, error: r.error }; }
  const def = s.instruments[req.instrumentId];
  if (!def) return { ok: false, error: "Instrument introuvable." };
  if (def.cls === "indice") return { ok: false, error: "Un indice n'est pas négociable directement : utilisez un ETF ou un future." };
  const q = s.quotes[def.id];
  if (q.defaulted) return { ok: false, error: "Instrument en défaut : négociation suspendue." };
  if (q.halted) return { ok: false, error: "Cotation suspendue." };
  if (!Number.isFinite(req.qty) || req.qty <= 0) return { ok: false, error: "Quantité invalide." };
  const qty = roundQty(def, req.qty);
  if (qty <= 0) return { ok: false, error: `Quantité minimale : ${qtyStep(def)}.` };
  if (qty > 1e9) return { ok: false, error: "Quantité excessive." };
  if ((req.type === "limit" || req.type === "stop_limit") && !(req.limit && req.limit > 0)) return { ok: false, error: "Prix limite requis." };
  if ((req.type === "stop" || req.type === "stop_limit") && !(req.stop && req.stop > 0)) return { ok: false, error: "Prix de déclenchement (stop) requis." };
  if (acc.kind === "desk" && !req.tag) { const c = canTradeOnDesk(s, def); if (!c.ok) return { ok: false, error: c.reason }; }
  if (def.option && def.option.expiryDay <= dayIndex(s.t) && s.t % MIN_PER_DAY >= 17 * 60 + 30) return { ok: false, error: "Option échue." };
  const pos = acc.positions[def.id];
  const curQty = pos?.qty ?? 0;
  const pendingSells = s.orders.filter((o) => o.account === acc.id && o.instrumentId === def.id && o.side === "sell" && (o.status === "en_attente" || o.status === "partiel") && !o.ocoWith).reduce((m, o) => m + o.qty - o.filled, 0);
  const after = req.side === "buy" ? curQty + qty : curQty - qty - (req.tag ? 0 : pendingSells);
  if (after < -1e-9 && req.side === "sell" && !(acc.allowShort && s.settings.allowShort)) return { ok: false, error: curQty > 0 ? `Quantité supérieure à la position détenue (${curQty}).` : "La vente à découvert n'est pas autorisée sur ce compte ou dans ce mode." };
  // Contrôle pré-négociation
  const px = req.limit ?? req.stop ?? (req.side === "buy" ? quoteBook(s, def.id).ask : quoteBook(s, def.id).bid);
  const notionalEur = toEur(s, px * qty * multiplier(def), def.currency);
  const increasesRisk = Math.abs(after) > Math.abs(curQty);
  if (increasesRisk && !req.tag) {
    if (def.future || (req.side === "sell" && after < 0)) {
      const eq = accountEquity(s, acc.id);
      const addReq = def.future ? notionalEur * def.future.marginPct : def.option ? notionalEur + 0.2 * toEur(s, s.quotes[def.option.underlying].price * qty * def.option.multiplier, def.currency) : notionalEur * 0.5;
      if (eq - reservedEur(s, acc.id) < marginRequirement(s, acc.id) + addReq) return { ok: false, error: `Marge insuffisante : exigence supplémentaire de ${Math.round(addReq).toLocaleString("fr-FR")} €.` };
    } else if (req.side === "buy") {
      const fee = toEur(s, feeFor(s, acc, def, px * qty * multiplier(def), qty), def.currency);
      const bp = buyingPower(s, acc.id);
      if (notionalEur + fee > bp + 0.01) return { ok: false, error: `Fonds insuffisants : besoin de ${Math.round(notionalEur + fee).toLocaleString("fr-FR")} €, disponible ${Math.round(bp).toLocaleString("fr-FR")} €.` };
    }
    if (acc.kind === "desk" && !req.tag) {
      const cap = (acc.capitalAllocated ?? 0) / 100;
      const existing = Math.abs(toEur(s, s.quotes[def.id].price * curQty * multiplier(def), def.currency));
      const exposure = def.option ? 0.5 * toEur(s, s.quotes[def.option.underlying].price * Math.abs(after) * def.option.multiplier, def.currency) : existing + notionalEur;
      if (exposure > cap * s.career.deskMaxPosition) return { ok: false, error: `Limite de concentration du desk dépassée : ${Math.round(s.career.deskMaxPosition * 100)} % du capital par position maximum.` };
    }
  }
  let expiresT: number | undefined;
  if (req.duration === "jour") { const ses = SESSIONS[def.option || def.future ? s.instruments[def.option?.underlying ?? def.future!.underlying].session : def.session]; expiresT = startOfDay(s.t) + ses.close + (s.t % MIN_PER_DAY >= ses.close ? MIN_PER_DAY : 0); }
  else if (req.duration === "date" && req.expiresT) expiresT = req.expiresT;
  const o: Order = {
    id: nextId(s, "ord"), account: acc.id, instrumentId: def.id, side: req.side, type: req.type, qty, filled: 0, limit: req.limit, stop: req.stop,
    status: "en_attente", createdT: s.t, updatedT: s.t, expiresT, fees: 0, tag: req.tag, clientRef: req.clientRef,
  };
  if (req.stopLoss || req.takeProfit) (o as Order & { attach?: { sl?: number; tp?: number } }).ocoWith = JSON.stringify({ sl: req.stopLoss, tp: req.takeProfit, parent: true });
  s.orders.unshift(o);
  if (s.orders.length > 800) s.orders = s.orders.filter((x, i) => i < 600 || x.status === "en_attente" || x.status === "partiel");
  tryExecute(s, o);
  const open = isOpen(s, def);
  const message = o.status === "execute" ? `Ordre exécuté : ${o.side === "buy" ? "achat" : "vente"} de ${o.filled} ${def.id} à ${fmtPx(o.avgFill!)}.` : o.status === "partiel" ? `Ordre partiellement exécuté (${o.filled}/${o.qty}).` : o.status === "rejete" ? `Ordre rejeté : ${o.reason}` : open ? "Ordre enregistré, en attente des conditions de prix." : "Marché fermé : l'ordre sera traité à l'ouverture.";
  if (o.status === "rejete") return { ok: false, error: o.reason ?? "Rejeté" };
  return { ok: true, order: o, message };
}

export function cancelOrder(s: GameState, orderId: string): OrderResult {
  const o = s.orders.find((x) => x.id === orderId);
  if (!o) return { ok: false, error: "Ordre introuvable." };
  if (o.status !== "en_attente" && o.status !== "partiel") return { ok: false, error: "L'ordre n'est plus modifiable." };
  o.status = "annule"; o.updatedT = s.t;
  return { ok: true, order: o, message: "Ordre annulé." };
}

const fmtPx = (p: number) => (p >= 100 ? p.toFixed(2) : p >= 1 ? p.toFixed(3) : p.toPrecision(4));

/** Tente d'exécuter un ordre (appelé à la création et à chaque pas de simulation) */
export function tryExecute(s: GameState, o: Order) {
  if (o.status !== "en_attente" && o.status !== "partiel") return;
  const def = s.instruments[o.instrumentId];
  if (!def || s.quotes[def.id].defaulted) { o.status = "annule"; o.reason = "Instrument indisponible"; return; }
  if (o.expiresT !== undefined && s.t >= o.expiresT) { o.status = "expire"; o.updatedT = s.t; return; }
  if (!isOpen(s, def)) return;
  const book = quoteBook(s, def.id);
  if ((o.type === "stop" || o.type === "stop_limit") && !o.triggered) {
    const hit = o.side === "buy" ? book.ask >= o.stop! : book.bid <= o.stop!;
    if (!hit) return;
    o.triggered = true;
    if (o.tag === "stop_loss") notify(s, "alerte", `Stop-loss déclenché sur ${def.id}`, `Seuil ${fmtPx(o.stop!)} atteint.`, "/play/ordres");
  }
  const isLimit = o.type === "limit" || o.type === "stop_limit";
  if (isLimit) {
    if (o.side === "buy" && book.ask > o.limit! + 1e-12) return;
    if (o.side === "sell" && book.bid < o.limit! - 1e-12) return;
  }
  const remaining = roundQty(def, o.qty - o.filled);
  const maxStep = Math.max(qtyStep(def), roundQty(def, book.adv * 0.05));
  let q = Math.min(remaining, maxStep);
  if (q <= 0) return;
  const sigmaD = baseVol(s, def.id) / Math.sqrt(252);
  const impact = Math.min(0.05, 0.5 * sigmaD * Math.sqrt(q / Math.max(1, book.adv)));
  let price = o.side === "buy" ? book.ask * (1 + impact) : book.bid * (1 - impact);
  if (isLimit) price = o.side === "buy" ? Math.min(price, o.limit!) : Math.max(price, o.limit!);
  const acc = s.accounts[o.account];
  // Contrôle de trésorerie au moment de l'exécution (achats au comptant)
  const cur = acc.positions[def.id]?.qty ?? 0;
  if (o.side === "buy" && !def.future && cur >= 0 && !o.tag) {
    const m = multiplier(def);
    const avail = cashEur(s, acc.id) - marginRequirement(s, acc.id) * 0.5;
    const unitEur = toEur(s, price * m, def.currency) * 1.003;
    const affordable = roundQty(def, Math.max(0, avail - toEur(s, feeFor(s, acc, def, price * m, 1), def.currency)) / unitEur);
    if (affordable < q) {
      if (affordable <= 0) { o.status = o.filled > 0 ? "annule" : "rejete"; o.reason = "Fonds insuffisants au moment de l'exécution"; o.updatedT = s.t; return; }
      q = affordable;
    }
  }
  const slippageBps = ((price - (o.side === "buy" ? book.ask : book.bid)) / book.mid) * 10000 * (o.side === "buy" ? 1 : -1);
  executeFill(s, o, q, price, slippageBps);
}

/** Écritures et mise à jour de position pour une exécution */
export function executeFill(s: GameState, o: Order, qty: number, price: number, slippageBps = 0) {
  const def = s.instruments[o.instrumentId];
  const acc = s.accounts[o.account];
  const m = multiplier(def);
  const cur = def.currency;
  const ref = o.id;
  const signed = o.side === "buy" ? qty : -qty;
  let pos: Position | undefined = acc.positions[def.id];
  if (!pos) { pos = { instrumentId: def.id, qty: 0, avgPrice: price, realized: 0, openedT: s.t, lastSettle: def.future ? price : undefined }; acc.positions[def.id] = pos; }
  const feeLocal = feeFor(s, acc, def, price * qty * m, qty);
  let realizedLocal = 0;
  if (def.future) {
    // Règlement de la variation de toute la position au prix d'exécution, puis ajustement de la marge
    const variation = (price - (pos.lastSettle ?? price)) * pos.qty * m;
    if (variation !== 0) post(s, cashAcc(acc.id), EXT_CCP, toCents(variation), cur, `Appel de marge de variation ${def.id}`, ref);
    pos.lastSettle = price;
  } else {
    const notional = mulToCents(price, qty * m);
    if (o.side === "buy") { ensureCash(s, acc.id, cur, notional + toCents(feeLocal)); post(s, EXT_MARKET, cashAcc(acc.id), notional, cur, `Achat ${qty} ${def.id} @ ${fmtPx(price)}`, ref); }
    else post(s, cashAcc(acc.id), EXT_MARKET, notional, cur, `Vente ${qty} ${def.id} @ ${fmtPx(price)}`, ref);
  }
  if (feeLocal > 0) { ensureCash(s, acc.id, cur, toCents(feeLocal)); post(s, EXT_FEES, cashAcc(acc.id), toCents(feeLocal), cur, `Frais de transaction ${def.id}`, ref); }
  if (pos.qty === 0 || Math.sign(pos.qty) === Math.sign(signed)) {
    const nq = Math.abs(pos.qty) + qty;
    pos.avgPrice = (Math.abs(pos.qty) * pos.avgPrice + qty * price) / nq;
    pos.qty += signed;
  } else {
    const closeQty = Math.min(qty, Math.abs(pos.qty));
    realizedLocal = closeQty * (price - pos.avgPrice) * m * Math.sign(pos.qty);
    pos.qty += signed;
    if (Math.abs(pos.qty) < 1e-9) pos.qty = 0;
    if (pos.qty !== 0 && Math.sign(pos.qty) === Math.sign(signed)) pos.avgPrice = price; // retournement
  }
  if (def.future) {
    const reqLocal = Math.abs(pos.qty) * price * m * def.future.marginPct;
    const lockedC = bal(s, marginAcc(acc.id), cur);
    const delta = toCents(reqLocal) - lockedC;
    if (delta > 0) ensureCash(s, acc.id, cur, delta);
    if (delta !== 0) post(s, marginAcc(acc.id), cashAcc(acc.id), delta, cur, `Dépôt de garantie ${def.id}`, ref);
  }
  const realizedC = toCents(toEur(s, realizedLocal, cur));
  pos.realized += realizedC;
  acc.realizedTotal += realizedC;
  acc.feesTotal += toCents(toEur(s, feeLocal, cur));
  if (pos.qty === 0) delete acc.positions[def.id];
  const prevFilled = o.filled;
  o.avgFill = (prevFilled * (o.avgFill ?? 0) + qty * price) / (prevFilled + qty);
  o.filled = roundQty(def, prevFilled + qty);
  o.fees += toCents(toEur(s, feeLocal, cur));
  o.updatedT = s.t;
  o.status = o.filled + 1e-9 >= o.qty ? "execute" : "partiel";
  s.fills.unshift({ id: nextId(s, "f"), orderId: o.id, account: acc.id, instrumentId: def.id, side: o.side, qty, price, fees: toCents(toEur(s, feeLocal, cur)), t: s.t, slippageBps, realized: realizedC });
  if (s.fills.length > 1500) s.fills.length = 1500;
  s.stats.tradesCount++;
  if (o.status === "execute") onOrderComplete(s, o);
}

function onOrderComplete(s: GameState, o: Order) {
  const def = s.instruments[o.instrumentId];
  // OCO : annule l'ordre lié
  if (o.ocoWith && !o.ocoWith.startsWith("{")) { const other = s.orders.find((x) => x.id === o.ocoWith); if (other && (other.status === "en_attente" || other.status === "partiel")) { other.status = "annule"; other.reason = "Ordre lié (OCO) exécuté"; } }
  // Ordres attachés (stop-loss / take-profit)
  if (o.ocoWith?.startsWith("{")) {
    const att = JSON.parse(o.ocoWith) as { sl?: number; tp?: number };
    o.ocoWith = undefined;
    const exitSide = o.side === "buy" ? "sell" : "buy";
    let sl: Order | undefined, tp: Order | undefined;
    if (att.sl) { const r = placeOrder(s, { account: o.account, instrumentId: o.instrumentId, side: exitSide, type: "stop", stop: att.sl, qty: o.filled, duration: "gtc", tag: "stop_loss" }); if (r.ok) sl = r.order; }
    if (att.tp) { const r = placeOrder(s, { account: o.account, instrumentId: o.instrumentId, side: exitSide, type: "limit", limit: att.tp, qty: o.filled, duration: "gtc", tag: "take_profit" }); if (r.ok) tp = r.order; }
    if (sl && tp) { sl.ocoWith = tp.id; tp.ocoWith = sl.id; }
  }
  const acc = s.accounts[o.account];
  if (o.tag !== "liquidation" && o.tag !== "rebalance") {
    gainXp(s, def.option || def.future ? "maths" : "marches", def.option || def.future ? 12 : 6, `Exécution d'ordres ${def.option ? "options" : def.future ? "futures" : def.cls}`);
    if (acc.kind === "desk") logDecision(s, "trade", `${o.side === "buy" ? "Achat" : "Vente"} ${o.filled} ${def.id} sur le book du desk`);
  }
}

/** Garantit qu'un compte dispose de `needCents` dans la devise `cur`, en convertissant depuis l'euro (ou la devise la plus fournie). */
export function ensureCash(s: GameState, accId: string, cur: Currency, needCents: number) {
  const have = cashOf(s, accId, cur);
  if (have >= needCents) return;
  const missing = needCents - have;
  const sources: Currency[] = ["EUR", "USD", "CHF", "GBP", "JPY", "CAD", "AUD", "CNY"];
  let left = missing;
  for (const src of sources) {
    if (src === cur || left <= 0) continue;
    const avail = cashOf(s, accId, src);
    if (avail <= 0) continue;
    const neededSrc = Math.ceil(fx(s, left, cur, src) * (1 + fxFee(s, accId)));
    const take = Math.min(avail, neededSrc);
    const got = convertCash(s, accId, src, cur, take, true);
    left -= got;
  }
}
function fxFee(s: GameState, accId: string) { return s.accounts[accId]?.kind === "personnel" ? 0.0025 : 0.0002; }
/** Conversion de devises (renvoie le montant obtenu en centimes) */
export function convertCash(s: GameState, accId: string, from: Currency, to: Currency, amountFromCents: number, auto = false): number {
  if (from === to || amountFromCents <= 0) return 0;
  const got = Math.floor(fx(s, amountFromCents, from, to) * (1 - fxFee(s, accId)));
  post(s, EXT_FX, cashAcc(accId), amountFromCents, from, `${auto ? "Conversion automatique" : "Conversion"} ${from}→${to}`);
  post(s, cashAcc(accId), EXT_FX, got, to, `${auto ? "Conversion automatique" : "Conversion"} ${from}→${to}`);
  return got;
}
/** Couvre les soldes négatifs (variation de marge, dividendes sur positions courtes…) */
export function sweepNegativeCash(s: GameState) {
  for (const acc of Object.values(s.accounts)) {
    for (const cur of ["USD", "GBP", "CHF", "JPY", "CAD", "AUD", "CNY", "EUR"] as Currency[]) {
      const c = cashOf(s, acc.id, cur);
      if (c < 0) ensureCash(s, acc.id, cur, 0);
    }
  }
}

/** Traitement des ordres en attente — appelé à chaque pas */
export function processOrders(s: GameState) {
  for (const o of s.orders) {
    if (o.status === "en_attente" || o.status === "partiel") tryExecute(s, o);
  }
}

/* ───────────── Dérivés listés : options et futures ───────────── */
export function optionId(und: string, type: "call" | "put", strike: number, expiryDay: number) { return `OPT-${und}-${type === "call" ? "C" : "P"}-${strike}-${expiryDay}`; }
export function listExpiries(s: GameState, n = 4) {
  const out: number[] = [];
  const d0 = dateOf(s.t);
  for (let k = 0; out.length < n && k < 12; k++) {
    const y = d0.getUTCFullYear() + Math.floor((d0.getUTCMonth() + k) / 12), mo = (d0.getUTCMonth() + k) % 12;
    const tf = thirdFriday(y, mo);
    if (tf > dayIndex(s.t) + 1) out.push(tf);
  }
  return out;
}
export function strikeGrid(spot: number, n = 6) {
  const raw = spot * 0.025;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((k) => k * mag).find((x) => x >= raw) ?? raw;
  const atm = Math.round(spot / step) * step;
  const out: number[] = [];
  for (let i = -n; i <= n; i++) { const k = +(atm + i * step).toPrecision(8); if (k > 0) out.push(k); }
  return out;
}
export function optionable(def: InstrumentDef) { return def.cls === "action" || def.cls === "etf" || def.cls === "indice"; }
export function ensureOption(s: GameState, id: string): { ok: true } | { ok: false; error: string } {
  if (s.instruments[id]) return { ok: true };
  const parts = id.split("-");
  if (parts.length < 5) return { ok: false, error: "Identifiant d'option invalide." };
  const expiryDay = Number(parts.pop()); const strike = Number(parts.pop()); const t = parts.pop(); parts.shift();
  const und = parts.join("-");
  const ud = s.instruments[und];
  if (!ud || !optionable(ud)) return { ok: false, error: "Sous-jacent non optionnable." };
  if (!listExpiries(s, 6).includes(expiryDay)) return { ok: false, error: "Échéance non listée." };
  const grid = strikeGrid(s.quotes[und].price, 10);
  if (!(strike > 0) || !grid.some((k) => Math.abs(k - strike) / strike < 1e-6)) return { ok: false, error: "Prix d'exercice non listé." };
  const type = t === "C" ? "call" : "put";
  const mult = ud.cls === "indice" ? 10 : 100;
  invalidateInstruments(s);
  s.instruments[id] = { id, name: `${type === "call" ? "Call" : "Put"} ${ud.name} ${strike} ${fmtShortDate(expiryDay * MIN_PER_DAY)}`, cls: "option", currency: ud.currency, session: ud.session, zone: ud.zone, vol: 0, beta: 0, liquidity: 0.5, baseSpreadBps: 120, option: { underlying: und, type, strike, expiryDay, multiplier: mult }, description: `Option européenne ${type} sur ${ud.name}, prix d'exercice ${strike}, échéance ${fmtShortDate(expiryDay * MIN_PER_DAY)}, multiplicateur ${mult}. Règlement en espèces à l'échéance.` };
  s.quotes[id] = { price: 0, prevClose: 0, dayOpen: 0, dayHigh: 0, dayLow: 0, dayVolume: 0, ivBump: 0, stress: 0, daily: [], intraday: [], pending: 0, rv: 0, lastBarDay: -1 };
  refreshDerived(s, null);
  const q = s.quotes[id]; q.prevClose = q.dayOpen = q.dayHigh = q.dayLow = q.price;
  return { ok: true };
}
const MONTH_CODES = "FGHJKMNQUVXZ";
export function listFutures(s: GameState) {
  const d0 = dateOf(s.t);
  const quarters: number[] = [];
  for (let k = 0; quarters.length < 2 && k < 15; k++) {
    const y = d0.getUTCFullYear() + Math.floor((d0.getUTCMonth() + k) / 12), mo = (d0.getUTCMonth() + k) % 12;
    if (mo % 3 !== 2) continue;
    const tf = thirdFriday(y, mo);
    if (tf > dayIndex(s.t)) quarters.push(tf);
  }
  for (const spec of FUTURE_SPECS) for (const exp of quarters) {
    const dt = dateOf(exp * MIN_PER_DAY);
    const id = `${spec.root}${MONTH_CODES[dt.getUTCMonth()]}${String(dt.getUTCFullYear()).slice(2)}`;
    if (s.instruments[id]) continue;
    const ud = s.instruments[spec.underlying];
    invalidateInstruments(s);
    s.instruments[id] = { id, name: `${spec.name} ${fmtShortDate(exp * MIN_PER_DAY).slice(3)}`, cls: "future", currency: ud.currency, session: ud.session, zone: ud.zone, vol: 0, beta: 0, liquidity: 0.95, baseSpreadBps: 1, future: { underlying: spec.underlying, expiryDay: exp, multiplier: spec.multiplier, marginPct: spec.marginPct }, description: `Contrat à terme sur ${ud.name}. Multiplicateur ${spec.multiplier}, dépôt de garantie ${(spec.marginPct * 100).toFixed(0)} % du notionnel, appels de marge quotidiens, règlement en espèces le ${fmtShortDate(exp * MIN_PER_DAY)}.` };
    s.quotes[id] = { price: 0, prevClose: 0, dayOpen: 0, dayHigh: 0, dayLow: 0, dayVolume: 0, ivBump: 0, stress: 0, daily: [], intraday: [], pending: 0, rv: 0, lastBarDay: -1 };
  }
  refreshDerived(s, null);
}

/** Règlement quotidien des futures (marge de variation) à la clôture */
export function dailyFuturesSettlement(s: GameState) {
  for (const acc of Object.values(s.accounts)) for (const p of Object.values(acc.positions)) {
    const d = s.instruments[p.instrumentId];
    if (!d?.future) continue;
    const px = s.quotes[d.id].price;
    const variation = (px - (p.lastSettle ?? px)) * p.qty * d.future.multiplier;
    if (Math.abs(variation) >= 0.01) post(s, cashAcc(acc.id), EXT_CCP, toCents(variation), d.currency, `Marge de variation ${d.id}`, d.id);
    p.lastSettle = px;
    const reqC = toCents(Math.abs(p.qty) * px * d.future.multiplier * d.future.marginPct);
    const delta = reqC - bal(s, marginAcc(acc.id), d.currency);
    if (Math.abs(delta) > 100) { if (delta > 0) ensureCash(s, acc.id, d.currency, delta); post(s, marginAcc(acc.id), cashAcc(acc.id), delta, d.currency, `Ajustement du dépôt de garantie ${d.id}`); }
  }
}

/** Échéance des options et futures (17:30 le jour d'échéance) */
export function processExpiries(s: GameState) {
  const day = dayIndex(s.t);
  for (const d of Object.values(s.instruments)) {
    const exp = d.option?.expiryDay ?? d.future?.expiryDay;
    if (exp === undefined || exp > day) continue;
    const und = s.quotes[d.option?.underlying ?? d.future!.underlying].price;
    for (const acc of Object.values(s.accounts)) {
      const p = acc.positions[d.id];
      if (!p) continue;
      if (d.option) {
        const o = d.option;
        const intrinsic = Math.max(0, o.type === "call" ? und - o.strike : o.strike - und);
        const cashflow = intrinsic * p.qty * o.multiplier;
        if (Math.abs(cashflow) >= 0.01) {
          if (cashflow < 0) ensureCash(s, acc.id, d.currency, toCents(-cashflow));
          post(s, cashAcc(acc.id), EXT_MARKET, toCents(cashflow), d.currency, `${intrinsic > 0 ? "Exercice" : "Expiration"} ${d.id} (règlement en espèces)`, d.id);
        }
        const realized = toCents(toEur(s, (intrinsic - p.avgPrice) * p.qty * o.multiplier, d.currency));
        p.realized += realized; acc.realizedTotal += realized;
        notify(s, intrinsic > 0 ? "succes" : "info", `${d.name} : ${intrinsic > 0 ? "exercée automatiquement" : "expirée sans valeur"}`, `Sous-jacent ${und.toFixed(2)} — valeur intrinsèque ${intrinsic.toFixed(2)} × ${Math.abs(p.qty)} × ${o.multiplier}.`, "/play/portefeuille");
        gainXp(s, "maths", 25, "Échéance d'options");
      } else {
        const f = d.future!;
        const variation = (und - (p.lastSettle ?? und)) * p.qty * f.multiplier;
        if (Math.abs(variation) >= 0.01) post(s, cashAcc(acc.id), EXT_CCP, toCents(variation), d.currency, `Règlement final ${d.id}`, d.id);
        const realized = toCents(toEur(s, (und - p.avgPrice) * p.qty * f.multiplier, d.currency));
        p.realized += realized; acc.realizedTotal += realized;
        const locked = bal(s, marginAcc(acc.id), d.currency);
        const share = Math.min(locked, toCents(Math.abs(p.qty) * (p.lastSettle ?? und) * f.multiplier * f.marginPct));
        if (share > 0) post(s, cashAcc(acc.id), marginAcc(acc.id), share, d.currency, `Restitution du dépôt de garantie ${d.id}`);
        notify(s, "info", `Échéance du future ${d.id}`, `Règlement final au cours du sous-jacent : ${und.toFixed(2)}.`, "/play/portefeuille");
      }
      delete acc.positions[d.id];
    }
    for (const o of s.orders) if (o.instrumentId === d.id && (o.status === "en_attente" || o.status === "partiel")) { o.status = "expire"; o.updatedT = s.t; }
    delete s.instruments[d.id]; delete s.quotes[d.id]; invalidateInstruments(s);
    s.watchlist = s.watchlist.filter((w) => w !== d.id);
  }
  listFutures(s);
}

/** Surveillance de la marge : appel de marge puis liquidation forcée */
export function checkMargins(s: GameState) {
  for (const acc of Object.values(s.accounts)) {
    const req = marginRequirement(s, acc.id);
    if (req <= 0) { acc.marginCall = undefined; continue; }
    const eq = accountEquity(s, acc.id);
    const maint = req * 0.6;
    if (eq >= maint) { if (acc.marginCall) notify(s, "succes", `Appel de marge levé (${acc.label})`); acc.marginCall = undefined; continue; }
    if (!acc.marginCall) {
      acc.marginCall = { sinceT: s.t, deadlineT: s.t + MIN_PER_DAY };
      notify(s, "critique", `APPEL DE MARGE — ${acc.label}`, `Valeur nette ${Math.round(eq).toLocaleString("fr-FR")} € < marge de maintenance ${Math.round(maint).toLocaleString("fr-FR")} €. Réduisez vos positions ou apportez des liquidités sous 24 h simulées.`, "/play/risques");
      s.paused = s.settings.autoPauseImportant ? true : s.paused; s.pauseReason = "Appel de marge";
      continue;
    }
    if (s.t >= acc.marginCall.deadlineT || eq < maint * 0.5) liquidate(s, acc);
  }
}
export function liquidate(s: GameState, acc: Account) {
  let n = 0;
  for (const p of Object.values(acc.positions)) {
    const d = s.instruments[p.instrumentId];
    const risky = p.qty < 0 || d.future || d.option;
    if (!risky) continue;
    for (const o of s.orders) if (o.account === acc.id && o.instrumentId === d.id && (o.status === "en_attente" || o.status === "partiel")) o.status = "annule";
    const r = placeOrder(s, { account: acc.id, instrumentId: d.id, side: p.qty > 0 ? "sell" : "buy", type: "market", qty: Math.abs(p.qty), tag: "liquidation" });
    if (r.ok) n++;
  }
  acc.marginCall = undefined;
  if (n > 0) {
    notify(s, "critique", `LIQUIDATION FORCÉE — ${acc.label}`, `${n} position(s) clôturée(s) d'office par le service des risques.`, "/play/risques");
    if (acc.kind === "desk") { s.career.breaches++; s.reputation.risque = Math.max(0, s.reputation.risque - 12); s.career.warnings++; }
    logDecision(s, "risque", `Liquidation forcée de ${n} positions sur ${acc.label}`);
  }
}
