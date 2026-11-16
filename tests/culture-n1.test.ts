import { describe, it, expect } from "vitest";
import { game } from "./helpers";
import "@/engine/meetings";
import { startMeeting, answerMeeting, meetingChoices, meetingView } from "@/engine/meetingEngine";
import { quizById, quizState, quizToday, answerQuiz } from "@/engine/quiz";
import { planDay } from "@/engine/agenda";
import { Rng } from "@/engine/rng";
import { tOfDay, dayIndex, nextBusinessDay, isWeekend } from "@/engine/time";
import type { GameState } from "@/engine/types";

const ids = (m: { vars: Record<string, number | string> }) => String(m.vars.ids).split("|").filter(Boolean);
const workDay = (s: GameState) => { s.t = tOfDay(nextBusinessDay(dayIndex(s.t) + 1), 8, 15); s.agenda = []; s.paused = true; return s; };
const answer = (s: GameState, mid: string, right: boolean) => {
  const m = s.meetings.find((x) => x.id === mid)!;
  const i = Number(m.nodeId.slice(1));
  const q = quizById(ids(m)[i])!;
  const choice = right ? q.correct : (q.correct + 1) % q.options.length;
  return answerMeeting(s, mid, { choiceId: `c${choice}` });
};

describe("Point culture quotidien avec le N+1", () => {
  it("chaque jour ouvré (pas le premier jour, pas le week-end) l'agenda contient un point culture, dans les horaires choisis", () => {
    const s = workDay(game("carriere", "cul-1"));
    s.flags["startDay"] = -9;
    s.t = tOfDay(dayIndex(s.t), 0, 5);
    planDay(s, new Rng(s.rng));
    const it = s.agenda.find((a) => a.meetingTemplate === "culture_n1")!;
    expect(it).toBeTruthy();
    expect(it.kind).toBe("reunion");
    expect(it.t % 1440).toBe(8 * 60 + 15); // arrivée à 7 h 30 + 45 min
    // Horaires décalés : le point culture suit l'arrivée
    s.agenda = []; s.life!.plan = { start: 9 * 60, end: 17 * 60 + 30, wake: 7 * 60 + 30 };
    planDay(s, new Rng(s.rng));
    expect(s.agenda.find((a) => a.meetingTemplate === "culture_n1")!.t % 1440).toBe(9 * 60 + 45);
    // Week-end : rien
    let d = dayIndex(s.t); while (!isWeekend(d * 1440)) d++;
    s.agenda = []; s.t = tOfDay(d, 0, 5);
    planDay(s, new Rng(s.rng));
    expect(s.agenda.some((a) => a.meetingTemplate === "culture_n1")).toBe(false);
  });

  it("deux bonnes réponses d'affilée : 2 questions seulement, bases validées, quiz du jour compté, confiance du responsable en hausse", () => {
    const s = workDay(game("carriere", "cul-2"));
    const trust0 = s.npcs.boss.trust;
    const m = startMeeting(s, "culture_n1")!;
    expect(m.templateId).toBe("culture_n1");
    expect(ids(m).length).toBe(2);
    expect(ids(m)).toEqual(quizToday(s).ids); // ce sont les deux questions du jour
    answer(s, m.id, true);
    expect(m.done).toBe(false);
    answer(s, m.id, true);
    expect(m.done).toBe(true);
    expect(m.vars.asked).toBe(2);
    expect(m.outcome).toMatch(/2 bonnes réponses sur 2/);
    expect(s.npcs.boss.trust).toBeGreaterThan(trust0);
    expect(quizState(s).dailyDone).toBe(1);
    expect(s.notifications.some((n) => n.title.includes("Questions du jour"))).toBe(true);
    expect(s.activeMeetingId).toBeUndefined();
  });

  it("une erreur : le responsable pose une question de rattrapage du même thème et de niveau égal ou inférieur ; fin dès 2 bonnes réponses (3 questions)", () => {
    const s = workDay(game("carriere", "cul-3"));
    const m = startMeeting(s, "culture_n1")!;
    const first = quizById(ids(m)[0])!;
    answer(s, m.id, false);
    expect(m.done).toBe(false);
    expect(m.nodeId).toBe("q1");
    answer(s, m.id, true);
    expect(ids(m).length).toBe(3); // une question de rattrapage a été ajoutée
    const fu = quizById(ids(m)[2])!;
    expect(fu.id).not.toBe(first.id);
    if (!fu.id.startsWith("g:")) expect(fu.level).toBeLessThanOrEqual(Math.max(1, first.level));
    expect(m.nodeId).toBe("q2");
    // la correction est dite par le responsable, ✘ puis ✔
    const corr = m.log.filter((l) => l.who === s.npcs.boss.name && /^[✔✘]/.test(l.text));
    expect(corr.map((l) => l.text[0])).toEqual(["✘", "✔"]);
    answer(s, m.id, true);
    expect(m.done).toBe(true);
    expect(m.vars.asked).toBe(3);
    expect(m.outcome).toMatch(/2 bonnes réponses sur 3/);
  });

  it("jamais plus de 5 questions : cinq mauvaises réponses terminent le point, bases à retravailler, confiance en baisse", () => {
    const s = workDay(game("carriere", "cul-4"));
    const trust0 = s.npcs.boss.trust;
    const m = startMeeting(s, "culture_n1")!;
    for (let i = 0; i < 5; i++) { expect(m.done).toBe(false); answer(s, m.id, false); }
    expect(m.done).toBe(true);
    expect(m.vars.asked).toBe(5);
    expect(ids(m).length).toBe(5);
    expect(new Set(ids(m)).size).toBe(5);
    expect(m.outcome).toMatch(/0 bonne réponse sur 5 questions · bases à retravailler/);
    expect(s.npcs.boss.trust).toBeLessThan(trust0);
    expect(m.vars.failed).toBeUndefined(); // se tromper ne fait pas échouer la réunion
  });

  it("choix = réponses de la question ; mode oral : les réponses sont lues ; correction dite par le responsable", () => {
    const s = workDay(game("carriere", "cul-5"));
    const m = startMeeting(s, "culture_n1")!;
    const q = quizById(ids(m)[0])!;
    expect(meetingChoices(s, m).map((c) => c.label)).toEqual(q.options);
    const v = meetingView(s, m) as { readChoices: boolean; log: { who: string; text: string }[] };
    expect(v.readChoices).toBe(true);
    expect(v.log[0].who).toBe(s.npcs.boss.name);
    expect(v.log[0].text).toMatch(/Point culture du jour/);
    expect(v.log[0].text).toContain(q.q);
  });

  it("les bases d'abord : la question de culture du jour monte en niveau (1, puis 2, puis 3) tant que tout est réussi", () => {
    const s = game("carriere", "cul-6");
    const levels: number[] = [];
    for (let d = 0; d < 160; d++) {
      const t = quizToday(s);
      const id = t.ids[0];
      levels.push(quizById(id)!.level);
      for (const x of t.ids) answerQuiz(s, x, quizById(x)!.correct);
      s.t += 1440;
    }
    for (let i = 1; i < levels.length; i++) expect(levels[i]).toBeGreaterThanOrEqual(levels[i - 1]);
    expect(levels[0]).toBe(1);
    expect(levels.filter((l) => l === 1).length).toBeGreaterThan(30);
  });
});
