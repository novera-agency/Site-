import { describe, it, expect } from "vitest";
import { game, profile } from "./helpers";
import { EPOCH_UTC, useEpoch } from "@/engine/time";
import { REQUESTS } from "@/engine/clientRequests";
import { createMission, answerMission } from "@/engine/missions";
import { lifeChoice } from "@/engine/life";
import { maybeWorldEvent } from "@/engine/worldEvents";
import { advanceBudget, createGame } from "@/engine/engine";
import { histDaily } from "@/engine/historical";
import { Rng } from "@/engine/rng";
import { trialBalance } from "@/engine/ledger";

describe("Contenu supplémentaire", () => {
  it("25 demandes clients différentes, chacune avec une bonne réponse et des formulations variées", () => {
    expect(REQUESTS.length).toBeGreaterThanOrEqual(25);
    expect(new Set(REQUESTS.map((r) => r.id)).size).toBe(REQUESTS.length);
    for (const r of REQUESTS) {
      expect(r.choices.some((c) => c.q === "bon")).toBe(true);
      expect(r.intro.length).toBeGreaterThanOrEqual(2);
      if (r.collect) expect(r.intro.every((x) => x.includes("{amount}"))).toBe(true);
    }
  });
  it("nouvelles missions du jour : bonnes réponses validées (or en euros, capitalisation, intérêts composés, titre de la semaine)", () => {
    const s = game("carriere", "contenu-1");
    for (const id of ["d_or_eur", "d_capi", "d_interets", "d_semaine"]) {
      const m = createMission(s, id, {}, undefined, { daily: true, quiet: true });
      expect(m, id).toBeTruthy();
      let input: { value?: number; choice?: number };
      if (id === "d_or_eur") input = { value: Number(m!.params.g) / Number(m!.params.r) };
      else if (id === "d_capi") input = { value: Number(m!.params.a) };
      else if (id === "d_interets") input = { value: Number(m!.params.cap) * Math.pow(1 + Number(m!.params.rate) / 100, Number(m!.params.years)) };
      else input = { choice: Number(m!.params.c) };
      const r = answerMission(s, m!.id, input);
      expect(r.ok && r.message.startsWith("✔"), `${id} : ${r.ok ? r.message : r.error}`).toBe(true);
    }
  });
  it("nouveaux événements de vie : coûts payés, animal ajouté aux factures, comptabilité équilibrée", () => {
    const s = game("carriere", "contenu-2");
    const before = s.life!.fun;
    expect(lifeChoice(s, "voyage_derniere", "go")).toMatch(/soleil/);
    expect(s.life!.fun).toBeGreaterThan(before);
    lifeChoice(s, "adoption", "go");
    expect(s.life!.pets).toBe(1);
    for (const ev of ["concert", "parent_malade", "marathon", "benevolat"]) for (const c of ["go", "no"]) expect(lifeChoice(s, ev, c).length).toBeGreaterThan(0);
    for (const v of Object.values(trialBalance(s))) expect(v).toBe(0);
  });
  it("26 événements mondiaux simulés, sans répétition rapprochée", () => {
    const s = game("bac_a_sable", "contenu-3");
    const rng = new Rng(s.rng);
    const seen: string[] = [];
    for (let d = 0; d < 3000; d++) {
      s.t += 1440;
      const n = s.news.length;
      maybeWorldEvent(s, rng);
      if (s.news.length > n) seen.push(s.news[0].title);
    }
    expect(seen.length).toBeGreaterThan(20);
    for (let i = 1; i < seen.length; i++) expect(seen.slice(Math.max(0, i - 6), i)).not.toContain(seen[i]);
    expect(new Set(seen).size).toBeGreaterThan(18);
  });
  it("calcul limité dans le temps : le moteur s'arrête au budget au lieu de figer l'écran", () => {
    const s = game("carriere", "contenu-4");
    s.paused = false;
    const t0 = performance.now();
    const n = advanceBudget(s, 3 * 1440, 50);
    const dt = performance.now() - t0;
    expect(n).toBeGreaterThan(0);
    expect(n).toBeLessThan(3 * 288);
    expect(dt).toBeLessThan(1500);
  });
  it("mode historique : prévenu un mois avant la fin des données réelles, puis message d'entrée dans le futur", () => {
    const s = createGame({ ownerId: "u", mode: "carriere", difficulty: "normal", seed: "contenu-5", profile, bankId: "lutece", track: "trader", startingCapital: 10000, historical: true });
    useEpoch(s);
    const at = (iso: string) => (Date.parse(iso + "T08:00:00Z") - EPOCH_UTC) / 60000;
    s.t = at("2026-10-20");
    histDaily(s, () => undefined);
    expect(s.notifications.some((n) => n.title.includes("Dans un mois"))).toBe(true);
    s.t = at("2026-11-16");
    histDaily(s, () => undefined);
    expect(s.messages.some((m) => m.subject.includes("futur"))).toBe(true);
  });
});
