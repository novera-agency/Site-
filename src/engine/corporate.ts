/** Événements sur titres : résultats trimestriels, dividendes, coupons, remboursements, défauts. */
import type { GameState, InstrumentDef } from "./types";
import { Rng } from "./rng";
import { applyShock } from "./market";
import { cashAcc, post } from "./ledger";
import { toCents } from "./money";
import { couponSchedule } from "./pricing";
import { ensureCash } from "./orders";
import { nextId, notify, pushNews, toEur, ZONE_NAMES, changeRep } from "./core";
import { REGIMES } from "./regimes";
import { dayIndex, MIN_PER_DAY, nextBusinessDay } from "./time";

const EXT_ISSUERS = "ext:emetteurs";

export function initFundamentals(s: GameState, rng: Rng) {
  const today = dayIndex(s.t);
  for (const d of Object.values(s.instruments)) {
    if (d.cls !== "action") continue;
    const q = s.quotes[d.id];
    q.eps = (d.revenue! * d.margin!) / d.shares!;
    q.dividend = q.eps * d.payout!;
    q.nextEarningsDay = nextBusinessDay(today + rng.int(8, 75));
    scheduleEarningsEvent(s, d, q.nextEarningsDay);
  }
}
function earningsMinute(d: InstrumentDef) { return d.session === "US" ? 22 * 60 + 5 : d.session === "ASIA" ? 7 * 60 + 45 : 7 * 60 + 30; }
function scheduleEarningsEvent(s: GameState, d: InstrumentDef, day: number) {
  s.calendar.push({ id: nextId(s, "cal"), day, minute: earningsMinute(d), title: `Résultats trimestriels — ${d.name}`, kind: "resultats", ref: d.id, importance: d.liquidity > 0.85 ? 2 : 1 });
  s.calendar.push({ id: nextId(s, "cal"), day: nextBusinessDay(day + 21), minute: 8 * 60 + 45, title: `Détachement du dividende — ${d.name}`, kind: "dividende", ref: d.id, importance: 1 });
}

export function releaseEarnings(s: GameState, id: string, rng: Rng) {
  const d = s.instruments[id], q = s.quotes[id];
  if (!d || !q || q.defaulted) return;
  const z = s.macro.zones[d.zone];
  const reg = REGIMES[s.macro.regime];
  const expected = (d.growth ?? 0.03) / 4;
  const macroBias = (z.growth - 1.5) * 0.006 + (reg.sectorTilt[d.sector!] ?? 0) * 0.08 - q.stress * 0.15;
  const surprise = rng.normal() * 0.05 + macroBias;
  const oldEps = q.eps!;
  q.eps = Math.max(oldEps * 0.2, oldEps * (1 + expected + surprise));
  q.dividend = Math.max(0, q.eps * d.payout! * (q.stress > 0.4 ? 0.3 : 1));
  q.lastEarningsDay = dayIndex(s.t);
  const reaction = surprise * 1.6 + rng.normal() * 0.015;
  applyShock(s, { kind: "instrument", id }, reaction, Math.abs(surprise) * 3, `Résultats ${d.name}`);
  const beat = surprise > 0.02 ? "supérieurs aux attentes" : surprise < -0.02 ? "inférieurs aux attentes" : "conformes aux attentes";
  const epsTxt = `BPA trimestriel ${(q.eps / 4).toFixed(2)} ${d.currency} (${surprise >= 0 ? "+" : ""}${(surprise * 100).toFixed(1)} % vs consensus)`;
  pushNews(s, {
    category: "entreprises",
    title: `${d.name} publie des résultats ${beat}`,
    body: `${epsTxt}. ${surprise > 0.04 ? "La direction relève ses perspectives annuelles." : surprise < -0.04 ? "La direction abaisse ses prévisions et évoque un environnement difficile." : "Les objectifs annuels sont confirmés."} Secteur : ${d.sector}, ${ZONE_NAMES[d.zone]}.`,
    impact: Math.abs(surprise) > 0.05 ? "fort" : Math.abs(surprise) > 0.02 ? "moyen" : "faible", tickers: [id], zones: [d.zone], sentiment: surprise * 10,
  });
  q.nextEarningsDay = nextBusinessDay(dayIndex(s.t) + 91);
  scheduleEarningsEvent(s, d, q.nextEarningsDay);
  // Résultats de l'employeur du joueur
  if (d.issuerOf && d.issuerOf === s.career.bankId && s.career.employed) {
    const bonusMood = surprise > 0.02 ? "L'enveloppe de bonus devrait progresser." : surprise < -0.02 ? "La direction annonce un plan d'économies : prudence sur les bonus." : "";
    notify(s, surprise < -0.02 ? "alerte" : "info", `Votre banque publie des résultats ${beat}`, bonusMood, "/play/actualites");
    s.career.ytdBonusPool = Math.max(0, s.career.ytdBonusPool + toCents(surprise * 20000));
  }
}

