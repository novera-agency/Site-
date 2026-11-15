/** CareerEngine — rémunération, évaluations, promotions, offres, licenciement, burnout, changement de banque. */
import type { GameState, Review, Track } from "./types";
import { Rng } from "./rng";
import { cashAcc, cashOf, post, bal } from "./ledger";
import { toCents, fromCents } from "./money";
import { accountEquity, valueAtRisk, performance } from "./portfolio";
import { avgRep, careerLog, changeRep, changeTrust, clamp, gainXp, logDecision, nextId, notify, skillLevel, pause } from "./core";
import { BANK_BY_ID, BANKS, BASE_SALARY, TRACKS } from "./data/banks";
import { lifeOn, payslip, monthlyLife, lifePerformanceAdj, priceLevel } from "./life";
import { addAgendaItem } from "./agenda";
import { newAccount, totalAum } from "./clients";
import { dayIndex, MIN_PER_DAY, tOfDay, nextBusinessDay, fmtDate } from "./time";
import { liquidate } from "./orders";
import { isAlly, isHostile } from "./relations";

const EXT_EMPLOYER = "ext:employeur", EXT_LIVING = "ext:depenses_vie", EXT_BANK = "ext:capital_banque", EXT_TAX = "ext:fisc";

export function rankTitle(s: GameState, rank = s.career.rank, track: Track = s.career.track) { return TRACKS[track].ranks[Math.min(rank, 8)]; }
export function salaryFor(bankId: string, rank: number) { const b = BANK_BY_ID[bankId]; return Math.round(BASE_SALARY[Math.min(rank, 8)] * (b?.salaryMult ?? 1) / 1000) * 1000; }

export function setupDesk(s: GameState) {
  const b = BANK_BY_ID[s.career.bankId];
  const cap = b.deskCapitalM * 1e6 * (1 + s.career.rank * 0.5);
  const id = "desk";
  if (s.accounts[id]) {
    // restitution de l'ancien capital à l'ancienne banque
    const acc = s.accounts[id];
    for (const cur of ["EUR", "USD", "GBP", "CHF", "JPY", "CAD", "AUD", "CNY"] as const) {
      const c = cashOf(s, id, cur); if (c !== 0) post(s, EXT_BANK, cashAcc(id), c, cur, "Restitution du capital du desk");
      const m = bal(s, `${id}:marge`, cur); if (m !== 0) post(s, EXT_BANK, `${id}:marge`, m, cur, "Restitution des dépôts de garantie");
    }
    acc.positions = {};
  }
  const acc = newAccount(id, "desk", `Book du desk — ${b.short}`, true, cap);
  s.accounts[id] = acc;
  post(s, cashAcc(id), EXT_BANK, toCents(cap), "EUR", `Allocation de capital par ${b.name}`);
  s.career.deskLimitVaR = toCents(cap * 0.012 / b.riskStrictness);
  s.career.deskMaxPosition = 0.25 / b.riskStrictness;
  s.career.weekStartEquity = cap; s.career.quarterStartEquity = cap; s.career.yearStartEquity = cap;
  acc.equityHistory = [{ t: s.t, v: cap }];
  setObjectives(s);
}

export function setObjectives(s: GameState) {
  const cap = (s.accounts.desk?.capitalAllocated ?? 0) / 100;
  const r = s.career.rank;
  const t = s.career.track;
  const obj: { label: string; key: string; target: number }[] = [];
  if (["trader", "structurer", "risk", "analyste"].includes(t)) obj.push({ label: `P&L trimestriel du desk ≥ ${Math.round(cap * 0.012 * (1 + r * 0.2)).toLocaleString("fr-FR")} €`, key: "pnl_q", target: cap * 0.012 * (1 + r * 0.2) });
  obj.push({ label: "Aucun dépassement de la limite de VaR", key: "var", target: 0 });
  if (s.clients.length) obj.push({ label: "Satisfaction moyenne des clients ≥ 60", key: "sat", target: 60 });
  obj.push({ label: `Réussir au moins ${2 + r} missions par trimestre`, key: "missions", target: 2 + r });
  if (t === "sales" || t === "gerant" || t === "entrepreneur") obj.push({ label: "Encours clients en croissance", key: "aum", target: 0 });
  s.career.objectives = obj;
}

