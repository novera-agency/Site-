/** Aide « Je ne comprends pas » d'une mission : la question en mots simples, tous ses mots de métier expliqués, la méthode et des exemples résolus. */
import type { GameState, Mission } from "./types";
import { termsIn, type TermDef } from "./glossary";
import { missionQuestion, missionGuide } from "./missions";
import { famExamples, famHint, famPlain } from "./missionBank";

export interface HelpTerm { term: string; simple: string; example?: string }
export interface MissionHelp {
  /** La question dite autrement, avec la marche à suivre */
  plain?: string;
  /** Formule ou principe à retenir */
  formula?: string;
  /** Les mots de la question (énoncé, réponses possibles, critères) avec leur explication */
  terms: HelpTerm[];
  /** Exemples résolus, autres chiffres, même problème */
  examples: { question: string; options?: string[]; answer: string; explain: string }[];
  /** Étapes concrètes dans le jeu */
  steps: string[];
}
const toTerm = (d: TermDef): HelpTerm => ({ term: d.term, simple: d.simple, example: d.example });

export function missionHelp(s: GameState, m: Mission): MissionHelp {
  const q = m.status === "active" ? missionQuestion(s, m) : null;
  const texts = [m.title, m.description, ...m.criteria, ...(q && "question" in q ? [q.question as string] : []), ...(q && "options" in q && Array.isArray(q.options) ? (q.options as string[]) : [])];
  const fam = typeof m.params._fam === "string" ? String(m.params._fam) : "";
  const formula = fam ? famHint(fam) : undefined;
  if (formula) texts.push(formula);
  const g = missionGuide(s, m);
  return {
    plain: fam ? famPlain(fam) : undefined,
    formula,
    terms: termsIn(texts).map(toTerm),
    examples: fam ? famExamples(fam, 2) : [],
    steps: g.steps,
  };
}
