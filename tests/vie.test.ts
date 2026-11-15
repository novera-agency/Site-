import { describe, it, expect } from "vitest";
import { game, cash } from "./helpers";
import { applyAction } from "@/server/actions";
import { payslip, monthlyBills, incomeTax, freeHours, priceLevel } from "@/engine/life";
import { monthlyPayroll } from "@/engine/career";
import { isBalanced } from "@/engine/ledger";
import { tOfDay, dayIndex, nextBusinessDay, MIN_PER_DAY, minuteOfDay, isWeekend } from "@/engine/time";
import { answerMeeting } from "@/engine/meetingEngine";
import { createGame } from "@/engine/engine";
import { getPlan, setPlan, workWindow, sleepCheck, plannedNetHours, DEFAULT_PLAN, hhmm } from "@/engine/schedule";
import { planDay } from "@/engine/agenda";
import { Rng } from "@/engine/rng";
import { profile } from "./helpers";
import { dailyLife } from "@/engine/life";
const dailyLifeForTest = (s: ReturnType<typeof game>) => dailyLife(s, new Rng(s.rng));

const act = (s: ReturnType<typeof game>, a: object) => applyAction(s, a as never);

describe("Vie privée", () => {
  it("fiche de paie : cotisations, impôt progressif, net versé ; factures prélevées en début de mois", () => {
    const s = game("carriere", "vie-paie");
    expect(s.life).toBeTruthy();
    const p = payslip(s);
    expect(p.social).toBeGreaterThan(0);
    expect(p.netAfterTax).toBeLessThan(p.net);
    expect(incomeTax(s, 20000)).toBeLessThan(incomeTax(s, 60000) / 3); // progressivité
    const before = cash(s);
    monthlyPayroll(s);
    const bills = monthlyBills(s).reduce((a, [, v]) => a + v, 0);
    const delta = cash(s) - before;
    expect(Math.abs(delta - (p.netAfterTax - bills))).toBeLessThan(300); // + intérêts créditeurs éventuels
    expect(isBalanced(s)).toBe(true);
  });

  it("loisirs : coût, temps libre limité, effets sur les jauges et lassitude", () => {
    const s = game("carriere", "vie-loisirs");
    s.t = tOfDay(nextBusinessDay(dayIndex(s.t) + 1), 19, 0); // un soir de semaine
    const l = s.life!;
    l.social = 40; const m0 = l.mental;
    const c0 = cash(s);
    expect(act(s, { type: "life_activity", id: "amis" }).ok).toBe(true);
    expect(l.social).toBeGreaterThan(40);
    expect(cash(s)).toBeLessThan(c0);
    expect(freeHours(s).left).toBe(freeHours(s).total - 3);
    const r = act(s, { type: "life_activity", id: "weekend" });
    expect(r.ok).toBe(false); // réservé au week-end
    act(s, { type: "life_activity", id: "cine" });
    expect(act(s, { type: "life_activity", id: "famille" }).ok).toBe(false); // plus assez de temps
    expect(l.mental).toBeGreaterThanOrEqual(m0);
  });

  it("activités : seulement après le travail (18 h), et l'horloge avance de leur durée", () => {
    const s = game("carriere", "vie-horloge");
    s.t = tOfDay(nextBusinessDay(dayIndex(s.t) + 1), 10, 0); // jour ouvré, en pleine journée de travail
    s.agenda = []; s.paused = true; // pas de rendez-vous en attente qui interrompraient l'avance
    const r0 = act(s, { type: "life_activity", id: "course" });
    expect(r0.ok).toBe(false);
    expect(r0.error).toMatch(/au travail/);
    const t0 = s.t;
    // « Jusqu'à la fin du travail » mène à 18 h pile
    expect(act(s, { type: "skip", to: "work_end" }).ok).toBe(true);
    expect(minuteOfDay(s.t)).toBe(18 * 60);
    expect(s.t).toBeGreaterThan(t0);
    s.paused = true; s.pauseReason = "Pause";
    const before = s.t;
    const r1 = act(s, { type: "life_activity", id: "course" }); // 1 h
    expect(r1.ok).toBe(true);
    expect(s.t - before).toBe(60);
    expect(s.paused).toBe(true); // l'état de pause d'avant est conservé
    const r2 = act(s, { type: "life_activity", id: "amis" }); // 3 h : 19 h → 22 h
    expect(r2.ok).toBe(true);
    expect(minuteOfDay(s.t)).toBe(22 * 60);
    // Trop tard : une sortie en club de 5 h finirait après minuit
    const r3 = act(s, { type: "life_activity", id: "club" });
    expect(r3.ok).toBe(false);
    expect(r3.error).toMatch(/minuit/);
    // En semaine après 18 h, on ne peut plus « aller à la fin du travail »
    expect(act(s, { type: "skip", to: "work_end" }).ok).toBe(false);
  });
  it("activités : le week-end elles sont possibles dès le matin", () => {
    const s = game("carriere", "vie-weekend");
    let d = dayIndex(s.t); while (!isWeekend(d * MIN_PER_DAY)) d++;
    s.t = tOfDay(d, 9, 0);
    s.agenda = []; s.paused = true;
    const t0 = s.t;
    const r = act(s, { type: "life_activity", id: "famille" }); // 6 h
    expect(r.ok).toBe(true);
    expect(s.t - t0).toBe(6 * 60);
  });

  it("logement : achat refusé sans apport, accepté avec ; la valeur nette entre dans le patrimoine", () => {
    const s = game("carriere", "vie-achat");
    s.life!.housing.since -= 60 * MIN_PER_DAY;
    expect(act(s, { type: "life_move", housing: "studio", buy: true }).ok).toBe(false);
    act(s, { type: "lifestyle", level: 1 });
    // Héritage fictif pour l'apport
    s.balances["perso:cash|EUR"] = (s.balances["perso:cash|EUR"] ?? 0) + 8_000_000;
    s.balances["ext:depenses_vie|EUR"] = (s.balances["ext:depenses_vie|EUR"] ?? 0) - 8_000_000;
    s.career.salaryAnnual = 9_000_000;
    const r = act(s, { type: "life_move", housing: "studio", buy: true });
    expect(r.ok, (r as { error?: string }).error).toBe(true);
    expect(s.life!.housing.owned).toBe(true);
    expect(s.life!.housing.mortgage!.monthsLeft).toBe(240);
    expect(monthlyBills(s).some(([l]) => l.startsWith("Mensualité"))).toBe(true);
  });

  it("impayés répétés : expulsion vers la colocation", () => {
    const s = game("carriere", "vie-impaye", 1000);
    s.life!.housing = { id: "loft", owned: false, since: s.t };
    s.career.salaryAnnual = 100_000; // salaire dérisoire
    for (let i = 0; i < 8 && s.life!.housing.id !== "coloc"; i++) monthlyPayroll(s);
    expect(s.life!.housing.id).toBe("coloc");
    expect(s.life!.mental).toBeLessThan(60);
  });

  it("négociation salariale : rendez-vous, augmentation accordée avec un bon dossier, délai de six mois", () => {
    const s = game("carriere", "vie-nego");
    s.npcs.boss.trust = 80;
    s.career.reviews.unshift({ t: s.t, kind: "hebdo", score: 85, details: {}, outcome: "", comment: "" } as never);
    const sal0 = s.career.salaryAnnual;
    const r = act(s, { type: "ask_raise" });
    expect(r.ok).toBe(true);
    const id = s.activeMeetingId!;
    answerMeeting(s, id, { choiceId: "p5" });
    answerMeeting(s, id, { choiceId: "res" });
    const m = s.meetings.find((x) => x.id === id)!;
    if (!m.done) answerMeeting(s, id, { choiceId: "ok" });
    expect(s.career.salaryAnnual).toBe(Math.round(sal0 * 1.05));
    expect(act(s, { type: "ask_raise" }).ok).toBe(false);
  });

  it("mode historique : salaires et prix de l'an 2000 plus bas", () => {
    const h = createGame({ ownerId: "u", mode: "carriere", difficulty: "normal", seed: "vie-h", profile, bankId: "lutece", track: "trader", startingCapital: 10000, historical: true });
    expect(priceLevel(h)).toBeLessThan(0.7);
    const f = game("carriere", "vie-f");
    expect(h.career.salaryAnnual).toBeLessThan(f.career.salaryAnnual * 0.75);
  });
});

