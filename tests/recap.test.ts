import { describe, it, expect } from "vitest";
import { game } from "./helpers";
import "@/engine/meetings";
import { startMeeting, answerMeeting } from "@/engine/meetingEngine";
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
