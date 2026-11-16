import { describe, it, expect } from "vitest";
import { game } from "./helpers";
import { applyAction } from "@/server/actions";
import { LESSONS } from "@/engine/data/learning";
import { genQuestion, GEN_FAMILIES } from "@/engine/quizGen";
import { buildView } from "@/server/views";

const act = (s: ReturnType<typeof game>, a: object) => applyAction(s, a as never);

import { isHoliday, isWeekend, tOfDay, dayOfDate } from "@/engine/time";

describe("Correctifs d'audit", () => {
  it("jours fériés : marchés et bureau fermés (1er janvier, vendredi saint, lundi de Pâques, 1er mai, Noël)", () => {
    const at = (y: number, m: number, d: number) => tOfDay(dayOfDate(y, m, d), 12, 0);
    expect(isHoliday(at(2026, 3, 3))).toBe(true);   // vendredi saint 2026
    expect(isHoliday(at(2026, 3, 6))).toBe(true);   // lundi de Pâques 2026
    expect(isHoliday(at(2026, 4, 1))).toBe(true);   // 1er mai
    expect(isHoliday(at(2026, 11, 25))).toBe(true); // Noël
    expect(isWeekend(at(2026, 3, 3))).toBe(true);
    expect(isHoliday(at(2026, 3, 7))).toBe(false);  // un jeudi ordinaire
    expect(isWeekend(at(2026, 3, 7))).toBe(false);
  });
  it("les leçons : la bonne réponse n'est pas toujours en première position", () => {
    const pos = LESSONS.filter((l) => l.exercise.kind === "qcm").map((l) => (l.exercise as { answer: number }).answer);
    expect(new Set(pos).size).toBeGreaterThan(1);
  });
  it("les questions générées : déterministes et sans options en double", () => {
    for (let f = 0; f < GEN_FAMILIES; f++) for (let seed = 1; seed <= 40; seed++) {
      const a = genQuestion(f, seed), b = genQuestion(f, seed);
      expect(a).toEqual(b);
      expect(new Set(a.options).size).toBe(a.options.length);
    }
  });
  it("quiz_answer refuse une question générée qui n'a pas été servie", () => {
    const s = game();
    const r = act(s, { type: "quiz_answer", id: "g:3:999999", choice: 0 });
    expect(r.ok).toBe(false);
  });
  it("la vue d'apprentissage n'envoie pas les réponses", () => {
    const s = game();
    const v = JSON.stringify(buildView(s, "learning", {}) ?? {});
    expect(v).not.toMatch(/"answer"/);
  });
});
