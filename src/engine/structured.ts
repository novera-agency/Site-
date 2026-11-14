/** Produits structurés : émission, souscription, moteur d'observation contractuel, défaut de l'émetteur. */
import type { GameState, StructuredProduct, StructuredHolding } from "./types";
import { Rng } from "./rng";
import { cashAcc, cashOf, post } from "./ledger";
import { toCents, fromCents } from "./money";
import { addMonthsDay, dayIndex, fmtShortDate, MIN_PER_DAY, nextBusinessDay } from "./time";
import { nextId, notify, pushNews, gainXp, logDecision } from "./core";
import { mcPaths } from "./pricing";
import { baseVol, rateFor } from "./market";

const EXT_ISSUERS = "ext:emetteurs_structures";
const ISSUERS = [{ name: "Banque Lutèce & Associés", stock: "LUTB" }, { name: "Hudson Meridian Partners", stock: "HDMP" }, { name: "Union Bancaire Continentale", stock: "UBCE" }, { name: "Seiryu Markets Holdings", stock: "SEIR" }, { name: "Banca Adriatica", stock: "BADR" }];
const UNDERLYINGS = [["IDX-EU"], ["MAIS"], ["TERA"], ["IDX-US"], ["NOVX"], ["LUTB", "UBCE", "BADR"], ["AERO", "SIGA"], ["XWLD"], ["CURA", "ALPN"], ["ELEC"]];

export function issueProducts(s: GameState, rng: Rng, n = 3) {
  const day = dayIndex(s.t);
  const kinds: StructuredProduct["kind"][] = ["autocall", "phoenix", "reverse_convertible", "capital_protege", "participation", "barriere"];
  for (let i = 0; i < n; i++) {
    const kind = kinds[(s.structuredProducts.length + i) % kinds.length];
    const unds = rng.pick(UNDERLYINGS).filter((u) => s.instruments[u]);
    const issuer = rng.pick(ISSUERS);
    const years = kind === "reverse_convertible" ? 1 : kind === "capital_protege" ? 4 : kind === "barriere" ? 2 : 3;
    const freq = kind === "reverse_convertible" ? 3 : kind === "autocall" ? 12 : 3;
    const maturityDay = nextBusinessDay(addMonthsDay(day, years * 12));
    const obs: number[] = [];
    for (let m = freq; m <= years * 12; m += freq) obs.push(nextBusinessDay(addMonthsDay(day, m)));
    const vol = unds.reduce((a, u) => a + baseVol(s, u), 0) / unds.length * (unds.length > 1 ? 1.15 : 1);
    const r = rateFor(s, "EUR") / 100;
    const stress = s.quotes[issuer.stock]?.stress ?? 0;
    const couponRate = Math.round((r + vol * (kind === "reverse_convertible" ? 0.45 : kind === "phoenix" ? 0.32 : 0.28) + stress * 0.05) * 400) / 400;
    const initial: Record<string, number> = {};
    for (const u of unds) initial[u] = s.quotes[u].price;
    const names = unds.map((u) => s.instruments[u].name).join(", ");
    const p: StructuredProduct = {
      id: nextId(s, "sp"), kind, issuer: issuer.name, issuerStock: issuer.stock, underlyings: unds, launchDay: day, maturityDay, initial,
      protectionBarrier: kind === "capital_protege" ? 0 : kind === "reverse_convertible" ? 0.7 : kind === "barriere" ? 0.7 : 0.6,
      couponBarrier: kind === "phoenix" ? 0.7 : 1, autocallLevel: kind === "autocall" || kind === "phoenix" ? 1 : 99,
      couponRate: kind === "capital_protege" || kind === "participation" || kind === "barriere" ? 0 : couponRate, memory: kind === "phoenix",
      freqMonths: freq, observationDays: obs, capitalProtection: kind === "capital_protege" ? 0.95 : 0, participation: kind === "capital_protege" ? 0.6 : kind === "participation" ? 1.3 : kind === "barriere" ? 1.15 : 0,
      subscriptionEndDay: day + 14, minTicket: toCents(1000), observationsDone: 0,
      name: "", description: "",
    };
    p.name = productName(p, unds.length > 1 ? "Panier " + unds.join("/") : s.instruments[unds[0]].name);
    p.description = describe(p, names);
    s.structuredProducts.push(p);
    for (const od of obs) s.calendar.push({ id: nextId(s, "cal"), day: od, minute: 17 * 60 + 40, title: `Observation ${p.name}`, kind: "observation", ref: p.id, importance: 1 });
  }
  s.calendar.sort((a, b) => a.day - b.day || a.minute - b.minute);
}
function productName(p: StructuredProduct, und: string) {
  const k = { autocall: "Autocall Athéna", phoenix: "Phoenix Mémoire", reverse_convertible: "Reverse Convertible", capital_protege: "Capital Protégé 95 %", participation: "Tracker Participation 130 %", barriere: "Bonus Barrière" }[p.kind];
  return `${k} ${und} ${fmtShortDate(p.maturityDay * MIN_PER_DAY).slice(6)}`;
}
function describe(p: StructuredProduct, names: string) {
  const pct = (x: number) => `${Math.round(x * 100)} %`;
  const worst = p.underlyings.length > 1 ? "le moins performant des sous-jacents (worst-of)" : "le sous-jacent";
  switch (p.kind) {
    case "autocall": return `Sous-jacent : ${names}. Chaque année, si ${worst} est au-dessus de ${pct(p.autocallLevel)} de son niveau initial, le produit est remboursé par anticipation avec un gain de ${pct(p.couponRate)} par année écoulée (effet « boule de neige »). À l'échéance, le capital est remboursé si ${worst} n'a pas baissé de plus de ${pct(1 - p.protectionBarrier)} ; sinon la perte en capital est égale à la baisse du sous-jacent. Risque de crédit de ${p.issuer}.`;
    case "phoenix": return `Sous-jacent : ${names}. Coupon conditionnel de ${pct(p.couponRate)} par an versé trimestriellement si ${worst} est au-dessus de ${pct(p.couponBarrier)} de son niveau initial (avec effet mémoire des coupons non versés). Remboursement anticipé si au-dessus de ${pct(p.autocallLevel)}. Protection du capital jusqu'à −${pct(1 - p.protectionBarrier)} à l'échéance uniquement. La barrière n'est PAS une garantie. Risque de crédit de ${p.issuer}.`;
    case "reverse_convertible": return `Sous-jacent : ${names}. Coupon fixe garanti de ${pct(p.couponRate)} par an versé trimestriellement. À l'échéance (1 an), si ${worst} a baissé de plus de ${pct(1 - p.protectionBarrier)}, le remboursement est égal au nominal multiplié par la performance du sous-jacent. Risque de crédit de ${p.issuer}.`;
    case "capital_protege": return `Sous-jacent : ${names}. À l'échéance, remboursement d'au moins ${pct(p.capitalProtection)} du capital, plus ${pct(p.participation)} de la hausse du sous-jacent. La protection dépend de la solvabilité de l'émetteur ${p.issuer} et ne vaut qu'à l'échéance.`;
    case "participation": return `Sous-jacent : ${names}. Participation de ${pct(p.participation)} à la performance (hausse ET baisse) à l'échéance, sans protection. Risque de crédit de ${p.issuer}.`;
    case "barriere": return `Certificat bonus sur ${names}. Si ${worst} ne clôture jamais sous ${pct(p.protectionBarrier)} de son niveau initial pendant la vie du produit, le remboursement est au moins de ${pct(p.participation)} du nominal (ou la performance si elle est supérieure). Si la barrière est touchée, le produit suit simplement le sous-jacent. Barrière observée chaque jour.`;
  }
}