describe("Planning, sommeil et heures supplémentaires", () => {
  const monday = (s: ReturnType<typeof game>, h: number, m = 0) => { s.t = tOfDay(nextBusinessDay(dayIndex(s.t) + 1), h, m); s.agenda = []; s.paused = true; return s; };
  it("planning : validation des horaires, journée nette, réveil au moins 45 min avant l'arrivée", () => {
    const s = game("carriere", "plan-1");
    expect(getPlan(s)).toEqual(DEFAULT_PLAN);
    expect(plannedNetHours(DEFAULT_PLAN)).toBe(9.5);
    expect(act(s, { type: "set_plan", start: 9 * 60, end: 17 * 60 + 30, wake: 7 * 60 + 30 }).ok).toBe(true);
    expect(getPlan(s).start).toBe(540);
    expect(act(s, { type: "set_plan", start: 9 * 60, end: 17 * 60, wake: 8 * 60 + 30 }).ok).toBe(false); // réveil trop tard
    expect(act(s, { type: "set_plan", start: 11 * 60, end: 17 * 60, wake: 8 * 60 }).ok).toBe(false); // arrivée trop tardive
    expect(act(s, { type: "set_plan", start: 9 * 60, end: 14 * 60, wake: 8 * 60 }).ok).toBe(false); // départ trop tôt
    expect(act(s, { type: "set_plan", start: 7 * 60, end: 21 * 60, wake: 6 * 60 }).ok).toBe(false); // plus de 12 h sur place
    expect(act(s, { type: "set_plan", start: 8 * 60 + 5, end: 17 * 60, wake: 7 * 60 }).ok).toBe(false); // pas un quart d'heure
  });
  it("les activités suivent l'horaire de départ choisi ; le matin avant le travail on peut faire une activité courte", () => {
    const s = monday(game("carriere", "plan-2"), 10);
    act(s, { type: "set_plan", start: 9 * 60, end: 16 * 60 + 30, wake: 7 * 60 });
    expect(act(s, { type: "life_activity", id: "course" }).ok).toBe(false); // en plein travail
    expect(act(s, { type: "skip", to: "work_end" }).ok).toBe(true);
    expect(minuteOfDay(s.t)).toBe(16 * 60 + 30);
    const t0 = s.t;
    expect(act(s, { type: "life_activity", id: "course" }).ok).toBe(true);
    expect(s.t - t0).toBe(60);
    // Tôt le matin : une course d'1 h se termine avant l'arrivée à 9 h
    monday(s, 7, 30);
    expect(act(s, { type: "life_activity", id: "course" }).ok).toBe(true);
    expect(act(s, { type: "life_activity", id: "famille" }).ok).toBe(false); // 6 h : finirait trop tard
  });
  it("sommeil : dormir fait avancer l'horloge jusqu'au réveil choisi ; effets selon la durée ; refus au travail et trop tôt", () => {
    const s = monday(game("carriere", "plan-3"), 10);
    expect(sleepCheck(s).ok).toBe(false); // au travail
    monday(s, 18, 30);
    expect(act(s, { type: "sleep" }).ok).toBe(false); // 18 h 30 → 6 h 30 = 12 h : trop tôt
    s.t = tOfDay(dayIndex(s.t), 23, 0);
    s.life!.physique = 50; s.life!.mental = 50; s.career.stress = 40;
    const t0 = s.t;
    const r = act(s, { type: "sleep" });
    expect(r.ok).toBe(true);
    expect(minuteOfDay(s.t)).toBe(6 * 60 + 30); // réveil planifié
    expect(s.t - t0).toBe(7.5 * 60);
    expect(s.life!.physique).toBeGreaterThan(50);
    expect(s.life!.mental).toBeGreaterThan(50);
    expect(s.career.stress).toBeLessThan(40);
    expect(s.life!.sleep!.hours).toBe(7.5);
    expect(s.paused).toBe(true);
    // Trop tard : réveil dans moins de 3 h
    s.t = tOfDay(dayIndex(s.t), 5, 0);
    expect(sleepCheck(s).ok).toBe(false);
  });
  it("sommeil court : une nuit de 4 h abîme la forme", () => {
    const s = monday(game("carriere", "plan-4"), 23);
    act(s, { type: "set_plan", start: 7 * 60 + 30, end: 18 * 60, wake: 4 * 60 + 30 });
    s.life!.physique = 60; s.career.stress = 30;
    s.t = tOfDay(dayIndex(s.t), 0, 30); // couché à 0 h 30 jusqu'à 4 h 30 = 4 h
    expect(act(s, { type: "sleep" }).ok).toBe(true);
    expect(s.life!.sleep!.hours).toBe(4);
    expect(s.life!.physique).toBeLessThan(60);
    expect(s.career.stress).toBeGreaterThan(30);
  });
  it("heures supplémentaires : seulement après l'horaire de fin, l'horloge avance, fatigue ; « avance » permet de partir plus tôt le lendemain", () => {
    const s = monday(game("carriere", "plan-5"), 10);
    expect(act(s, { type: "overtime", hours: 2, focus: "avance" }).ok).toBe(false); // encore au travail
    act(s, { type: "skip", to: "work_end" });
    const t0 = s.t, ph = s.life!.physique, st = s.career.stress;
    const r = act(s, { type: "overtime", hours: 2, focus: "avance" });
    expect(r.ok).toBe(true);
    expect(s.t - t0).toBe(120);
    expect(s.life!.physique).toBeLessThan(ph);
    expect(s.career.stress).toBeGreaterThan(st);
    expect(s.life!.ahead).toBe(2);
    expect(act(s, { type: "overtime", hours: 4, focus: "avance" }).ok).toBe(false); // finirait après 23 h 30 (20 h + 4 h)
    // Lendemain : départ avancé de 2 h
    s.t = tOfDay(dayIndex(s.t) + 1, 0, 1);
    dailyLifeForTest(s);
    expect(workWindow(s).end).toBe(16 * 60);
    expect(s.life!.ahead).toBe(0);
  });
  it("heures supplémentaires « dossiers » : échéances repoussées, « formation » : expérience gagnée ; plafonds d'avance", () => {
    const s = monday(game("carriere", "plan-6"), 18);
    const active = s.missions.filter((m) => m.status === "active" && !m.daily);
    const before = active.map((m) => m.deadlineT);
    expect(act(s, { type: "overtime", hours: 2, focus: "dossiers" }).ok).toBe(true);
    active.forEach((m, i) => expect(m.deadlineT).toBe(before[i] + 12 * 60));
    const xp = Object.values(s.skills).reduce((a, b) => a + b, 0);
    s.t = tOfDay(dayIndex(s.t), 18, 0);
    expect(act(s, { type: "overtime", hours: 1, focus: "formation" }).ok).toBe(true);
    expect(Object.values(s.skills).reduce((a, b) => a + b, 0)).toBeGreaterThan(xp);
    s.life!.ahead = 4; s.t = tOfDay(dayIndex(s.t), 18, 0);
    expect(act(s, { type: "overtime", hours: 1, focus: "avance" }).message).toMatch(/réserve pleine/);
    expect(s.life!.ahead).toBe(4);
  });
  it("une journée plus longue fatigue et agace moins le responsable qu'une journée très courte ne le rassure ; la référence est neutre", () => {
    const run = (start: number, end: number, wake: number) => {
      const s = monday(game("carriere", "plan-7"), 0, 5);
      s.life!.plan = { start, end, wake };
      const stress = s.career.stress, trust = s.npcs.boss.trust, phys = s.life!.physique;
      dailyLifeForTest(s);
      return { ds: s.career.stress - stress, dt: s.npcs.boss.trust - trust, dp: s.life!.physique - phys };
    };
    const ref = run(7 * 60 + 30, 18 * 60, 6 * 60 + 30);
    const long = run(7 * 60, 20 * 60 + 30, 6 * 60);
    const short = run(9 * 60 + 30, 16 * 60, 8 * 60);
    expect(long.ds).toBeGreaterThan(ref.ds);
    expect(long.dp).toBeLessThan(ref.dp);
    expect(short.dt).toBeLessThan(ref.dt);
    expect(short.ds).toBeLessThan(ref.ds);
  });
  it("l'agenda est replacé dans les horaires : rien avant l'arrivée, bilan à l'heure de fin", () => {
    const s = monday(game("carriere", "plan-8"), 0, 5);
    s.flags["startDay"] = -5;
    s.life!.plan = { start: 9 * 60 + 30, end: 17 * 60, wake: 8 * 60 };
    planDay(s, new Rng(s.rng));
    const today = s.agenda.filter((a) => a.t >= tOfDay(dayIndex(s.t), 0, 0) && a.t < tOfDay(dayIndex(s.t) + 1, 0, 0));
    const work = today.filter((a) => a.kind !== "marche");
    expect(work.length).toBeGreaterThan(2);
    for (const a of work) expect(a.t % 1440).toBeGreaterThanOrEqual(9 * 60 + 30);
    const bilan = today.find((a) => a.title.startsWith("Bilan"))!;
    expect(bilan.t % 1440).toBe(17 * 60);
    expect(new Set(work.map((a) => a.t)).size).toBe(work.length);
  });
});
