import { describe, it, expect } from "vitest";
import { game } from "./helpers";
import { startMeeting, answerMeeting, explainTerm, meetingChoices, MAX_PENALTIES } from "@/engine/meetingEngine";
import { performanceScore, quarterlyReview } from "@/engine/career";
import { relationStatus, checkRelationChanges } from "@/engine/relations";
import { changeRep } from "@/engine/core";
import { isTermQuestion, findTerm } from "@/engine/glossary";
import { MIN_PER_DAY } from "@/engine/time";

describe("Réunions : hors-sujet, échec, définitions", () => {
  it("une réponse hors sujet coûte des points ; au 3e avertissement la réunion est ratée", () => {
    const s = game("carriere", "offtopic");
    const trust0 = s.npcs.boss.trust, interne0 = s.reputation.interne;
    const m = startMeeting(s, "accueil")!;
    answerMeeting(s, m.id, { offtopic: true, spoken: "il fait beau aujourd'hui" });
    expect(m.score.communication).toBe(-2);
    expect(m.done).toBe(false);
    expect(m.log.some((l) => l.text.includes("Je répète"))).toBe(true);
    answerMeeting(s, m.id, { timeout: true });
    expect(m.done).toBe(false);
    for (let i = 2; i < MAX_PENALTIES; i++) answerMeeting(s, m.id, { offtopic: true, spoken: "les vacances" });
    expect(m.done).toBe(true);
    expect(m.vars.failed).toBe(1);
    expect(m.outcome).toMatch(/Réunion ratée/);
    expect(s.npcs.boss.trust).toBeLessThan(trust0);
    expect(s.reputation.interne).toBeLessThan(interne0);
    expect(s.activeMeetingId).toBeUndefined();
  });
  it("« Qu'est-ce que la VaR ? » : c'est la personne qui a employé le terme qui l'explique, sans pénalité", () => {
    const s = game("carriere", "terme");
    const m = startMeeting(s, "accueil")!;
    answerMeeting(s, m.id, { choiceId: meetingChoices(s, m)[0].id }); // le N+1 parle de « limite de VaR »
    const before = { ...m.score }, node = m.nodeId;
    const r = explainTerm(s, m.id, "Qu'est-ce que la VaR ?");
    expect(r.ok && r.term).toBe("VaR (Value at Risk)");
    expect(r.ok && r.by).toBe("boss");
    const last = m.log[m.log.length - 1];
    expect(last.who).toBe(s.npcs.boss.name);
    expect(last.text).toMatch(/99 %/);
    expect(m.score).toEqual(before);
    expect(m.nodeId).toBe(node);
  });
  it("détecte les questions de définition et retrouve le jargon", () => {
    expect(isTermQuestion("qu'est-ce que la duration ?")).toBe(true);
    expect(isTermQuestion("c'est quoi un DV01")).toBe(true);
    expect(isTermQuestion("ça veut dire quoi high yield")).toBe(true);
    expect(isTermQuestion("je propose de vendre les obligations")).toBe(false);
    expect(findTerm("qu'est ce que le DV01")?.term).toBe("DV01");
    expect(findTerm("c'est quoi les points de base")?.term).toBe("Point de base");
    expect(findTerm("qu'est-ce qu'un future")?.term).toBe("Future");
  });
});

describe("Avis des collaborateurs : effets réalistes", () => {
  it("N+1 allié : +5 à l'évaluation ; défavorable : −5", () => {
    const s = game("carriere", "boss");
    s.npcs.boss.trust = 50; const neutral = performanceScore(s, "quarter").total;
    s.npcs.boss.trust = 80; expect(performanceScore(s, "quarter").total).toBe(Math.min(100, neutral + 5));
    s.npcs.boss.trust = 10; expect(performanceScore(s, "quarter").total).toBe(Math.max(0, neutral - 5));
    expect(relationStatus(s, "boss")?.kind).toBe("inconvenient");
  });
  it("Managing Director défavorable : pas de promotion au-delà d'Associate", () => {
    const s = game("carriere", "md");
    s.career.rank = 3; s.flags["rankSinceT"] = s.t - 800 * MIN_PER_DAY;
    for (const k of Object.keys(s.skills) as (keyof typeof s.skills)[]) s.skills[k] = 9000;
    for (const k of Object.keys(s.reputation) as (keyof typeof s.reputation)[]) s.reputation[k] = 95;
    s.npcs.director.trust = 20;
    quarterlyReview(s);
    expect(s.career.rank).toBe(3);
    expect(s.career.reviews[0].outcome).toMatch(/Managing Director/);
  });
  it("conformité : pénalités atténuées si alliée, aggravées si défavorable", () => {
    const s = game("carriere", "comp");
    s.npcs.compliance.trust = 80; s.reputation.conformite = 60; changeRep(s, "conformite", -8); expect(s.reputation.conformite).toBe(54);
    s.npcs.compliance.trust = 10; s.reputation.conformite = 60; changeRep(s, "conformite", -8); expect(s.reputation.conformite).toBe(50);
  });
  it("les changements d'avis sont annoncés au joueur", () => {
    const s = game("carriere", "notif");
    checkRelationChanges(s);
    s.npcs.risk.trust = 85;
    checkRelationChanges(s);
    expect(s.notifications[0].title).toMatch(/vous apprécie/);
  });
});
