import { describe, it, expect } from "vitest";
import { game, profile } from "./helpers";
import { QUIZ_BANK, quizBatch, answerQuiz, quizState } from "@/engine/quiz";
import { createMission, answerMission } from "@/engine/missions";
import { applyAction } from "@/server/actions";
import { buildView } from "@/server/views";
import { checkProgress } from "@/engine/progression";
import { createGame, restartLegacyGame } from "@/engine/engine";
import { seriesAt, policyAt, HIST_END_ABS } from "@/engine/historical";
import { EPOCH_UTC, useEpoch } from "@/engine/time";

describe("Quiz de culture économique", () => {
  it("banque équilibrée : micro et macro, bonnes réponses variées, explications présentes", () => {
    expect(QUIZ_BANK.length).toBeGreaterThanOrEqual(48);
    expect(new Set(QUIZ_BANK.map((q) => q.id)).size).toBe(QUIZ_BANK.length);
    expect(QUIZ_BANK.filter((q) => q.cat === "micro").length).toBeGreaterThanOrEqual(24);
    expect(QUIZ_BANK.filter((q) => q.cat === "macro").length).toBeGreaterThanOrEqual(24);
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
    expect(quizBatch(s, "macro", 30).some((q) => q.id === a.id)).toBe(false);
    expect(quizBatch(s, "macro", 30).some((q) => q.id === b.id)).toBe(true);
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
      const full = QUIZ_BANK.find((x) => x.id === q.id)!;
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
    const full = QUIZ_BANK.find((x) => x.id === m!.params.q)!;
    const r = answerMission(s, m!.id, { choice: full.correct });
    expect(r.ok && r.message.startsWith("✔")).toBe(true);
  });
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
