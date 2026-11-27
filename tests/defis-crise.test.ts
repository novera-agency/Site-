import { describe, it, expect } from "vitest";
import { createGame, advance, CHALLENGES } from "@/engine/engine";
import { profile } from "./helpers";

const mk = (id: string, seed: string) => createGame({ ownerId: "u", mode: "defi", difficulty: "normal", seed, profile, bankId: "lutece", track: "trader", startingCapital: 100000, challengeId: id });

describe("Exercices de crise (défis)", () => {
  it("dix défis, chacun avec une leçon ; neuf déclenchent une crise d'un type précis", () => {
    expect(CHALLENGES.length).toBe(10);
    expect(new Set(CHALLENGES.map((c) => c.id)).size).toBe(10);
    for (const c of CHALLENGES) expect(c.lesson.length).toBeGreaterThan(60);
    expect(CHALLENGES.filter((c) => c.crisis).length).toBe(9);
  });
  it("la crise annoncée éclate bien quelques jours après le début, du bon type", () => {
    for (const c of CHALLENGES.filter((x) => x.crisis)) {
      const s = mk(c.id, "crise-" + c.id); s.paused = false;
      for (let d = 0; d < 40 && !s.flags["challengeCrisisFired"]; d++) { s.paused = false; advance(s, 360); }
      expect(s.flags["challengeCrisisFired"], c.id).toBe(true);
      expect(s.crises.some((k) => k.kind === c.crisis), c.id).toBe(true);
    }
  });
  it("à la fin d'un défi, un bilan commenté est envoyé (réaction, protections, leçon)", () => {
    const s = mk("panique_bancaire", "bilan-1"); s.paused = false;
    for (let d = 0; d < 400 && s.challenge!.status === "en_cours"; d++) { s.paused = false; advance(s, 360); }
    expect(s.challenge!.status).not.toBe("en_cours");
    const m = s.messages.find((x) => x.subject.startsWith("Bilan de l'exercice"));
    expect(m, "bilan").toBeTruthy();
    expect(m!.body).toContain("Votre réaction");
    expect(m!.body).toContain("Vos protections");
    expect(m!.body).toContain("La leçon");
  });
});
