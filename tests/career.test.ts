import { describe, it, expect } from "vitest";
import { game, cash, atEuOpen } from "./helpers";
import { quarterlyReview, joinBank, salaryFor, fire, monthlyPayroll } from "@/engine/career";
import { startMeeting, answerMeeting, meetingChoices } from "@/engine/meetingEngine";
import { monthlyClients, rebalanceClient } from "@/engine/clients";
import { createMission, checkMissions, answerMission } from "@/engine/missions";
import { foundCompany, companyAction, hireCandidates, monthlyCompany } from "@/engine/company";
import { handleMessageAction } from "@/engine/events";
import { generateOffer } from "@/engine/career";
import { isBalanced } from "@/engine/ledger";
import { accountEquity } from "@/engine/portfolio";
import { completeLesson } from "@/engine/engine";
import { Rng } from "@/engine/rng";
import { MIN_PER_DAY } from "@/engine/time";
import { toCents } from "@/engine/money";
import { LESSONS } from "@/engine/data/learning";

/** Joue une réunion jusqu'au bout en choisissant toujours la première option (ou une valeur chiffrée) */
function playMeeting(s: ReturnType<typeof game>, tpl: string, params: Record<string, string> = {}, value = 0) {
  const m = startMeeting(s, tpl, params)!;
  for (let i = 0; i < 20 && !m.done; i++) {
    const ch = meetingChoices(s, m);
    const r = ch.length ? answerMeeting(s, m.id, { choiceId: ch[0].id }) : answerMeeting(s, m.id, { value });
    expect(r.ok).toBe(true);
  }
  return m;
}

