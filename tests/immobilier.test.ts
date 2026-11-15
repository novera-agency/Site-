import { describe, it, expect } from "vitest";
import { game, cash } from "./helpers";
import { applyAction } from "@/server/actions";
import { listings, rentProbability, saleProbability, marketRent, marketValue, dailyRealEstate, monthlyRealEstate, CITIES } from "@/engine/realestate";
import { Rng } from "@/engine/rng";
import { isBalanced } from "@/engine/ledger";
import { MIN_PER_DAY, dayIndex, nextBusinessDay } from "@/engine/time";

const act = (s: ReturnType<typeof game>, a: object) => applyAction(s, a as never);

describe("Investissement immobilier", () => {
  it("13 villes, annonces mensuelles, rendement plus élevé à Saint-Étienne qu'à Paris", () => {
    const s = game("carriere", "re-1");
    expect(CITIES.length).toBe(13);
    expect(listings(s, "paris").length).toBe(4);
    const y = (id: string) => { const l = listings(s, id)[0]; const p = { ...l, id: "", buyPrice: 0, buyT: 0, status: "vacant" as const }; return marketRent(s, p) * 12 / marketValue(s, p); };
    expect(y("saint-etienne")).toBeGreaterThan(y("paris") * 1.6);
  });

  it("achat comptant, loyer trop cher → personne ; loyer de marché → locataire ; loyers et charges chaque mois", () => {
    const s = game("carriere", "re-2", 400000);
    const li = listings(s, "toulouse").find((x) => x.dpe !== "G")!;
    expect(act(s, { type: "re_buy", listing: li.id, credit: false }).ok).toBe(true);
    expect(listings(s, "toulouse").some((x) => x.id === li.id)).toBe(false); // l'annonce disparaît
    const p = s.life!.properties![0];
    const mr = marketRent(s, p);
    expect(rentProbability(s, p, mr * 1.4)).toBe(0);
    expect(rentProbability(s, p, mr * 0.7)).toBeLessThan(1); // même bradé, la demande de la ville limite
    expect(act(s, { type: "re_rent", id: p.id, rent: Math.round(mr * 1.4) }).ok).toBe(true);
    const rng = new Rng(s.rng);
    for (let d = 0; d < 60; d++) { s.t = nextBusinessDay(dayIndex(s.t) + 1) * MIN_PER_DAY + 600; dailyRealEstate(s, rng); }
    expect(p.status).toBe("en_location");
    act(s, { type: "re_rent", id: p.id, rent: mr });
    for (let d = 0; d < 120 && p.status !== "loue"; d++) { s.t = nextBusinessDay(dayIndex(s.t) + 1) * MIN_PER_DAY + 600; dailyRealEstate(s, rng); }
    expect(p.status).toBe("loue");
    const c0 = cash(s);
    monthlyRealEstate(s, rng);
    expect(cash(s)).not.toBe(c0);
    expect(isBalanced(s)).toBe(true);
  });

  it("encadrement des loyers à Paris ; passoire thermique interdite à la location", () => {
    const s = game("carriere", "re-3", 2_000_000);
    const li = listings(s, "paris")[0];
    act(s, { type: "re_buy", listing: li.id, credit: false });
    const p = s.life!.properties![0];
    const r = act(s, { type: "re_rent", id: p.id, rent: Math.round(marketRent(s, p) * 1.2) }) as { ok: boolean; error?: string };
    expect(r.ok).toBe(false); expect(r.error).toMatch(/Encadrement/);
    p.dpe = "G";
    expect((act(s, { type: "re_rent", id: p.id, rent: 500 }) as { error?: string }).error).toMatch(/interdit/);
  });

  it("vente : trop cher, invendable ; au prix du marché, vendue avec plus-value imposée", () => {
    const s = game("carriere", "re-4", 400000);
    const li = listings(s, "nantes")[0];
    act(s, { type: "re_buy", listing: li.id, credit: false });
    const p = s.life!.properties![0];
    expect(saleProbability(s, p, marketValue(s, p) * 1.3)).toBe(0);
    act(s, { type: "re_sell", id: p.id, price: Math.round(marketValue(s, p) * 0.95) });
    const rng = new Rng(s.rng);
    const c0 = cash(s);
    for (let d = 0; d < 200 && s.life!.properties!.length; d++) { s.t = nextBusinessDay(dayIndex(s.t) + 1) * MIN_PER_DAY + 600; dailyRealEstate(s, rng); }
    expect(s.life!.properties!.length).toBe(0);
    expect(cash(s)).toBeGreaterThan(c0);
  });

  it("achat à crédit refusé si l'endettement dépasse 35 %", () => {
    const s = game("carriere", "re-5", 300000);
    s.career.salaryAnnual = 3_000_000; // 30 000 € brut
    const li = listings(s, "paris")[0];
    const r = act(s, { type: "re_buy", listing: li.id, credit: true }) as { ok: boolean; error?: string };
    expect(r.ok).toBe(false); expect(r.error).toMatch(/35 %/);
  });
});
