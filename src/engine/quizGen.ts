/**
 * Exercices de calcul générés (chiffres différents à chaque fois) et questions tirées de la chronologie historique du jeu.
 * Une même identité (famille + graine) redonne toujours exactement la même question : le moteur peut donc la valider.
 */
import type { QuizQ } from "./quiz";
import { HIST_EVENTS } from "./data/history2000";

const mulberry = (a: number) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const hash = (s: string) => { let x = 2166136261; for (let i = 0; i < s.length; i++) x = Math.imul(x ^ s.charCodeAt(i), 16777619) >>> 0; return x; };
const n2 = (x: number) => x.toLocaleString("fr-FR", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const fmts = new Map<number, Intl.NumberFormat>();
const nf = (n: number, d = 2) => { let f = fmts.get(d); if (!f) { f = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: d, minimumFractionDigits: 0 }); fmts.set(d, f); } return f.format(n); };
const eur = (n: number, d = 0) => `${nf(n, d)} €`;
const pct = (n: number, d = 1) => `${nf(n, d)} %`;

type G = { q: string; right: string; wrong: string[]; explain: string; level: 1 | 2 | 3 };
type Gen = (r: () => number) => G;
const pick = <T,>(r: () => number, a: T[]) => a[Math.floor(r() * a.length)];
const int = (r: () => number, lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));