export function subscribe(s: GameState, accId: string, productId: string, nominalEur: number) {
  const p = s.structuredProducts.find((x) => x.id === productId);
  if (!p) return { ok: false as const, error: "Produit introuvable." };
  if (dayIndex(s.t) > p.subscriptionEndDay) return { ok: false as const, error: "La période de souscription est close." };
  const nominal = toCents(Math.floor(nominalEur / 100) * 100);
  if (nominal < p.minTicket) return { ok: false as const, error: `Ticket minimum : ${fromCents(p.minTicket)} € (par multiples de 100 €).` };
  if (cashOf(s, accId, "EUR") < nominal) return { ok: false as const, error: "Liquidités en euros insuffisantes." };
  post(s, EXT_ISSUERS, cashAcc(accId), nominal, "EUR", `Souscription ${p.name}`, p.id);
  const h: StructuredHolding = { id: nextId(s, "sh"), productId, account: accId, nominal, t: s.t, status: "actif", couponsPaid: 0, missedCoupons: 0, log: [`${fmtShortDate(s.t)} : souscription de ${fromCents(nominal)} €`] };
  s.structuredHoldings.push(h);
  gainXp(s, "maths", 20, "Souscription de produit structuré");
  logDecision(s, "structure", `Souscription de ${fromCents(nominal)} € au produit ${p.name}`);
  return { ok: true as const, holding: h };
}

function worstPerf(s: GameState, p: StructuredProduct) { return Math.min(...p.underlyings.map((u) => s.quotes[u].price / p.initial[u])); }