export function payDividend(s: GameState, id: string) {
  const d = s.instruments[id], q = s.quotes[id];
  if (!d || !q?.dividend || q.defaulted) return;
  const perShare = q.dividend / 4;
  if (perShare <= 0) return;
  q.price = Math.max(0.01, q.price - perShare);
  for (const acc of Object.values(s.accounts)) {
    const p = acc.positions[id];
    if (!p) continue;
    const amount = toCents(perShare * p.qty);
    if (amount < 0) ensureCash(s, acc.id, d.currency, -amount);
    post(s, cashAcc(acc.id), EXT_ISSUERS, amount, d.currency, `${amount >= 0 ? "Dividende" : "Dividende dû (position courte)"} ${id} : ${perShare.toFixed(3)} × ${p.qty}`, id);
    acc.incomeTotal += toCents(toEur(s, amount / 100, d.currency));
    if (acc.kind === "personnel") notify(s, amount >= 0 ? "succes" : "info", `Dividende ${d.name}`, `${(amount / 100).toFixed(2)} ${d.currency} ${amount >= 0 ? "crédités" : "débités"} sur votre compte.`, "/play/transactions");
  }
}

/** Coupons, remboursements à l'échéance et défauts (traitement journalier) */
export function dailyBonds(s: GameState, rng: Rng) {
  const day = dayIndex(s.t);
  for (const d of Object.values(s.instruments)) {
    if (d.cls !== "obligation") continue;
    const q = s.quotes[d.id];
    const b = d.bond!;
    if (q.defaulted) continue;
    // Défaut de l'émetteur
    const stress = b.issuerStock ? s.quotes[b.issuerStock]?.stress ?? 0 : 0;
    const issuerDefaulted = b.issuerStock ? s.quotes[b.issuerStock]?.defaulted : false;
    if (issuerDefaulted || (!b.gov && stress > 0.5 && rng.chance(Math.pow(stress, 4) * 0.03))) { defaultBond(s, d); continue; }
    const sched = couponSchedule(d, day - 1);
    if (sched[0] === day) {
      const rate = b.floating ? s.macro.zones[d.zone].policyRate / 100 + b.couponRate : b.couponRate;
      const isLast = day >= b.maturityDay;
      for (const acc of Object.values(s.accounts)) {
        const p = acc.positions[d.id];
        if (!p) continue;
        const cpn = toCents((p.qty * b.nominal * rate) / b.freq);
        post(s, cashAcc(acc.id), EXT_ISSUERS, cpn, d.currency, `Coupon ${d.id} (${(rate * 100).toFixed(2)} % / ${b.freq})`, d.id);
        acc.incomeTotal += toCents(toEur(s, cpn / 100, d.currency));
        if (isLast) {
          const red = toCents(p.qty * b.nominal);
          post(s, cashAcc(acc.id), EXT_ISSUERS, red, d.currency, `Remboursement à l'échéance ${d.id}`, d.id);
          const realized = toCents(toEur(s, (100 - p.avgPrice) * p.qty * (b.nominal / 100), d.currency));
          p.realized += realized; acc.realizedTotal += realized;
          delete acc.positions[d.id];
          notify(s, "succes", `Obligation ${d.name} remboursée`, `Nominal remboursé : ${(red / 100).toLocaleString("fr-FR")} ${d.currency}.`, "/play/portefeuille");
        } else if (acc.kind === "personnel") notify(s, "succes", `Coupon reçu : ${d.name}`, `${(cpn / 100).toFixed(2)} ${d.currency}`, "/play/transactions");
      }
      if (isLast) { q.halted = true; }
    }
  }
}

export function defaultBond(s: GameState, d: InstrumentDef, recovery = 0.35) {
  const q = s.quotes[d.id];
  q.defaulted = true; q.price = recovery * 100;
  for (const acc of Object.values(s.accounts)) {
    const p = acc.positions[d.id];
    if (!p) continue;
    const pay = toCents(p.qty * d.bond!.nominal * recovery);
    post(s, cashAcc(acc.id), EXT_ISSUERS, pay, d.currency, `Défaut de ${d.bond!.issuer} — taux de recouvrement ${(recovery * 100).toFixed(0)} %`, d.id);
    const realized = toCents(toEur(s, (recovery * 100 - p.avgPrice) * p.qty * (d.bond!.nominal / 100), d.currency));
    p.realized += realized; acc.realizedTotal += realized;
    delete acc.positions[d.id];
    if (acc.kind === "desk") changeRep(s, "risque", -6, `Perte sur défaut de ${d.bond!.issuer} dans le book du desk`);
  }
  pushNews(s, { category: "crises", title: `Défaut de paiement : ${d.bond!.issuer}`, body: `L'émetteur n'a pas honoré ses engagements sur l'obligation ${d.name}. Les porteurs récupèrent environ ${(recovery * 100).toFixed(0)} % du nominal.`, impact: "fort", tickers: [d.id, d.bond!.issuerStock ?? ""].filter(Boolean), zones: [d.zone], sentiment: -1 });
  notify(s, "critique", `DÉFAUT : ${d.bond!.issuer}`, d.name, "/play/actualites");
}
export { MIN_PER_DAY };
