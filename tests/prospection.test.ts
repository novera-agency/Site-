import { describe, it, expect } from "vitest";
import { game, atEuOpen } from "./helpers";
import { startMeeting, answerMeeting } from "@/engine/meetingEngine";
import { assignProspects, addProspect } from "@/engine/prospects";
import { Rng } from "@/engine/rng";
import { applyAction } from "@/server/actions";
import { dayIndex, MIN_PER_DAY, weekday, tOfDay } from "@/engine/time";
import { isBalanced } from "@/engine/ledger";

const pick = (s: ReturnType<typeof game>, id: string, choice: string) => expect(answerMeeting(s, id, { choiceId: choice }).ok).toBe(true);
function monday(s: ReturnType<typeof game>) { let d = dayIndex(s.t) + 1; while (weekday(d * MIN_PER_DAY) !== 1) d++; s.t = tOfDay(d, 10, 0); }

describe("Prospection", () => {
  it("le lundi, le N+1 confie des prospects et l'annonce par message", () => {
    const s = game("carriere", "pros-1");
    monday(s);
    const m0 = s.messages.length;
    assignProspects(s, new Rng(s.rng));
    expect((s.prospects ?? []).length).toBeGreaterThanOrEqual(1);
    expect(s.messages.length).toBe(m0 + 1);
    expect(s.messages[0].subject).toMatch(/Prospection/);
  });
  it("bon démarchage : rendez-vous concluant, le prospect devient client avec un premier versement", () => {
    const s = atEuOpen(game("carriere", "pros-2"));
    const p = addProspect(s, new Rng(s.rng), { warm: true, kind: "particulier" })!;
    const n0 = s.clients.length;
    let won = false;
    for (let i = 0; i < 6 && !won; i++) {
      p.lastCallT = undefined;
      const r = applyAction(s, { type: "call_prospect", id: p.id } as never);
      expect(r.ok).toBe(true);
      const id = s.activeMeetingId!;
      const m = s.meetings.find((x) => x.id === id)!;
      if (!m.vars.pickup) { pick(s, id, "a"); continue; }
      pick(s, id, "a"); pick(s, id, "o0"); pick(s, id, "a"); pick(s, id, "a");
      won = p.status === "converti";
    }
    expect(won).toBe(true);
    expect(s.clients.length).toBe(n0 + 1);
    expect(isBalanced(s)).toBe(true);
  });
  it("démarchage agressif : le prospect refuse", () => {
    const s = atEuOpen(game("carriere", "pros-3"));
    const p = addProspect(s, new Rng(s.rng), { kind: "particulier" })!;
    for (let i = 0; i < 6 && p.status !== "refus"; i++) {
      p.lastCallT = undefined;
      applyAction(s, { type: "call_prospect", id: p.id } as never);
      const id = s.activeMeetingId!; const m = s.meetings.find((x) => x.id === id)!;
      if (!m.vars.pickup) { pick(s, id, "b"); continue; }
      pick(s, id, "b"); pick(s, id, "o1"); pick(s, id, "b"); pick(s, id, "c");
    }
    expect(p.status).toBe("refus");
  });
});
