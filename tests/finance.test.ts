import { describe, it, expect } from "vitest";
import { game, atEuOpen, cash } from "./helpers";
import { placeOrder, cancelOrder, processExpiries, checkMargins, convertCash, feeFor, ensureOption, optionId, listExpiries, strikeGrid, tryExecute } from "@/engine/orders";
import { isBalanced, trialBalance } from "@/engine/ledger";
import { payDividend, dailyBonds } from "@/engine/corporate";
import { issueProducts, subscribe, observeProduct } from "@/engine/structured";
import { blackScholes, bondPriceFromYield, yieldFromPrice, impliedVol, binomialAmerican, couponSchedule } from "@/engine/pricing";
import { accountEquity, marginRequirement } from "@/engine/portfolio";
import { quoteBook } from "@/engine/market";
import { Rng } from "@/engine/rng";
import { MIN_PER_DAY, tOfDay } from "@/engine/time";
import { toCents, mulToCents } from "@/engine/money";

describe("Valorisation", () => {
  it("Black-Scholes : parité call-put et grecques cohérentes", () => {
    const S = 100, K = 95, T = 0.5, r = 0.03, q = 0.01, v = 0.25;
    const c = blackScholes("call", S, K, T, r, v, q), p = blackScholes("put", S, K, T, r, v, q);
    expect(c.price - p.price).toBeCloseTo(S * Math.exp(-q * T) - K * Math.exp(-r * T), 6);
    expect(c.delta).toBeGreaterThan(0.5); expect(p.delta).toBeLessThan(0);
    expect(c.gamma).toBeCloseTo(p.gamma, 10); expect(c.vega).toBeCloseTo(p.vega, 10);
    expect(c.theta).toBeLessThan(0);
    expect(impliedVol("call", c.price, S, K, T, r, q)).toBeCloseTo(v, 4);
    expect(binomialAmerican("put", S, K, T, r, v, q)).toBeGreaterThanOrEqual(p.price - 1e-6);
  });
  it("Obligations : prix ↔ taux actuariel, duration et sensibilité", () => {
    const s = game();
    const d = s.instruments["FR10Y"];
    const a = bondPriceFromYield(d, 3, 0.04);
    expect(yieldFromPrice(d, 3, a.price)).toBeCloseTo(0.04, 6);
    const up = bondPriceFromYield(d, 3, 0.0401).price;
    expect((a.price - up) / a.price * 10000).toBeCloseTo(a.modified, 0);
    expect(a.modified).toBeGreaterThan(7); expect(a.modified).toBeLessThan(9.5);
  });
  it("Arrondi monétaire en centimes (demi-pair)", () => {
    expect(mulToCents(10.005, 1)).toBe(1000);
    expect(mulToCents(10.015, 1)).toBe(1002);
    expect(toCents(0.1 + 0.2)).toBe(30);
  });
});

