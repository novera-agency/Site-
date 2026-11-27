import { describe, it, expect } from "vitest";
import { game } from "./helpers";
import { advance } from "@/engine/engine";
import { createMission, answerMission, missionQuestion, missionGuide, checkMissions, missionTemplate } from "@/engine/missions";
import { BANK, BANK_CALC, BANK_ACTION, BANK_CTX, FAM_BY_KEY } from "@/engine/missionBank";
import { Rng, seedRng } from "@/engine/rng";
import { assignDailyMissions } from "@/engine/missions";
import { dayIndex, nextBusinessDay, MIN_PER_DAY } from "@/engine/time";

describe("Banque de missions de pratique", () => {
  it("contient plus de 500 modèles distincts, aux identifiants et titres uniques", () => {
    expect(BANK.length).toBeGreaterThanOrEqual(500);
    expect(new Set(BANK.map((t) => t.id)).size).toBe(BANK.length);
    const s = game("carriere", "bank-1");
    const titles = new Set<string>();
    for (const t of BANK) { const made = t.make(s, { k: 1 }, new Rng(seedRng("t" + t.id))); if (made) titles.add(made.title); }
    expect(titles.size).toBeGreaterThanOrEqual(480); // les missions de situation ne se proposent que si la situation existe
    expect(BANK_CTX.length).toBe(19);
    expect(BANK_CALC.length).toBe(Object.keys(FAM_BY_KEY).length * 8);
    expect(Object.keys(FAM_BY_KEY).length).toBe(66);
    expect(BANK_ACTION.length).toBeGreaterThanOrEqual(70);
  });

  it("chaque mission de calcul se résout : la bonne réponse réussit, une mauvaise échoue, la correction est donnée", () => {
    const s = game("carriere", "bank-calc");
    for (const [i, t] of BANK_CALC.entries()) {
      for (const good of [true, false]) {
        const m = createMission(s, t.id, { k: 1 + (i % 3) }, "boss");
        expect(m, t.id).toBeTruthy();
        expect(m!.description.length).toBeGreaterThan(40);
        expect(JSON.parse(JSON.stringify(m!.params))).toEqual(m!.params);
        const q = missionQuestion(s, m!)!;
        expect(q, t.id).toBeTruthy();
        const guide = missionGuide(s, m!); expect(guide.steps.length).toBeGreaterThan(0);
        const r = q.kind === "numeric"
          ? answerMission(s, m!.id, { value: (() => { const info = t.quiz!(s, m!); return good ? info.answer : info.answer + 50 * info.tolerance + 7; })() })
          : answerMission(s, m!.id, { choice: (() => { const info = t.choiceQuiz!(s, m!); return good ? info.correct : (info.correct + 1) % info.options.length; })() });
        expect(r.ok, t.id).toBe(true);
        expect(m!.status, `${t.id} ${good}`).toBe(good ? "reussie" : "echouee");
        if (r.ok) expect((r as { message: string }).message.length).toBeGreaterThan(8);
      }
    }
  });

  it("les chiffres changent d'une attribution à l'autre", () => {
    const s = game("carriere", "bank-var");
    const seen = new Set<string>();
    for (let i = 0; i < 12; i++) { const m = createMission(s, "p_int_compose_2", { k: 1 }, "boss"); seen.add(m!.description); m!.status = "echouee"; }
    expect(seen.size).toBeGreaterThanOrEqual(8);
  });

  it("les missions d'action se créent, se vérifient sans erreur et ne se valident pas toutes seules", () => {
    const s = game("carriere", "bank-act");
    let made = 0;
    for (const t of BANK_ACTION) {
      const m = createMission(s, t.id, { k: 1 }, "boss");
      if (!m) continue; made++;
      const p = t.check(s, m);
      expect(p, t.id).toBeGreaterThanOrEqual(-1); expect(p).toBeLessThanOrEqual(1);
    }
    expect(made).toBeGreaterThanOrEqual(70);
    checkMissions(s);
  });

  it("une action réelle valide la mission : acheter une valeur du secteur demandé", () => {
    const s = game("carriere", "bank-buy");
    const m = createMission(s, "a_classe_achat_etf", { k: 1 }, "boss")!;
    expect(m.status).toBe("active");
    const etf = Object.values(s.instruments).find((d) => d.cls === "etf")!;
    s.fills.push({ id: "f1", orderId: "o-none", account: "perso", instrumentId: etf.id, side: "buy", qty: 10, price: 100, fees: 0, t: s.t + 1, slippageBps: 0, realized: 0 });
    checkMissions(s);
    expect(m.status).toBe("reussie");
  });

  it("au fil des semaines, les missions du jour sont très variées et surtout pratiques", () => {
    const s = game("carriere", "bank-days"); const rng = new Rng(s.rng);
    const all: string[] = [];
    for (let d = 0; d < 45; d++) {
      s.t = nextBusinessDay(dayIndex(s.t) + 1) * MIN_PER_DAY + 1;
      const before = new Set(s.missions.map((m) => m.id));
      assignDailyMissions(s, rng);
      for (const m of s.missions) if (!before.has(m.id)) { all.push(m.templateId); m.status = "echouee"; }
    }
    const bank = all.filter((id) => id.startsWith("p_") || id.startsWith("a_"));
    expect(all.length).toBeGreaterThanOrEqual(90);
    expect(new Set(all).size).toBeGreaterThanOrEqual(Math.floor(all.length * 0.9)); // presque aucune répétition
    expect(bank.length / all.length).toBeGreaterThan(0.7);
    expect(all.every((id) => !!missionTemplate(id))).toBe(true);
  });
});