/** Paiement mensuel du salaire, des dépenses de vie et des intérêts */
export function monthlyPayroll(s: GameState) {
  const c = s.career;
  if (c.employed && s.mode === "carriere") {
    const gross = c.salaryAnnual / 12;
    const net = Math.round(gross * 0.77);
    post(s, cashAcc("perso"), EXT_EMPLOYER, net, "EUR", `Salaire net — ${BANK_BY_ID[c.bankId].short} (brut ${fromCents(Math.round(gross)).toLocaleString("fr-FR")} €)`);
    if (lifeOn(s)) {
      const tax = toCents(payslip(s).tax);
      if (tax > 0) post(s, EXT_TAX, cashAcc("perso"), tax, "EUR", "Impôt sur le revenu (prélèvement à la source)");
      notify(s, "succes", "Salaire versé", `${fromCents(net - tax).toLocaleString("fr-FR")} € nets après impôt. Les factures du mois vont être prélevées.`, "/play/vie");
    } else notify(s, "succes", "Salaire versé", `${fromCents(net).toLocaleString("fr-FR")} € nets crédités sur votre compte.`, "/play/remuneration");
  }
  if (lifeOn(s)) monthlyLife(s);
  else if (s.settings.livingExpenses) {
    const lifestyle = (s.flags["lifestyle"] as number) ?? 1;
    const base = 1800 + lifestyle * 900 + (c.employed ? c.salaryAnnual / 100 / 12 * 0.15 : 0);
    post(s, EXT_LIVING, cashAcc("perso"), toCents(base), "EUR", `Dépenses de vie mensuelles (logement, transport, alimentation) — train de vie ${lifestyle}`);
  }
  // Agios si découvert, intérêts si créditeur
  const eur = cashOf(s, "perso", "EUR");
  if (eur < 0) { const fee = Math.round(-eur * 0.08 / 12); post(s, EXT_EMPLOYER.replace("employeur", "banque_detail"), cashAcc("perso"), fee, "EUR", "Agios sur découvert (8 % l'an)"); notify(s, "alerte", "Compte personnel à découvert", "Des agios de 8 % l'an s'appliquent.", "/play/patrimoine"); }
  else if (eur > 0) { const rate = Math.max(0, s.macro.zones.EZ.policyRate - 1) / 100; const it = Math.round(eur * rate / 12); if (it > 0) post(s, cashAcc("perso"), "ext:banque_detail", it, "EUR", `Intérêts créditeurs (${(rate * 100).toFixed(2)} %)`); }
}

