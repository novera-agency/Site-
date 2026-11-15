import { describe, it, expect } from "vitest";
import { game, cash } from "./helpers";
import { applyAction } from "@/server/actions";
import { payslip, monthlyBills, incomeTax, freeHours, priceLevel } from "@/engine/life";
import { monthlyPayroll } from "@/engine/career";
import { isBalanced } from "@/engine/ledger";
import { tOfDay, dayIndex, nextBusinessDay, MIN_PER_DAY, minuteOfDay, isWeekend } from "@/engine/time";
import { answerMeeting } from "@/engine/meetingEngine";
import { createGame } from "@/engine/engine";
import { profile } from "./helpers";

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
