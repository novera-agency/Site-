import { describe, it, expect } from "vitest";
import { game } from "./helpers";
import { assignDailyMissions, drawStakes, completeMission, answerMission, missionQuestion } from "@/engine/missions";
import { Rng } from "@/engine/rng";
import { dayIndex, nextBusinessDay, MIN_PER_DAY } from "@/engine/time";

function toBusinessDay(s: ReturnType<typeof game>, offset: number) { s.t = nextBusinessDay(dayIndex(s.t) + offset) * MIN_PER_DAY + 1; }

describe("Missions du jour", () => {
  it("au moins deux missions chaque jour ouvré, différentes de la veille", () => {
    const s = game("carriere", "mj-1");
    const rng = new Rng(s.rng);
    toBusinessDay(s, 1);
    assignDailyMissions(s, rng);
    const d1 = s.missions.filter((m) => m.daily && m.status === "active");
    expect(d1.length).toBeGreaterThanOrEqual(2);
    for (const m of d1) { completeMission(s, m, true); }
    toBusinessDay(s, 1);
    assignDailyMissions(s, rng);
    const d2 = s.missions.filter((m) => m.daily && m.status === "active");
    expect(d2.length).toBeGreaterThanOrEqual(2);
    const ids1 = new Set(d1.map((m) => m.templateId));
    for (const m of d2) expect(ids1.has(m.templateId)).toBe(false);
    for (const m of d2) expect(m.deadlineT - s.t).toBeLessThan(MIN_PER_DAY);
  });

  it("l'enjeu suit l'appréciation : apprécié → missions risquées, mal vu → missions sans risque", () => {
    const s = game("carriere", "mj-2");
    const rng = new Rng(s.rng);
    const count = (trust: number, rep: number, score: number) => {
      s.npcs.boss.trust = trust; s.npcs.director.trust = trust;
      for (const k of Object.keys(s.reputation) as (keyof typeof s.reputation)[]) s.reputation[k] = rep;
      s.career.reviews = [{ t: s.t, kind: "hebdo", score, details: {}, outcome: "", comment: "" } as never];
      const c = { 1: 0, 2: 0, 3: 0 }; for (let i = 0; i < 400; i++) c[drawStakes(s, rng)]++; return c;
    };
    const loved = count(90, 85, 90), disliked = count(20, 25, 25);
    expect(loved[3]).toBeGreaterThan(loved[1] * 3);
    expect(disliked[1]).toBeGreaterThan(disliked[3] * 5);
  });

  it("une mission à fort enjeu ratée coûte cher ; réussie, elle alimente le bonus", () => {
    const s = game("carriere", "mj-3");
    s.npcs.boss.trust = 95; s.npcs.director.trust = 95;
    for (const k of Object.keys(s.reputation) as (keyof typeof s.reputation)[]) s.reputation[k] = 90;
    const rng = new Rng(s.rng);
    toBusinessDay(s, 1);
    let high = undefined as undefined | ReturnType<typeof s.missions.find>;
    for (let i = 0; i < 10 && !high; i++) { assignDailyMissions(s, rng); high = s.missions.find((m) => m.daily && m.stakes === 3 && m.status === "active"); toBusinessDay(s, 1); }
    expect(high).toBeTruthy();
    const pool0 = s.career.ytdBonusPool;
    completeMission(s, high!, true);
    expect(s.career.ytdBonusPool).toBeGreaterThan(pool0);
    const other = s.missions.find((m) => m.daily && m.stakes === 3 && m.status === "active") ?? (() => { assignDailyMissions(s, rng); return s.missions.find((m) => m.daily && m.status === "active")!; })();
    other.stakes = 3; other.giver = "director";
    const pro0 = s.reputation.professionnelle, tr0 = s.npcs.director.trust;
    completeMission(s, other, false);
    expect(s.reputation.professionnelle).toBeLessThan(pro0);
    expect(s.npcs.director.trust).toBeLessThanOrEqual(tr0 - 7);
  });

  it("les quiz du jour se répondent et se notent", () => {
    const s = game("carriere", "mj-4");
    const rng = new Rng(s.rng);
    let quiz;
    for (let i = 0; i < 12 && !quiz; i++) { toBusinessDay(s, 1); assignDailyMissions(s, rng); quiz = s.missions.find((m) => m.status === "active" && m.daily && missionQuestion(s, m)?.kind === "choice"); }
    expect(quiz).toBeTruthy();
    const r = answerMission(s, quiz!.id, { choice: Number(quiz!.params.c ?? 0) });
    expect(r.ok).toBe(true);
    expect(quiz!.status).not.toBe("active");
  });
});
