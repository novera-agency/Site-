/** Carnet d'erreurs : chaque question ratée est gardée (une seule ligne par question, avec le nombre d'échecs) pour être revue et refaite. */
import type { GameState, NotebookEntry } from "./types";

type Item = NonNullable<NotebookEntry["item"]>;
export const keyOf = (it: Item) => `${it.k}:${it.id}${it.seed !== undefined ? ":" + it.seed : ""}`;
/** Identifiant de question du quiz (banque, histoire ou exercice généré) → élément reconstructible */
export function itemOfQuizId(id: string): Item { return id.startsWith("g:") ? { k: "calc", id: id.slice(2) } : { k: "quiz", id }; }
const MAX = 60;

/** Entrées du carnet, anciens enregistrements mis au format actuel */
export function notebook(s: GameState): NotebookEntry[] {
  const nb = (s.life?.notebook ?? []) as Partial<NotebookEntry>[];
  nb.forEach((e, i) => { e.key ??= `old:${e.t}:${i}`; e.count ??= 1; e.from ??= "formation"; });
  return nb as NotebookEntry[];
}
export function recordMistake(s: GameState, e: { item: Item; kind: string; title: string; text: string; yours?: string; from: "formation" | "culture" }) {
  const l = s.life; if (!l) return;
  const nb = (l.notebook ??= []) as NotebookEntry[];
  notebook(s);
  const key = keyOf(e.item);
  const i = nb.findIndex((x) => x.key === key);
  const clip = (t: string) => (t.length > 110 ? t.slice(0, 107) + "…" : t);
  if (i >= 0) { const old = nb.splice(i, 1)[0]; nb.unshift({ ...old, t: s.t, count: old.count + 1, fixed: false, yours: e.yours, text: e.text }); }
  else nb.unshift({ key, t: s.t, kind: e.kind, title: clip(e.title), text: e.text, from: e.from, count: 1, item: e.item, yours: e.yours });
  if (nb.length > MAX) nb.length = MAX;
}
/** Une question ratée puis réussie est marquée comme maîtrisée (elle reste consultable) */
export function markFixed(s: GameState, item: Item) {
  const e = notebook(s).find((x) => x.key === keyOf(item));
  if (e && !e.fixed) { e.fixed = true; return true; }
  return false;
}
/** Erreurs à revoir (non maîtrisées) pouvant être reposées */
export function unresolved(s: GameState) { return notebook(s).filter((e) => !e.fixed && e.item); }