/** Observation contractuelle (appelée par le calendrier) */
export function observeProduct(s: GameState, productId: string) {
  const p = s.structuredProducts.find((x) => x.id === productId);
  if (!p) return;
  const day = dayIndex(s.t);
  const idx = p.observationDays.indexOf(day);
  if (idx < 0) return;
  p.observationsDone = idx + 1;
  const perf = worstPerf(s, p);
  const isFinal = idx === p.observationDays.length - 1;
  const yearsElapsed = ((idx + 1) * p.freqMonths) / 12;
  const holdings = s.structuredHoldings.filter((h) => h.productId === p.id && h.status === "actif");
  for (const h of holdings) {
    const nom = h.nominal;
    const note = (txt: string) => h.log.push(`${fmtShortDate(s.t)} : ${txt}`);
    const pay = (c: number, memo: string) => { if (c > 0) { post(s, cashAcc(h.account), EXT_ISSUERS, c, "EUR", memo, p.id); } };
    const periodCpn = Math.round(nom * p.couponRate * p.freqMonths / 12);
    if (p.kind === "reverse_convertible") { pay(periodCpn, `Coupon ${p.name}`); h.couponsPaid += periodCpn; note(`coupon versé (${fromCents(periodCpn)} €)`); }
    if (p.kind === "phoenix") {
      if (perf >= p.couponBarrier) { const c = periodCpn * (1 + (p.memory ? h.missedCoupons : 0)); pay(c, `Coupon conditionnel ${p.name}`); h.couponsPaid += c; note(`coupon versé ${fromCents(c)} € (performance ${(perf * 100).toFixed(1)} %)`); h.missedCoupons = 0; }
      else { h.missedCoupons++; note(`coupon non versé : sous-jacent à ${(perf * 100).toFixed(1)} % < barrière ${(p.couponBarrier * 100).toFixed(0)} %`); }
    }
    if ((p.kind === "autocall" || p.kind === "phoenix") && !isFinal && perf >= p.autocallLevel) {
      const red = nom + (p.kind === "autocall" ? Math.round(nom * p.couponRate * yearsElapsed) : 0);
      pay(red, `Remboursement anticipé ${p.name}`);
      h.redemption = red; h.status = "rembourse_anticipe"; note(`remboursement anticipé : ${fromCents(red)} €`);
      notify(s, "succes", `Remboursement anticipé : ${p.name}`, `${fromCents(red)} € versés.`, "/play/structures");
      continue;
    }
    if (isFinal) {
      let red: number;
      if (p.kind === "capital_protege") red = Math.round(nom * (p.capitalProtection + p.participation * Math.max(0, perf - 1)));
      else if (p.kind === "participation") red = Math.round(nom * Math.max(0, 1 + p.participation * (perf - 1)));
      else if (p.kind === "barriere") red = (s.flags[`barrier_${p.id}`] ? Math.round(nom * perf) : Math.round(nom * Math.max(p.participation, perf)));
      else if (perf >= p.protectionBarrier) red = nom + (p.kind === "autocall" && perf >= p.autocallLevel ? Math.round(nom * p.couponRate * yearsElapsed) : 0);
      else red = Math.round(nom * perf);
      pay(red, `Remboursement à l'échéance ${p.name}`);
      h.redemption = red; h.status = "echu";
      note(`échéance : remboursement de ${fromCents(red)} € (performance finale ${(perf * 100).toFixed(1)} %)`);
      notify(s, red >= nom ? "succes" : "alerte", `Échéance : ${p.name}`, `Remboursement ${fromCents(red)} € pour ${fromCents(nom)} € investis.`, "/play/structures");
    }
  }
}

