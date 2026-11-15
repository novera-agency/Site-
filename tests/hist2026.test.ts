import { describe, it, expect } from "vitest";
import { profile } from "./helpers";
import { createGame, advance } from "@/engine/engine";
import { EPOCH_UTC, useEpoch } from "@/engine/time";
import { seriesAt, histActive } from "@/engine/historical";
import { trialBalance } from "@/engine/ledger";

describe("Mode historique : fin 2026", () => {
  it("le moteur suit les repères d'avril 2026, bascule en simulation libre le 14 novembre sans valeur aberrante", async () => {
    const s = createGame({ ownerId: "u", mode: "bac_a_sable", difficulty: "normal", seed: "h26", profile, bankId: "lutece", track: "trader", startingCapital: 10000, historical: true });
    useEpoch(s);
    const at = (iso: string) => (Date.parse(iso + "T07:00:00Z") - EPOCH_UTC) / 60000;
    const run = async (days: number) => { s.paused = false; for (let d = 0; d < days; d++) { advance(s, 1440); s.paused = false; await new Promise((r) => setImmediate(r)); } };
    s.t = at("2026-03-25");
    await run(22); // jusqu'au 16 avril : le S&P 500 repasse au-dessus de 7 000
    const a = (iso: string) => Date.parse(iso + "T12:00:00Z") / 86400000;
    const target = seriesAt("EQ_US", EPOCH_UTC / 86400000 + s.t / 1440);
    const px = s.quotes["IDX-US5"].price;
    expect(histActive(s)).toBe(true);
    expect(target).toBeGreaterThan(6900);
    expect(px / target).toBeGreaterThan(0.8); expect(px / target).toBeLessThan(1.2);
    expect(Number.isFinite(s.macro.fxLog.EUR)).toBe(true);
    // Bascule : 8 jours avant la fin, puis 6 jours après
    s.t = at("2026-11-08");
    await run(10);
    expect(histActive(s)).toBe(false);
    expect(s.flags["histEnded"]).toBe(true);
    expect(s.messages.some((m) => m.subject.includes("futur"))).toBe(true);
    for (const q of Object.values(s.quotes)) expect(Number.isFinite(q.price) && q.price > 0).toBe(true);
    for (const v of Object.values(trialBalance(s))) expect(v).toBe(0);
    void a;
  }, 180000);
});