/** Score de performance composite (0..100) — pondéré selon le métier */
export function performanceScore(s: GameState, since: "week" | "quarter" | "year") {
  const c = s.career;
  const desk = s.accounts.desk;
  const cap = (desk?.capitalAllocated ?? 1) / 100;
  const eqNow = desk ? accountEquity(s, "desk") : cap;
  const start = since === "week" ? c.weekStartEquity : since === "quarter" ? c.quarterStartEquity : c.yearStartEquity;
  const pnl = eqNow - start;
  const horizonFactor = since === "week" ? 0.0015 : since === "quarter" ? 0.015 : 0.05;
  const pnlScore = clamp(50 + (pnl / (cap * horizonFactor)) * 25, 0, 100);
  const varv = desk ? valueAtRisk(s, "desk").var : 0;
  const limit = c.deskLimitVaR / 100;
  const riskScore = clamp(100 - Math.max(0, varv / Math.max(1, limit) - 0.7) * 120 - c.breaches * 10, 0, 100);
  const clients = s.clients.filter((x) => !x.lost);
  const clientScore = clients.length ? clients.reduce((a, x) => a + x.satisfaction, 0) / clients.length : 60;
  const recent = s.missions.filter((m) => m.status !== "active" && m.startT > s.t - (since === "week" ? 7 : since === "quarter" ? 91 : 365) * MIN_PER_DAY);
  const missionScore = recent.length ? (recent.filter((m) => m.status === "reussie").length / recent.length) * 100 : 50;
  const repScore = avgRep(s);
  const compliance = s.reputation.conformite;
  const w: Record<string, number> = ["sales", "gerant", "entrepreneur"].includes(c.track) ? { pnl: 0.15, risk: 0.15, client: 0.3, mission: 0.2, rep: 0.1, comp: 0.1 }
    : c.track === "risk" ? { pnl: 0.05, risk: 0.35, client: 0.05, mission: 0.3, rep: 0.15, comp: 0.1 }
    : c.track === "analyste" || c.track === "ib" ? { pnl: 0.1, risk: 0.1, client: 0.1, mission: 0.4, rep: 0.2, comp: 0.1 }
    : { pnl: 0.35, risk: 0.25, client: 0.05, mission: 0.15, rep: 0.1, comp: 0.1 };
  const bossAdj = isAlly(s, "boss") ? 5 : isHostile(s, "boss") ? -5 : 0; // le jugement du manager pèse dans toute évaluation
  const total = clamp(pnlScore * w.pnl + riskScore * w.risk + clientScore * w.client + missionScore * w.mission + repScore * w.rep + compliance * w.comp + bossAdj + lifePerformanceAdj(s), 0, 100);
  return { total: Math.round(total), bossAdj, details: { pnl: Math.round(pnlScore), risque: Math.round(riskScore), clients: Math.round(clientScore), missions: Math.round(missionScore), reputation: Math.round(repScore), conformite: Math.round(compliance) }, pnl, varv, limit };
}

/** Bilan hebdomadaire (vendredi 18 h) */
export function weeklyReview(s: GameState) {
  if (!s.career.employed || s.mode !== "carriere") return;
  const sc = performanceScore(s, "week");
  const comment = sc.total >= 70 ? "Excellente semaine. Continuez comme ça." : sc.total >= 50 ? "Semaine correcte, sans éclat." : sc.total >= 35 ? "Semaine décevante. J'attends mieux." : "Semaine très insuffisante. Nous devons parler.";
  const r: Review = { t: s.t, kind: "hebdo", score: sc.total, details: sc.details, outcome: comment, comment: `P&L desk de la semaine : ${Math.round(sc.pnl).toLocaleString("fr-FR")} €. VaR : ${Math.round(sc.varv).toLocaleString("fr-FR")} € / limite ${Math.round(sc.limit).toLocaleString("fr-FR")} €.` };
  s.career.reviews.unshift(r);
  changeTrust(s, "boss", sc.total >= 65 ? 3 : sc.total < 40 ? -4 : 0);
  notify(s, sc.total >= 50 ? "info" : "alerte", `Évaluation hebdomadaire : ${sc.total}/100`, `${s.npcs.boss.name} : « ${comment} »`, "/play/carriere");
  s.career.weekStartEquity = s.accounts.desk ? accountEquity(s, "desk") : 0;
  if (sc.total < 30) s.career.warnings = Math.min(5, s.career.warnings + 0.5);
}

