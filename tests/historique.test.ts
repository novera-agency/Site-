import { describe, it, expect } from "vitest";
import { createGame, advance } from "@/engine/engine";
import { profile, game } from "./helpers";
import { fmtDate, MIN_PER_DAY, EPOCH_YEAR } from "@/engine/time";
import { seriesAtT } from "@/engine/historical";
import { serialize, deserialize } from "@/engine/serialize";
import { isBalanced } from "@/engine/ledger";

const hist = (seed = "hist") => createGame({ ownerId: "u", mode: "carriere", difficulty: "normal", seed, profile, bankId: "lutece", track: "trader", startingCapital: 10000, historical: true });

describe("Mode historique 2000", () => {
  it("démarre le lundi 3 janvier 2000 avec les conditions de marché de l'époque", () => {
    const s = hist();
    expect(s.epochYear).toBe(2000);
    expect(fmtDate(s.t)).toBe("lundi 3 janvier 2000");
    expect(s.macro.zones.US.policyRate).toBe(5.5);
    expect(s.macro.zones.EZ.policyRate).toBe(3);
    expect(s.macro.zones.US.cbName).toBe("Réserve fédérale américaine");
    expect(s.quotes["EURUSD"].price).toBeGreaterThan(0.98); expect(s.quotes["EURUSD"].price).toBeLessThan(1.03);
    expect(s.quotes["GOLD"].price).toBeGreaterThan(270); expect(s.quotes["GOLD"].price).toBeLessThan(300);
    expect(Math.abs(s.quotes["IDX-US"].price / 1469 - 1)).toBeLessThan(0.05);
    expect(s.quotes["AURC"].halted).toBe(true); // les cryptoactifs n'existent pas encore
    expect(s.instruments["LUTB30"].name).toMatch(/2003/);
    expect(s.news[0].title).toMatch(/2000/);
    expect(s.quotes["IDX-US"].daily.length).toBeGreaterThan(200); // historique 1999 reconstitué
  });

  it("suit la chronologie : krach Internet, décisions réelles de la Fed, indices proches de leurs trajectoires", () => {
    const s = hist("hist-run");
    s.settings.autoPauseImportant = false;
    let guard = 0;
    while (s.t < 140 * MIN_PER_DAY && guard++ < 1000) { s.paused = false; if (s.activeMeetingId) { for (const m of s.meetings) m.done = true; s.activeMeetingId = undefined; } advance(s, 1440); }
    expect(fmtDate(s.t, false)).toMatch(/mai 2000/);
    expect(s.macro.zones.US.policyRate).toBe(6.5); // hausse du 16 mai 2000
    expect(s.news.some((n) => n.title.includes("Nasdaq"))).toBe(true);
    expect(s.news.some((n) => n.title.includes("relève son taux directeur de 50 points de base"))).toBe(true);
    const gap = s.quotes["IDX-US"].price / seriesAtT("EQ_US", s.t) - 1;
    expect(Math.abs(gap)).toBeLessThan(0.12);
    expect(Math.abs(s.quotes["BRENT"].price / seriesAtT("BRENT", s.t) - 1)).toBeLessThan(0.2);
    expect(isBalanced(s)).toBe(true);
  }, 120000);

  it("la sauvegarde conserve l'époque ; une partie fictive reste en 2027", () => {
    const s = hist("hist-save");
    const txt = serialize(s);
    const f = game("bac_a_sable", "fictif");
    expect(EPOCH_YEAR).toBe(2027);
    expect(fmtDate(f.t)).toBe("lundi 4 janvier 2027");
    const back = deserialize(txt);
    expect(EPOCH_YEAR).toBe(2000);
    expect(fmtDate(back.t)).toBe("lundi 3 janvier 2000");
  });
});
