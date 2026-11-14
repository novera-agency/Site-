import { describe, it, expect } from "vitest";
import { createGame, advance } from "@/engine/engine";
import { isBalanced, trialBalance } from "@/engine/ledger";
import { accountEquity } from "@/engine/portfolio";
import { placeOrder } from "@/engine/orders";
import { startMeeting } from "@/engine/meetingEngine";

const profile = { firstName: "Alex", lastName: "Martin", nationality: "Française", age: 24, education: "Master finance", knowledge: "etudiant" as const, goal: "Devenir MD", specialization: "Marchés", riskProfile: "equilibre" as const };
describe("smoke", () => {
  it("crée une partie et simule", () => {
    const t0 = Date.now();
    const s = createGame({ ownerId: "u", mode: "carriere", difficulty: "normal", seed: "abc", profile, bankId: "lutece", track: "trader", startingCapital: 10000 });
    console.log("create ms", Date.now() - t0, "instruments", Object.keys(s.instruments).length, "json KB", Math.round(JSON.stringify(s).length / 1024));
    expect(isBalanced(s)).toBe(true);
    expect(Math.round(accountEquity(s, "perso"))).toBe(10000);
    s.paused = false;
    const t1 = Date.now();
    // traiter les réunions au fil de l'eau : on ignore (pause automatique), on force la reprise
    let total = 0;
    for (let i = 0; i < 300 && total < 288 * 10; i++) { const n = advance(s, 600); total += n; if (s.paused) { s.paused = false; s.activeMeetingId = undefined; delete s.flags["pendingMeeting"]; } }
    console.log("sim 10 days ms", Date.now() - t1, "steps", total);
    console.log(Object.entries(s.quotes).slice(0, 8).map(([k, q]) => `${k}:${q.price.toFixed(2)}`).join(" "));
    console.log("news", s.news.length, s.news.slice(0, 5).map((n) => n.title));
    console.log("trial", trialBalance(s));
    expect(isBalanced(s)).toBe(true);
    const r = placeOrder(s, { account: "perso", instrumentId: "XWLD", side: "buy", type: "market", qty: 10 });
    console.log(r.ok ? r.message : r.error);
    expect(isBalanced(s)).toBe(true);
    const m = startMeeting(s, "desk_quotidien");
    expect(m).toBeTruthy();
  });
});