/** Revue trimestrielle : promotion possible, accumulation de bonus */
export function quarterlyReview(s: GameState) {
  const c = s.career;
  if (!c.employed || s.mode !== "carriere") return;
  const sc = performanceScore(s, "quarter");
  const b = BANK_BY_ID[c.bankId];
  const daysInRank = (s.t - ((s.flags["rankSinceT"] as number) ?? c.hiredT)) / MIN_PER_DAY;
  const track = TRACKS[c.track];
  const skillReq = c.rank * 2;
  const skillSum = track.skills.reduce((a, k) => a + skillLevel(s.skills[k as keyof typeof s.skills]), 0);
  const repOk = avgRep(s) >= 40 + c.rank * 5;
  const riskOk = sc.details.risque >= 60 && sc.details.conformite >= 50;
  const minDays = 80 / b.promoSpeed * (1 + c.rank * 0.25) * (isAlly(s, "boss") ? 0.8 : 1);
  let outcome = "";
  let promoted = false;
  const reasons: string[] = [];
  if (sc.total < 60) reasons.push("score global insuffisant (≥ 60 requis)");
  if (!riskOk) reasons.push("gestion du risque ou conformité insuffisantes");
  if (skillSum < skillReq) reasons.push(`compétences clés insuffisantes (${skillSum}/${skillReq} niveaux sur ${track.skills.join(", ")})`);
  if (!repOk) reasons.push(`réputation insuffisante (moyenne ${Math.round(avgRep(s))}, ${40 + c.rank * 5} requis)`);
  if (daysInRank < minDays) reasons.push(`ancienneté au poste insuffisante (${Math.round(daysInRank)}/${Math.round(minDays)} jours)`);
  if (c.rank >= 8) reasons.push("vous occupez déjà le poste le plus élevé");
  if (c.rank >= 3 && (s.npcs.director?.trust ?? 50) < 45) reasons.push(`pas de soutien du Managing Director (${s.npcs.director?.name}) pour passer au-delà du rang Associate`);
  if (reasons.length === 0) {
    promoted = true;
    promote(s);
    outcome = `Promotion : vous devenez ${rankTitle(s)} !`;
  } else outcome = `Pas de promotion ce trimestre : ${reasons.join(" ; ")}.`;
  const bonusAccrual = toCents(Math.max(0, sc.total - 45) / 55 * c.salaryAnnual / 100 * 0.15 * b.bonusMult);
  c.ytdBonusPool += bonusAccrual;
  c.reviews.unshift({ t: s.t, kind: "trimestrielle", score: sc.total, details: sc.details, outcome, promoted, comment: `Provision de bonus : ${fromCents(bonusAccrual).toLocaleString("fr-FR")} €` });
  notify(s, promoted ? "succes" : "info", `Revue trimestrielle : ${sc.total}/100`, outcome, "/play/carriere");
  pause(s, `Revue trimestrielle : ${outcome}`);
  c.quarterStartEquity = s.accounts.desk ? accountEquity(s, "desk") : 0;
  if (sc.total < 30 || c.warnings >= 3) fire(s, sc.total < 30 ? "performances très insuffisantes" : "avertissements répétés");
}

export function promote(s: GameState) {
  const c = s.career;
  c.rank = Math.min(8, c.rank + 1);
  c.salaryAnnual = toCents(salaryFor(c.bankId, c.rank) * priceLevel(s));
  s.flags["rankSinceT"] = s.t;
  careerLog(s, `Promotion au poste de ${rankTitle(s)} — salaire ${fromCents(c.salaryAnnual).toLocaleString("fr-FR")} €`);
  changeRep(s, "interne", 5); changeRep(s, "professionnelle", 4);
  gainXp(s, "management", 60, "Promotion");
  logDecision(s, "carriere", `Promotion : ${rankTitle(s)}`);
  // capital du desk augmenté
  if (s.accounts.desk) {
    const add = BANK_BY_ID[c.bankId].deskCapitalM * 1e6 * 0.5;
    post(s, cashAcc("desk"), EXT_BANK, toCents(add), "EUR", "Capital supplémentaire alloué suite à la promotion");
    s.accounts.desk.capitalAllocated = (s.accounts.desk.capitalAllocated ?? 0) + toCents(add);
    c.deskLimitVaR = toCents(((s.accounts.desk.capitalAllocated ?? 0) / 100) * 0.012 / BANK_BY_ID[c.bankId].riskStrictness);
    c.weekStartEquity += add; c.quarterStartEquity += add; c.yearStartEquity += add;
  }
  setObjectives(s);
}

