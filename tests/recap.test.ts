import { describe, it, expect } from "vitest";
import { game } from "./helpers";
import "@/engine/meetings";
import { startMeeting, answerMeeting, meetingChoices } from "@/engine/meetingEngine";
import { buildRecap } from "@/engine/recap";
import { quizById } from "@/engine/quiz";
import { buildQuestion } from "@/engine/training";
import { tOfDay, dayIndex, nextBusinessDay } from "@/engine/time";
import { applyAction } from "@/server/actions";
import { buildView } from "@/server/views";
import type { GameState } from "@/engine/types";

const workDay = (s: GameState) => { s.t = tOfDay(nextBusinessDay(dayIndex(s.t) + 1), 18, 0); s.agenda = []; s.paused = true; return s; };

describe("Fiche « à retenir » de fin d'entretien", () => {
  it("pas de fiche tant que la réunion n'est pas terminée ; la vue l'ajoute ensuite", () => {
    const s = workDay(game("carriere", "rec-0"));
    const m = startMeeting(s, "question_technique")!;
    expect((buildView(s, "meeting", { id: m.id }) as { recap: unknown }).recap).toBeNull();
    answerMeeting(s, m.id, { value: 40000 });
    answerMeeting(s, m.id, { choiceId: "a" });
    expect(m.done).toBe(true);
    const v = buildView(s, "meeting", { id: m.id }) as { recap: { title: string } | null };
    expect(v.recap?.title).toBe("Question technique du responsable");
  });

  it("fiche générale : corrections, décisions, notions du glossaire employées par les participants, verdict, date et lieu", () => {
    const s = workDay(game("carriere", "rec-1"));
    const m = startMeeting(s, "question_technique")!;
    answerMeeting(s, m.id, { value: 1 }); // faux : la correction est à retenir
    answerMeeting(s, m.id, { choiceId: "b" }); // faux aussi
    const r = buildRecap(s, m)!;
    expect(r.title).toBe("Question technique du responsable");
    expect(r.subtitle).toContain("Salle des marchés");
    expect(r.when).toMatch(/\d{2}[:h]\d{2}/);
    expect(r.points.length).toBeGreaterThan(0);
    expect(r.points.join(" ")).toMatch(/Inexact/);
    expect(r.points[0]).toMatch(/Objectifs de la réunion/);
    expect(r.decisions.length).toBeGreaterThan(0);
    expect(r.terms.map((t) => t.term).join(" ")).toMatch(/Duration|Point de base/i);
    expect(r.terms.every((t) => t.text.length > 10)).toBe(true);
    expect(r.verdict.tone).toBe("loss");
    expect(r.outcome).toBeTruthy();
  });

  it("point culture : une ligne par question avec la bonne réponse et l'explication, verdict selon les bases", () => {
    const s = workDay(game("carriere", "rec-2"));
    const m = startMeeting(s, "culture_n1")!;
    const ids = String(m.vars.ids).split("|");
    const q0 = quizById(ids[0])!;
    answerMeeting(s, m.id, { choiceId: `c${(q0.correct + 1) % 4}` }); // faux
    while (!m.done) { const i = Number(m.nodeId.slice(1)); const q = quizById(String(m.vars.ids).split("|")[i])!; answerMeeting(s, m.id, { choiceId: `c${q.correct}` }); }
    const r = buildRecap(s, m)!;
    expect(r.title).toMatch(/Point culture avec/);
    expect(r.points.length).toBe(Number(m.vars.asked));
    expect(r.points[0].startsWith("✘")).toBe(true);
    expect(r.points[0]).toContain(q0.options[q0.correct]);
    expect(r.points[0]).toContain(q0.explain.slice(0, 20));
    expect(r.points.slice(1).every((p) => p.startsWith("✔"))).toBe(true);
    expect(r.verdict.label).toBe("Bases acquises");
    expect(r.terms.length).toBe(0);
    expect(r.tips.some((t) => t.includes("À revoir"))).toBe(true);
  });

  it("séance de formation : fiche de cours, question, réponse et explication de chaque question, verdict selon le score", () => {
    const s = workDay(game("carriere", "rec-3"));
    expect(applyAction(s, { type: "overtime", hours: 2, focus: "formation", subject: "marches" } as never).ok).toBe(true);
    const m = s.meetings[0];
    const items = s.life!.training!.items;
    items.forEach((it) => answerMeeting(s, m.id, { choiceId: `c${buildQuestion(it)!.answer}` }));
    expect(m.done).toBe(true);
    const r = buildRecap(s, m)!;
    expect(r.verdict.label).toBe("Séance réussie");
    expect(r.points.filter((p) => p.startsWith("✔")).length).toBe(items.length);
    expect(r.points.some((p) => p.startsWith("📖"))).toBe(true); // la notion de la fiche de cours
    expect(r.points.every((p) => p.length > 20)).toBe(true);
    expect(r.tips.join(" ")).toMatch(/carnet de formation/);
  });

  it("n'inclut jamais de réponse non jouée : une réunion en cours n'a pas de fiche dans la vue ; les fiches restent consultables dans l'historique", () => {
    const s = workDay(game("carriere", "rec-4"));
    const m = startMeeting(s, "culture_n1")!;
    expect((buildView(s, "meeting", { id: m.id }) as { recap: unknown }).recap).toBeNull();
    while (!m.done) { const i = Number(m.nodeId.slice(1)); answerMeeting(s, m.id, { choiceId: `c${quizById(String(m.vars.ids).split("|")[i])!.correct}` }); }
    s.t += 3 * 1440;
    const again = buildView(s, "meeting", { id: m.id }) as { recap: { when: string; verdict: { label: string } } };
    expect(again.recap.verdict.label).toBe("Bases solides");
  });
});

