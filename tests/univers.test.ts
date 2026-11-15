import { describe, it, expect } from "vitest";
import { game } from "./helpers";
import { serialize, deserialize } from "@/engine/serialize";
import { advance } from "@/engine/engine";
import { applyAction } from "@/server/actions";

describe("Univers étendu", () => {
  const s = game("bac_a_sable", "univers");
  it("plus de 1 000 actions fictives, tickers uniques, 13 pays et 12 secteurs", () => {
    const stocks = Object.values(s.instruments).filter((d) => d.cls === "action");
    expect(stocks.length).toBeGreaterThan(1000);
    expect(new Set(stocks.map((d) => d.id)).size).toBe(stocks.length);
    expect(new Set(stocks.map((d) => d.country)).size).toBe(13);
    expect(new Set(stocks.map((d) => d.sector)).size).toBe(12);
    for (const d of stocks) { expect(s.quotes[d.id].price).toBeGreaterThan(0); expect(Number.isFinite(s.quotes[d.id].price)).toBe(true); }
  });
  it("indices nationaux composés des plus grandes capitalisations", () => {
    expect(s.instruments["IDX-US5"].basket!.length).toBe(500);
    expect(s.instruments["IDX-FR"].basket!.length).toBe(40);
    expect(s.instruments["IDX-DE"].basket!.length).toBe(40);
    expect(s.instruments["IDX-UK"].basket!.length).toBe(100);
    expect(s.instruments["IDX-JP"].basket!.length).toBe(100);
    expect(Math.abs(s.quotes["IDX-FR"].price / 8000 - 1)).toBeLessThan(0.05);
  });
  it("une petite valeur s'achète, se suit et la sauvegarde reste compacte et fidèle", () => {
    const small = Object.values(s.instruments).find((d) => d.lite && d.currency === "EUR" && d.liquidity > 0.5)!;
    s.paused = false;
    advance(s, 60 * 3);
    const r = applyAction(s, { type: "order", account: "perso", instrumentId: small.id, side: "buy", orderType: "market", qty: 10, duration: "jour" } as never);
    expect(r.ok, r.error).toBe(true);
    const txt = serialize(s);
    expect(txt.length).toBeLessThan(5_000_000);
    const back = deserialize(txt);
    expect(Object.keys(back.instruments).length).toBe(Object.keys(s.instruments).length);
    expect(back.instruments[small.id].name).toBe(small.name);
    const lite2 = Object.values(s.instruments).find((d) => d.lite && d.id !== small.id && !s.watchlist.includes(d.id))!;
    expect(back.quotes[lite2.id].daily.length).toBe(s.quotes[lite2.id].daily.length);
    expect(Math.abs(back.quotes[lite2.id].daily.at(-1)!.c / s.quotes[lite2.id].daily.at(-1)!.c - 1)).toBeLessThan(1e-3);
  });
});
