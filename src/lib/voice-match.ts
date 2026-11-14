/**
 * Compréhension des réponses orales (sans service externe) :
 * - rapprochement d'une phrase libre avec les réponses possibles (mots-clés, racines, ordinaux « la deuxième ») ;
 * - lecture d'un nombre dit en français (« quarante mille », « huit virgule cinq », « 1,2 million »).
 */
const STOP = new Set("le la les un une des de du d l a à au aux et ou en dans sur pour par avec sans ce cet cette ces que qui quoi dont où je j tu il elle on nous vous ils elles me m te t se s y est sont suis être avoir ai as avons avez ont mon ma mes ton ta tes son sa ses notre nos votre vos leur leurs ne n pas plus très bien alors donc mais car si oui euh ben bon voilà ça cela c qu".split(" "));
export function normalize(t: string) {
  return t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[’']/g, " ").replace(/[^a-z0-9%,.\s-]/g, " ").replace(/\s+/g, " ").trim();
}
const stem = (w: string) => w.replace(/(ement|ements|ations|ation|ions|ion|eurs|eur|euses|euse|ables|able|iques|ique|ees|ee|es|er|ez|s|e)$/, "").slice(0, 7);
export function keywords(t: string) {
  return normalize(t).split(" ").filter((w) => w.length > 1 && !STOP.has(w)).map(stem).filter((w) => w.length > 1);
}

const ORD: [RegExp, number][] = [
  [/\b(premiere|premier|1ere|1er|option (1|un|une)|reponse (1|un|une)|numero (1|un))\b/, 0],
  [/\b(deuxieme|seconde?|2e|option (2|deux)|reponse (2|deux)|numero (2|deux))\b/, 1],
  [/\b(troisieme|3e|option (3|trois)|reponse (3|trois)|numero (3|trois))\b/, 2],
  [/\b(quatrieme|4e|option (4|quatre)|reponse (4|quatre)|numero (4|quatre))\b/, 3],
];
export interface MatchResult { index: number; score: number; ambiguous: boolean; how: "ordinal" | "mots" | "aucun"; }
export function matchChoice(transcript: string, choices: string[]): MatchResult {
  const n = normalize(transcript);
  if (!n || !choices.length) return { index: -1, score: 0, ambiguous: true, how: "aucun" };
  if (n.split(" ").length <= 5) for (const [re, i] of ORD) if (re.test(n) && i < choices.length) return { index: i, score: 1, ambiguous: false, how: "ordinal" };
  const said = new Set(keywords(transcript));
  const scores = choices.map((c) => {
    const k = [...new Set(keywords(c))];
    if (!k.length) return 0;
    let hit = 0;
    for (const w of k) if (said.has(w) || [...said].some((x) => x.length >= 4 && (x.startsWith(w) || w.startsWith(x)))) hit++;
    return hit / Math.sqrt(k.length);
  });
  let best = 0;
  for (let i = 1; i < scores.length; i++) if (scores[i] > scores[best]) best = i;
  const sorted = [...scores].sort((a, b) => b - a);
  const ambiguous = sorted[0] < 0.45 || sorted[0] - (sorted[1] ?? 0) < 0.15;
  return { index: sorted[0] > 0 ? best : -1, score: sorted[0], ambiguous, how: sorted[0] > 0 ? "mots" : "aucun" };
}

const UNITS: Record<string, number> = { zero: 0, un: 1, une: 1, deux: 2, trois: 3, quatre: 4, cinq: 5, six: 6, sept: 7, huit: 8, neuf: 9, dix: 10, onze: 11, douze: 12, treize: 13, quatorze: 14, quinze: 15, seize: 16, vingt: 20, trente: 30, quarante: 40, cinquante: 50, soixante: 60, septante: 70, huitante: 80, octante: 80, nonante: 90 };
function wordsToInt(words: string[]): number | null {
  let total = 0, cur = 0, any = false;
  for (let i = 0; i < words.length; i++) {
    const w = words[i];
    if (w === "et") continue;
    if (w in UNITS) {
      const v = UNITS[w];
      if (w === "vingt" && words[i - 1] === "quatre" && cur % 100 === 4) { cur = cur - 4 + 80; any = true; continue; } // quatre-vingt
      if (v === 10 && cur % 100 === 60) cur += 10; else if (v < 10 && cur % 100 >= 70 && cur % 100 < 80 && cur % 10 === 0 && words[i - 1] !== "dix") cur += v; else cur += v;
      any = true;
    } else if (w === "cent" || w === "cents") { cur = (cur || 1) * 100; any = true; }
    else if (w === "mille") { total += (cur || 1) * 1000; cur = 0; any = true; }
    else if (w === "million" || w === "millions") { total += (cur || 1) * 1e6; cur = 0; any = true; }
    else if (w === "milliard" || w === "milliards") { total += (cur || 1) * 1e9; cur = 0; any = true; }
    else return null;
  }
  return any ? total + cur : null;
}
/** Renvoie le nombre prononcé, ou null s'il n'y en a pas */
export function parseFrenchNumber(text: string): number | null {
  let t = normalize(text).replace(/-/g, " ").replace(/\b(euros?|eur|ans?|annees?|pour ?cents?|%|points?|environ|a peu pres|je dirais|disons|c est|ca fait|moins de|plus de|a peu pres)\b/g, " ");
  const neg = /\b(moins|negatif)\b/.test(t) && !/\bmoins de\b/.test(normalize(text));
  t = t.replace(/\b(moins|negatif)\b/g, " ").replace(/\s+/g, " ").trim();
  // Forme chiffrée : « 40 000 », « 8,5 », « 1,2 million », « 40000 »
  const digit = t.match(/(\d[\d\s]*(?:[.,]\d+)?)\s*(milliards?|millions?|mille|k)?/);
  if (digit) {
    let v = parseFloat(digit[1].replace(/\s/g, "").replace(",", "."));
    const mult = digit[2];
    if (mult?.startsWith("milliard")) v *= 1e9; else if (mult?.startsWith("million")) v *= 1e6; else if (mult === "mille" || mult === "k") v *= 1000;
    if (Number.isFinite(v)) return neg ? -v : v;
  }
  // Forme en lettres, avec éventuellement « virgule »
  const parts = t.split(/\bvirgule\b/);
  const ip = wordsToInt(parts[0].trim().split(" ").filter(Boolean));
  if (ip === null) return null;
  let v = ip;
  if (parts[1]) { const dec = parts[1].trim().split(" ").filter(Boolean); const d = wordsToInt(dec); if (d !== null) v = parseFloat(`${ip}.${dec[0] === "zero" ? "0" + d : d}`); }
  return neg ? -v : v;
}
