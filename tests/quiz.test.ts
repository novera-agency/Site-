import { describe, it, expect } from "vitest";
import { game, profile } from "./helpers";
import { QUIZ_BANK, quizBatch, answerQuiz, quizState, quizToday, quizById } from "@/engine/quiz";
import { genQuestion, GEN_FAMILIES, histIds, histQuestion } from "@/engine/quizGen";
import { createMission, answerMission } from "@/engine/missions";
import { applyAction } from "@/server/actions";
import { buildView } from "@/server/views";
import { checkProgress } from "@/engine/progression";
import { createGame, restartLegacyGame } from "@/engine/engine";
import { seriesAt, policyAt, HIST_END_ABS } from "@/engine/historical";
import { EPOCH_UTC, useEpoch } from "@/engine/time";

describe("Quiz de culture économique", () => {
  it("banque équilibrée : micro et macro, bonnes réponses variées, explications présentes", () => {
    expect(QUIZ_BANK.length).toBeGreaterThanOrEqual(140);
    expect(new Set(QUIZ_BANK.map((q) => q.id)).size).toBe(QUIZ_BANK.length);
    for (const c of ["micro", "macro", "finance", "histoire"]) expect(QUIZ_BANK.filter((q) => q.cat === c).length, c).toBeGreaterThanOrEqual(c === "histoire" ? 10 : 40);
    for (const q of QUIZ_BANK) {
      expect(q.options.length).toBe(4);
      expect(new Set(q.options).size).toBe(4);
      expect(q.correct).toBeGreaterThanOrEqual(0); expect(q.correct).toBeLessThan(4);
      expect(q.explain.length).toBeGreaterThan(30);
    }
    // la bonne réponse ne doit pas toujours être au même endroit
    const pos = [0, 1, 2, 3].map((i) => QUIZ_BANK.filter((q) => q.correct === i).length);
    expect(pos.filter((n) => n > 0).length).toBeGreaterThanOrEqual(2);
  });
  it("bonne réponse : expérience gagnée une seule fois ; mauvaise réponse : série remise à zéro, question reproposée plus tard", () => {
    const s = game("carriere", "quiz-1");
    const [a, b] = quizBatch(s, "macro", 2);
    const xp0 = s.skills.macro;
    const r1 = answerQuiz(s, a.id, a.correct);
    expect(r1.ok && r1.data.correct && r1.data.xp > 0).toBe(true);
    expect(s.skills.macro).toBeGreaterThan(xp0);
    const xp1 = s.skills.macro;
    const r2 = answerQuiz(s, a.id, a.correct);
    expect(r2.ok && r2.data.xp).toBe(0);
    expect(s.skills.macro).toBe(xp1);
    const wrong = answerQuiz(s, b.id, (b.correct + 1) % 4);
    expect(wrong.ok && !wrong.data.correct && wrong.data.explain.length > 0).toBe(true);
    expect(quizState(s).streak).toBe(0);
    expect(quizBatch(s, "macro", 100).some((q) => q.id === a.id)).toBe(false);
    expect(quizBatch(s, "macro", 100).some((q) => q.id === b.id)).toBe(true);
    expect(answerQuiz(s, "inconnue", 0).ok).toBe(false);
    expect(answerQuiz(s, b.id, 9).ok).toBe(false);
  });
  it("la vue ne révèle jamais la bonne réponse ; l'action est validée côté moteur ; succès débloqués", () => {
    const s = game("carriere", "quiz-2");
    const v = buildView(s, "culture", { cat: "micro" }) as any;
    expect(v.batch.length).toBe(5);
    expect(JSON.stringify(v)).not.toContain("correct\":");
    expect(v.batch.every((q: any) => q.cat === "micro")).toBe(true);
    for (let i = 0; i < 12; i++) {
      const q = (buildView(s, "culture", { cat: "mix" }) as any).batch[0];
      const full = quizById(q.id)!;
      const r = applyAction(s, { type: "quiz_answer", id: q.id, choice: full.correct } as never);
      expect(r.ok).toBe(true);
    }
    checkProgress(s);
    expect(s.progress!.achievements).toContain("eco10");
  });
  it("mission du jour de culture économique : bonne réponse validée", () => {
    const s = game("carriere", "quiz-3");
    const m = createMission(s, "d_culture", {}, undefined, { daily: true, quiet: true });
    expect(m).toBeTruthy();
    const full = quizById(String(m!.params.q))!;
    const r = answerMission(s, m!.id, { choice: full.correct });
    expect(r.ok && r.message.startsWith("✔")).toBe(true);
  });
});