describe("Carrière et interactions", () => {
  it("Promotion : refusée sans compétences ni ancienneté, accordée quand tous les critères sont réunis", () => {
    const s = game("carriere", "promo");
    const rank0 = s.career.rank;
    quarterlyReview(s);
    expect(s.career.rank).toBe(rank0);
    expect(s.career.reviews[0].outcome).toMatch(/Pas de promotion/);
    // conditions réunies : ancienneté, compétences, réputation, missions, P&L
    s.flags["rankSinceT"] = s.t - 400 * MIN_PER_DAY;
    for (const k of Object.keys(s.skills) as (keyof typeof s.skills)[]) s.skills[k] = 2000;
    for (const k of Object.keys(s.reputation) as (keyof typeof s.reputation)[]) s.reputation[k] = 85;
    for (const c of s.clients) c.satisfaction = 90;
    s.career.quarterStartEquity = accountEquity(s, "desk") - 200000;
    for (let i = 0; i < 4; i++) s.missions.push({ id: `m${i}`, templateId: "watchlist", title: "t", category: "trading", description: "", criteria: [], params: {}, startT: s.t - 10, deadlineT: s.t + 10, status: "reussie", reward: { xp: 0, rep: {} }, progress: 1 });
    quarterlyReview(s);
    expect(s.career.rank).toBe(rank0 + 1);
    expect(s.career.salaryAnnual).toBe(toCents(salaryFor("lutece", rank0 + 1)));
  });
  it("Un fort P&L avec un risque excessif ne suffit pas à être promu", () => {
    const s = game("carriere", "risky");
    s.flags["rankSinceT"] = s.t - 400 * MIN_PER_DAY;
    for (const k of Object.keys(s.skills) as (keyof typeof s.skills)[]) s.skills[k] = 2000;
    s.career.quarterStartEquity = accountEquity(s, "desk") - 500000;
    s.career.breaches = 6; s.reputation.conformite = 20;
    const r0 = s.career.rank;
    quarterlyReview(s);
    expect(s.career.rank).toBe(r0);
  });
  it("Réunion : déroulement complet, conséquences sur la confiance et journal des décisions", () => {
    const s = game("carriere", "meet");
    const trust0 = s.npcs.boss.trust;
    const m = playMeeting(s, "accueil");
    expect(m.done).toBe(true);
    expect(m.outcome).toBeTruthy();
    expect(s.npcs.boss.trust).not.toBe(trust0);
    expect(s.decisions.some((d) => d.kind === "reunion")).toBe(true);
    const q = playMeeting(s, "question_technique", {}, 40000);
    expect(q.score.finance).toBeGreaterThan(0);
  });
  it("Réunion obligataire : la réponse chiffrée est vérifiée avec la duration réelle du book", () => {
    const s = atEuOpen(game("carriere", "bonds"));
    const m = startMeeting(s, "pertes_obligataires")!;
    const dur = Number(m.vars.dur);
    expect(dur).toBeGreaterThan(3);
    answerMeeting(s, m.id, { value: dur });
    expect(m.score.finance).toBe(3);
  });
  it("Satisfaction client : refus d'un délit d'initié valorisé, mauvaise allocation sanctionnée", () => {
    const s = atEuOpen(game("carriere", "client"));
    const c = s.clients[0];
    const comp0 = s.reputation.conformite;
    playMeeting(s, "client_conformite", { client: c.id });
    expect(s.reputation.conformite).toBeGreaterThan(comp0);
    const r = rebalanceClient(s, c.id, { XTEC: 0.9, CASH: 0.1 });
    expect(r.ok && r.warnings.length).toBeGreaterThan(0);
    const sat0 = c.satisfaction;
    monthlyClients(s, new Rng(s.rng));
    expect(c.satisfaction).not.toBe(sat0);
    expect(isBalanced(s)).toBe(true);
  });
  it("Échec de mission à l'échéance et quiz corrigé", () => {
    const s = game("carriere", "mission");
    const m = createMission(s, "diversifier", { account: "perso" })!;
    s.t = m.deadlineT + 60;
    checkMissions(s);
    expect(m.status).toBe("echouee");
    const q = createMission(s, "duration_obligation", { instrument: "DE10Y" })!;
    const res = answerMission(s, q.id, { value: 99 });
    expect(res.ok).toBe(true);
    expect(q.status).toBe("echouee");
  });
  it("Changement de banque : offre, entretien, nouvelle banque, nouveau book", () => {
    const s = game("carriere", "move");
    for (const k of Object.keys(s.reputation) as (keyof typeof s.reputation)[]) s.reputation[k] = 80;
    generateOffer(s, new Rng(s.rng));
    const off = s.career.pendingOffers[0];
    expect(off).toBeTruthy();
    s.flags[`offerReady_${off.id}`] = true;
    const msg = s.messages.find((x) => x.actions?.some((a) => a.action === "interview"))!;
    msg.actions = [{ label: "ok", action: "accept_offer", payload: { offer: off.id } }];
    const r = handleMessageAction(s, msg.id, "accept_offer", { offer: off.id });
    expect(r.ok).toBe(true);
    expect(s.career.bankId).toBe(off.bankId);
    expect(s.accounts.desk.label).toContain("Book du desk");
    expect(isBalanced(s)).toBe(true);
    joinBank(s, "lutece", "trader", 1, toCents(55000));
    expect(s.career.bankId).toBe("lutece");
  });
  it("Licenciement puis salaires : plus de salaire versé hors emploi", () => {
    const s = game("carriere", "fire");
    monthlyPayroll(s);
    const c1 = cash(s);
    expect(c1).toBeGreaterThan(10000 - 5000);
    fire(s, "test");
    expect(s.career.employed).toBe(false);
    s.settings.livingExpenses = false;
    const c2 = cash(s);
    monthlyPayroll(s);
    expect(cash(s) - c2).toBeLessThan(500); // seuls des intérêts créditeurs, plus de salaire (≈ 3 600 € nets)
  });
  it("Création d'entreprise : capital transféré, recrutement, clôture mensuelle, états financiers équilibrés", () => {
    const s = game("bac_a_sable", "corp", 300000);
    const r = foundCompany(s, "Atlas Conseil", "conseil", 50000, "Conseil");
    expect(r.ok).toBe(true);
    expect(cash(s)).toBe(250000);
    expect(cash(s, "societe")).toBe(50000);
    const cand = hireCandidates(s)[0];
    expect(companyAction(s, "hire", { id: cand.id }).ok).toBe(true);
    monthlyCompany(s, new Rng(s.rng));
    expect(s.company!.monthly.length).toBe(1);
    expect(isBalanced(s)).toBe(true);
    expect(foundCompany(s, "Bis", "conseil", 20000, "x").ok).toBe(false);
  });
  it("Formation : l'XP n'est attribuée qu'une seule fois par module", () => {
    const s = game();
    const l = LESSONS.find((x) => x.exercise.kind === "qcm")!;
    const xp0 = s.skills[l.branch];
    const ans = l.exercise.kind === "qcm" ? l.exercise.answer : 0;
    expect(completeLesson(s, l.id, ans).ok).toBe(true);
    const xp1 = s.skills[l.branch];
    expect(xp1).toBeGreaterThan(xp0);
    completeLesson(s, l.id, ans);
    expect(s.skills[l.branch]).toBe(xp1);
  });
});