describe("Ordres et comptabilité", () => {
  it("Achat d'action : trésorerie débitée du montant + frais, position créée", () => {
    const s = atEuOpen(game());
    const before = cash(s);
    const r = placeOrder(s, { account: "perso", instrumentId: "MAIS", side: "buy", type: "market", qty: 10 });
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.order.status).toBe("execute");
    const pos = s.accounts.perso.positions["MAIS"];
    expect(pos.qty).toBe(10);
    const spent = before - cash(s);
    expect(spent).toBeCloseTo(r.order.avgFill! * 10 + r.order.fees / 100, 1);
    expect(r.order.avgFill!).toBeGreaterThanOrEqual(quoteBook(s, "MAIS").ask - 1e-9);
    expect(isBalanced(s)).toBe(true);
  });
  it("Vente : P&L réalisé, position soldée, frais", () => {
    const s = atEuOpen(game());
    placeOrder(s, { account: "perso", instrumentId: "MAIS", side: "buy", type: "market", qty: 10 });
    s.quotes["MAIS"].price *= 1.1;
    const r = placeOrder(s, { account: "perso", instrumentId: "MAIS", side: "sell", type: "market", qty: 10 });
    expect(r.ok && r.order.status).toBe("execute");
    expect(s.accounts.perso.positions["MAIS"]).toBeUndefined();
    expect(s.accounts.perso.realizedTotal).toBeGreaterThan(0);
    expect(isBalanced(s)).toBe(true);
  });
  it("Achat en devise étrangère : conversion automatique EUR→USD", () => {
    const s = atEuOpen(game()); s.t = tOfDay(Math.floor(s.t / MIN_PER_DAY), 16, 0);
    const r = placeOrder(s, { account: "perso", instrumentId: "NOVX", side: "buy", type: "market", qty: 5 });
    expect(r.ok).toBe(true);
    expect(cash(s, "perso", "USD")).toBeGreaterThanOrEqual(0);
    expect(cash(s)).toBeLessThan(100000);
    expect(isBalanced(s)).toBe(true);
  });
  it("Fonds insuffisants : ordre refusé, aucune création monétaire", () => {
    const s = atEuOpen(game("bac_a_sable", "x", 1000));
    const r = placeOrder(s, { account: "perso", instrumentId: "MAIS", side: "buy", type: "market", qty: 100 });
    expect(r.ok).toBe(false);
    expect(cash(s)).toBe(1000);
  });
  it("Ordre limite : jamais exécuté au-delà de sa limite", () => {
    const s = atEuOpen(game());
    const px = s.quotes["XWLD"].price;
    const r = placeOrder(s, { account: "perso", instrumentId: "XWLD", side: "buy", type: "limit", limit: px * 0.95, qty: 10, duration: "gtc" });
    expect(r.ok && r.order.status).toBe("en_attente");
    s.quotes["XWLD"].price = px * 0.94;
    if (r.ok) { tryExecute(s, r.order); expect(r.order.status).toBe("execute"); expect(r.order.avgFill!).toBeLessThanOrEqual(px * 0.95 + 1e-9); }
  });
  it("Stop-loss déclenché et OCO avec take-profit", () => {
    const s = atEuOpen(game());
    const px = s.quotes["XWLD"].price;
    const r = placeOrder(s, { account: "perso", instrumentId: "XWLD", side: "buy", type: "market", qty: 10, stopLoss: px * 0.9, takeProfit: px * 1.2 });
    expect(r.ok).toBe(true);
    const sl = s.orders.find((o) => o.tag === "stop_loss")!, tp = s.orders.find((o) => o.tag === "take_profit")!;
    expect(sl.ocoWith).toBe(tp.id);
    s.quotes["XWLD"].price = px * 0.85;
    tryExecute(s, sl);
    expect(sl.status).toBe("execute");
    tryExecute(s, tp);
    expect(tp.status).toBe("annule");
    expect(s.accounts.perso.positions["XWLD"]).toBeUndefined();
  });
  it("Pas de double exécution (identifiant client idempotent) et annulation", () => {
    const s = atEuOpen(game());
    const a = placeOrder(s, { account: "perso", instrumentId: "XWLD", side: "buy", type: "limit", limit: 1, qty: 1, clientRef: "abc" });
    const b = placeOrder(s, { account: "perso", instrumentId: "XWLD", side: "buy", type: "limit", limit: 1, qty: 1, clientRef: "abc" });
    expect(a.ok).toBe(true); expect(b.ok).toBe(false);
    if (a.ok) { expect(cancelOrder(s, a.order.id).ok).toBe(true); expect(cancelOrder(s, a.order.id).ok).toBe(false); }
  });
  it("Calcul des frais par classe d'actifs", () => {
    const s = game();
    const perso = s.accounts.perso;
    expect(feeFor(s, perso, s.instruments["MAIS"], 500, 1)).toBe(1); // minimum 1
    expect(feeFor(s, perso, s.instruments["MAIS"], 10000, 1)).toBeCloseTo(10);
    expect(feeFor(s, perso, s.instruments["EURUSD"], 10000, 1)).toBe(0);
  });
  it("Conversion de devises équilibrée", () => {
    const s = game();
    const got = convertCash(s, "perso", "EUR", "USD", toCents(1000));
    expect(got / 100).toBeGreaterThan(1000);
    expect(isBalanced(s)).toBe(true);
  });
  it("Dividende crédité aux porteurs et cours ajusté", () => {
    const s = atEuOpen(game());
    placeOrder(s, { account: "perso", instrumentId: "TERA", side: "buy", type: "market", qty: 100 });
    const c0 = cash(s), p0 = s.quotes["TERA"].price, div = s.quotes["TERA"].dividend! / 4;
    payDividend(s, "TERA");
    expect(cash(s) - c0).toBeCloseTo(div * 100, 1);
    expect(s.quotes["TERA"].price).toBeCloseTo(p0 - div, 6);
    expect(isBalanced(s)).toBe(true);
  });
  it("Coupon versé à la date contractuelle et remboursement à l'échéance", () => {
    const s = atEuOpen(game()); s.t += 6 * 60; // séance américaine
    expect(placeOrder(s, { account: "perso", instrumentId: "PCBK29", side: "buy", type: "market", qty: 5 }).ok).toBe(true);
    s.flags["cpn_PCBK29"] = Math.floor(s.t / MIN_PER_DAY);
    const d = s.instruments["PCBK29"];
    const sched = couponSchedule(d, Math.floor(s.t / MIN_PER_DAY));
    s.quotes["PCBK"].stress = 0;
    s.t = sched[0] * MIN_PER_DAY + 60;
    const c0 = cash(s, "perso", "USD");
    dailyBonds(s, new Rng(s.rng));
    expect(cash(s, "perso", "USD") - c0).toBeCloseTo(5 * 1000 * 0.075 / 2, 2);
    const remaining = couponSchedule(d, sched[0]).length; // coupons restants, rattrapés jusqu'à l'échéance
    s.t = d.bond!.maturityDay * MIN_PER_DAY + 60;
    const c1 = cash(s, "perso", "USD");
    dailyBonds(s, new Rng(s.rng));
    expect(cash(s, "perso", "USD") - c1).toBeCloseTo(5 * 1000 + remaining * 5 * 1000 * 0.075 / 2, 2);
    expect(s.accounts.perso.positions["PCBK29"]).toBeUndefined();
    expect(isBalanced(s)).toBe(true);
  });
  it("Options : exercice automatique ITM et expiration sans valeur OTM", () => {
    const s = atEuOpen(game());
    const exp = listExpiries(s, 1)[0];
    const grid = strikeGrid(s.quotes["XEUR"].price, 6);
    const kItm = grid[2], kOtm = grid[grid.length - 1];
    const idItm = optionId("XEUR", "call", kItm, exp), idOtm = optionId("XEUR", "call", kOtm, exp);
    expect(ensureOption(s, idItm).ok).toBe(true);
    expect(placeOrder(s, { account: "perso", instrumentId: idItm, side: "buy", type: "market", qty: 1 }).ok).toBe(true);
    expect(placeOrder(s, { account: "perso", instrumentId: idOtm, side: "buy", type: "market", qty: 1 }).ok).toBe(true);
    const S = s.quotes["XEUR"].price;
    s.t = exp * MIN_PER_DAY + 17 * 60 + 30;
    const c0 = cash(s);
    processExpiries(s);
    expect(cash(s) - c0).toBeCloseTo((S - kItm) * 100, 0);
    expect(s.accounts.perso.positions[idItm]).toBeUndefined();
    expect(s.accounts.perso.positions[idOtm]).toBeUndefined();
    expect(isBalanced(s)).toBe(true);
  });
  it("Futures : dépôt de garantie, appel de marge puis liquidation forcée", () => {
    const s = atEuOpen(game("bac_a_sable", "fut", 20000));
    const fut = Object.keys(s.instruments).find((k) => k.startsWith("FEU"))!;
    const r = placeOrder(s, { account: "perso", instrumentId: fut, side: "buy", type: "market", qty: 3 });
    expect(r.ok).toBe(true);
    expect(marginRequirement(s, "perso")).toBeGreaterThan(0);
    s.quotes[fut].price *= 0.6;
    s.quotes["IDX-EU"].price *= 0.6;
    checkMargins(s);
    expect(s.accounts.perso.marginCall).toBeTruthy();
    s.t += MIN_PER_DAY + 5;
    checkMargins(s);
    expect(s.accounts.perso.positions[fut]).toBeUndefined();
    expect(isBalanced(s)).toBe(true);
    expect(Object.values(trialBalance(s)).every((v) => v === 0)).toBe(true);
  });
  it("Produit structuré : remboursement à l'échéance selon la barrière", () => {
    const s = atEuOpen(game());
    issueProducts(s, new Rng(s.rng), 6);
    const p = s.structuredProducts.find((x) => x.kind === "reverse_convertible")!;
    expect(subscribe(s, "perso", p.id, 5000).ok).toBe(true);
    for (const u of p.underlyings) s.quotes[u].price = p.initial[u] * 0.5; // sous la barrière de 70 %
    const c0 = cash(s);
    for (const d of p.observationDays) { s.t = d * MIN_PER_DAY + 18 * 60; observeProduct(s, p.id); }
    const h = s.structuredHoldings.find((x) => x.productId === p.id)!;
    expect(h.status).toBe("echu");
    expect(h.redemption! / 100).toBeCloseTo(2500, 0); // perte en capital : barrière ≠ garantie
    expect(cash(s) - c0).toBeCloseTo(2500 + h.couponsPaid / 100, 0);
    expect(isBalanced(s)).toBe(true);
  });
  it("Conservation comptable : la somme des soldes est nulle après de nombreuses opérations", () => {
    const s = atEuOpen(game());
    const ids = ["MAIS", "XWLD", "EURUSD", "GOLD", "XEUR", "TERA", "DE10Y"];
    for (let i = 0; i < 40; i++) {
      const id = ids[i % ids.length];
      placeOrder(s, { account: "perso", instrumentId: id, side: i % 3 === 2 ? "sell" : "buy", type: "market", qty: id === "EURUSD" ? 1000 : 2 });
      s.quotes[id].price *= 1 + ((i % 5) - 2) / 100;
    }
    expect(isBalanced(s)).toBe(true);
    expect(accountEquity(s, "perso")).toBeGreaterThan(0);
  });
});