describe("Quiz à grande échelle : 2 questions par jour sur 20 ans", () => {
  it("exercices de calcul : 20 familles, toujours 4 réponses distinctes dont la bonne, reproductibles", () => {
    expect(GEN_FAMILIES).toBe(20);
    for (let f = 0; f < GEN_FAMILIES; f++) for (let seed = 1; seed <= 60; seed++) {
      const q = genQuestion(f, seed);
      expect(q.options.length, q.id).toBe(4);
      expect(new Set(q.options).size, `${q.id} ${q.options.join(" | ")}`).toBe(4);
      expect(q.correct).toBeGreaterThanOrEqual(0); expect(q.correct).toBeLessThan(4);
      expect(q.explain.length).toBeGreaterThan(20);
      expect(JSON.stringify(genQuestion(f, seed))).toBe(JSON.stringify(q));
      expect(quizById(q.id)?.q).toBe(q.q);
    }
    // les chiffres changent d'une graine à l'autre
    expect(new Set(Array.from({ length: 30 }, (_, i) => genQuestion(0, i + 1).q)).size).toBeGreaterThanOrEqual(15);
  });
  it("questions tirées de l'histoire du jeu : l'année bonne figure parmi 4 années distinctes, explication datée", () => {
    const ids = histIds();
    expect(ids.length).toBeGreaterThan(80);
    for (const id of ids) {
      const q = histQuestion(id)!;
      expect(new Set(q.options).size, id).toBe(4);
      expect(q.options[q.correct]).toMatch(/^(19|20)\d\d$/);
      expect(q.explain).toMatch(/\d{4}\./);
    }
  });
  it("deux questions du jour, figées pour la journée, différentes d'un jour à l'autre ; bonus et série quand les deux sont faites", () => {
    const s = game("carriere", "quiz-6");
    const a = quizToday(s);
    expect(a.ids.length).toBe(2);
    expect(quizToday(s)).toBe(a);
    const batch = quizBatch(s, "jour");
    expect(batch.map((q) => q.id)).toEqual(a.ids);
    answerQuiz(s, a.ids[0], quizById(a.ids[0])!.correct);
    expect(quizBatch(s, "jour").length).toBe(1);
    const r = answerQuiz(s, a.ids[1], quizById(a.ids[1])!.correct);
    expect(r.ok && r.data.daily?.done).toBe(true);
    expect(quizState(s).dailyStreak).toBe(1);
    expect(s.notifications.some((n) => n.title.includes("Questions du jour"))).toBe(true);
    s.t += 1440;
    const b = quizToday(s);
    expect(b.ids).not.toEqual(a.ids);
    for (const id of b.ids) answerQuiz(s, id, quizById(id)!.correct);
    expect(quizState(s).dailyStreak).toBe(2);
    s.t += 5 * 1440; // trois jours sautés : la série repart de 1
    for (const id of quizToday(s).ids) answerQuiz(s, id, quizById(id)!.correct);
    expect(quizState(s).dailyStreak).toBe(1);
  });
  it("sur 20 ans (7 300 jours) : toujours 2 questions valides par jour, sans répétition d'une question de culture réussie", () => {
    const s = game("carriere", "quiz-7");
    const seen = new Set<string>();
    let repeats = 0;
    for (let d = 0; d < 7300; d++) {
      const t = quizToday(s);
      expect(t.ids.length).toBe(2);
      for (const id of t.ids) { const q = quizById(id); expect(q, id).toBeTruthy(); expect(q!.options.length).toBe(4); }
      for (const id of t.ids) { if (seen.has(id)) repeats++; seen.add(id); answerQuiz(s, id, quizById(id)!.correct); }
      s.t += 1440;
    }
    expect(seen.size).toBeGreaterThan(7000);
    expect(repeats).toBeLessThan(50);
    expect(quizState(s).dailyDone).toBe(7300);
  }, 120000);
});

describe("Histoire réelle jusqu'en novembre 2026 et partie recommencée", () => {
  it("repères 2026 : S&P 500 au-dessus de 7 000 en avril, creux de mars, Brent > 100 $ pendant le choc, taux de la Fed relevé en septembre", () => {
    const abs = (iso: string) => Date.parse(iso + "T12:00:00Z") / 86400000;
    expect(seriesAt("EQ_US", abs("2026-04-15"))).toBeGreaterThan(6900);
    expect(seriesAt("EQ_US", abs("2026-03-27"))).toBeLessThan(6500);
    expect(seriesAt("BRENT", abs("2026-03-31"))).toBeGreaterThan(110);
    expect(seriesAt("GOLD", abs("2026-01-28"))).toBeGreaterThan(5000);
    expect(seriesAt("GOLD", abs("2026-11-13"))).toBeLessThan(4000);
    expect(policyAt("US", abs("2026-10-30"))).toBeCloseTo(3.875, 3);
    expect(policyAt("EZ", abs("2026-10-30"))).toBeCloseTo(2.5, 3);
    expect(policyAt("UK", abs("2026-11-10"))).toBeCloseTo(4.0, 3);
    expect(HIST_END_ABS).toBe(abs("2026-11-13") - 0.5);
  });
  it("une partie créée avant la mise à jour est recommencée au 3 janvier 2000 (même personnage, banque et nom), une seule fois", () => {
    const old = game("carriere", "quiz-4", 50000);
    old.flags["gen"] = 0; old.name = "Ma partie";
    const fresh = restartLegacyGame(old);
    expect(fresh).toBeTruthy();
    expect(fresh!.id).toBe(old.id);
    expect(fresh!.name).toBe("Ma partie");
    expect(fresh!.epochYear).toBe(2000);
    expect(fresh!.historical).toBe(true);
    expect(fresh!.profile.firstName).toBe(old.profile.firstName);
    expect(fresh!.career.bankId).toBe(old.career.bankId);
    expect(fresh!.messages.some((m) => m.subject.includes("recommence en 2000"))).toBe(true);
    expect(restartLegacyGame(fresh!)).toBeNull();
    expect(restartLegacyGame(game("defi", "quiz-5"))).toBeNull();
  });
});