/** Revue annuelle et versement du bonus (mi-décembre) */
export function annualReview(s: GameState) {
  const c = s.career;
  if (!c.employed || s.mode !== "carriere") return;
  const sc = performanceScore(s, "year");
  const b = BANK_BY_ID[c.bankId];
  const desk = s.accounts.desk;
  const pnl = desk ? accountEquity(s, "desk") - c.yearStartEquity : 0;
  const pnlShare = Math.max(0, pnl) * (c.track === "trader" ? 0.04 : 0.015) * b.bonusMult * (sc.details.risque >= 60 ? 1 : 0.3);
  const mdMult = isAlly(s, "director") ? 1.15 : isHostile(s, "director") ? 0.85 : 1;
  const bonus = Math.round((c.ytdBonusPool + toCents(pnlShare) * (sc.total >= 40 ? 1 : 0)) * mdMult);
  if (bonus > 0) { post(s, cashAcc("perso"), EXT_EMPLOYER, Math.round(bonus * 0.6), "EUR", `Bonus annuel net (brut ${fromCents(bonus).toLocaleString("fr-FR")} €)`); post(s, EXT_TAX, EXT_EMPLOYER, Math.round(bonus * 0.4), "EUR", "Prélèvements sur bonus"); }
  c.reviews.unshift({ t: s.t, kind: "annuelle", score: sc.total, details: sc.details, outcome: bonus > 0 ? `Bonus attribué : ${fromCents(bonus).toLocaleString("fr-FR")} € brut` : "Aucun bonus cette année.", bonus, comment: `P&L annuel du desk : ${Math.round(pnl).toLocaleString("fr-FR")} €` });
  c.ytdBonusPool = 0;
  c.yearStartEquity = desk ? accountEquity(s, "desk") : 0;
  careerLog(s, `Revue annuelle : ${sc.total}/100, bonus ${fromCents(bonus).toLocaleString("fr-FR")} €`);
  notify(s, "succes", "Revue annuelle et bonus", `Score ${sc.total}/100 — bonus ${fromCents(bonus).toLocaleString("fr-FR")} € brut.`, "/play/remuneration");
  addAgendaItem(s, { t: s.t + 60, durationMin: 45, title: "Entretien annuel avec votre responsable", kind: "reunion", meetingTemplate: "entretien_annuel", important: true });
}

export function fire(s: GameState, reason: string) {
  const c = s.career;
  if (!c.employed) return;
  if (s.accounts.desk) liquidate(s, s.accounts.desk);
  c.employed = false;
  careerLog(s, `Licenciement : ${reason}`);
  changeRep(s, "professionnelle", -12); changeRep(s, "interne", -20);
  notify(s, "critique", "Vous êtes licencié", `Motif : ${reason}. Vous conservez votre patrimoine personnel. Consultez les offres d'emploi.`, "/play/rh");
  logDecision(s, "carriere", `Licenciement (${reason})`);
  s.paused = true; s.pauseReason = "Licenciement";
  generateOffer(s, new Rng(s.rng), true);
}

/** Offres de recrutement des concurrents */
export function generateOffer(s: GameState, rng: Rng, afterFiring = false) {
  const rep = avgRep(s);
  const candidates = BANKS.filter((b) => b.id !== s.career.bankId && (afterFiring ? b.difficulty <= 3 : b.difficulty * 13 <= rep + 15));
  if (!candidates.length) return;
  const b = rng.pick(candidates);
  const track = b.tracks.includes(s.career.track) ? s.career.track : b.tracks[0];
  const rank = Math.max(1, afterFiring ? s.career.rank - 1 : s.career.rank + (rng.chance(0.4) ? 1 : 0));
  const salary = toCents(salaryFor(b.id, rank) * priceLevel(s) * rng.range(0.98, 1.12));
  s.career.pendingOffers.push({ id: nextId(s, "off"), bankId: b.id, rank, salary, expiresT: s.t + 10 * MIN_PER_DAY, track });
  s.messages.unshift({ id: nextId(s, "msg"), t: s.t, from: s.npcs.recruiter.name + " (chasseur de têtes)", subject: `Opportunité chez ${b.name}`, body: `Bonjour,\n\n${b.name} (${b.city}) recherche un profil comme le vôtre pour un poste de ${TRACKS[track].ranks[rank]} (${TRACKS[track].name}). Rémunération fixe proposée : ${fromCents(salary).toLocaleString("fr-FR")} € par an, bonus selon la politique maison (multiplicateur ${b.bonusMult}).\n\nCulture : ${b.culture}\n\nL'offre est valable 10 jours. Un entretien sera nécessaire.\n\nBien à vous.`, read: false, actions: [{ label: "Passer l'entretien", action: "interview", payload: { offer: s.career.pendingOffers[s.career.pendingOffers.length - 1].id } }, { label: "Décliner", action: "decline_offer", payload: { offer: s.career.pendingOffers[s.career.pendingOffers.length - 1].id } }] });
  notify(s, "info", `Offre de recrutement : ${b.name}`, `${TRACKS[track].ranks[rank]} — ${fromCents(salary).toLocaleString("fr-FR")} €`, "/play/messagerie");
}