describe("Fiche : formules détaillées, calcul pas à pas et exercice supplémentaire", () => {
  it("chaque famille d'exercices de calcul a sa formule ; les exercices rédigés ont un corrigé exact", async () => {
    const { FORMULAS, matchFormulas } = await import("@/engine/formulas");
    const { GEN_FAMILIES } = await import("@/engine/quizGen");
    for (let f = 0; f < GEN_FAMILIES; f++) expect(FORMULAS.some((x) => x.fam === f), `famille ${f}`).toBe(true);
    expect(new Set(FORMULAS.map((f) => f.id)).size).toBe(FORMULAS.length);
    for (const f of FORMULAS) { expect(f.formula.length).toBeGreaterThan(15); expect(f.legend.length).toBeGreaterThan(0); if (f.fam === undefined) { expect(f.example, f.id).toBeTruthy(); expect(f.exercise, f.id).toBeTruthy(); } }
    // vérification numérique des corrigés rédigés
    const ex = (id: string) => FORMULAS.find((f) => f.id === id)!.exercise!;
    expect(-2000 + 1200 / 1.1 + 1200 / 1.21).toBeCloseTo(82.65, 1); expect(ex("van").answer).toBe("+82,65 €");
    expect(2_000_000 * 0.015 * 2.33).toBeCloseTo(69900, 0); expect(ex("var").answer).toBe("69 900 €");
    expect(6 * 0.0025 * 500_000).toBe(7500); expect(ex("duration").answer).toBe("7 500 €");
    expect(0.35 * 4200 - 200).toBe(1270); expect(ex("endettement").answer).toBe("1 270 €");
    expect((650 * 12) / 150_000).toBeCloseTo(0.052, 5); expect(ex("rend_loc").answer).toBe("5,2 %");
    expect(15 / 12).toBe(1.25); expect(ex("peg").answer).toBe("1,25");
    expect((900 - 300) / 200).toBe(3); expect(15 / 250).toBeCloseTo(0.06, 5); expect(9 / 60).toBeCloseTo(0.15, 5); expect(0.4 * 3).toBeCloseTo(1.2, 5); expect(120000 / 240).toBe(500);
    // repérage dans un texte
    expect(matchFormulas(["Quel est le PER de cette action ?"]).map((f) => f.id)).toContain("per");
    expect(matchFormulas(["La VaR 99 % du book"]).map((f) => f.id)).toContain("var");
    expect(matchFormulas(["Aucun rapport"]).length).toBe(0);
    // les familles travaillées passent en premier
    expect(matchFormulas(["PER"], 3, [14])[0].id).toBe("levier");
  });

  it("réunion classique : la fiche cite les formules du sujet (duration, delta, call…) avec formule, légende, calcul et un exercice corrigé", () => {
    const s = workDay(game("carriere", "rec-f1"));
    const m = startMeeting(s, "question_technique")!;
    answerMeeting(s, m.id, { value: 40000 });
    answerMeeting(s, m.id, { choiceId: "a" });
    const r = buildRecap(s, m)!;
    expect(r.formulas.length).toBeGreaterThan(0);
    expect(r.formulas.length).toBeLessThanOrEqual(3);
    const dur = r.formulas.find((f) => f.title.includes("duration"))!;
    expect(dur).toBeTruthy();
    expect(dur.formula).toMatch(/duration modifiée × variation des taux/);
    expect(dur.legend.length).toBeGreaterThan(0);
    expect(dur.example).toMatch(/−40 000 €/);
    expect(dur.pitfall).toBeTruthy();
    expect(r.exercise).toBeTruthy();
    expect(r.exercise!.prompt.length).toBeGreaterThan(30);
    expect(r.exercise!.answer.length).toBeGreaterThan(0);
    expect(r.exercise!.solution.length).toBeGreaterThan(20);
  });

  it("séance ou point culture : la formule de l'exercice de calcul travaillé passe en premier, avec un exemple chiffré et un autre exercice de la même famille", () => {
    const s = workDay(game("carriere", "rec-f2"));
    // Point culture dont la 2e question est un calcul : on force la liste
    const m = startMeeting(s, "culture_n1")!;
    m.vars.ids = `g:14:51|${String(m.vars.ids).split("|")[1]}`;
    const q0 = quizById("g:14:51")!;
    answerMeeting(s, m.id, { choiceId: `c${(q0.correct + 1) % 4}` }); // on se trompe sur l'exercice de levier
    while (!m.done) { const i = Number(m.nodeId.slice(1)); answerMeeting(s, m.id, { choiceId: `c${quizById(String(m.vars.ids).split("|")[i])!.correct}` }); }
    const r = buildRecap(s, m)!;
    expect(r.formulas[0].title).toBe("Effet de levier");
    expect(r.formulas[0].formula).toMatch(/coefficient de levier/);
    expect(r.formulas[0].example).toContain("→"); // énoncé → réponse. calcul
    expect(r.exercise!.title).toBe("Effet de levier");
    expect(r.exercise!.prompt).not.toBe(q0.q); // un autre exercice
    expect(r.exercise!.solution).toMatch(/coefficient de levier/);
  });

  it("toute fiche propose un exercice supplémentaire, même sans formule repérée", () => {
    const s = workDay(game("carriere", "rec-f3"));
    const m = startMeeting(s, "desk_quotidien")!;
    while (!m.done) { const v = meetingChoices(s, m); if (!v.length) break; answerMeeting(s, m.id, { choiceId: v[0].id }); }
    const r = buildRecap(s, m)!;
    expect(r.exercise).toBeTruthy();
    expect(r.exercise!.solution.length).toBeGreaterThan(15);
  });

  it("la fiche d'une séance ne répète pas les définitions et n'a ni double point ni phrase dupliquée", () => {
    const s = workDay(game("carriere", "rec-f4"));
    expect(applyAction(s, { type: "overtime", hours: 4, focus: "formation", subject: "risque" } as never).ok).toBe(true);
    const m = s.meetings[0];
    s.life!.training!.items.forEach((it) => answerMeeting(s, m.id, { choiceId: `c${buildQuestion(it)!.answer}` }));
    const r = buildRecap(s, m)!;
    for (const p of [...r.points, ...r.formulas.map((f) => f.example), r.exercise!.solution]) {
      expect(p, p).not.toMatch(/\.\./);
      const sentences = p.split(/(?<=[.!?])\s+/).filter((x) => x.length > 40);
      expect(new Set(sentences).size, p).toBe(sentences.length); // aucune phrase répétée dans une même ligne
    }
  });
});