/** Surveillance journalière : barrières continues et défaut de l'émetteur */
export function dailyStructured(s: GameState) {
  for (const p of s.structuredProducts) {
    if (p.kind === "barriere" && !s.flags[`barrier_${p.id}`] && dayIndex(s.t) <= p.maturityDay && worstPerf(s, p) < p.protectionBarrier) {
      s.flags[`barrier_${p.id}`] = true;
      if (s.structuredHoldings.some((h) => h.productId === p.id && h.status === "actif")) notify(s, "alerte", `Barrière désactivante touchée : ${p.name}`, "Le bonus est perdu : le produit suit désormais le sous-jacent.", "/play/structures");
    }
    if (p.issuerStock && s.quotes[p.issuerStock]?.defaulted) {
      for (const h of s.structuredHoldings) {
        if (h.productId !== p.id || h.status !== "actif") continue;
        const rec = Math.round(h.nominal * 0.3);
        post(s, cashAcc(h.account), EXT_ISSUERS, rec, "EUR", `Défaut de l'émetteur ${p.issuer} — recouvrement 30 %`, p.id);
        h.status = "defaut"; h.redemption = rec; h.log.push(`${fmtShortDate(s.t)} : DÉFAUT DE L'ÉMETTEUR — recouvrement ${fromCents(rec)} €`);
        notify(s, "critique", `Défaut de l'émetteur ${p.issuer}`, `Votre produit ${p.name} ne vaut plus que ${fromCents(rec)} €.`, "/play/structures");
      }
    }
  }
  const day = dayIndex(s.t);
  // Purge des offres expirées sans encours
  s.structuredProducts = s.structuredProducts.filter((p) => day <= p.subscriptionEndDay || s.structuredHoldings.some((h) => h.productId === p.id));
  if (s.structuredProducts.filter((p) => day <= p.subscriptionEndDay).length < 3) {
    const rng = new Rng(s.rng); issueProducts(s, rng, 2);
    pushNews(s, { category: "marches", title: "Nouvelles émissions de produits structurés", body: "Plusieurs émetteurs lancent de nouvelles campagnes de produits structurés à destination des investisseurs particuliers et privés.", impact: "faible", tickers: [], zones: ["EZ"], sentiment: 0 });
  }
}

/** Valeur indicative Monte-Carlo (déterministe) et scénarios de remboursement */
export function structuredScenarios(s: GameState, productId: string, paths = 400) {
  const p = s.structuredProducts.find((x) => x.id === productId);
  if (!p) return null;
  const day = dayIndex(s.t);
  const remaining = p.observationDays.filter((d) => d > day).map((d) => d - day);
  if (remaining.length === 0) return { fair: 1, probCapitalLoss: 0, probEarly: 0, avgCoupons: 0, histogram: [] as number[] };
  const s0 = p.underlyings.map((u) => s.quotes[u].price / p.initial[u]);
  const vols = p.underlyings.map((u) => baseVol(s, u));
  const r = rateFor(s, "EUR") / 100;
  const all = mcPaths(`${p.id}:${day}`, s0, vols, 0.6, r, remaining, paths);
  let sum = 0, loss = 0, early = 0, cpnSum = 0;
  const outcomes: number[] = [];
  const done = p.observationsDone;
  for (const path of all) {
    let value = 0, cpn = 0, missed = 0, ended = false, touched = !!s.flags[`barrier_${p.id}`];
    for (let k = 0; k < path.length && !ended; k++) {
      const perf = Math.min(...path[k]);
      const obsIndex = done + k;
      const yearsElapsed = ((obsIndex + 1) * p.freqMonths) / 12;
      const df = Math.exp(-r * remaining[k] / 365);
      if (p.kind === "barriere" && perf < p.protectionBarrier) touched = true;
      if (p.kind === "reverse_convertible") cpn += p.couponRate * p.freqMonths / 12 * df;
      if (p.kind === "phoenix") { if (perf >= p.couponBarrier) { cpn += p.couponRate * p.freqMonths / 12 * (1 + missed) * df; missed = 0; } else missed++; }
      const isFinal = k === path.length - 1;
      if ((p.kind === "autocall" || p.kind === "phoenix") && !isFinal && perf >= p.autocallLevel) { value = (1 + (p.kind === "autocall" ? p.couponRate * yearsElapsed : 0)) * df; ended = true; early++; break; }
      if (isFinal) {
        let red: number;
        if (p.kind === "capital_protege") red = p.capitalProtection + p.participation * Math.max(0, perf - 1);
        else if (p.kind === "participation") red = Math.max(0, 1 + p.participation * (perf - 1));
        else if (p.kind === "barriere") red = touched ? perf : Math.max(p.participation, perf);
        else if (perf >= p.protectionBarrier) red = 1 + (p.kind === "autocall" && perf >= p.autocallLevel ? p.couponRate * yearsElapsed : 0);
        else red = perf;
        value = red * df;
        if (red < 0.999) loss++;
      }
    }
    const stress = p.issuerStock ? s.quotes[p.issuerStock]?.stress ?? 0 : 0;
    const total = (value + cpn) * (1 - stress * 0.4);
    sum += total; cpnSum += cpn; outcomes.push(total);
  }
  const bins = new Array(12).fill(0);
  for (const o of outcomes) bins[Math.max(0, Math.min(11, Math.floor(o * 8)))]++;
  return { fair: sum / paths, probCapitalLoss: loss / paths, probEarly: early / paths, avgCoupons: cpnSum / paths, histogram: bins };
}