export function joinBank(s: GameState, bankId: string, track: Track, rank: number, salary: number) {
  const prev = s.career.bankId;
  const wasEmployed = s.career.employed;
  s.career.bankId = bankId; s.career.track = track; s.career.rank = rank; s.career.salaryAnnual = salary;
  s.career.employed = true; s.career.hiredT = s.t; s.career.warnings = 0; s.career.breaches = 0; s.career.ytdBonusPool = 0;
  s.flags["rankSinceT"] = s.t;
  for (const id of ["boss", "director", "senior", "analyst", "colleague", "compliance", "risk"]) if (s.npcs[id]) { s.npcs[id].bankId = bankId; s.npcs[id].trust = 50; s.npcs[id].memory = [{ t: s.t, text: `Arrivée de ${s.profile.firstName} dans l'équipe`, impact: 0 }]; }
  setupDesk(s);
  careerLog(s, `${wasEmployed ? `Départ de ${BANK_BY_ID[prev].short} et a` : "A"}rrivée chez ${BANK_BY_ID[bankId].name} comme ${rankTitle(s)}`);
  logDecision(s, "carriere", `Rejoint ${BANK_BY_ID[bankId].name}`);
  if (wasEmployed && prev !== bankId) changeRep(s, "interne", -10);
  notify(s, "succes", `Bienvenue chez ${BANK_BY_ID[bankId].name}`, `${rankTitle(s)} — ${fromCents(salary).toLocaleString("fr-FR")} € par an.`, "/play/carriere");
}

/** Stress et énergie (fatigue professionnelle simulée) */
export function dailyWellbeing(s: GameState, weekend: boolean) {
  const c = s.career;
  if (!c.employed) { c.stress = Math.max(0, c.stress - 3); return; }
  const crises = s.crises.filter((x) => !x.resolved).length;
  const meetings = s.agenda.filter((a) => a.status === "fait" && a.t > s.t - MIN_PER_DAY && a.meetingTemplate).length;
  const lifestyle = (s.flags["lifestyle"] as number) ?? 1;
  if (weekend) c.stress = Math.max(0, c.stress - 6 - lifestyle);
  else c.stress = clamp(c.stress + 1.2 + meetings * 1.3 + crises * 3 + c.warnings * 0.5 - lifestyle * 0.5 + (BANK_BY_ID[c.bankId].bonusMult > 1.5 ? 1 : 0), 0, 100);
  c.energy = clamp(100 - c.stress * 0.8, 5, 100);
  if (c.stress >= 92 && !s.flags["burnoutUntil"]) {
    s.flags["burnoutUntil"] = s.t + 10 * MIN_PER_DAY;
    notify(s, "critique", "Burnout", "Votre médecin vous arrête 10 jours. Vos réunions sont annulées et vos résultats en pâtissent.", "/play/carriere");
    changeRep(s, "fiabilite", -6); changeTrust(s, "boss", -5, "Arrêt maladie pour épuisement");
    careerLog(s, "Arrêt pour épuisement professionnel");
    for (const a of s.agenda) if (a.status === "prevu" && a.t < s.t + 10 * MIN_PER_DAY) a.status = "annule";
  }
  if (s.flags["burnoutUntil"] && s.t >= (s.flags["burnoutUntil"] as number)) { delete s.flags["burnoutUntil"]; c.stress = 35; notify(s, "info", "Retour au bureau", "Vous reprenez le travail, reposé."); }
}

