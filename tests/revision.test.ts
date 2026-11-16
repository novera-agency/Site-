import { describe, it, expect } from "vitest";
import { game } from "./helpers";
import "@/engine/meetings";
import { applyAction } from "@/server/actions";
import { buildView } from "@/server/views";
import { answerQuiz, quizById } from "@/engine/quiz";
import { genQuestion } from "@/engine/quizGen";
import { buildQuestion, answerTraining, startTraining, closeTraining, type TItem } from "@/engine/training";
import { notebook, unresolved, recordMistake } from "@/engine/notebook";
import { entryRecap, revisionView, answerReview } from "@/engine/revision";
import { answerMeeting, meetingView } from "@/engine/meetingEngine";
import { tOfDay, dayIndex, nextBusinessDay } from "@/engine/time";
import type { GameState } from "@/engine/types";

const evening = (seed: string) => { const s = game("carriere", seed); s.t = tOfDay(nextBusinessDay(dayIndex(s.t) + 1), 18, 0); s.agenda = []; s.paused = true; return s; };
const wrongOf = (it: TItem) => { const q = buildQuestion(it)!; return (q.answer + 1) % q.options!.length; };
const act = (s: GameState, a: object) => applyAction(s, a as never);

describe("Erreurs passées : carnet, fiches de révision, refaire, séance de révision", () => {
  it("chaque erreur (séance de formation ou quiz) est gardée une seule fois avec son nombre d'échecs ; réussie, elle est maîtrisée ; ratée à nouveau, elle redevient à revoir", () => {
    const s = evening("rv-1");
    startTraining(s, 1, "marches");
    const t = s.life!.training!;
    answerTraining(s, 0, { choice: wrongOf(t.items[0]) });
    answerTraining(s, 1, { choice: buildQuestion(t.items[1])!.answer });
    expect(notebook(s).length).toBe(1);
    const e = notebook(s)[0];
    expect(e.count).toBe(1); expect(e.from).toBe("formation"); expect(e.item!.id).toBe(t.items[0].id); expect(e.yours).toBeTruthy();
    // Erreur au quiz : une ligne de plus, origine « culture »
    const q = quizById("mi_offre")!;
    answerQuiz(s, "mi_offre", (q.correct + 1) % 4);
    expect(notebook(s).length).toBe(2);
    expect(notebook(s)[0].from).toBe("culture");
    // Même question ratée une 2e fois : pas de doublon, compteur à 2, remise en tête
    answerQuiz(s, "mi_offre", (q.correct + 2) % 4);
    expect(notebook(s).length).toBe(2);
    expect(notebook(s)[0].count).toBe(2);
    // Réussite : maîtrisée ; puis ratée de nouveau : à revoir
    answerQuiz(s, "mi_offre", q.correct);
    expect(notebook(s)[0].fixed).toBe(true);
    expect(unresolved(s).length).toBe(1);
    answerQuiz(s, "mi_offre", (q.correct + 1) % 4);
    expect(notebook(s)[0].fixed).toBe(false);
    expect(notebook(s)[0].count).toBe(3);
  });

  it("anciens enregistrements du carnet remis au format actuel (clé, compteur), sans question à refaire", () => {
    const s = evening("rv-2");
    s.life!.notebook = [{ t: s.t, kind: "Calcul", title: "Ancienne question", text: "Ancienne explication" } as never];
    const e = notebook(s)[0];
    expect(e.key).toMatch(/^old:/); expect(e.count).toBe(1);
    const v = revisionView(s);
    expect(v.entries[0].retry).toBeNull();
    expect(v.entries[0].recap.points.join(" ")).toContain("Ancienne explication");
    expect(unresolved(s).length).toBe(0); // sans question reconstructible, elle ne peut pas être reposée
  });

  it("fiche de révision : votre réponse, bonne réponse, explication, fiche de cours, formule avec calcul pas à pas et exercice supplémentaire", () => {
    const s = evening("rv-3");
    // Exercice de calcul raté (levier) puis question de leçon ratée
    const g = genQuestion(14, 51);
    answerQuiz(s, "g:14:51", (g.correct + 1) % 4);
    const calc = notebook(s)[0];
    const r = entryRecap(calc);
    expect(r.title).toMatch(/Fiche de révision/);
    expect(r.points.some((p) => p.startsWith("✘ Votre réponse"))).toBe(true);
    expect(r.points.some((p) => p.startsWith("✔ Bonne réponse") && p.includes(g.options[g.correct].replace(/[.\s]+$/, "")))).toBe(true);
    expect(r.formulas[0].title).toBe("Effet de levier");
    expect(r.formulas[0].example).toContain("→");
    expect(r.exercise!.title).toBe("Effet de levier");
    expect(r.exercise!.prompt).not.toBe(g.q);
    expect(r.verdict.label).toBe("À revoir");
    // Leçon : la fiche de cours (définition, en clair, exemple, à quoi ça sert) est intégrée
    startTraining(s, 1, "marches");
    const t = s.life!.training!;
    const lessonIdx = t.items.findIndex((i) => i.k === "lesson");
    for (let i = 0; i <= lessonIdx; i++) answerTraining(s, i, { choice: i === lessonIdx ? wrongOf(t.items[i]) : buildQuestion(t.items[i])!.answer });
    const les = notebook(s).find((e) => e.item?.k === "lesson")!;
    const lr = entryRecap(les);
    expect(lr.points.some((p) => p.startsWith("📖"))).toBe(true);
    expect(lr.points.some((p) => p.startsWith("À quoi ça sert"))).toBe(true);
  });

  it("refaire une question sans la correction : mauvaise réponse sans effet, bonne réponse = maîtrisée (+ expérience une seule fois), réponses invalides refusées", () => {
    const s = evening("rv-4");
    const g = genQuestion(9, 12);
    answerQuiz(s, "g:9:12", (g.correct + 1) % 4);
    const key = notebook(s)[0].key;
    const xp0 = Object.values(s.skills).reduce((a, b) => a + b, 0);
    const v = revisionView(s).entries[0];
    expect(v.retry!.options).toEqual(g.options);
    expect(JSON.stringify(v.retry)).not.toContain("correct");
    expect(act(s, { type: "review_answer", key, choice: (g.correct + 1) % 4 }).data).toEqual(expect.objectContaining({ correct: false, fixed: false }));
    expect(notebook(s)[0].fixed).toBeFalsy();
    expect(act(s, { type: "review_answer", key, choice: 9 }).ok).toBe(false);
    expect(act(s, { type: "review_answer", key: "inconnue", choice: 0 }).ok).toBe(false);
    const ok = act(s, { type: "review_answer", key, choice: g.correct });
    expect(ok.data).toEqual(expect.objectContaining({ correct: true, fixed: true, xp: 4 }));
    expect(Object.values(s.skills).reduce((a, b) => a + b, 0)).toBeGreaterThan(xp0);
    expect(revisionView(s).entries[0].recap.verdict.label).toBe("Maîtrisée");
    const again = answerReview(s, key, g.correct);
    expect(again.ok && again.data.xp).toBe(0); // pas de gain en boucle
    expect(unresolved(s).length).toBe(0);
  });

  it("séance « Mes erreurs passées » : le responsable reprend d'abord les erreurs (les plus ratées d'abord), le dit, et la réussite les maîtrise ; refusée s'il n'y en a pas", () => {
    const s = evening("rv-5");
    expect(act(s, { type: "overtime", hours: 2, focus: "formation", subject: "erreurs" }).ok).toBe(false); // aucune erreur
    const ids = ["g:5:7", "g:1:3", "g:2:4"];
    for (const id of ids) { const q = quizById(id)!; answerQuiz(s, id, (q.correct + 1) % 4); }
    answerQuiz(s, "g:1:3", (quizById("g:1:3")!.correct + 2) % 4); // la 2e ratée 2 fois
    expect(unresolved(s).length).toBe(3);
    const r = act(s, { type: "overtime", hours: 2, focus: "formation", subject: "erreurs" });
    expect(r.ok).toBe(true);
    const t = s.life!.training!;
    expect(t.revision).toBe(true);
    expect(t.items.length).toBe(3);
    expect(t.items.every((i) => i.rev)).toBe(true);
    expect(t.items[0].id).toBe("1:3"); // la plus ratée d'abord
    expect(new Set(t.items.map((i) => i.id))).toEqual(new Set(["5:7", "1:3", "2:4"]));
    const m = s.meetings[0];
    const v = meetingView(s, m) as { log: { who: string; text: string }[] };
    expect(v.log[0].text).toMatch(/reprenons vos erreurs passées/);
    expect(v.log[0].text).toMatch(/Vous aviez déjà buté/);
    t.items.forEach((it) => answerMeeting(s, m.id, { choiceId: `c${buildQuestion(it)!.answer}` }));
    expect(m.done).toBe(true);
    expect(unresolved(s).length).toBe(0); // toutes maîtrisées
    expect(buildView(s, "planning", {}) as { revision: { unresolved: number } }).toEqual(expect.objectContaining({ revision: expect.objectContaining({ unresolved: 0 }) }));
  });

  it("séance de révision avec peu d'erreurs : complétée par de nouvelles questions, sans doublon ; la vue ne dévoile pas la bonne réponse", () => {
    const s = evening("rv-6");
    const g = genQuestion(5, 3);
    answerQuiz(s, "g:5:3", (g.correct + 1) % 4);
    expect(startTraining(s, 4, "erreurs").ok).toBe(true);
    const t = s.life!.training!;
    expect(t.items.length).toBe(5);
    expect(t.items[0]).toEqual(expect.objectContaining({ k: "calc", id: "5:3", rev: true }));
    expect(t.items.slice(1).every((i) => !i.rev)).toBe(true);
    expect(new Set(t.items.map((i) => `${i.k}:${i.id}`)).size).toBe(5);
    closeTraining(s);
    // La vue Planning expose les fiches mais jamais la bonne réponse de la question à refaire
    const pv = buildView(s, "planning", {}) as { revision: { entries: { retry: object | null }[] } };
    expect(Object.keys(pv.revision.entries[0].retry!).sort()).toEqual(["options", "prompt"]);
  });

  it("carnet limité à 60 erreurs, les plus récentes conservées", () => {
    const s = evening("rv-7");
    for (let i = 0; i < 70; i++) recordMistake(s, { item: { k: "calc", id: `5:${i + 1}` }, kind: "Calcul", title: `Q${i}`, text: "x", from: "formation" });
    expect(notebook(s).length).toBe(60);
    expect(notebook(s)[0].title).toBe("Q69");
  });
});
