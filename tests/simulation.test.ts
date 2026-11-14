import { describe, it, expect } from "vitest";
import { game, cash } from "./helpers";
import { advance, step, createGame } from "@/engine/engine";
import { setRegime } from "@/engine/macro";
import { startCrisis, stepCrises } from "@/engine/crisis";
import { isBalanced } from "@/engine/ledger";
import { serialize, deserialize } from "@/server/store";
import { Rng } from "@/engine/rng";
import { dayIndex, MIN_PER_DAY, tOfDay, nextBusinessDay } from "@/engine/time";
import type { GameState } from "@/engine/types";

const fingerprint = (s: GameState) => JSON.stringify({ t: s.t, q: Object.fromEntries(Object.entries(s.quotes).map(([k, q]) => [k, q.price])), b: s.balances, rng: s.rng, regime: s.macro.regime, news: s.news.map((n) => n.title) });
const run = (s: GameState, minutes: number, chunk: number) => { s.paused = false; s.settings.autoPauseImportant = false; let done = 0; while (done < minutes) { advance(s, Math.min(chunk, minutes - done)); done += Math.min(chunk, minutes - done); } };

describe("Horloge et moteur", () => {
  it("Pause : le temps simulé ne progresse pas", () => {
    const s = game(); s.paused = true;
    const t0 = s.t;
    expect(advance(s, 600)).toBe(0);
    expect(s.t).toBe(t0);
  });
  it("Accélération : le résultat ne dépend pas de la vitesse (pas fixes)", () => {
    const a = game("bac_a_sable", "vitesse"), b = game("bac_a_sable", "vitesse");
    run(a, 3 * 1440, 5);      // x1 : petits incréments
    run(b, 3 * 1440, 500);    // x100 : gros incréments
    expect(fingerprint(a)).toBe(fingerprint(b));
  });
  it("Reproductibilité : même graine + mêmes décisions = même monde", () => {
    const a = game("bac_a_sable", "repro"), b = game("bac_a_sable", "repro"), c = game("bac_a_sable", "autre");
    run(a, 2 * 1440, 60); run(b, 2 * 1440, 60); run(c, 2 * 1440, 60);
    expect(fingerprint(a)).toBe(fingerprint(b));
    expect(fingerprint(a)).not.toBe(fingerprint(c));
  });
  it("Les marchés évoluent sans intervention et restent cohérents", () => {
    const s = game("bac_a_sable", "evol");
    const p0 = s.quotes["MAIS"].price;
    run(s, 2 * 1440, 120);
    expect(s.quotes["MAIS"].price).not.toBe(p0);
    for (const q of Object.values(s.quotes)) { expect(Number.isFinite(q.price)).toBe(true); expect(q.price).toBeGreaterThan(0); }
    expect(isBalanced(s)).toBe(true);
  });
  it("Événement planifié : décision de banque centrale publiée au calendrier", () => {
    const s = game("bac_a_sable", "bc");
    const z = s.macro.zones.US;
    const target = tOfDay(z.nextCbDay, 20, 30);
    run(s, target - s.t, 1440);
    const ev = s.calendar.find((e) => e.kind === "banque_centrale" && e.ref === "US" && e.done);
    expect(ev).toBeTruthy();
    expect(ev!.actual).toMatch(/pb/);
    expect(s.news.some((n) => n.category === "banques_centrales")).toBe(true);
  });
  it("Changement de régime et krach : chute des actifs risqués", () => {
    const s = game("bac_a_sable", "krach");
    s.t = tOfDay(nextBusinessDay(dayIndex(s.t)), 9, 55);
    const idx0 = s.quotes["IDX-EU"].price;
    setRegime(s, "volatil");
    expect(s.macro.regime).toBe("volatil");
    const c = startCrisis(s, "krach", new Rng(s.rng));
    c.phaseSinceT -= 4 * MIN_PER_DAY; // signaux faibles écoulés
    s.t = tOfDay(dayIndex(s.t), 10, 0);
    stepCrises(s, new Rng(s.rng));
    expect(c.phase).toBe(1);
    expect(s.macro.regime).toBe("crise");
    s.paused = false; s.settings.autoPauseImportant = false;
    for (let i = 0; i < 60; i++) step(s);
    expect(s.quotes["IDX-EU"].price).toBeLessThan(idx0 * 0.97);
  });
  it("Sauvegarde puis rechargement : la simulation reprend à l'identique", () => {
    const a = game("carriere", "save");
    run(a, 1440, 300);
    const copy = deserialize(serialize(a));
    expect(copy.t).toBe(a.t);
    expect(cash(copy)).toBe(cash(a));
    expect(Object.keys(copy.quotes).length).toBe(Object.keys(a.quotes).length);
    run(a, 1440, 300); run(copy, 1440, 300);
    const pa = a.quotes["MAIS"].price, pc = copy.quotes["MAIS"].price;
    expect(Math.abs(pa / pc - 1)).toBeLessThan(1e-3); // séries compactées à 4 décimales, dynamique identique
    expect(copy.macro.regime).toBe(a.macro.regime);
  });
  it("Mode carrière : création cohérente (comptes séparés, desk, clients, agenda)", () => {
    const s = createGame({ ownerId: "u", mode: "carriere", difficulty: "debutant", seed: "car", profile: { firstName: "A", lastName: "B", nationality: "FR", age: 22, education: "Licence", knowledge: "debutant", goal: "", specialization: "", riskProfile: "prudent" }, bankId: "lutece", track: "trader", startingCapital: 10000 });
    expect(cash(s)).toBe(10000);
    expect(s.accounts.desk.capitalAllocated! / 100).toBeGreaterThan(1e6);
    expect(s.clients.length).toBeGreaterThanOrEqual(2);
    expect(s.agenda.some((a) => a.meetingTemplate === "accueil")).toBe(true);
    expect(s.settings.allowShort).toBe(false);
    expect(isBalanced(s)).toBe(true);
  });
});