/** Congés : le temps avance, le stress diminue, aucune pénalité d'absence */
export function takeVacation(s: GameState, days: number) {
  if (!s.career.employed) return { ok: false as const, error: "Vous n'êtes pas en poste." };
  if (s.activeMeetingId) return { ok: false as const, error: "Terminez d'abord votre réunion." };
  const used = (s.flags["vacationDaysYear"] as number) ?? 0;
  const quota = 25 + (s.life?.perks.extraLeave ?? 0);
  if (used + days > quota) return { ok: false as const, error: `Il vous reste ${quota - used} jours de congés cette année.` };
  s.flags["vacationDaysYear"] = used + days;
  const until = tOfDay(nextBusinessDay(dayIndex(s.t) + days), 7, 0);
  for (const a of s.agenda) if (a.status === "prevu" && a.t < until) a.status = "annule";
  s.flags["vacationUntil"] = until;
  s.career.stress = Math.max(0, s.career.stress - days * 8);
  careerLog(s, `Congés de ${days} jours jusqu'au ${fmtDate(until)}`);
  return { ok: true as const, until };
}

/** Contrôle quotidien des limites de risque du desk */
export function checkRiskLimits(s: GameState) {
  const c = s.career;
  if (!c.employed || !s.accounts.desk) return;
  const v = valueAtRisk(s, "desk").var;
  const limit = c.deskLimitVaR / 100 * (isHostile(s, "risk") ? 0.9 : 1);
  if (v > limit && isAlly(s, "risk") && v <= limit * 1.1 && !s.flags["riskGraceT"]) {
    s.flags["riskGraceT"] = s.t;
    notify(s, "alerte", `${s.npcs.risk.name} ferme les yeux… une fois`, "Votre VaR dépasse légèrement la limite. Réduisez le risque : la tolérance ne durera pas.", "/play/risques");
    return;
  }
  if (v <= limit) delete s.flags["riskGraceT"];
  if (v > limit) {
    const last = c.lastBreachT ?? 0;
    if (s.t - last > 2 * MIN_PER_DAY) {
      c.breaches++; c.lastBreachT = s.t;
      changeRep(s, "risque", -5, "Dépassement de la limite de VaR du desk");
      changeTrust(s, "risk", -6, "Dépassement de limite VaR");
      notify(s, "critique", "Dépassement de limite de VaR", `VaR 99 % 1 jour : ${Math.round(v).toLocaleString("fr-FR")} € pour une limite de ${Math.round(limit).toLocaleString("fr-FR")} €. Réduisez le risque immédiatement.`, "/play/risques");
      s.messages.unshift({ id: nextId(s, "msg"), t: s.t, from: `${s.npcs.risk.name} (Risques)`, subject: "Dépassement de limite — action requise", body: `Le book du desk dépasse sa limite de VaR (${Math.round(v).toLocaleString("fr-FR")} € vs ${Math.round(limit).toLocaleString("fr-FR")} €). Merci de revenir dans la limite avant la clôture de demain, faute de quoi l'incident sera remonté au comité des risques.`, read: false });
      if (c.breaches >= 3) { c.warnings++; notify(s, "critique", "Avertissement formel", "Troisième dépassement de limite : avertissement inscrit à votre dossier."); }
    }
  } else if (v < limit * 0.8 && s.accounts.desk && Object.keys(s.accounts.desk.positions).length > 0) {
    gainXp(s, "risque", 3, "Respect des limites de risque");
  }
}

export function careerSummary(s: GameState) {
  const sc = s.career.employed ? performanceScore(s, "quarter") : null;
  return { score: sc, aum: totalAum(s), deskPerf: s.accounts.desk ? performance(s.accounts.desk) : null };
}
export { logDecision };
