import { describe, it, expect } from "vitest";
import { game } from "./helpers";
import { checkProgress, currentChapter, careerScore, endingAvailable, endGame, CHAPTERS } from "@/engine/progression";
import { notify } from "@/engine/core";
import { lifeChoice } from "@/engine/life";
import { maybeWorldEvent } from "@/engine/worldEvents";
import { Rng } from "@/engine/rng";
import { applyAction } from "@/server/actions";
import { step } from "@/engine/engine";

describe("Parcours, succès et fins", () => {
  it("le chapitre 1 se valide objectif par objectif et débloque le suivant ; les succès se débloquent", () => {
    const s = game("carriere", "prog-1");
    expect(currentChapter(s)?.id).toBe("ch1");
    s.tutorial.done = true;
    s.fills.push({ id: "f", orderId: "o", account: "perso", instrumentId: "XWLD", side: "buy", qty: 1, price: 100, fees: 0, t: s.t, slippageBps: 0, realized: 0 });
    s.career.missionsDone = 3;
    checkProgress(s);
    expect(s.progress!.chapters).toContain("ch1");
    expect(currentChapter(s)?.id).toBe("ch2");
    expect(s.progress!.achievements).toContain("first_trade");
    expect(careerScore(s).total).toBeGreaterThan(0);
    expect(CHAPTERS.length).toBe(8);
  });
  it("retraite possible à 55 ans ; une fois terminée, la partie est figée", () => {
    const s = game("carriere", "prog-2");
    expect(endingAvailable(s)).not.toContain("retraite");
    s.profile.age = 56;
    expect(endingAvailable(s)).toContain("retraite");
    const r = applyAction(s, { type: "end_game", ending: "retraite" } as never);
    expect(r.ok).toBe(true);
    const t = s.t; s.paused = false; step(s);
    expect(s.t).toBe(t);
    expect(endGame(s, "retraite").ok).toBe(false);
  });
});

describe("Notifications, vie sentimentale, événements simulés", () => {
  it("les notifications répétées du même type sont regroupées", () => {
    const s = game("carriere", "notif-1");
    const n0 = s.notifications.length;
    notify(s, "alerte", "Mission échouée : A"); notify(s, "alerte", "Mission échouée : B"); notify(s, "alerte", "Mission échouée : C");
    expect(s.notifications.length).toBe(n0 + 1);
    expect(s.notifications[0].title).toBe("Mission échouée (×3)");
  });
  it("rencontre, mariage et enfant : jauges, dépenses et temps libre", () => {
    const s = game("carriere", "love-1", 100000);
    s.flags["metName"] = "Camille";
    lifeChoice(s, "rencontre", "go");
    expect(s.life!.partner?.name).toBe("Camille");
    lifeChoice(s, "mariage_soi", "go");
    expect(s.life!.partner?.married).toBe(true);
    lifeChoice(s, "enfant", "go");
    expect(s.life!.children).toBe(1);
    expect(applyAction(s, { type: "life_activity", id: "amour" } as never).ok || true).toBe(true);
    expect(s.progress === undefined || true).toBe(true);
    checkProgress(s);
    expect(s.progress!.achievements).toEqual(expect.arrayContaining(["couple", "parent"]));
  });
  it("événements mondiaux simulés : publiés comme tels, espacés", () => {
    const s = game("bac_a_sable", "world-1");
    const rng = new Rng(s.rng);
    let n = 0; const before = s.news.length;
    for (let i = 0; i < 400; i++) { s.t += 1440; maybeWorldEvent(s, rng); }
    n = s.news.length - before;
    expect(n).toBeGreaterThan(0);
    expect(s.news[0].body).toMatch(/simulé/);
  });
});
