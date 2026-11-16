/**
 * Révision des erreurs passées : chaque question ratée (en séance de formation ou au point culture) devient une fiche de révision :
 * votre réponse, la bonne réponse, l'explication, la fiche de cours de la notion, les formules à connaître avec un calcul pas à pas
 * et un exercice supplémentaire. On peut refaire la question sans regarder la correction ; réussie, elle est marquée « maîtrisée ».
 */
import type { GameState, NotebookEntry } from "./types";
import { buildQuestion, type TItem } from "./training";
import { LESSONS } from "./data/learning";
import { formulaSections, type Recap } from "./recap";
import { notebook, markFixed, unresolved } from "./notebook";
import { gainXp } from "./core";
import { fmtDate, fmtTime } from "./time";

const LESSON_BY_ID = Object.fromEntries(LESSONS.map((l) => [l.id, l]));
const strip = (t: string) => t.replace(/[.\s]+$/, "");
/** Termine par un point, sauf si la phrase se termine déjà par une ponctuation forte (« ? », « ! ») */
const endp = (t: string) => (/[?!…]$/.test(t.trim()) ? t.trim() : strip(t) + ".");
const short = (t: string, n: number) => (t.length > n ? t.slice(0, n - 1).trimEnd() + "…" : t);
const hash = (str: string) => { let x = 7; for (let i = 0; i < str.length; i++) x = (x * 31 + str.charCodeAt(i)) % 100000; return x; };

export interface RevisionEntry {
  key: string; kind: string; from: "formation" | "culture"; count: number; fixed: boolean; when: string; title: string;
  /** Possibilité de refaire la question (ancien enregistrement sans question : non) */
  retry: { prompt: string; options: string[] } | null;
  recap: Recap;
}

/** Fiche de révision d'une erreur, au format des fiches « à retenir » (écran, image PNG, texte) */
export function entryRecap(e: NotebookEntry): Recap {
  const q = e.item ? buildQuestion(e.item as TItem) : null;
  const points: string[] = [];
  if (q) {
    points.push(`Question : ${endp(q.prompt)}`);
    if (e.yours) points.push(`✘ Votre réponse : ${strip(e.yours)}.`);
    points.push(`✔ Bonne réponse : ${strip(q.options?.[q.answer] ?? "")}.`);
    if (e.item?.k !== "def") points.push(`Pourquoi : ${q.explain}`); // pour une définition, la fiche de cours ci-dessous dit la même chose
  } else { points.push(`Question : ${endp(e.title)}`); points.push(`Pourquoi : ${e.text}`); }
  // Fiche de cours de la notion (leçons et définitions)
  const les = e.item && (e.item.k === "lesson" || e.item.k === "def") ? LESSON_BY_ID[e.item.id] : undefined;
  if (les) { points.push(`📖 ${les.term} : ${strip(les.definition)}.`); points.push(`En clair : ${strip(les.simple)}.`); points.push(`Exemple : ${strip(les.example)}.`); points.push(`À quoi ça sert : ${strip(les.application)}.`); }
  const fam = e.item?.k === "calc" ? Number(e.item.id.split(":")[0]) : undefined;
  const { formulas, exercise } = formulaSections([`${e.title} ${e.text}`], fam === undefined ? [] : [fam], hash(e.key));
  return {
    title: `Fiche de révision : ${short(e.title, 64)}`,
    subtitle: e.from === "culture" ? "Erreur au quiz ou au point culture" : "Erreur en séance de formation",
    when: `${fmtDate(e.t)} · ${fmtTime(e.t)}`,
    verdict: e.fixed ? { label: "Maîtrisée", tone: "gain" } : { label: e.count > 1 ? `À revoir · ratée ${e.count} fois` : "À revoir", tone: e.count > 2 ? "loss" : "warn" },
    outcome: e.fixed ? "Vous avez réussi cette question depuis : gardez la fiche pour la relire." : "Lisez la correction, puis refaites la question sans la regarder.",
    points, facts: [], terms: [], formulas, exercise, decisions: [], reactions: [],
    tips: e.fixed ? [] : ["Refaites la question ci-dessous sans regarder la correction : une question réussie est marquée comme maîtrisée.", "Ou lancez une séance de formation « Mes erreurs passées » : votre responsable vous les reposera."],
  };
}

export function revisionView(s: GameState) {
  const all = notebook(s);
  // À revoir d'abord (les plus ratées, puis les plus récentes), puis les questions maîtrisées
  const sorted = [...all].sort((a, b) => Number(!!a.fixed) - Number(!!b.fixed) || b.count - a.count || b.t - a.t).slice(0, 30);
  const entries: RevisionEntry[] = sorted.map((e) => {
    const q = e.item ? buildQuestion(e.item as TItem) : null;
    return { key: e.key, kind: e.kind, from: e.from, count: e.count, fixed: !!e.fixed, when: `${fmtDate(e.t)}`, title: e.title, retry: q?.options ? { prompt: q.prompt, options: q.options } : null, recap: entryRecap(e) };
  });
  return { entries, unresolved: unresolved(s).length, total: all.length };
}

/** Refaire une question ratée, sans la correction : réussie, elle est maîtrisée */
export function answerReview(s: GameState, key: string, choice: number) {
  const e = notebook(s).find((x) => x.key === key);
  if (!e?.item) return { ok: false as const, error: "Cette question ne peut pas être refaite." };
  const q = buildQuestion(e.item as TItem);
  if (!q?.options) return { ok: false as const, error: "Question introuvable." };
  if (!Number.isInteger(choice) || choice < 0 || choice >= q.options.length) return { ok: false as const, error: "Réponse invalide." };
  const correct = choice === q.answer;
  let xp = 0, fixed = !!e.fixed;
  if (correct && !e.fixed) { markFixed(s, e.item); fixed = true; xp = 4; gainXp(s, q.branch, xp, `Révision d'une erreur : ${e.key}`); }
  if (!correct) e.yours = q.options[choice];
  return { ok: true as const, data: { correct, answer: q.answer, explain: q.explain, fixed, xp } };
}