describe("Missions de situation (nées de l'état de la partie)", () => {
  it("chaque modèle renvoie null sans situation, et se résout sur les chiffres du moment quand elle existe", () => {
    const s = game("carriere", "ctx-1"); const rng = new Rng(seedRng("ctx"));
    s.crises = []; s.news = [];
    const withoutCrisis = BANK_CTX.filter((t) => t.make(s, { k: 1 }, rng) === null).map((t) => t.id);
    expect(withoutCrisis).toEqual(expect.arrayContaining(["c_crise_var", "c_crise_expo", "c_crise_choix", "c_news_signe"]));
    s.crises.push({ id: "cr1", kind: "krach", phase: 2, phaseSinceT: s.t, startT: s.t, severity: 2, resolved: false, log: [] } as never);
    s.news.push({ id: "n1", t: s.t - 60, category: "entreprises", title: "Résultats record", body: "Très bons chiffres.", impact: "fort", tickers: ["MAIS"], zones: [], sentiment: 0.7 } as never);
    let ok = 0;
    for (const t of BANK_CTX) {
      const m = createMission(s, t.id, { k: 1 }, "boss");
      if (!m) continue; ok++;
      const q = missionQuestion(s, m);
      if (t.quiz) { const info = t.quiz(s, m); expect(answerMission(s, m.id, { value: info.answer }).ok).toBe(true); expect(m.status, t.id).toBe("reussie"); }
      else if (t.choiceQuiz) { const info = t.choiceQuiz(s, m); expect(q).toBeTruthy(); answerMission(s, m.id, { choice: info.correct }); expect(m.status, t.id).toBe("reussie"); }
      else expect(t.check(s, m)).toBeGreaterThanOrEqual(0);
    }
    expect(ok).toBeGreaterThanOrEqual(14);
  });
});

import { atEuOpen } from "./helpers";
import { applyAction } from "@/server/actions";

describe("Missions d'action jouées pour de vrai (ordres réels, exécutés par le moteur)", () => {
  it("acheter un ETF, des actions d'un secteur, placer un ordre limité et un stop valident les missions correspondantes", () => {
    const s = atEuOpen(game("carriere", "bank-real")); s.paused = false;
    const eur = Object.values(s.instruments).filter((d) => d.cls === "action" && !d.lite && d.currency === "EUR" && d.sector && !s.quotes[d.id].halted);
    const sector = eur[0].sector!; const stocks = eur.filter((d) => d.sector === sector).slice(0, 3);
    const ids = ["a_classe_achat_etf", `a_secteur_${sector}`, "a_ordre_limite", "a_ordre_stop", "a_lignes_3", "a_taille_0", "a_classes_2"];
    const ms = ids.map((id) => createMission(s, id, { k: 1 }, "boss")).filter(Boolean) as ReturnType<typeof createMission>[];
    expect(ms.length).toBe(ids.length);
    const order = (inst: string, side: "buy" | "sell", type: string, qty: number, extra: object = {}) => applyAction(s, { type: "order", account: "perso", instrumentId: inst, side, orderType: type, qty, duration: "jour", ...extra } as never);
    const etf = Object.values(s.instruments).find((d) => d.cls === "etf" && !d.lite)!;
    expect(order(etf.id, "buy", "market", 20).ok).toBe(true);
    for (const d of stocks) expect(order(d.id, "buy", "market", Math.max(1, Math.round(1500 / s.quotes[d.id].price))).ok).toBe(true);
    const px = s.quotes[etf.id].price;
    expect(order(etf.id, "buy", "limit", 1, { limit: Math.round(px * 0.9 * 100) / 100 }).ok).toBe(true);
    expect(order(etf.id, "sell", "stop", 1, { stop: Math.round(px * 0.8 * 100) / 100 }).ok).toBe(true);
    advance(s, 30); checkMissions(s);
    const done = Object.fromEntries(ms.map((m) => [m!.templateId, m!.status]));
    for (const id of ["a_classe_achat_etf", `a_secteur_${sector}`, "a_ordre_limite", "a_ordre_stop", "a_lignes_3", "a_classes_2"]) expect(done[id], `${id} → ${JSON.stringify(done)}`).toBe("reussie");
  });
});