const FAMILIES: Gen[] = [
  // 0 – rendement du dividende
  (r) => { const p = pick(r, [20, 25, 30, 40, 45, 50, 60, 80, 90, 120, 150]); const d = Math.round(p * pick(r, [0.01, 0.02, 0.03, 0.04, 0.05, 0.06]) * 4) / 4; const y = (d / p) * 100; return { level: 1, q: `Une action cote ${eur(p)} et verse ${eur(d, 2)} de dividende par an. Quel est son rendement du dividende ?`, right: pct(y, 2), wrong: [pct(y * 2, 2), pct(y / 2, 2), pct(y + 1.5, 2)], explain: `Rendement = dividende ÷ cours = ${nf(d, 2)} ÷ ${p} = ${nf(y, 2)} %.` }; },
  // 1 – PER
  (r) => { const e = pick(r, [2, 2.5, 3, 4, 5, 6, 8]); const k = pick(r, [8, 10, 12, 15, 18, 20, 25]); const p = e * k; return { level: 1, q: `Une action cote ${eur(p, Number.isInteger(p) ? 0 : 2)} avec un bénéfice de ${eur(e, 2)} par action. Quel est son PER ?`, right: nf(k, 1), wrong: [nf(p * e, 1), nf((e / p) * 100, 1), nf(p - e, 1)], explain: `PER = cours ÷ bénéfice par action = ${nf(p, 2)} ÷ ${nf(e, 2)} = ${k}.` }; },
  // 2 – intérêts composés
  (r) => { const c = pick(r, [1000, 2000, 5000, 10000, 20000]); const t = pick(r, [2, 3, 4, 5, 6]); const n = pick(r, [3, 5, 8, 10]); const v = c * (1 + t / 100) ** n; return { level: 2, q: `Vous placez ${eur(c)} à ${t} % par an pendant ${n} ans, intérêts réinvestis. Combien aurez-vous à peu près ?`, right: eur(Math.round(v / 10) * 10), wrong: [eur(Math.round((c * (1 + (t / 100) * n)) / 10) * 10), eur(Math.round((c * (1 + t / 100) ** (n - 1)) / 10) * 10), eur(Math.round((c * (1 + t / 100) ** (n + 1)) / 10) * 10)], explain: `${eur(c)} × (1 + ${t} %)^${n} ≈ ${eur(Math.round(v / 10) * 10)}. Le calcul simple (${eur(Math.round((c * (1 + (t / 100) * n)) / 10) * 10)}) oublie que les intérêts rapportent eux-mêmes des intérêts.` }; },
  // 3 – valeur actuelle
  (r) => { const f = pick(r, [1000, 2000, 5000, 10000]); const t = pick(r, [2, 3, 4, 5, 8]); const n = pick(r, [1, 2, 3, 5]); const v = f / (1 + t / 100) ** n; return { level: 2, q: `Quelle est aujourd'hui la valeur d'une somme de ${eur(f)} reçue dans ${n} an${n > 1 ? "s" : ""}, avec un taux d'actualisation de ${t} % ?`, right: eur(Math.round(v)), wrong: [eur(Math.round(f * (1 - (t / 100) * n))), eur(Math.round(f / (1 + t / 100) ** (n + 1))), eur(f)], explain: `Valeur actuelle = ${eur(f)} ÷ (1 + ${t} %)^${n} ≈ ${eur(Math.round(v))}.` }; },
  // 4 – rendement courant d'une obligation
  (r) => { const c = pick(r, [2, 3, 4, 5, 6]); const p = pick(r, [800, 850, 900, 950, 1050, 1100]); const y = ((c * 10) / p) * 100; return { level: 2, q: `Une obligation de valeur nominale 1 000 € verse un coupon de ${c} % ; elle s'échange à ${eur(p)}. Quel est son rendement courant (coupon ÷ prix) ?`, right: pct(y, 2), wrong: [pct(c, 2), pct(((c * 10) / 1000) * 100 * 1.5, 2), pct((p / (c * 10)), 2)], explain: `Coupon annuel = ${c * 10} €. Rendement courant = ${c * 10} ÷ ${p} = ${nf(y, 2)} %.` }; },
  // 5 – variation en %
  (r) => { const a = pick(r, [20, 40, 50, 80, 100, 120, 200]); const b = Math.round(a * pick(r, [0.6, 0.7, 0.8, 1.2, 1.25, 1.5, 1.8])); const v = ((b - a) / a) * 100; return { level: 1, q: `Un titre passe de ${eur(a)} à ${eur(b)}. Quelle est sa variation en pourcentage ?`, right: `${v > 0 ? "+" : ""}${nf(v, 1)} %`, wrong: [`${v > 0 ? "+" : ""}${nf(((b - a) / b) * 100, 1)} %`, `${v > 0 ? "+" : ""}${nf(b - a, 1)} %`, `${nf((b / a) * 100, 1)} %`], explain: `Variation = (${b} − ${a}) ÷ ${a} = ${nf(v, 1)} %. On divise toujours par la valeur de départ.` }; },
  // 6 – baisse puis hausse
  (r) => { const x = pick(r, [10, 20, 25, 30, 40, 50]); const v = -((x * x) / 100); return { level: 2, q: `Un portefeuille perd ${x} %, puis gagne ${x} % l'année suivante. Quel est son résultat sur les deux ans par rapport au départ ?`, right: `${nf(v, 2)} %`, wrong: ["0 %", `${nf(-x / 2, 2)} %`, `+${nf((x * x) / 100, 2)} %`], explain: `100 × (1 − ${x} %) × (1 + ${x} %) = ${nf(100 + v, 2)} : une perte de ${nf(-v, 2)} %. Pour revenir à l'équilibre après une baisse de ${x} %, il faut gagner ${nf((x / (100 - x)) * 100, 1)} %.` }; },
  // 7 – taux réel
  (r) => { const n = pick(r, [3, 4, 5, 6, 7]); const i = pick(r, [1, 2, 3, 4, 5, 8]); const v = n - i; return { level: 1, q: `Un placement rapporte ${n} % par an alors que l'inflation est de ${i} %. Quel est son rendement réel (approximatif) ?`, right: `${v > 0 ? "+" : ""}${nf(v, 1)} %`, wrong: [`+${nf(n + i, 1)} %`, `${nf(i - n, 1)} %`, `+${nf(n, 1)} %`], explain: `Rendement réel ≈ rendement nominal − inflation = ${n} − ${i} = ${nf(v, 1)} %.` }; },
  // 8 – capitalisation
  (r) => { const p = pick(r, [10, 20, 25, 40, 50, 80, 120]); const n = pick(r, [100, 200, 250, 400, 500, 800]); const v = (p * n) / 1000; return { level: 1, q: `Une entreprise a ${n} millions d'actions qui cotent ${eur(p)} chacune. Quelle est sa capitalisation boursière ?`, right: `${nf(v, 2)} Md€`, wrong: [`${nf(v * 10, 2)} Md€`, `${nf(v / 10, 2)} Md€`, `${nf(v * 100, 2)} Md€`], explain: `${p} × ${n} millions = ${nf(p * n, 0)} millions d'euros, soit ${nf(v, 2)} milliards.` }; },
  // 9 – change
  (r) => { const a = pick(r, [1000, 2000, 5000, 10000, 25000]); const c = pick(r, [1.05, 1.1, 1.15, 1.2, 1.25, 1.3]); const v = a * c; return { level: 1, q: `Au cours EUR/USD de ${nf(c, 2)}, combien de dollars obtient-on pour ${eur(a)} ?`, right: `${nf(v, 0)} $`, wrong: [`${nf(Math.round(a / c), 0)} $`, `${nf(Math.round(v * 1.1), 0)} $`, `${nf(Math.round(v * 0.9), 0)} $`], explain: `EUR/USD = ${nf(c, 2)} signifie que 1 € vaut ${nf(c, 2)} $ : ${a} × ${nf(c, 2)} = ${nf(v, 0)} $.` }; },
  // 10 – marge
  (r) => { const cost = pick(r, [20, 30, 40, 50, 60, 75]); const p = cost + pick(r, [10, 15, 20, 25, 30, 50]); const m = ((p - cost) / p) * 100; return { level: 2, q: `Un article acheté ${eur(cost)} est vendu ${eur(p)}. Quel est le taux de marque (marge ÷ prix de vente) ?`, right: pct(m, 1), wrong: [pct(((p - cost) / cost) * 100, 1), pct((cost / p) * 100, 1), pct(((p - cost) / (p + cost)) * 100, 1)], explain: `Marge = ${p} − ${cost} = ${p - cost} €. Taux de marque = ${p - cost} ÷ ${p} = ${nf(m, 1)} % (diviser par le prix d'achat donnerait le taux de marge, ${nf(((p - cost) / cost) * 100, 1)} %).` }; },
  // 11 – règle des 72
  (r) => { const t = pick(r, [2, 3, 4, 6, 8, 9, 12]); const y = 72 / t; return { level: 2, q: `À ${t} % par an, en combien d'années un capital double-t-il environ (règle des 72) ?`, right: `${nf(y, 1)} ans`, wrong: [`${nf(t * 2, 1)} ans`, `${nf(y * 2, 1)} ans`, `${nf(y / 2, 1)} ans`], explain: `Règle des 72 : 72 ÷ ${t} = ${nf(y, 1)} ans.` }; },
  // 12 – dette / PIB
  (r) => { const y = pick(r, [500, 800, 1000, 2000, 2500, 3000]); const k = pick(r, [0.4, 0.6, 0.8, 1.0, 1.2, 1.5]); const d = Math.round(y * k); const v = (d / y) * 100; return { level: 2, q: `Un pays a une dette publique de ${nf(d, 0)} Md€ et un PIB de ${nf(y, 0)} Md€. Quel est son ratio dette/PIB ?`, right: pct(v, 0), wrong: [pct((y / d) * 100, 0), pct(v / 2, 0), pct(v + 30, 0)], explain: `${d} ÷ ${y} = ${nf(v / 100, 2)} soit ${nf(v, 0)} % du PIB.` }; },
  // 13 – pouvoir d'achat
  (r) => { const w = pick(r, [1, 2, 3, 4]); let i = pick(r, [0, 1, 2, 5, 6]); if (i === w) i = 5; const v = ((1 + w / 100) / (1 + i / 100) - 1) * 100; const lab = (x: number) => `${x > 0 ? "+" : ""}${nf(x, 1)} %`; return { level: 2, q: `Votre salaire augmente de ${w} % et les prix de ${i} %. De combien évolue votre pouvoir d'achat (environ) ?`, right: lab(v), wrong: [lab(w + i), lab(-v), lab(w)], explain: `Pouvoir d'achat ≈ (1 + ${w} %) ÷ (1 + ${i} %) − 1 = ${lab(v)}.` }; },
  // 14 – levier
  (r) => { const c = pick(r, [1000, 2000, 5000, 10000]); const l = pick(r, [2, 3, 5, 10]); const m = pick(r, [-4, -2, 2, 3, 5]); const v = c * l * (m / 100); return { level: 2, q: `Vous investissez ${eur(c)} avec un effet de levier ×${l}. Le marché varie de ${m > 0 ? "+" : ""}${m} %. Quel est votre gain ou votre perte ?`, right: `${v > 0 ? "+" : ""}${eur(v)}`, wrong: [`${v > 0 ? "+" : ""}${eur(c * (m / 100))}`, `${v > 0 ? "+" : ""}${eur(v / 2)}`, `${v > 0 ? "+" : ""}${eur(c * l)}`], explain: `Exposition = ${eur(c)} × ${l} = ${eur(c * l)} ; ${m > 0 ? "+" : ""}${m} % de ${eur(c * l)} = ${eur(v)}. Le levier amplifie gains et pertes.` }; },
  // 15 – option d'achat
  (r) => { const k = pick(r, [40, 50, 80, 100]); const prime = pick(r, [2, 3, 5, 8]); const s = k + pick(r, [-10, -5, 4, 8, 12, 20]); const v = Math.max(s - k, 0) - prime; return { level: 3, q: `Vous achetez un call de prix d'exercice ${eur(k)} pour une prime de ${eur(prime)} par action. À l'échéance, l'action vaut ${eur(s)}. Quel est votre résultat par action ?`, right: `${v >= 0 ? "+" : "−"}${eur(Math.abs(v))}`, wrong: [`+${eur(Math.max(s - k, 0))}`, `${s - k >= 0 ? "+" : "−"}${eur(Math.abs(s - k))}`, `+${eur(prime)}`], explain: `Valeur à l'échéance = max(${s} − ${k} ; 0) = ${Math.max(s - k, 0)} €. Moins la prime payée (${prime} €), résultat = ${v >= 0 ? "+" : "−"}${Math.abs(v)} €.` }; },
  // 16 – rendement total
  (r) => { const p0 = pick(r, [40, 50, 80, 100]); const p1 = p0 + pick(r, [-8, -4, 4, 8, 12]); const d = pick(r, [1, 2, 3]); const v = ((p1 - p0 + d) / p0) * 100; return { level: 2, q: `Une action passe de ${eur(p0)} à ${eur(p1)} et verse ${eur(d)} de dividende. Quel est son rendement total sur la période ?`, right: `${v >= 0 ? "+" : ""}${nf(v, 1)} %`, wrong: [`${p1 >= p0 ? "+" : ""}${nf(((p1 - p0) / p0) * 100, 1)} %`, `+${nf((d / p0) * 100, 1)} %`, `${v >= 0 ? "+" : ""}${nf(((p1 - p0 + d) / p1) * 100, 1)} %`], explain: `Rendement total = (plus-value + dividende) ÷ prix d'achat = (${p1 - p0} + ${d}) ÷ ${p0} = ${nf(v, 1)} %.` }; },
  // 17 – inflation cumulée
  (r) => { const i = pick(r, [2, 3, 4, 5, 8]); const n = pick(r, [5, 8, 10, 15, 20]); const v = 100 * (1 + i / 100) ** n; return { level: 2, q: `Un panier coûte 100 € aujourd'hui. Avec ${i} % d'inflation par an, combien coûtera-t-il dans ${n} ans ?`, right: eur(Math.round(v)), wrong: [eur(Math.round(100 * (1 + (i / 100) * n))), eur(Math.round(100 * (1 + i / 100) ** (n - 2))), eur(Math.round(100 + i * n * 1.5))], explain: `100 × (1 + ${i} %)^${n} ≈ ${eur(Math.round(v))} : l'inflation se cumule, comme des intérêts composés.` }; },
  // 18 – seuil de rentabilité
  (r) => { const v = pick(r, [5, 8, 10, 12]); const p = v + pick(r, [5, 8, 10]); const f = pick(r, [10000, 20000, 30000, 50000]); const x = Math.ceil(f / (p - v)); return { level: 3, q: `Un artisan vend ses produits ${eur(p)} pièce, avec ${eur(v)} de coûts variables par pièce et ${eur(f)} de coûts fixes. Combien de pièces pour atteindre le seuil de rentabilité ?`, right: nf(x, 0), wrong: [nf(Math.ceil(f / p), 0), nf(Math.ceil(f / v), 0), nf(Math.ceil(f / (p + v)), 0)], explain: `Marge unitaire = ${p} − ${v} = ${p - v} €. Seuil = ${f} ÷ ${p - v} = ${nf(f / (p - v), 1)}, soit ${nf(x, 0)} pièces.` }; },
  // 19 – coût de l'écart achat/vente
  (r) => { const bid = pick(r, [24.9, 49.9, 99.8, 19.95]); const sp = pick(r, [0.1, 0.2, 0.3]); const ask = Math.round((bid + sp) * 100) / 100; const q = pick(r, [500, 1000, 2000]); const v = Math.round(sp * q * 100) / 100; return { level: 2, q: `Un titre affiche un prix acheteur (bid) de ${n2(bid)} et un prix vendeur (ask) de ${n2(ask)}. Vous achetez ${nf(q, 0)} titres puis les revendez aussitôt. Quel est le coût de l'écart ?`, right: eur(v), wrong: [eur(v / 2), eur(v * 10), eur(v * 2)], explain: `Vous achetez à l'ask (${n2(ask)}) et revendez au bid (${n2(bid)}) : perte de ${n2(sp)} € par titre × ${nf(q, 0)} = ${eur(v)}, avant même que le cours bouge.` }; },
];
export const GEN_FAMILIES = FAMILIES.length;
const FAM_TITLES = ["Dividende", "PER", "Intérêts composés", "Valeur actuelle", "Rendement obligataire", "Variation", "Baisse puis hausse", "Taux réel", "Capitalisation", "Change", "Marge", "Règle des 72", "Dette/PIB", "Pouvoir d'achat", "Levier", "Option d'achat", "Rendement total", "Inflation", "Seuil de rentabilité", "Écart achat/vente"];

