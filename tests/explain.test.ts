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
