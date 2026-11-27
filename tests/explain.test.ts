import { describe, it, expect } from "vitest";
import { game } from "./helpers";
import { annotate, termsIn, searchTerms, allTerms } from "@/engine/glossary";
import { createMission } from "@/engine/missions";
import { missionHelp } from "@/engine/missionHelp";
import { BANK_CALC, FAM_BY_KEY, famExamples, famPlain, famHint } from "@/engine/missionBank";

describe("Explications : tous les mots de métier sont explicables", () => {
  it("le texte est découpé en morceaux, les mots de métier portent leur définition (expressions longues, pluriels, accents)", () => {
    const segs = annotate("Un stop-loss à 95 € protège un portefeuille : le bêta et la valeur d'entreprise se calculent en points de base. Les intérêts composés rapportent.");
    const found = segs.filter((s) => s.def).map((s) => s.def!.term);
    for (const t of ["Stop-loss", "Portefeuille", "Bêta", "Valeur d'entreprise", "Point de base", "Intérêts composés"]) expect(found.join("|")).toContain(t);
    expect(segs.map((s) => s.text).join("")).toBe("Un stop-loss à 95 € protège un portefeuille : le bêta et la valeur d'entreprise se calculent en points de base. Les intérêts composés rapportent."); // rien n'est perdu ni déformé
  });
  it("une notion n'est soulignée qu'une fois par texte, mais toutes sont listées dans l'aide", () => {
    expect(annotate("Le put et le put").filter((s) => s.def).length).toBe(1);
    expect(termsIn(["Le put", "Le call et le put"]).map((t) => t.term).sort()).toEqual(["Call", "Put"].sort());
  });
  it("le vocabulaire de toutes les questions des missions de calcul est couvert", () => {
    const MUST = ["PER", "VaR", "bêta", "duration modifiée", "EBITDA", "strike", "put", "call", "levier", "dépôt de garantie", "stop-loss", "bid", "ask", "points de base", "spread", "volatilité annuelle", "Sharpe", "dividende", "obligation", "coupon", "zéro coupon", "taux sans risque", "valeur d'entreprise", "fonds propres", "résultat net", "chiffre d'affaires", "dette nette", "trésorerie", "capitalisation", "prime", "contrat", "multiplicateur", "inflation", "taux directeur", "courbe des taux", "VAN", "annuité", "intérêts composés", "intérêts simples", "rendement courant", "cours à terme", "cours croisé", "EURUSD", "position", "portefeuille", "vente à découvert", "valeur intrinsèque", "parité call-put", "taux annuel équivalent", "règle des 72", "prix de revient moyen", "ratio", "PEG", "ROE", "marge nette", "tolérance", "franchise", "sinistre", "actualisation", "emprunt", "épargne", "frais"];
    for (const w of MUST) { const s = annotate(`Question : ${w}.`); expect(s.some((x) => x.def), w).toBe(true); }
    for (const d of allTerms()) { expect(d.simple.length, d.term).toBeGreaterThan(20); expect(d.aliases.length, d.term).toBeGreaterThan(0); }
  });
  it("chaque type de problème a une explication simple, une formule et deux exemples résolus cohérents", () => {
    for (const key of Object.keys(FAM_BY_KEY)) {
      expect(famPlain(key)?.length, key).toBeGreaterThan(60); expect(famHint(key), key).toBeTruthy();
      const ex = famExamples(key, 2); expect(ex.length, key).toBe(2);
      for (const e of ex) { expect(e.question.length).toBeGreaterThan(20); expect(e.explain.length).toBeGreaterThan(8); expect(e.answer.length).toBeGreaterThan(0); }
      expect(JSON.stringify(ex[0])).not.toBe(JSON.stringify(ex[1]));
    }
  });
  it("l'aide d'une mission contient la question en mots simples, ses mots expliqués, la méthode et des exemples", () => {
    const s = game("carriere", "help-1");
    for (const t of BANK_CALC.slice(0, 60)) {
      const m = createMission(s, t.id, { k: 1 }, "boss")!;
      const h = missionHelp(s, m);
      expect(h.plain, t.id).toBeTruthy(); expect(h.formula).toBeTruthy(); expect(h.terms.length, t.id).toBeGreaterThan(0); expect(h.examples.length).toBe(2); expect(h.steps.length).toBeGreaterThan(0);
      m.status = "echouee";
    }
  });
  it("la recherche libre trouve un mot tapé, avec ou sans accent", () => {
    expect(searchTerms("beta")[0].term).toBe("Bêta");
    expect(searchTerms("franchise")[0].term).toBe("Franchise");
    expect(searchTerms("zzzzqq")).toEqual([]);
  });
});

import { assignDailyMissions, assignWeeklyMissions, completeMission, answerMission, practiceKey } from "@/engine/missions";
import { Rng } from "@/engine/rng";
import { dayIndex, nextBusinessDay, MIN_PER_DAY } from "@/engine/time";

describe("Pratique : suivi des points faibles et aide pour toutes les missions", () => {
  it("toutes les missions attribuées (du jour, de la semaine, de départ) ont une explication en mots simples", () => {
    const s = game("carriere", "plain-all"); const rng = new Rng(s.rng); const missing = new Set<string>();
    for (let d = 0; d < 40; d++) {
      s.t = nextBusinessDay(dayIndex(s.t) + 1) * MIN_PER_DAY + 1;
      assignDailyMissions(s, rng); if (d % 4 === 0) assignWeeklyMissions(s, rng);
    }
    let n = 0;
    for (const m of s.missions) { n++; const h = missionHelp(s, m); if (!h.plain) missing.add(m.templateId); }
    expect(n).toBeGreaterThan(60);
    expect([...missing]).toEqual([]);
  });
  it("chaque mission terminée alimente le bilan de pratique, par type de problème", () => {
    const s = game("carriere", "practice-1");
    const m = createMission(s, "p_roi_1", { k: 1 }, "boss")!;
    expect(practiceKey(m)).toBe("roi");
    completeMission(s, m, true);
    const m2 = createMission(s, "p_roi_2", { k: 1 }, "boss")!; completeMission(s, m2, false);
    expect(s.practice!["roi"]).toEqual({ ok: 1, ko: 1 });
    const a = createMission(s, "a_veille_6", { k: 1 }, "boss")!; completeMission(s, a, true);
    expect(s.practice!["~action"]).toEqual({ ok: 1, ko: 0 });
    void answerMission;
  });
  it("les types de problèmes ratés reviennent plus souvent que les maîtrisés", () => {
    const s = game("carriere", "practice-2"); const rng = new Rng(s.rng);
    s.practice = { int_simple: { ok: 9, ko: 0 }, roi: { ok: 0, ko: 6 } };
    const count: Record<string, number> = {};
    for (let d = 0; d < 200; d++) {
      s.t = nextBusinessDay(dayIndex(s.t) + 1) * MIN_PER_DAY + 1;
      const before = new Set(s.missions.map((m) => m.id)); s.flags["recentTpl"] = ""; s.flags["recentFam"] = "";
      assignDailyMissions(s, rng);
      for (const m of s.missions) if (!before.has(m.id)) { const k = practiceKey(m); count[k] = (count[k] ?? 0) + 1; m.status = "echouee"; }
    }
    expect(count["roi"] ?? 0).toBeGreaterThan((count["int_simple"] ?? 0) * 1.5);
  });
});