/** Signe moins typographique (−) devant un nombre */
const minus = (t: string) => t.replace(/(^|[\s(+:])-(?=\d)/g, "$1−");
function assemble(id: string, cat: QuizQ["cat"], g0: G): QuizQ {
  const g: G = { ...g0, q: minus(g0.q), right: minus(g0.right), wrong: g0.wrong.map(minus), explain: minus(g0.explain) };
  const wrong: string[] = [];
  for (const w of g.wrong) if (w !== g.right && !wrong.includes(w)) wrong.push(w);
  let k = 1;
  while (wrong.length < 3) { const alt = `${g.right} (${k++ + 1})`; wrong.push(alt); }
  const opts = wrong.slice(0, 3);
  const pos = hash(id) % 4;
  opts.splice(pos, 0, g.right);
  return { id, cat, level: g.level, q: g.q, options: opts, correct: pos, explain: g.explain };
}
const distinct = (g: G) => { const seen = new Set([g.right]); let n = 0; for (const w of g.wrong) if (!seen.has(w)) { seen.add(w); n++; } return n >= 3; };
export function genQuestion(fam: number, seed: number): QuizQ {
  const f = ((fam % FAMILIES.length) + FAMILIES.length) % FAMILIES.length;
  // Même graine, même question : si le tirage donne deux options identiques (ou égales à la bonne réponse), on passe au tirage suivant, de façon déterministe
  const base = seed * 7919 + f * 104729 + 12345;
  let g = FAMILIES[f](mulberry(base));
  for (let k = 1; k < 80 && !distinct(g); k++) g = FAMILIES[f](mulberry(base + k * 6841));
  return assemble(`g:${f}:${seed}`, "calcul", g);
}
export const genTitle = (id: string) => FAM_TITLES[Number(id.split(":")[1])] ?? "Calcul";

// ───────── Questions tirées de la chronologie historique ─────────
interface HQ { idx: number; year: number; date: string; title: string; text: string }
const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const HQS: HQ[] = HIST_EVENTS.map((e, idx) => ({ idx, year: Number(e[0].slice(0, 4)), date: e[0], title: e[3], text: e[4], imp: e[2] }))
  .filter((e) => e.imp >= 2 && !/\b(19|20)\d\d\b/.test(e.title) && !/repères|Fin des/.test(e.title) && e.text.length > 20)
  .map(({ imp: _i, ...rest }) => rest);
export const HIST_COUNT = HQS.length;
export const histIds = () => HQS.map((e) => `h:${e.idx}`);
export function histQuestion(id: string): QuizQ | undefined {
  const idx = Number(id.slice(2));
  const e = HQS.find((x) => x.idx === idx);
  if (!e) return undefined;
  const r = mulberry(hash(id));
  const years = new Set<number>([e.year]);
  let guard = 0;
  while (years.size < 4 && guard++ < 50) { const y = e.year + pick(r, [-4, -3, -2, -1, 1, 2, 3, 4]); if (y >= 1999 && y <= 2026) years.add(y); }
  for (let y = e.year - 5; years.size < 4; y++) if (y >= 1999 && y <= 2026) years.add(y);
  const wrong = [...years].filter((y) => y !== e.year).slice(0, 3).map(String);
  const d = e.date.split("-");
  const when = `${Number(d[2])} ${MONTHS[Number(d[1]) - 1]} ${d[0]}`;
  return assemble(id, "histoire", { level: 2, q: `En quelle année : « ${e.title} » ?`, right: String(e.year), wrong, explain: `${when}. ${e.text}` });
}
