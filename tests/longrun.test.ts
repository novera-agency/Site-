import { it, expect } from "vitest";
import { createGame, advance } from "@/engine/engine";
import { isBalanced } from "@/engine/ledger";
const profile = { firstName: "A", lastName: "B", nationality: "FR", age: 24, education: "M", knowledge: "etudiant" as const, goal: "", specialization: "", riskProfile: "equilibre" as const };
it("simulation longue cohérente (120 jours)", () => {
  const s = createGame({ ownerId: "u", mode: "carriere", difficulty: "normal", seed: "long1", profile, bankId: "lutece", track: "trader", startingCapital: 10000 });
  const p0: Record<string, number> = {}; for (const [k, q] of Object.entries(s.quotes)) p0[k] = q.price;
  s.paused = false;
  let total = 0;
  const t = Date.now();
  while (total < 288 * 120) { total += advance(s, 3000); if (s.paused) { s.paused = false; s.activeMeetingId = undefined; delete s.flags["pendingMeeting"]; } }
  console.log("ms", Date.now() - t, "KB", Math.round(JSON.stringify(s).length / 1024));
  const ch = Object.entries(s.quotes).filter(([k]) => p0[k]).map(([k, q]) => [k, q.price / p0[k] - 1] as [string, number]).sort((a, b) => a[1] - b[1]);
  console.log("worst", ch.slice(0, 5).map(([k, v]) => `${k} ${(v * 100).toFixed(0)}%`).join(", "));
  console.log("best", ch.slice(-5).map(([k, v]) => `${k} ${(v * 100).toFixed(0)}%`).join(", "));
  console.log("regimes", s.macro.regimeHistory.map((r) => r.regime).join(">"));
  console.log("crises", s.crises.map((c) => `${c.kind}:${c.phase}:${c.resolved}`).join(", "));
  console.log("zones", Object.values(s.macro.zones).map((z) => `${z.id} g${z.growth.toFixed(1)} i${z.inflation.toFixed(1)} r${z.policyRate} y10 ${z.y10.toFixed(2)}`).join(" | "));
  console.log("idx", s.quotes["IDX-EU"].price.toFixed(0), s.quotes["IDX-US"].price.toFixed(0), "EURUSD", s.quotes.EURUSD.price.toFixed(4), "news", s.news.length, "missions", s.missions.length, "msgs", s.messages.length);
  console.log("RV", ["MAIS", "NOVX", "XWLD", "EURUSD", "BRENT", "AURC"].map((k) => `${k} ${(s.quotes[k].rv * 100).toFixed(0)}%`).join(" "));
  expect(isBalanced(s)).toBe(true);
});
