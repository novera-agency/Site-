/**
 * Banque de missions « pratique » : plus de 500 modèles distincts, dont 19 « de situation » (missionContext.ts), chacun aux chiffres tirés au hasard à chaque attribution.
 *  - 54 types de problèmes de métier (calcul chiffré ou choix commenté) × 8 mises en situation (client particulier, PME, gestion privée,
 *    desk, fonds de pension, structuration, trésorerie, comité) = 432 missions ; chaque mise en situation change le ton, l'interlocuteur,
 *    l'ordre de grandeur des montants et la difficulté ;
 *  - 74 missions d'action vérifiées par le moteur sur la partie (prendre une position dans un secteur ou une zone, tenir des limites de risque,
 *    placer un type d'ordre précis, constituer un portefeuille, collecter des fonds…).
 * Tout est déterministe : les nombres viennent du générateur aléatoire de la partie, les réponses attendues sont recalculées depuis les paramètres de la mission.
 */
import type { GameState, Mission, RepKey, Sector, ZoneId, AssetClass } from "./types";
import { Rng, seedRng } from "./rng";
import { accountEquity, exposures, positionViews, valueAtRisk } from "./portfolio";
import { quizState } from "./quiz";
import { CONTEXT } from "./missionContext";

type Params = Record<string, number | string>;
type Cat = Mission["category"];
export interface BankTpl {
  id: string; category: Cat; xp: number; rep: Partial<Record<RepKey, number>>; days: number;
  /** « calc » : question chiffrée ou à choix ; « action » : vérifiée par l'état de la partie */
  kind: "calc" | "action"; family: string;
  make: (s: GameState, p: Params, rng: Rng) => { title: string; description: string; criteria: string[]; params: Params; baseline?: Record<string, number> } | null;
  check: (s: GameState, m: Mission) => number;
  quiz?: (s: GameState, m: Mission) => { answer: number; tolerance: number; unit: string; question: string; explain: string };
  choiceQuiz?: (s: GameState, m: Mission) => { question: string; options: string[]; correct: number; explain: string };
  guide: (s: GameState, m: Mission) => { steps: string[]; link: string; linkLabel: string; tip?: string };
}

/* ───────── outils de mise en forme ───────── */
const f0 = (x: number) => Math.round(x).toLocaleString("fr-FR");
const fd = (x: number, d = 2) => x.toLocaleString("fr-FR", { minimumFractionDigits: d, maximumFractionDigits: d });
const eur = (x: number) => `${f0(x)} €`;
const K = (p: Params) => Math.max(1, Number(p.k ?? 1));
/** Montant rond tiré dans [lo, hi] × échelle, multiple de `step` (au moins `step`) */
const amt = (r: Rng, sc: number, lo: number, hi: number, step: number) => Math.max(step, Math.round((r.range(lo, hi) * sc) / step) * step);
const px = (r: Rng, lo: number, hi: number) => Math.round(r.range(lo, hi) * 100) / 100;
const rel = (x: number, min = 0.01) => (a: number) => Math.max(min, Math.abs(a) * x);
const abs = (x: number) => () => x;

/* ───────── mises en situation ───────── */
interface Ctx { label: string; sc: number; intro: string[]; giver: string; outro: string[] }
const CTX: Ctx[] = [
  { label: "Client particulier", outro: ["Merci de me répondre avant ce soir.", "Il aimerait une réponse claire, sans jargon.", "Prenez le temps de bien lui expliquer.", "Il attend votre retour dans la journée."], sc: 0.15, giver: "senior", intro: ["Un client retraité de votre agence vous interroge :", "Une cliente vous écrit après son rendez-vous :", "Un jeune cadre qui prépare son premier investissement demande :", "Un client fidèle appelle la banque et pose cette question :"] },
  { label: "Dirigeant de PME", outro: ["Il a un rendez-vous avec son banquier demain.", "Il doit décider cette semaine.", "Une réponse précise l'aiderait à trancher.", "Merci de répondre avant 18 h 30."], sc: 0.6, giver: "boss", intro: ["Le dirigeant d'une PME de votre portefeuille souhaite savoir :", "La directrice financière d'une entreprise cliente demande :", "Un artisan qui place sa trésorerie vous demande :", "Le patron d'un cabinet d'architectes vous interroge :"] },
  { label: "Gestion privée", outro: ["La famille décide en fin de semaine.", "Le conseiller attend votre validation.", "Merci de répondre avec précision.", "Le dossier part ce soir."], sc: 1, giver: "senior", intro: ["Une famille suivie en gestion privée vous soumet ce cas :", "Un client fortuné prépare un arbitrage et vous demande :", "Lors du comité patrimonial, on vous pose cette question :", "Une héritière veut comprendre avant de signer :"] },
  { label: "Desk de trading", outro: ["C'est pour tout de suite.", "Pas le temps de vérifier deux fois : répondez vite et juste.", "L'ordre part dans cinq minutes.", "Le risk manager regarde par-dessus l'épaule."], sc: 2, giver: "boss", intro: ["Le responsable du desk veut un chiffre rapide :", "Un trader vous demande un contrôle avant d'envoyer l'ordre :", "Pendant la réunion du matin, on attend de vous :", "Le middle-office vous soumet ce calcul à valider :"] },
  { label: "Fonds de pension", outro: ["Le comité se réunit demain matin.", "Les trustees attendent un chiffre fiable.", "Le rapport est publié vendredi.", "L'erreur ne serait pas pardonnée."], sc: 10, giver: "director", intro: ["Le comité de placement d'un fonds de pension doit trancher :", "Le directeur des investissements d'une caisse de retraite demande :", "Un gestionnaire institutionnel vous sollicite :", "Pour le rapport trimestriel d'un fonds de pension, il faut établir :"] },
  { label: "Structuration", outro: ["Le term sheet part ce soir.", "Le juridique attend votre chiffre.", "Le client veut le prix avant midi.", "Pas de marge d'erreur sur ce calcul."], sc: 3, giver: "senior", intro: ["L'équipe de structuration prépare une offre et a besoin de :", "Pour calibrer un produit structuré, on vous demande :", "Le structureur vous glisse ce calcul à vérifier :", "Avant le lancement d'un produit, le juridique et le front office vous demandent :"] },
  { label: "Trésorerie d'entreprise", outro: ["Le budget est bouclé jeudi.", "La direction générale attend la réponse.", "Le groupe décide ce soir.", "Une erreur fausserait les prévisions de trésorerie."], sc: 5, giver: "boss", intro: ["Le trésorier d'un grand groupe industriel cherche à savoir :", "La trésorerie d'une multinationale vous demande :", "Un client corporate prépare son budget et pose cette question :", "Le directeur administratif d'un groupe vous contacte :"] },
  { label: "Comité d'investissement", outro: ["Le comité commence dans une heure.", "Le dossier est sur la table du directeur.", "Un chiffre faux se verrait tout de suite.", "Répondez, le comité vous écoute."], sc: 4, giver: "director", intro: ["Le comité d'investissement attend votre chiffre :", "Le directeur présente un dossier au comité exécutif et vous demande :", "Un associé de la banque vous interpelle dans le couloir :", "Pour la note de décision d'aujourd'hui, il manque :"] },
];

/* ───────── 54 types de problèmes ───────── */
interface Fam {
  key: string; title: string; cat: Cat; xp: number; hint: string;
  gen: (r: Rng, sc: number) => Record<string, number>;
  ask: (p: Record<string, number>) => string;
  unit: string;
  ans?: (p: Record<string, number>) => number;
  tol?: (a: number) => number;
  explain?: (p: Record<string, number>, a: number) => string;
  choice?: (p: Record<string, number>) => { question: string; options: string[]; correct: number; explain: string };
}
const P = (p: Params) => p as Record<string, number>;
const FX = [{ c: "USD", s: "$", lo: 1.02, hi: 1.2, d: 4 }, { c: "GBP", s: "£", lo: 0.82, hi: 0.9, d: 4 }, { c: "CHF", s: "CHF", lo: 0.92, hi: 1.0, d: 4 }, { c: "JPY", s: "¥", lo: 145, hi: 170, d: 2 }];
const NAMES = ["Alpha", "Boréal", "Cassini", "Delta", "Éolia", "Fulgor", "Granit", "Horizon", "Ibérica", "Jade"];
const REFLEX: { q: string; o: [string, string, string]; e: string }[] = [
  { q: "L'euro se déprécie nettement face au dollar. Qui en profite ?", o: ["Un exportateur européen qui facture en dollars", "Un importateur européen qui paie en dollars", "Un touriste européen aux États-Unis"], e: "Ses recettes en dollars valent plus d'euros ; l'importateur et le touriste paient plus cher." },
  { q: "Les banques centrales relèvent leurs taux directeurs. Que font en général les prix des obligations déjà émises ?", o: ["Ils baissent", "Ils montent", "Ils ne bougent pas"], e: "Les nouvelles obligations rapportent plus : les anciennes, moins avantageuses, perdent de la valeur." },
  { q: "L'inflation dépasse nettement la cible de la banque centrale. Que fait-elle en général ?", o: ["Elle relève ses taux", "Elle baisse ses taux", "Elle achète des actions"], e: "Des taux plus élevés freinent la demande et donc l'inflation." },
  { q: "Une entreprise annonce un bénéfice très inférieur aux attentes des analystes. Que fait en général son cours ?", o: ["Il baisse", "Il monte", "Il reste identique"], e: "Le marché avait déjà intégré les attentes : une déception fait baisser le cours." },
  { q: "Vous avez vendu un call et le sous-jacent s'envole. Que se passe-t-il ?", o: ["Votre perte peut être très élevée, sans limite théorique", "Vous gagnez au maximum la prime", "Il n'y a aucun effet"], e: "Vendeur de call = risque illimité à la hausse ; le gain est limité à la prime encaissée." },
  { q: "Comment se couvrir contre une baisse d'un portefeuille d'actions ?", o: ["Acheter des puts sur l'indice", "Vendre des puts", "Acheter encore des actions"], e: "Un put prend de la valeur quand le marché baisse et compense la perte du portefeuille." },
  { q: "Un portefeuille entièrement investi dans un seul secteur est…", o: ["peu diversifié, donc plus risqué", "très bien diversifié", "sans risque"], e: "Si le secteur chute, tout chute : la diversification répartit le risque." },
  { q: "Comparée à une obligation notée AAA, une obligation notée BB offre en général…", o: ["un rendement plus élevé mais plus de risque de défaut", "un rendement plus faible et moins de risque", "exactement le même rendement"], e: "Le rendement supplémentaire rémunère le risque de défaut plus élevé." },
  { q: "En période de récession, quels secteurs résistent en général le mieux ?", o: ["Les défensifs (santé, alimentation)", "Les cycliques (automobile, luxe)", "Aucun, tous baissent pareil"], e: "On continue à se soigner et à manger même en crise ; l'automobile et le luxe se reportent." },
  { q: "Un client prudent à 70 ans veut placer toute son épargne dans un produit très risqué. Que faites-vous ?", o: ["Vous déconseillez et expliquez l'inadéquation par écrit", "Vous exécutez : c'est son argent", "Vous lui vendez une version à levier"], e: "Le devoir de conseil impose d'adapter le produit au profil du client et de tracer la mise en garde." },
];
const OPT = ["call", "put"];
/** n indices distincts dans [0, len) */
const distinct = (r: Rng, n: number, len: number) => { const a = Array.from({ length: len }, (_, i) => i); const o: number[] = []; while (o.length < n) o.push(a.splice(r.int(0, a.length - 1), 1)[0]); return o; };

const FAMS: Fam[] = [
  { key: "int_simple", title: "Intérêts simples", cat: "maths", xp: 30, hint: "Intérêts simples = capital × taux × durée.", unit: "€",
    gen: (r, sc) => ({ C: amt(r, sc, 5, 80, 500), i: r.pick([1.5, 2, 2.5, 3, 3.5, 4]), t: r.pick([0.5, 1, 2, 3, 4]) }),
    ask: (p) => `Un placement de ${eur(p.C)} rapporte des intérêts simples de ${fd(p.i, 1)} % par an pendant ${fd(p.t, 1)} an(s). Quel montant d'intérêts perçoit-on ?`,
    ans: (p) => (p.C * p.i * p.t) / 100, tol: rel(0.005, 1), explain: (p, a) => `${eur(p.C)} × ${fd(p.i, 1)} % × ${fd(p.t, 1)} = ${eur(a)}.` },
  { key: "int_compose", title: "Intérêts composés", cat: "maths", xp: 35, hint: "Capital final = C × (1 + taux)^années.", unit: "€",
    gen: (r, sc) => ({ C: amt(r, sc, 5, 120, 500), i: r.pick([2, 2.5, 3, 3.5, 4, 5]), n: r.int(3, 12) }),
    ask: (p) => `${eur(p.C)} sont placés à ${fd(p.i, 1)} % par an, intérêts réinvestis, pendant ${p.n} ans. Quel capital final ?`,
    ans: (p) => p.C * Math.pow(1 + p.i / 100, p.n), tol: rel(0.005, 1), explain: (p, a) => `${eur(p.C)} × (1 + ${fd(p.i, 1)} %)^${p.n} = ${eur(a)}.` },
  { key: "taux_equiv", title: "Taux annuel équivalent", cat: "maths", xp: 35, hint: "Taux annuel = (1 + taux mensuel)^12 − 1.", unit: "%",
    gen: (r) => ({ m: r.pick([0.2, 0.3, 0.4, 0.5, 0.6, 0.8, 1]) }),
    ask: (p) => `Un placement rapporte ${fd(p.m, 1)} % par mois, intérêts capitalisés chaque mois. Quel est le taux annuel équivalent ?`,
    ans: (p) => (Math.pow(1 + p.m / 100, 12) - 1) * 100, tol: abs(0.1), explain: (p, a) => `(1 + ${fd(p.m, 1)} %)^12 − 1 = ${fd(a, 2)} %.` },
  { key: "rend_total", title: "Rendement total d'un titre", cat: "analyse", xp: 30, hint: "Rendement total = (cours final − cours initial + dividendes) ÷ cours initial.", unit: "%",
    gen: (r) => { const p0 = px(r, 20, 200); return { p0, p1: px(r, p0 * 0.85, p0 * 1.25), d: Math.round(p0 * r.range(0, 0.04) * 100) / 100 }; },
    ask: (p) => `Un titre acheté ${fd(p.p0)} € vaut aujourd'hui ${fd(p.p1)} € et a versé ${fd(p.d)} € de dividende. Quel rendement total en pourcentage ?`,
    ans: (p) => ((p.p1 - p.p0 + p.d) / p.p0) * 100, tol: abs(0.1), explain: (p, a) => `(${fd(p.p1)} − ${fd(p.p0)} + ${fd(p.d)}) ÷ ${fd(p.p0)} = ${fd(a, 2)} %.` },
  { key: "cagr", title: "Performance annualisée", cat: "maths", xp: 40, hint: "Taux annualisé = (valeur finale ÷ valeur initiale)^(1/années) − 1.", unit: "%",
    gen: (r, sc) => { const V0 = amt(r, sc, 10, 200, 1000); return { V0, V1: Math.round((V0 * r.range(1.1, 2.2)) / 100) * 100, n: r.int(3, 10) }; },
    ask: (p) => `Un portefeuille est passé de ${eur(p.V0)} à ${eur(p.V1)} en ${p.n} ans. Quelle performance annualisée ?`,
    ans: (p) => (Math.pow(p.V1 / p.V0, 1 / p.n) - 1) * 100, tol: abs(0.1), explain: (p, a) => `(${f0(p.V1)} ÷ ${f0(p.V0)})^(1/${p.n}) − 1 = ${fd(a, 2)} %.` },
  { key: "var_enchainee", title: "Hausse puis baisse", cat: "maths", xp: 25, hint: "Les variations se multiplient : (1 + x)(1 − y) − 1.", unit: "%",
    gen: (r) => ({ x: r.pick([10, 15, 20, 25, 30, 40]), y: r.pick([10, 15, 20, 25, 30]) }),
    ask: (p) => `Un titre gagne ${p.x} % en janvier puis perd ${p.y} % en février. Quelle variation totale sur les deux mois ?`,
    ans: (p) => ((1 + p.x / 100) * (1 - p.y / 100) - 1) * 100, tol: abs(0.1), explain: (p, a) => `1,${String(p.x).padStart(2, "0")} × 0,${String(100 - p.y).padStart(2, "0")} − 1 = ${fd(a, 1)} %.` },
  { key: "pnl_long", title: "Résultat d'une position acheteuse", cat: "trading", xp: 30, hint: "P&L = quantité × (cours de vente − cours d'achat) − frais.", unit: "€",
    gen: (r, sc) => { const p0 = px(r, 20, 150); return { q: amt(r, sc, 300, 3000, 50), p0, p1: px(r, p0 * 0.88, p0 * 1.2), f: amt(r, 1, 20, 200, 10) }; },
    ask: (p) => `Vous avez acheté ${f0(p.q)} titres à ${fd(p.p0)} € et vous les revendez ${fd(p.p1)} €, avec ${eur(p.f)} de frais au total. Quel résultat net ?`,
    ans: (p) => p.q * (p.p1 - p.p0) - p.f, tol: rel(0.005, 5), explain: (p, a) => `${f0(p.q)} × (${fd(p.p1)} − ${fd(p.p0)}) − ${eur(p.f)} = ${eur(a)}.` },
  { key: "pnl_short", title: "Résultat d'une vente à découvert", cat: "trading", xp: 35, hint: "À découvert, on gagne quand le cours baisse : P&L = quantité × (cours de vente − cours de rachat).", unit: "€",
    gen: (r, sc) => { const p0 = px(r, 20, 150); return { q: amt(r, sc, 300, 3000, 50), p0, p1: px(r, p0 * 0.8, p0 * 1.1) }; },
    ask: (p) => `Vous avez vendu à découvert ${f0(p.q)} titres à ${fd(p.p0)} € et vous les rachetez ${fd(p.p1)} €. Quel résultat (hors frais) ?`,
    ans: (p) => p.q * (p.p0 - p.p1), tol: rel(0.005, 5), explain: (p, a) => `${f0(p.q)} × (${fd(p.p0)} − ${fd(p.p1)}) = ${eur(a)}.` },
  { key: "levier_perte", title: "Perte avec effet de levier", cat: "risque", xp: 35, hint: "Perte = capital × levier × baisse du sous-jacent.", unit: "€",
    gen: (r, sc) => ({ E: amt(r, sc, 10, 200, 1000), L: r.pick([2, 3, 4, 5, 8, 10]), v: r.pick([1, 2, 3, 4, 5]) }),
    ask: (p) => `Avec ${eur(p.E)} de capital et un levier ×${p.L}, l'actif sous-jacent baisse de ${p.v} %. Quelle perte en euros ?`,
    ans: (p) => (p.E * p.L * p.v) / 100, tol: rel(0.005, 1), explain: (p, a) => `${eur(p.E)} × ${p.L} × ${p.v} % = ${eur(a)} (soit ${p.L * p.v} % du capital).` },
  { key: "marge_init", title: "Marge initiale", cat: "risque", xp: 30, hint: "Marge = nominal × taux de marge.", unit: "€",
    gen: (r, sc) => ({ N: amt(r, sc, 50, 800, 5000), m: r.pick([5, 10, 15, 20, 25]) }),
    ask: (p) => `Un contrat à terme de ${eur(p.N)} de valeur nominale exige ${p.m} % de marge initiale. Quel dépôt de garantie ?`,
    ans: (p) => (p.N * p.m) / 100, tol: rel(0.005, 1), explain: (p, a) => `${eur(p.N)} × ${p.m} % = ${eur(a)}.` },
  { key: "taille_stop", title: "Taille de position et stop-loss", cat: "risque", xp: 40, hint: "Quantité = risque accepté ÷ (prix d'entrée − prix du stop).", unit: "titres",
    gen: (r, sc) => { const e = px(r, 20, 200); return { B: amt(r, sc, 5, 60, 100), e, s: px(r, e * 0.9, e * 0.97) }; },
    ask: (p) => `Vous acceptez de perdre au plus ${eur(p.B)} sur un trade. Entrée à ${fd(p.e)} €, stop-loss à ${fd(p.s)} €. Combien de titres au maximum ?`,
    ans: (p) => Math.floor(p.B / (p.e - p.s)), tol: (a) => Math.max(1, a * 0.01), explain: (p, a) => `${eur(p.B)} ÷ (${fd(p.e)} − ${fd(p.s)}) ≈ ${f0(a)} titres.` },
  { key: "ratio_rr", title: "Ratio rendement / risque d'un trade", cat: "trading", xp: 30, hint: "Ratio = gain visé ÷ perte maximale.", unit: "ratio",
    gen: (r) => { const e = px(r, 20, 200); return { e, s: px(r, e * 0.92, e * 0.97), t: px(r, e * 1.06, e * 1.2) }; },
    ask: (p) => `Entrée à ${fd(p.e)} €, stop à ${fd(p.s)} €, objectif à ${fd(p.t)} €. Quel ratio gain visé / perte maximale ?`,
    ans: (p) => (p.t - p.e) / (p.e - p.s), tol: abs(0.06), explain: (p, a) => `(${fd(p.t)} − ${fd(p.e)}) ÷ (${fd(p.e)} − ${fd(p.s)}) = ${fd(a, 2)}.` },
  { key: "pru", title: "Prix de revient moyen", cat: "trading", xp: 30, hint: "PRU = (q₁p₁ + q₂p₂) ÷ (q₁ + q₂).", unit: "€",
    gen: (r, sc) => ({ q1: amt(r, sc, 50, 500, 10), p1: px(r, 20, 150), q2: amt(r, sc, 50, 500, 10), p2: px(r, 20, 150) }),
    ask: (p) => `Vous détenez ${f0(p.q1)} titres achetés ${fd(p.p1)} € et vous en achetez ${f0(p.q2)} de plus à ${fd(p.p2)} €. Quel prix de revient moyen ?`,
    ans: (p) => (p.q1 * p.p1 + p.q2 * p.p2) / (p.q1 + p.q2), tol: rel(0.002, 0.03), explain: (p, a) => `(${f0(p.q1)} × ${fd(p.p1)} + ${f0(p.q2)} × ${fd(p.p2)}) ÷ ${f0(p.q1 + p.q2)} = ${fd(a, 2)} €.` },
  { key: "div_total", title: "Dividendes encaissés", cat: "analyse", xp: 25, hint: "Dividendes = nombre de titres × dividende par titre.", unit: "€",
    gen: (r, sc) => ({ n: amt(r, sc, 100, 5000, 100), d: Math.round(r.range(0.3, 4) * 100) / 100 }),
    ask: (p) => `Vous détenez ${f0(p.n)} actions qui versent ${fd(p.d)} € de dividende par action. Quel dividende total ?`,
    ans: (p) => p.n * p.d, tol: rel(0.005, 1), explain: (p, a) => `${f0(p.n)} × ${fd(p.d)} = ${eur(a)}.` },
  { key: "rend_div", title: "Rendement du dividende", cat: "analyse", xp: 25, hint: "Rendement = dividende ÷ cours.", unit: "%",
    gen: (r) => { const c = px(r, 20, 200); return { c, d: Math.round(c * r.range(0.015, 0.06) * 100) / 100 }; },
    ask: (p) => `Une action cote ${fd(p.c)} € et verse ${fd(p.d)} € par an. Quel rendement du dividende ?`,
    ans: (p) => (p.d / p.c) * 100, tol: abs(0.06), explain: (p, a) => `${fd(p.d)} ÷ ${fd(p.c)} = ${fd(a, 2)} %.` },
  { key: "per", title: "Ratio cours / bénéfices (PER)", cat: "analyse", xp: 30, hint: "PER = cours ÷ bénéfice par action.", unit: "fois",
    gen: (r) => { const c = px(r, 20, 200); return { c, e: Math.round((c / r.range(8, 30)) * 100) / 100 }; },
    ask: (p) => `Une action cote ${fd(p.c)} € pour un bénéfice par action de ${fd(p.e)} €. Quel PER ?`,
    ans: (p) => p.c / p.e, tol: abs(0.15), explain: (p, a) => `${fd(p.c)} ÷ ${fd(p.e)} = ${fd(a, 1)} fois.` },
  { key: "bpa", title: "Bénéfice par action", cat: "analyse", xp: 25, hint: "BPA = résultat net ÷ nombre d'actions.", unit: "€",
    gen: (r, sc) => ({ NI: amt(r, Math.max(1, sc), 50, 900, 10), n: r.int(20, 400) }),
    ask: (p) => `Une société a dégagé ${f0(p.NI)} millions d'euros de résultat net, pour ${f0(p.n)} millions d'actions. Quel bénéfice par action ?`,
    ans: (p) => p.NI / p.n, tol: abs(0.03), explain: (p, a) => `${f0(p.NI)} ÷ ${f0(p.n)} = ${fd(a, 2)} € par action.` },
  { key: "capi", title: "Capitalisation boursière", cat: "analyse", xp: 25, hint: "Capitalisation = cours × nombre d'actions.", unit: "Md€",
    gen: (r) => ({ c: px(r, 15, 400), n: r.int(80, 2500) }),
    ask: (p) => `Une action cote ${fd(p.c)} € et la société compte ${f0(p.n)} millions d'actions. Quelle capitalisation, en milliards d'euros ?`,
    ans: (p) => (p.c * p.n) / 1000, tol: rel(0.01, 0.05), explain: (p, a) => `${fd(p.c)} × ${f0(p.n)} millions = ${fd(a, 1)} milliards d'euros.` },
  { key: "ev", title: "Valeur d'entreprise", cat: "analyse", xp: 35, hint: "VE = capitalisation + dette nette (dette − trésorerie).", unit: "M€",
    gen: (r, sc) => ({ cap: amt(r, Math.max(1, sc) * 4, 200, 4000, 50), D: amt(r, Math.max(1, sc) * 2, 50, 1500, 10), T: amt(r, Math.max(1, sc), 20, 600, 10) }),
    ask: (p) => `Une société capitalise ${f0(p.cap)} M€, avec ${f0(p.D)} M€ de dette brute et ${f0(p.T)} M€ de trésorerie. Quelle valeur d'entreprise ?`,
    ans: (p) => p.cap + p.D - p.T, tol: rel(0.01, 1), explain: (p, a) => `${f0(p.cap)} + ${f0(p.D)} − ${f0(p.T)} = ${f0(a)} M€.` },
  { key: "ev_ebitda", title: "Multiple VE / EBITDA", cat: "analyse", xp: 35, hint: "Multiple = valeur d'entreprise ÷ EBITDA.", unit: "fois",
    gen: (r, sc) => { const eb = amt(r, Math.max(1, sc), 40, 800, 5); return { ev: Math.round(eb * r.range(5, 14)), eb }; },
    ask: (p) => `Une entreprise vaut ${f0(p.ev)} M€ (valeur d'entreprise) pour un EBITDA de ${f0(p.eb)} M€. Quel multiple VE/EBITDA ?`,
    ans: (p) => p.ev / p.eb, tol: abs(0.1), explain: (p, a) => `${f0(p.ev)} ÷ ${f0(p.eb)} = ${fd(a, 1)} fois.` },
  { key: "roe", title: "Rentabilité des fonds propres", cat: "analyse", xp: 30, hint: "ROE = résultat net ÷ fonds propres.", unit: "%",
    gen: (r, sc) => { const fp = amt(r, Math.max(1, sc), 200, 3000, 10); return { ni: Math.round(fp * r.range(0.04, 0.22)), fp }; },
    ask: (p) => `Une société a un résultat net de ${f0(p.ni)} M€ pour ${f0(p.fp)} M€ de fonds propres. Quel ROE ?`,
    ans: (p) => (p.ni / p.fp) * 100, tol: abs(0.2), explain: (p, a) => `${f0(p.ni)} ÷ ${f0(p.fp)} = ${fd(a, 1)} %.` },
  { key: "marge_nette", title: "Marge nette", cat: "analyse", xp: 25, hint: "Marge nette = résultat net ÷ chiffre d'affaires.", unit: "%",
    gen: (r, sc) => { const ca = amt(r, Math.max(1, sc), 300, 6000, 10); return { ca, ni: Math.round(ca * r.range(0.02, 0.2)) }; },
    ask: (p) => `Chiffre d'affaires de ${f0(p.ca)} M€ et résultat net de ${f0(p.ni)} M€ : quelle marge nette ?`,
    ans: (p) => (p.ni / p.ca) * 100, tol: abs(0.2), explain: (p, a) => `${f0(p.ni)} ÷ ${f0(p.ca)} = ${fd(a, 1)} %.` },
  { key: "dette_ebitda", title: "Levier financier d'une entreprise", cat: "risque", xp: 35, hint: "Levier = dette nette ÷ EBITDA ; au-delà de 3 à 4 fois, les banques s'inquiètent.", unit: "fois",
    gen: (r, sc) => { const eb = amt(r, Math.max(1, sc), 40, 700, 5); return { d: Math.round(eb * r.range(0.8, 5.5)), eb }; },
    ask: (p) => `Une entreprise a ${f0(p.d)} M€ de dette nette pour ${f0(p.eb)} M€ d'EBITDA. Quel ratio dette nette / EBITDA ?`,
    ans: (p) => p.d / p.eb, tol: abs(0.1), explain: (p, a) => `${f0(p.d)} ÷ ${f0(p.eb)} = ${fd(a, 1)} fois.` },
  { key: "peg", title: "Ratio PEG", cat: "analyse", xp: 30, hint: "PEG = PER ÷ croissance annuelle attendue des bénéfices (en %).", unit: "ratio",
    gen: (r) => ({ per: r.int(10, 40), g: r.pick([5, 8, 10, 12, 15, 20, 25]) }),
    ask: (p) => `Un titre se paie ${p.per} fois ses bénéfices, qui devraient croître de ${p.g} % par an. Quel PEG ?`,
    ans: (p) => p.per / p.g, tol: abs(0.1), explain: (p, a) => `${p.per} ÷ ${p.g} = ${fd(a, 2)} (en dessous de 1, la croissance est « bon marché »).` },
  { key: "gordon", title: "Valorisation par actualisation des dividendes", cat: "analyse", xp: 45, hint: "Valeur = dividende suivant ÷ (rendement exigé − croissance).", unit: "€",
    gen: (r) => ({ d: Math.round(r.range(1, 6) * 100) / 100, r: r.pick([6, 7, 8, 9, 10]), g: r.pick([1, 2, 3, 4]) }),
    ask: (p) => `Une action verse ${fd(p.d)} € de dividende l'an prochain, croissant de ${p.g} % par an. Rendement exigé : ${p.r} %. Quelle valeur théorique ?`,
    ans: (p) => p.d / ((p.r - p.g) / 100), tol: rel(0.01, 0.1), explain: (p, a) => `${fd(p.d)} ÷ (${p.r} % − ${p.g} %) = ${fd(a, 2)} €.` },
  { key: "van", title: "Valeur actuelle nette d'un projet", cat: "maths", xp: 45, hint: "VAN = −investissement + Σ flux ÷ (1 + taux)^année.", unit: "k€",
    gen: (r, sc) => { const I = amt(r, Math.max(1, sc), 100, 1000, 10); return { I, a: Math.round(I * r.range(0.3, 0.5)), b: Math.round(I * r.range(0.3, 0.5)), c: Math.round(I * r.range(0.3, 0.5)), i: r.pick([4, 5, 6, 8, 10]) }; },
    ask: (p) => `Un projet coûte ${f0(p.I)} k€ et rapporte ${f0(p.a)}, ${f0(p.b)} puis ${f0(p.c)} k€ sur trois ans. Taux d'actualisation ${p.i} %. Quelle VAN ?`,
    ans: (p) => -p.I + p.a / (1 + p.i / 100) + p.b / Math.pow(1 + p.i / 100, 2) + p.c / Math.pow(1 + p.i / 100, 3), tol: rel(0.005, 2), explain: (p, a) => `−${f0(p.I)} + ${f0(p.a)}/${fd(1 + p.i / 100, 2)} + ${f0(p.b)}/${fd(Math.pow(1 + p.i / 100, 2), 3)} + ${f0(p.c)}/${fd(Math.pow(1 + p.i / 100, 3), 3)} = ${fd(a, 1)} k€.` },
  { key: "annuite", title: "Échéance d'un emprunt", cat: "maths", xp: 40, hint: "Annuité = capital × i ÷ (1 − (1 + i)^−n).", unit: "€/an",
    gen: (r, sc) => ({ C: amt(r, sc, 100, 400, 5000), i: r.pick([2, 3, 3.5, 4, 5]), n: r.pick([10, 15, 20, 25]) }),
    ask: (p) => `Un emprunt de ${eur(p.C)} à ${fd(p.i, 1)} % sur ${p.n} ans, remboursé par annuités constantes. Quelle annuité ?`,
    ans: (p) => (p.C * (p.i / 100)) / (1 - Math.pow(1 + p.i / 100, -p.n)), tol: rel(0.005, 5), explain: (p, a) => `${eur(p.C)} × ${fd(p.i, 1)} % ÷ (1 − (1 + ${fd(p.i, 1)} %)^−${p.n}) = ${eur(a)} par an.` },
  { key: "epargne_fv", title: "Épargne régulière", cat: "maths", xp: 40, hint: "Capital = versement × ((1 + i)^n − 1) ÷ i.", unit: "€",
    gen: (r, sc) => ({ V: amt(r, sc, 2, 20, 500), i: r.pick([2, 3, 4, 5, 6]), n: r.pick([5, 8, 10, 15, 20]) }),
    ask: (p) => `Vous versez ${eur(p.V)} à la fin de chaque année pendant ${p.n} ans, à ${p.i} % par an. Quel capital au terme ?`,
    ans: (p) => (p.V * (Math.pow(1 + p.i / 100, p.n) - 1)) / (p.i / 100), tol: rel(0.005, 5), explain: (p, a) => `${eur(p.V)} × ((1 + ${p.i} %)^${p.n} − 1) ÷ ${p.i} % = ${eur(a)}.` },
  { key: "duration_prix", title: "Sensibilité d'une obligation aux taux", cat: "maths", xp: 40, hint: "Variation du prix ≈ −duration modifiée × variation du taux.", unit: "%",
    gen: (r) => ({ D: Math.round(r.range(2, 12) * 10) / 10, b: r.pick([10, 25, 50, 75, 100]) }),
    ask: (p) => `Une obligation a une duration modifiée de ${fd(p.D, 1)}. Les taux montent de ${p.b} points de base. De combien varie son prix, en pourcentage ?`,
    ans: (p) => -(p.D * p.b) / 100, tol: abs(0.05), explain: (p, a) => `−${fd(p.D, 1)} × ${p.b} pb = ${fd(a, 2)} % (1 pb = 0,01 %).` },
  { key: "zc_prix", title: "Prix d'une obligation zéro coupon", cat: "maths", xp: 40, hint: "Prix = 100 ÷ (1 + rendement)^années.", unit: "% du nominal",
    gen: (r) => ({ y: r.pick([2, 2.5, 3, 3.5, 4, 5, 6]), n: r.int(2, 10) }),
    ask: (p) => `Une obligation zéro coupon rembourse 100 dans ${p.n} ans. Le rendement exigé est de ${fd(p.y, 1)} %. Quel prix (pour 100 de nominal) ?`,
    ans: (p) => 100 / Math.pow(1 + p.y / 100, p.n), tol: abs(0.06), explain: (p, a) => `100 ÷ (1 + ${fd(p.y, 1)} %)^${p.n} = ${fd(a, 2)}.` },
  { key: "rend_courant", title: "Rendement courant d'une obligation", cat: "analyse", xp: 25, hint: "Rendement courant = coupon ÷ prix.", unit: "%",
    gen: (r) => ({ cp: r.pick([2, 2.5, 3, 4, 5, 6]), pr: px(r, 88, 112) }),
    ask: (p) => `Une obligation verse un coupon annuel de ${fd(p.cp, 1)} (pour 100 de nominal) et cote ${fd(p.pr)} %. Quel rendement courant ?`,
    ans: (p) => (p.cp / p.pr) * 100, tol: abs(0.03), explain: (p, a) => `${fd(p.cp, 1)} ÷ ${fd(p.pr)} = ${fd(a, 2)} %.` },
  { key: "change_conv", title: "Conversion de devises", cat: "macro", xp: 25, hint: "Montant converti = montant en euros × cours de la devise.", unit: "montant converti",
    gen: (r, sc) => { const f = r.int(0, FX.length - 1); const fx = FX[f]; return { A: amt(r, sc, 10, 400, 1000), f, r: Math.round(r.range(fx.lo, fx.hi) * 10 ** fx.d) / 10 ** fx.d }; },
    ask: (p) => `Un client convertit ${eur(p.A)} en ${FX[p.f].c} au cours de ${fd(p.r, FX[p.f].d)} ${FX[p.f].c} pour 1 €. Quel montant reçoit-il (en ${FX[p.f].c}) ?`,
    ans: (p) => p.A * p.r, tol: rel(0.005, 1), explain: (p, a) => `${eur(p.A)} × ${fd(p.r, FX[p.f].d)} = ${f0(a)} ${FX[p.f].c}.` },
  { key: "change_cross", title: "Cours croisé", cat: "macro", xp: 35, hint: "GBPUSD = EURUSD ÷ EURGBP.", unit: "USD pour 1 GBP",
    gen: (r) => ({ a: Math.round(r.range(1, 1.2) * 10000) / 10000, b: Math.round(r.range(0.82, 0.9) * 10000) / 10000 }),
    ask: (p) => `EURUSD = ${fd(p.a, 4)} et EURGBP = ${fd(p.b, 4)}. Combien de dollars pour une livre sterling ?`,
    ans: (p) => p.a / p.b, tol: abs(0.002), explain: (p, a) => `${fd(p.a, 4)} ÷ ${fd(p.b, 4)} = ${fd(a, 4)}.` },
  { key: "forward_fx", title: "Cours à terme EUR/USD", cat: "macro", xp: 45, hint: "Terme = comptant × (1 + taux USD × t) ÷ (1 + taux EUR × t).", unit: "USD pour 1 €",
    gen: (r) => ({ S: Math.round(r.range(1.05, 1.15) * 10000) / 10000, u: r.pick([3, 4, 5]), e: r.pick([1, 2, 3]), t: r.pick([0.25, 0.5, 1]) }),
    ask: (p) => `EURUSD au comptant : ${fd(p.S, 4)}. Taux USD ${p.u} %, taux EUR ${p.e} %, échéance ${fd(p.t, 2)} an. Quel cours à terme ?`,
    ans: (p) => (p.S * (1 + (p.u / 100) * p.t)) / (1 + (p.e / 100) * p.t), tol: abs(0.0015), explain: (p, a) => `${fd(p.S, 4)} × (1 + ${p.u} % × ${fd(p.t, 2)}) ÷ (1 + ${p.e} % × ${fd(p.t, 2)}) = ${fd(a, 4)}.` },
  { key: "parite_pc", title: "Parité call-put", cat: "maths", xp: 45, hint: "Put = call − cours + strike actualisé.", unit: "€",
    gen: (r) => { const S = px(r, 60, 140); return { S, C: px(r, 6, 14), rr: r.pick([2, 3, 4]) }; },
    ask: (p) => `Un call at-the-money (strike ${fd(p.S)} €, un an) vaut ${fd(p.C)} € ; le titre cote ${fd(p.S)} € ; taux sans risque ${p.rr} %. Quelle valeur pour le put de même strike ?`,
    ans: (p) => p.C - p.S + p.S / (1 + p.rr / 100), tol: abs(0.08), explain: (p, a) => `${fd(p.C)} − ${fd(p.S)} + ${fd(p.S)}/(1 + ${p.rr} %) = ${fd(a, 2)} €.` },
  { key: "val_intr", title: "Valeur intrinsèque d'options", cat: "maths", xp: 35, hint: "Call : max(cours − strike, 0) ; put : max(strike − cours, 0) ; × 100 par contrat.", unit: "€",
    gen: (r) => { const t = r.int(0, 1); const S = px(r, 40, 180); return { t, S, K: t === 0 ? px(r, S * 0.85, S * 0.97) : px(r, S * 1.03, S * 1.15), n: r.int(1, 20) }; },
    ask: (p) => `Vous détenez ${p.n} contrat(s) ${OPT[p.t]} de 100 titres, strike ${fd(p.K)} €, alors que le sous-jacent cote ${fd(p.S)} €. Quelle valeur intrinsèque totale ?`,
    ans: (p) => Math.abs(p.S - p.K) * 100 * p.n, tol: rel(0.005, 1), explain: (p, a) => `|${fd(p.S)} − ${fd(p.K)}| × 100 × ${p.n} = ${eur(a)}.` },
  { key: "breakeven_opt", title: "Seuil de rentabilité d'une option", cat: "maths", xp: 35, hint: "Call : strike + prime ; put : strike − prime.", unit: "€",
    gen: (r) => { const K0 = px(r, 40, 180); return { t: r.int(0, 1), K: K0, pr: px(r, K0 * 0.02, K0 * 0.09) }; },
    ask: (p) => `Vous achetez un ${OPT[p.t]} de strike ${fd(p.K)} € en payant une prime de ${fd(p.pr)} €. Quel cours du sous-jacent à l'échéance pour ne ni gagner ni perdre ?`,
    ans: (p) => (p.t === 0 ? p.K + p.pr : p.K - p.pr), tol: abs(0.03), explain: (p, a) => `${p.t === 0 ? `${fd(p.K)} + ${fd(p.pr)}` : `${fd(p.K)} − ${fd(p.pr)}`} = ${fd(a, 2)} €.` },
  { key: "payoff_exp", title: "Gain d'une option à l'échéance", cat: "maths", xp: 40, hint: "Gain net = valeur à l'échéance − prime payée, × 100 par contrat.", unit: "€",
    gen: (r) => { const K0 = px(r, 40, 180), t = r.int(0, 1); return { t, K: K0, pr: px(r, K0 * 0.02, K0 * 0.08), ST: px(r, K0 * 0.85, K0 * 1.2) }; },
    ask: (p) => `Un ${OPT[p.t]} de strike ${fd(p.K)} € a coûté ${fd(p.pr)} € (contrat de 100). À l'échéance, le sous-jacent cote ${fd(p.ST)} €. Quel résultat net pour un contrat ?`,
    ans: (p) => ((p.t === 0 ? Math.max(p.ST - p.K, 0) : Math.max(p.K - p.ST, 0)) - p.pr) * 100, tol: rel(0.005, 2), explain: (p, a) => `(${p.t === 0 ? `max(${fd(p.ST)} − ${fd(p.K)}, 0)` : `max(${fd(p.K)} − ${fd(p.ST)}, 0)`} − ${fd(p.pr)}) × 100 = ${eur(a)}.` },
  { key: "hedge_futures", title: "Couverture par contrats à terme", cat: "risque", xp: 50, hint: "Contrats = valeur du portefeuille × bêta ÷ (cours du future × multiplicateur).", unit: "contrats",
    gen: (r) => { const F = r.int(3000, 5500), c = r.int(6, 40), beta = Math.round(r.range(0.8, 1.3) * 100) / 100; return { F, m: 10, beta, V: Math.round((c * F * 10) / beta / 100000) * 100000 }; },
    ask: (p) => `Un portefeuille actions de ${eur(p.V)} a un bêta de ${fd(p.beta)}. Un future sur indice cote ${f0(p.F)} points à ${p.m} € le point. Combien de contrats vendre pour couvrir intégralement ?`,
    ans: (p) => (p.V * p.beta) / (p.F * p.m), tol: (a) => Math.max(0.6, a * 0.02), explain: (p, a) => `${eur(p.V)} × ${fd(p.beta)} ÷ (${f0(p.F)} × ${p.m}) ≈ ${fd(a, 1)} contrats.` },
  { key: "beta_ptf", title: "Bêta d'un portefeuille", cat: "risque", xp: 35, hint: "Bêta du portefeuille = Σ poids × bêta.", unit: "",
    gen: (r) => { const w = r.pick([[50, 30, 20], [40, 40, 20], [60, 25, 15], [34, 33, 33], [70, 20, 10]]); return { w1: w[0], w2: w[1], w3: w[2], b1: Math.round(r.range(0.6, 1.6) * 100) / 100, b2: Math.round(r.range(0.4, 1.4) * 100) / 100, b3: Math.round(r.range(0.2, 1.2) * 100) / 100 }; },
    ask: (p) => `Un portefeuille est réparti ${p.w1} % / ${p.w2} % / ${p.w3} % sur trois lignes de bêtas ${fd(p.b1)}, ${fd(p.b2)} et ${fd(p.b3)}. Quel bêta global ?`,
    ans: (p) => (p.w1 * p.b1 + p.w2 * p.b2 + p.w3 * p.b3) / 100, tol: abs(0.02), explain: (p, a) => `(${p.w1} × ${fd(p.b1)} + ${p.w2} × ${fd(p.b2)} + ${p.w3} × ${fd(p.b3)}) ÷ 100 = ${fd(a, 3)}.` },
  { key: "rend_pondere", title: "Rendement d'un portefeuille", cat: "analyse", xp: 30, hint: "Rendement du portefeuille = Σ poids × rendement.", unit: "%",
    gen: (r) => { const w = r.pick([[50, 30, 20], [40, 40, 20], [60, 25, 15], [25, 25, 50]]); return { w1: w[0], w2: w[1], w3: w[2], r1: Math.round(r.range(-6, 18) * 10) / 10, r2: Math.round(r.range(-6, 14) * 10) / 10, r3: Math.round(r.range(-6, 10) * 10) / 10 }; },
    ask: (p) => `Trois lignes pèsent ${p.w1} %, ${p.w2} % et ${p.w3} % et ont rapporté ${fd(p.r1, 1)} %, ${fd(p.r2, 1)} % et ${fd(p.r3, 1)} %. Quel rendement du portefeuille ?`,
    ans: (p) => (p.w1 * p.r1 + p.w2 * p.r2 + p.w3 * p.r3) / 100, tol: abs(0.06), explain: (p, a) => `(${p.w1} × ${fd(p.r1, 1)} + ${p.w2} × ${fd(p.r2, 1)} + ${p.w3} × ${fd(p.r3, 1)}) ÷ 100 = ${fd(a, 2)} %.` },
  { key: "vol_horizon", title: "Volatilité sur un horizon donné", cat: "risque", xp: 40, hint: "Volatilité sur n jours = volatilité annuelle × √(n ÷ 252).", unit: "%",
    gen: (r) => ({ s: r.int(10, 40), d: r.pick([5, 10, 21, 63]) }),
    ask: (p) => `Un actif a une volatilité annuelle de ${p.s} %. Quelle volatilité sur ${p.d} jours de bourse ?`,
    ans: (p) => p.s * Math.sqrt(p.d / 252), tol: abs(0.12), explain: (p, a) => `${p.s} % × √(${p.d} ÷ 252) = ${fd(a, 2)} %.` },
  { key: "var_param", title: "Valeur à risque d'une position", cat: "risque", xp: 45, hint: "VaR 99 % à 1 jour ≈ 2,33 × volatilité quotidienne × position.", unit: "€",
    gen: (r, sc) => ({ V: amt(r, sc, 2, 20, 50000), s: r.pick([0.8, 1, 1.2, 1.5, 2]) }),
    ask: (p) => `Une position de ${eur(p.V)} a une volatilité quotidienne de ${fd(p.s, 1)} %. Quelle VaR 99 % à un jour (z = 2,33) ?`,
    ans: (p) => 2.33 * (p.s / 100) * p.V, tol: rel(0.01, 5), explain: (p, a) => `2,33 × ${fd(p.s, 1)} % × ${eur(p.V)} = ${eur(a)}.` },
  { key: "sharpe", title: "Ratio de Sharpe", cat: "risque", xp: 40, hint: "Sharpe = (rendement − taux sans risque) ÷ volatilité.", unit: "",
    gen: (r) => ({ R: Math.round(r.range(4, 16) * 10) / 10, rf: r.pick([1, 2, 3, 4]), s: Math.round(r.range(8, 25) * 10) / 10 }),
    ask: (p) => `Un fonds rapporte ${fd(p.R, 1)} % par an avec ${fd(p.s, 1)} % de volatilité ; le taux sans risque est de ${p.rf} %. Quel ratio de Sharpe ?`,
    ans: (p) => (p.R - p.rf) / p.s, tol: abs(0.03), explain: (p, a) => `(${fd(p.R, 1)} − ${p.rf}) ÷ ${fd(p.s, 1)} = ${fd(a, 2)}.` },
  { key: "spread_bps", title: "Coût du spread", cat: "trading", xp: 30, hint: "Spread en points de base = (ask − bid) ÷ milieu × 10 000.", unit: "pb",
    gen: (r) => { const b = px(r, 20, 300); return { b, a: Math.round(b * (1 + r.range(0.0005, 0.004)) * 100) / 100 }; },
    ask: (p) => `Une action cote ${fd(p.b)} € à l'achat de la contrepartie (bid) et ${fd(p.a)} € à la vente (ask). Quel spread en points de base ?`,
    ans: (p) => ((p.a - p.b) / ((p.a + p.b) / 2)) * 10000, tol: abs(0.6), explain: (p, a) => `(${fd(p.a)} − ${fd(p.b)}) ÷ ${fd((p.a + p.b) / 2)} × 10 000 = ${fd(a, 1)} pb.` },
  { key: "cout_trans", title: "Coût d'une transaction", cat: "trading", xp: 25, hint: "Coût = quantité × cours × frais en points de base ÷ 10 000.", unit: "€",
    gen: (r, sc) => ({ q: amt(r, sc, 500, 5000, 100), c: px(r, 20, 200), b: r.pick([2, 5, 8, 10, 15]) }),
    ask: (p) => `Vous achetez ${f0(p.q)} titres à ${fd(p.c)} € avec ${p.b} points de base de frais. Quel coût en euros ?`,
    ans: (p) => (p.q * p.c * p.b) / 10000, tol: rel(0.005, 1), explain: (p, a) => `${f0(p.q)} × ${fd(p.c)} × ${p.b} ÷ 10 000 = ${eur(a)}.` },
  { key: "inflation_reelle", title: "Rendement réel", cat: "macro", xp: 30, hint: "Rendement réel = (1 + nominal) ÷ (1 + inflation) − 1.", unit: "%",
    gen: (r) => ({ n: r.pick([3, 4, 5, 6, 7]), i: r.pick([1.5, 2, 2.5, 3, 4]) }),
    ask: (p) => `Un placement rapporte ${p.n} % par an alors que l'inflation est de ${fd(p.i, 1)} %. Quel rendement réel ?`,
    ans: (p) => ((1 + p.n / 100) / (1 + p.i / 100) - 1) * 100, tol: abs(0.06), explain: (p, a) => `1,${String(p.n).padStart(2, "0")} ÷ ${fd(1 + p.i / 100, 3)} − 1 = ${fd(a, 2)} %.` },
  { key: "rule72", title: "Règle des 72", cat: "maths", xp: 20, hint: "Années pour doubler ≈ 72 ÷ taux.", unit: "ans",
    gen: (r) => ({ r: r.pick([2, 3, 4, 6, 8, 9, 12]) }),
    ask: (p) => `En appliquant la règle des 72, en combien d'années double un capital placé à ${p.r} % par an ?`,
    ans: (p) => 72 / p.r, tol: abs(0.35), explain: (p, a) => `72 ÷ ${p.r} = ${fd(a, 1)} ans.` },
  { key: "dv01", title: "Sensibilité en euros d'un portefeuille obligataire", cat: "risque", xp: 45, hint: "Gain ou perte ≈ nominal × duration modifiée × variation du taux.", unit: "€",
    gen: (r, sc) => ({ N: amt(r, sc, 10, 200, 100000), D: Math.round(r.range(2, 10) * 10) / 10, b: r.pick([1, 5, 10, 25]) }),
    ask: (p) => `Un portefeuille obligataire de ${eur(p.N)} a une duration modifiée de ${fd(p.D, 1)}. Les taux baissent de ${p.b} points de base. De combien gagne-t-il (en euros) ?`,
    ans: (p) => (p.N * p.D * p.b) / 10000, tol: rel(0.01, 5), explain: (p, a) => `${eur(p.N)} × ${fd(p.D, 1)} × ${p.b} ÷ 10 000 = ${eur(a)}.` },
  { key: "frais_gestion", title: "Impact des frais de gestion", cat: "client", xp: 40, hint: "Comparez le capital sans frais et avec frais : C(1+g)^n − C(1+g−frais)^n.", unit: "€",
    gen: (r, sc) => ({ C: amt(r, sc, 10, 150, 1000), g: r.pick([5, 6, 7]), f: r.pick([0.5, 1, 1.5, 2]), n: r.pick([10, 15, 20, 25]) }),
    ask: (p) => `${eur(p.C)} sont placés ${p.n} ans à ${p.g} % brut par an. Combien les frais annuels de ${fd(p.f, 1)} % coûtent-ils au final (écart entre le capital sans frais et avec frais) ?`,
    ans: (p) => p.C * (Math.pow(1 + p.g / 100, p.n) - Math.pow(1 + (p.g - p.f) / 100, p.n)), tol: rel(0.01, 10), explain: (p, a) => `${eur(p.C)} × ((1 + ${p.g} %)^${p.n} − (1 + ${fd(p.g - p.f, 1)} %)^${p.n}) = ${eur(a)}.` },
  { key: "bilan_fp", title: "Lire un bilan : les fonds propres", cat: "analyse", xp: 30, hint: "Fonds propres = total des actifs − dettes.", unit: "M€",
    gen: (r, sc) => { const A = amt(r, Math.max(1, sc), 300, 5000, 10); return { A, D: Math.round((A * r.range(0.3, 0.8)) / 10) * 10 }; },
    ask: (p) => `Le bilan d'une société affiche ${f0(p.A)} M€ d'actifs au total et ${f0(p.D)} M€ de dettes. Quels sont ses fonds propres ?`,
    ans: (p) => p.A - p.D, tol: rel(0.005, 1), explain: (p, a) => `${f0(p.A)} − ${f0(p.D)} = ${f0(a)} M€ (l'actif est financé par les dettes et par les fonds propres).` },
  { key: "liquidite_courante", title: "Ratio de liquidité d'une entreprise", cat: "risque", xp: 35, hint: "Ratio de liquidité = actifs à court terme ÷ dettes à court terme (sous 1, l'entreprise risque de ne pas pouvoir payer).", unit: "fois",
    gen: (r, sc) => { const d = amt(r, Math.max(1, sc), 50, 600, 10); return { ac: Math.round((d * r.range(0.6, 2.2)) / 10) * 10, d }; },
    ask: (p) => `Une entreprise a ${f0(p.ac)} M€ d'actifs à court terme (stocks, créances, cash) et ${f0(p.d)} M€ de dettes à court terme. Quel ratio de liquidité ?`,
    ans: (p) => p.ac / p.d, tol: abs(0.05), explain: (p, a) => `${f0(p.ac)} ÷ ${f0(p.d)} = ${fd(a, 2)} (${a < 1 ? "sous 1 : tension sur la trésorerie" : "au-dessus de 1 : elle peut payer ses dettes proches"}).` },
  { key: "couverture_interets", title: "Capacité à payer ses intérêts", cat: "risque", xp: 35, hint: "Couverture des intérêts = résultat d'exploitation ÷ charges d'intérêts.", unit: "fois",
    gen: (r, sc) => { const i = amt(r, Math.max(1, sc), 5, 80, 1); return { ebit: Math.round(i * r.range(1.5, 9)), i }; },
    ask: (p) => `Une société dégage ${f0(p.ebit)} M€ de résultat d'exploitation et paie ${f0(p.i)} M€ d'intérêts sur sa dette. De combien de fois couvre-t-elle ses intérêts ?`,
    ans: (p) => p.ebit / p.i, tol: abs(0.1), explain: (p, a) => `${f0(p.ebit)} ÷ ${f0(p.i)} = ${fd(a, 1)} fois (sous 2 à 3 fois, les prêteurs s'inquiètent).` },
  { key: "marge_op", title: "Marge d'exploitation", cat: "analyse", xp: 25, hint: "Marge d'exploitation = résultat d'exploitation ÷ chiffre d'affaires.", unit: "%",
    gen: (r, sc) => { const ca = amt(r, Math.max(1, sc), 300, 6000, 10); return { ca, eb: Math.round(ca * r.range(0.04, 0.3)) }; },
    ask: (p) => `Une entreprise vend pour ${f0(p.ca)} M€ et dégage ${f0(p.eb)} M€ de résultat d'exploitation. Quelle marge d'exploitation ?`,
    ans: (p) => (p.eb / p.ca) * 100, tol: abs(0.2), explain: (p, a) => `${f0(p.eb)} ÷ ${f0(p.ca)} = ${fd(a, 1)} %.` },
  { key: "roi", title: "Retour sur investissement", cat: "maths", xp: 25, hint: "ROI = (gain − coût) ÷ coût.", unit: "%",
    gen: (r, sc) => { const c = amt(r, sc, 5, 80, 500); return { c, g: Math.round((c * r.range(0.8, 1.6)) / 100) * 100 }; },
    ask: (p) => `Un investissement de ${eur(p.c)} rapporte au total ${eur(p.g)}. Quel retour sur investissement (ROI) ?`,
    ans: (p) => ((p.g - p.c) / p.c) * 100, tol: abs(0.2), explain: (p, a) => `(${f0(p.g)} − ${f0(p.c)}) ÷ ${f0(p.c)} = ${fd(a, 1)} %.` },
  { key: "seuil_rentab", title: "Seuil de rentabilité d'une activité", cat: "maths", xp: 40, hint: "Quantité à vendre = coûts fixes ÷ (prix de vente − coût variable unitaire).", unit: "unités",
    gen: (r, sc) => { const pv = px(r, 20, 120); return { F: amt(r, sc, 5, 100, 1000), pv, cv: px(r, pv * 0.3, pv * 0.7) }; },
    ask: (p) => `Une activité a ${eur(p.F)} de coûts fixes. Chaque unité se vend ${fd(p.pv)} € et coûte ${fd(p.cv)} € à fabriquer. Combien d'unités faut-il vendre pour ne ni gagner ni perdre ?`,
    ans: (p) => p.F / (p.pv - p.cv), tol: (a) => Math.max(1, a * 0.01), explain: (p, a) => `${f0(p.F)} ÷ (${fd(p.pv)} − ${fd(p.cv)}) ≈ ${f0(a)} unités.` },
  { key: "prix_futur", title: "Prix dans le futur avec l'inflation", cat: "macro", xp: 30, hint: "Prix futur = prix actuel × (1 + inflation)^années.", unit: "€",
    gen: (r, sc) => ({ P: amt(r, sc, 50, 500, 50), i: r.pick([2, 2.5, 3, 4, 5]), n: r.pick([3, 5, 8, 10]) }),
    ask: (p) => `Un panier de courses coûte ${eur(p.P)} aujourd'hui. Avec ${fd(p.i, 1)} % d'inflation par an, combien coûtera-t-il dans ${p.n} ans ?`,
    ans: (p) => p.P * Math.pow(1 + p.i / 100, p.n), tol: rel(0.005, 1), explain: (p, a) => `${eur(p.P)} × (1 + ${fd(p.i, 1)} %)^${p.n} = ${eur(a)}.` },
  { key: "croiss_ca", title: "Croissance du chiffre d'affaires", cat: "analyse", xp: 25, hint: "Croissance = (valeur finale ÷ valeur initiale − 1) × 100.", unit: "%",
    gen: (r, sc) => { const a = amt(r, Math.max(1, sc), 100, 3000, 10); return { a, b: Math.round(a * r.range(0.85, 1.4)) }; },
    ask: (p) => `Le chiffre d'affaires d'une société passe de ${f0(p.a)} M€ à ${f0(p.b)} M€. Quelle croissance en pourcentage ?`,
    ans: (p) => (p.b / p.a - 1) * 100, tol: abs(0.15), explain: (p, a) => `(${f0(p.b)} ÷ ${f0(p.a)} − 1) × 100 = ${fd(a, 1)} %.` },
  { key: "choix_roe", title: "Quelle société rapporte le plus à ses actionnaires ?", cat: "analyse", xp: 35, hint: "ROE = résultat net ÷ fonds propres.", unit: "",
    gen: (r) => { const o: Record<string, number> = {}; const v: number[] = []; const nm = distinct(r, 3, NAMES.length); for (let i = 0; i < 3; i++) { const fp = r.int(10, 80) * 10; const ni = Math.round(fp * r.range(0.04, 0.25)); o[`n${i}`] = nm[i]; o[`ni${i}`] = ni; o[`fp${i}`] = fp; v.push(ni / fp); } o.c = v.indexOf(Math.max(...v)); return o; },
    ask: () => "",
    choice: (p) => ({ question: "Quelle société a le meilleur ROE (résultat net ÷ fonds propres) ?", options: [0, 1, 2].map((i) => `${NAMES[p[`n${i}`]]} : résultat net ${f0(p[`ni${i}`])} M€, fonds propres ${f0(p[`fp${i}`])} M€`), correct: p.c, explain: `ROE : ${[0, 1, 2].map((i) => `${NAMES[p[`n${i}`]]} ${fd((p[`ni${i}`] / p[`fp${i}`]) * 100, 1)} %`).join(", ")}.` }) },
  { key: "choix_dette", title: "Quelle entreprise est la plus endettée ?", cat: "risque", xp: 35, hint: "Levier = dette nette ÷ EBITDA : plus il est haut, plus l'entreprise est endettée.", unit: "",
    gen: (r) => { const o: Record<string, number> = {}; const v: number[] = []; const nm = distinct(r, 3, NAMES.length); for (let i = 0; i < 3; i++) { const eb = r.int(5, 60) * 10; const d = Math.round(eb * r.range(0.5, 5)); o[`n${i}`] = nm[i]; o[`d${i}`] = d; o[`e${i}`] = eb; v.push(d / eb); } o.c = v.indexOf(Math.max(...v)); return o; },
    ask: () => "",
    choice: (p) => ({ question: "Quelle entreprise a le levier financier (dette nette ÷ EBITDA) le plus élevé ?", options: [0, 1, 2].map((i) => `${NAMES[p[`n${i}`]]} : dette nette ${f0(p[`d${i}`])} M€, EBITDA ${f0(p[`e${i}`])} M€`), correct: p.c, explain: `Levier : ${[0, 1, 2].map((i) => `${NAMES[p[`n${i}`]]} ${fd(p[`d${i}`] / p[`e${i}`], 1)} fois`).join(", ")}.` }) },
  { key: "choix_duration", title: "Quelle obligation souffre le plus d'une hausse des taux ?", cat: "risque", xp: 35, hint: "Plus la duration est longue, plus le prix réagit aux taux.", unit: "",
    gen: (r) => { const o: Record<string, number> = {}; const d = distinct(r, 3, 90).map((x) => Math.round((2 + x / 10) * 10) / 10); for (let i = 0; i < 3; i++) o[`d${i}`] = d[i]; o.c = d.indexOf(Math.max(...d)); return o; },
    ask: () => "",
    choice: (p) => ({ question: "Les taux montent de 1 %. Quelle obligation perd le plus de valeur ?", options: [0, 1, 2].map((i) => `Obligation ${"ABC"[i]} : duration modifiée ${fd(p[`d${i}`], 1)}`), correct: p.c, explain: `Variation ≈ − duration × 1 % : ${[0, 1, 2].map((i) => `${"ABC"[i]} ${fd(-p[`d${i}`], 1)} %`).join(", ")}.` }) },
  { key: "reflexe", title: "Quelle décision prendre ?", cat: "analyse", xp: 30, hint: "Raisonnez sur la cause et l'effet : que fait chaque acteur quand la situation change ?", unit: "",
    gen: (r) => ({ sc: r.int(0, REFLEX.length - 1), rot: r.int(0, 2) }),
    ask: () => "",
    choice: (p) => { const s0 = REFLEX[p.sc]; const opts = [0, 1, 2].map((i) => s0.o[(i + p.rot) % 3]); return { question: s0.q, options: opts, correct: (3 - p.rot) % 3, explain: s0.e }; } },
  { key: "compare_placements", title: "Comparer trois placements", cat: "client", xp: 35, hint: "Comparez les rendements nets de frais, pas les rendements bruts.", unit: "",
    gen: (r) => { const g = [0, 1, 2].map(() => Math.round(r.range(3, 7) * 10) / 10); const f = [0, 1, 2].map(() => Math.round(r.range(0.1, 1.8) * 10) / 10); const net = g.map((x, i) => x - f[i]); const best = net.indexOf(Math.max(...net)); const ok = net.filter((x) => Math.abs(x - net[best]) < 0.15).length === 1; return { g0: g[0], g1: g[1], g2: g[2], f0: f[0], f1: f[1], f2: f[2], ok: ok ? 1 : 0, c: best }; },
    ask: () => "",
    choice: (p) => ({ question: "Trois placements (rendement brut annuel, frais annuels). Lequel rapporte le plus net de frais ?", options: [0, 1, 2].map((i) => `Placement ${"ABC"[i]} : ${fd(p[`g${i}`], 1)} % brut, ${fd(p[`f${i}`], 1)} % de frais`), correct: p.c, explain: `Net de frais : ${[0, 1, 2].map((i) => `${"ABC"[i]} = ${fd(p[`g${i}`] - p[`f${i}`], 1)} %`).join(", ")}.` }) },
  { key: "compare_per4", title: "Quelle action est la moins chère ?", cat: "analyse", xp: 35, hint: "Comparez les PER (cours ÷ bénéfice par action).", unit: "",
    gen: (r) => { const o: Record<string, number> = {}; const pe: number[] = []; const nm = distinct(r, 4, NAMES.length); for (let i = 0; i < 4; i++) { const eps = px(r, 1, 12); const per = Math.round(r.range(8, 32) * 10) / 10; o[`n${i}`] = nm[i]; o[`e${i}`] = eps; o[`c${i}`] = Math.round(eps * per * 100) / 100; pe.push(o[`c${i}`] / eps); } o.c = pe.indexOf(Math.min(...pe)); return o; },
    ask: () => "",
    choice: (p) => ({ question: "Quelle société a le PER le plus bas ?", options: [0, 1, 2, 3].map((i) => `${NAMES[p[`n${i}`]]} (cours ${fd(p[`c${i}`])} €, bénéfice par action ${fd(p[`e${i}`])} €)`), correct: p.c, explain: `PER : ${[0, 1, 2, 3].map((i) => `${NAMES[p[`n${i}`]]} ${fd(p[`c${i}`] / p[`e${i}`], 1)}`).join(", ")}.` }) },
  { key: "compare_oblig", title: "Quelle obligation rapporte le plus ?", cat: "analyse", xp: 35, hint: "Rendement courant = coupon ÷ prix.", unit: "",
    gen: (r) => { const o: Record<string, number> = {}; const y: number[] = []; for (let i = 0; i < 3; i++) { o[`cp${i}`] = r.pick([2, 2.5, 3, 3.5, 4, 5, 6]); o[`pr${i}`] = px(r, 85, 115); y.push((o[`cp${i}`] / o[`pr${i}`]) * 100); } o.c = y.indexOf(Math.max(...y)); return o; },
    ask: () => "",
    choice: (p) => ({ question: "Quelle obligation offre le meilleur rendement courant ?", options: [0, 1, 2].map((i) => `Obligation ${"ABC"[i]} : coupon ${fd(p[`cp${i}`], 1)}, cours ${fd(p[`pr${i}`])} %`), correct: p.c, explain: `Rendements courants : ${[0, 1, 2].map((i) => `${"ABC"[i]} = ${fd((p[`cp${i}`] / p[`pr${i}`]) * 100, 2)} %`).join(", ")}.` }) },
  { key: "classer_risque", title: "Quelle position est la plus risquée ?", cat: "risque", xp: 35, hint: "À montant égal, la VaR croît avec la volatilité.", unit: "",
    gen: (r) => { const o: Record<string, number> = {}; const v: number[] = []; const nm = distinct(r, 4, NAMES.length); const vols = distinct(r, 4, 53).map((x) => x + 8); for (let i = 0; i < 4; i++) { o[`n${i}`] = nm[i]; o[`v${i}`] = vols[i]; v.push(vols[i]); } o.c = v.indexOf(Math.max(...v)); return o; },
    ask: () => "",
    choice: (p) => ({ question: "À montant investi égal, quel actif a la VaR la plus élevée ?", options: [0, 1, 2, 3].map((i) => `${NAMES[p[`n${i}`]]} (volatilité annuelle ${p[`v${i}`]} %)`), correct: p.c, explain: "La VaR est proportionnelle à la volatilité : l'actif le plus volatil est le plus risqué." }) },
];


/** La question dite autrement, en mots simples, avec la marche à suivre : affiché quand l'élève ne comprend pas */
const PLAIN: Record<string, string> = {
  bilan_fp: "Le bilan d'une entreprise a deux côtés qui s'égalent : ce qu'elle possède (actifs) = ce qu'elle doit (dettes) + ce qui appartient aux actionnaires (fonds propres). Donc fonds propres = actifs − dettes.",
  liquidite_courante: "On veut savoir si l'entreprise peut payer ses dettes qui arrivent bientôt avec ce qu'elle a sous la main (stocks, créances, cash). On divise ce qu'elle a à court terme par ce qu'elle doit à court terme. Au-dessus de 1, c'est rassurant.",
  couverture_interets: "On compare ce que gagne l'entreprise (avant intérêts) aux intérêts qu'elle doit payer. Plus le rapport est grand, plus elle paie ses intérêts facilement : on divise le résultat d'exploitation par les intérêts.",
  marge_op: "La marge d'exploitation dit combien l'activité courante garde sur chaque euro vendu, avant intérêts et impôts : résultat d'exploitation ÷ chiffre d'affaires, en pourcentage.",
  roi: "Le retour sur investissement compare ce qu'on a gagné à ce qu'on a dépensé : (ce qu'on récupère − ce qu'on a payé) ÷ ce qu'on a payé, en pourcentage.",
  seuil_rentab: "Chaque unité vendue rapporte « prix − coût variable » : c'est sa contribution pour payer les coûts fixes. On cherche combien d'unités il faut pour couvrir tous les coûts fixes : coûts fixes ÷ contribution par unité.",
  prix_futur: "L'inflation augmente les prix chaque année, avec des « intérêts composés » : prix futur = prix actuel × (1 + inflation)^nombre d'années.",
  croiss_ca: "La croissance dit de combien (en pourcentage) une grandeur a augmenté : (valeur finale ÷ valeur initiale − 1) × 100. Négatif = recul.",
  choix_roe: "Le ROE mesure ce que rapporte chaque euro des actionnaires. Calculez résultat net ÷ fonds propres pour chaque société et prenez le plus élevé.",
  choix_dette: "Le levier financier = dette nette ÷ EBITDA : le nombre d'années de résultat nécessaires pour rembourser la dette. Calculez-le pour chaque entreprise, la plus endettée a le chiffre le plus haut.",
  choix_duration: "La duration mesure la sensibilité d'une obligation aux taux : plus elle est longue, plus le prix baisse quand les taux montent. Cherchez la duration la plus élevée.",
  reflexe: "Question de logique économique : demandez-vous quelle est la cause (taux, devise, bénéfices…), qui est touché et dans quel sens. La réponse est celle qui suit la logique du marché.",

  int_simple: "Un placement rapporte de l'argent chaque année : ce sont les intérêts. « Simples » veut dire qu'on les calcule toujours sur la somme de départ, jamais sur les intérêts déjà gagnés. Calculez donc les intérêts d'une seule année (capital × taux), puis multipliez par le nombre d'années.",
  int_compose: "Ici les intérêts gagnés sont ajoutés au capital, donc l'année suivante ils rapportent eux aussi des intérêts. Chaque année, le capital est multiplié par (1 + taux). Il suffit de répéter cette multiplication autant de fois qu'il y a d'années : capital × (1 + taux)^années.",
  taux_equiv: "On vous donne un petit taux appliqué chaque mois. Question : quel serait le taux sur une année entière ? Comme chaque mois les intérêts s'ajoutent au capital, on multiplie 12 fois par (1 + taux mensuel), puis on retire 1 et on exprime en pourcentage.",
  rend_total: "On veut savoir combien l'action a rapporté au total, en pourcentage de son prix d'achat. Il y a deux sources de gain : l'évolution du cours (prix final − prix initial) et le dividende reçu. On additionne les deux, puis on divise par le prix initial.",
  cagr: "Le portefeuille a grossi sur plusieurs années. On cherche le pourcentage moyen gagné par an, en tenant compte des intérêts composés. On divise la valeur finale par la valeur initiale, on prend la racine n-ième (n = nombre d'années), puis on retire 1.",
  var_enchainee: "Attention au piège : +20 % puis −20 % ne revient pas à zéro, car la baisse s'applique à un prix plus grand. On multiplie les deux coefficients : (1 + hausse) × (1 − baisse), puis on retire 1 pour retrouver une variation.",
  pnl_long: "« P&L » veut dire « profit et perte » : ce qu'on gagne ou perd. On a acheté puis revendu. Le gain par titre est (prix de vente − prix d'achat). On le multiplie par le nombre de titres, puis on retire les frais payés.",
  pnl_short: "Vendre à découvert, c'est vendre un titre qu'on a emprunté, en espérant le racheter moins cher. Le gain par titre est donc (prix de vente − prix de rachat) : positif si le cours a baissé. On le multiplie par le nombre de titres.",
  levier_perte: "Le levier amplifie les gains et les pertes. Avec un levier de 5 et un capital de 10 000 €, on contrôle 50 000 € d'actifs. Si ces actifs baissent de 2 %, on perd 2 % de 50 000 €. Calculez la perte : capital × levier × baisse.",
  marge_init: "Pour ouvrir un contrat à terme, on ne paie pas sa valeur totale : on bloque seulement un pourcentage, appelé marge ou dépôt de garantie. Il suffit d'appliquer ce pourcentage à la valeur du contrat.",
  taille_stop: "On se fixe une perte maximale en euros. Le stop-loss fixe le prix de sortie si ça tourne mal : la perte par titre est (prix d'entrée − prix du stop). Pour ne pas dépasser le budget, on divise la perte acceptée par la perte par titre. On arrondit à l'entier inférieur.",
  ratio_rr: "On compare ce qu'on peut gagner à ce qu'on peut perdre. Gain visé par titre = objectif − entrée. Perte maximale par titre = entrée − stop. Le ratio est le premier divisé par le second : plus il est grand, plus le trade est intéressant.",
  pru: "Quand on achète en deux fois à des prix différents, le prix moyen payé n'est pas la simple moyenne des deux prix : il faut pondérer par les quantités. Total payé = q1 × p1 + q2 × p2 ; on le divise par le nombre total de titres.",
  div_total: "Chaque action donne droit à un dividende. Si on possède plusieurs actions, on multiplie : nombre d'actions × dividende par action.",
  rend_div: "Le rendement du dividende dit quelle part du prix de l'action est « rendue » chaque année en dividende. On divise le dividende annuel par le cours, puis on multiplie par 100 pour avoir un pourcentage.",
  per: "Le PER dit combien d'années de bénéfices il faut pour « rembourser » le prix de l'action : un PER de 15 signifie qu'on paie 15 fois le bénéfice annuel. On divise le cours par le bénéfice par action.",
  bpa: "Le bénéfice par action est la part du bénéfice qui revient à chaque action. On divise le résultat net de la société par le nombre d'actions. Attention : les deux chiffres sont ici en millions, donc le résultat est directement en euros par action.",
  capi: "La capitalisation boursière est la valeur de toute l'entreprise vue par la bourse : le prix d'une action multiplié par le nombre d'actions. Les actions sont en millions, et on demande la réponse en milliards : divisez par 1 000.",
  ev: "La valeur d'entreprise est le prix pour racheter toute l'entreprise, dettes comprises, en récupérant sa trésorerie : capitalisation + dette − trésorerie disponible.",
  ev_ebitda: "Un multiple compare le prix de l'entreprise à ce qu'elle gagne avant intérêts, impôts et amortissements (l'EBITDA). On divise la valeur d'entreprise par l'EBITDA : le résultat se lit « on paie X fois le résultat ».",
  roe: "Le ROE mesure le rendement obtenu avec l'argent des actionnaires. On divise le résultat net par les fonds propres, puis on exprime en pourcentage.",
  marge_nette: "La marge nette dit combien l'entreprise garde de bénéfice sur chaque euro vendu. On divise le résultat net par le chiffre d'affaires et on exprime en pourcentage.",
  dette_ebitda: "Ce ratio dit en combien d'années de résultat (EBITDA) l'entreprise pourrait rembourser sa dette nette. On divise la dette nette par l'EBITDA.",
  peg: "Un PER élevé peut se justifier si l'entreprise croît vite. Le PEG corrige cela : on divise le PER par la croissance attendue des bénéfices, exprimée en pourcentage (sans le signe %).",
  gordon: "On estime la valeur d'une action par ses dividendes futurs, qui croissent à un rythme régulier. Formule : dividende de l'an prochain ÷ (rendement exigé − croissance), avec les deux taux écrits en pourcentage puis convertis (6 % = 0,06).",
  van: "Pour comparer de l'argent à des dates différentes, on ramène chaque flux futur à aujourd'hui en le divisant par (1 + taux)^année. La VAN est la somme de ces valeurs d'aujourd'hui, moins l'investissement de départ. Positive : le projet est rentable.",
  annuite: "On rembourse un emprunt avec une somme identique chaque année. La formule donne cette somme : capital × taux ÷ (1 − (1 + taux)^−durée). Utilisez le taux écrit en décimal (4 % = 0,04).",
  epargne_fv: "On verse la même somme chaque année et chaque versement rapporte des intérêts jusqu'à la fin. Le capital final vaut : versement × ((1 + taux)^années − 1) ÷ taux.",
  duration_prix: "La duration modifiée dit de combien (en pourcentage) le prix d'une obligation varie quand les taux bougent de 1 %. Un point de base vaut 0,01 %. Variation du prix ≈ − duration × variation des taux ; si les taux montent, le prix baisse (signe moins).",
  zc_prix: "Une obligation zéro coupon ne verse rien avant l'échéance où elle rembourse 100. Son prix d'aujourd'hui est ces 100 ramenés à aujourd'hui : 100 ÷ (1 + rendement)^années.",
  rend_courant: "Le rendement courant compare ce que rapporte le coupon chaque année au prix payé : coupon ÷ prix × 100. C'est une mesure simple, qui ne tient pas compte du remboursement final.",
  change_conv: "Le cours indique combien d'unités de la devise étrangère on obtient pour 1 euro. Pour convertir des euros dans cette devise, on multiplie le montant en euros par le cours.",
  change_cross: "On connaît deux cours qui ont l'euro en commun et on veut un troisième cours sans euro. EURUSD = dollars pour 1 €, EURGBP = livres pour 1 €. Pour avoir des dollars pour 1 livre, on divise EURUSD par EURGBP.",
  forward_fx: "Le cours à terme fixe aujourd'hui le prix d'une devise pour plus tard. Il tient compte de l'écart d'intérêts : la devise qui paie le plus d'intérêts se déprécie à terme. Formule : comptant × (1 + taux USD × durée) ÷ (1 + taux EUR × durée).",
  parite_pc: "Call et put de même strike et même échéance sont liés. Quand on connaît le call, on retrouve le put : put = call − cours de l'action + strike actualisé (strike ÷ (1 + taux sans risque)).",
  val_intr: "La valeur intrinsèque est ce que l'option rapporterait si on l'exerçait tout de suite. Call : cours − strike (si positif). Put : strike − cours (si positif). Un contrat porte sur 100 titres, on multiplie donc par 100 et par le nombre de contrats.",
  breakeven_opt: "Quand on achète une option, on paie une prime. Pour récupérer cette prime, le prix du sous-jacent doit aller assez loin. Call : strike + prime. Put : strike − prime.",
  payoff_exp: "À l'échéance, un call vaut max(cours − strike ; 0) et un put max(strike − cours ; 0). Le gain net est cette valeur moins la prime payée. Un contrat porte sur 100 titres : multipliez par 100.",
  hedge_futures: "Pour protéger un portefeuille d'actions on vend des contrats à terme sur indice. On veut que la valeur « couverte » soit la même : valeur du portefeuille × bêta, divisée par la valeur d'un contrat (cours du future × multiplicateur).",
  beta_ptf: "Le bêta d'un portefeuille est la moyenne des bêtas de ses lignes, pondérée par leur poids. Multipliez chaque bêta par le poids de sa ligne (en pourcentage), additionnez, divisez par 100.",
  rend_pondere: "Le rendement du portefeuille est la moyenne des rendements de ses lignes, pondérée par leur poids. Multipliez chaque rendement par le poids de sa ligne, additionnez, divisez par 100.",
  vol_horizon: "La volatilité annuelle ne s'applique pas telle quelle à une période plus courte : elle se réduit comme la racine carrée du temps. Il y a environ 252 jours de bourse par an. Volatilité sur n jours = volatilité annuelle × √(n ÷ 252).",
  var_param: "La VaR estime la perte à ne pas dépasser (sauf 1 jour sur 100). Avec un niveau de confiance de 99 %, on multiplie la volatilité quotidienne par 2,33 puis par la valeur de la position.",
  sharpe: "Le ratio de Sharpe dit combien de rendement « en plus » on obtient par unité de risque. On retire le taux sans risque du rendement du fonds, puis on divise par la volatilité.",
  spread_bps: "Le spread est l'écart entre le prix d'achat et le prix de vente, un coût caché. On le rapporte au prix moyen et on l'exprime en points de base : 1 point de base = 0,01 %. Spread (pb) = (ask − bid) ÷ milieu × 10 000.",
  cout_trans: "Les frais sont exprimés en points de base (1 pb = 0,01 %). Montant de la transaction = quantité × cours. Coût = montant × nombre de pb ÷ 10 000.",
  inflation_reelle: "L'inflation réduit ce que l'argent permet d'acheter. Le rendement réel enlève cet effet : on divise (1 + rendement) par (1 + inflation), puis on retire 1.",
  rule72: "Astuce de calcul mental : le nombre d'années pour doubler un capital est à peu près 72 divisé par le taux annuel en pourcentage.",
  dv01: "Une variation de taux de quelques points de base change la valeur d'un portefeuille d'obligations. Gain ≈ valeur du portefeuille × duration modifiée × variation en points de base ÷ 10 000 (les taux baissent : le prix monte).",
  frais_gestion: "Les frais réduisent le rendement chaque année, et l'effet s'accumule avec le temps. Calculez le capital final sans frais (rendement brut) puis avec frais (rendement brut − frais), et faites la différence.",
  compare_placements: "Pour comparer, ne regardez pas seulement le rendement affiché : ce qui compte, c'est ce qui reste après les frais. Calculez rendement − frais pour chaque placement, puis choisissez le plus élevé.",
  compare_per4: "Le PER d'une action = cours ÷ bénéfice par action. Calculez-le pour chaque société : le plus bas est le moins cher par rapport à ses bénéfices.",
  compare_oblig: "Le rendement courant d'une obligation = coupon ÷ prix. Calculez-le pour chaque obligation et choisissez le plus élevé.",
  classer_risque: "La VaR croît avec la volatilité : à montant égal, l'actif le plus volatil est celui qui peut faire perdre le plus. Cherchez la volatilité la plus élevée.",
};
export const FAM_BY_KEY: Record<string, Fam> = Object.fromEntries(FAMS.map((f) => [f.key, f]));
export interface WorkedExample { question: string; options?: string[]; answer: string; explain: string }
/** Exemples résolus (autres chiffres, même problème) : montrent la méthode du début à la fin, avec les mots de la question expliqués */
export function famExamples(key: string, n = 2): WorkedExample[] {
  const f = FAM_BY_KEY[key]; if (!f) return [];
  const out: WorkedExample[] = [];
  for (let i = 0; i < n; i++) {
    const r = new Rng(seedRng(`ex-${key}-${i}`)); let vals: Record<string, number> = {};
    for (let k = 0; k < 8; k++) { vals = f.gen(r, 0.4); if (vals.ok === undefined || vals.ok === 1) break; }
    if (f.choice) { const c = f.choice(vals); out.push({ question: c.question, options: c.options, answer: c.options[c.correct], explain: c.explain }); }
    else { const a = f.ans!(vals); out.push({ question: f.ask(vals), answer: `${fd(a, Math.abs(a) < 10 ? 2 : Math.abs(a) < 1000 ? 1 : 0)} ${f.unit}`.trim(), explain: f.explain!(vals, a) }); }
  }
  return out;
}
export const famPlain = (key: string) => PLAIN[key];
export const famHint = (key: string) => FAM_BY_KEY[key]?.hint;

/** Compte la première famille « choix » : (les trois dernières familles + celle des placements sont des QCM calculés) */
function famTemplate(fam: Fam, ci: number): BankTpl {
  const ctx = CTX[ci];
  const id = `p_${fam.key}_${ci}`;
  const isChoice = !!fam.choice;
  return {
    id, category: fam.cat, xp: Math.round(fam.xp * 0.75), rep: { professionnelle: 1 }, days: 2, kind: "calc", family: fam.key,
    make: (_s, p, rng) => {
      const k = K(p), sc = ctx.sc * (1 + 0.25 * (k - 1));
      let vals: Record<string, number> = {};
      for (let t = 0; t < 8; t++) { vals = fam.gen(rng, sc); if (vals.ok === undefined || vals.ok === 1) break; }
      for (const k of Object.keys(vals)) if (vals[k] === 0) vals[k] = 0; // évite -0 (perdu à la sauvegarde JSON)
      const intro = rng.pick(ctx.intro);
      const qtext = isChoice ? fam.choice!(vals).question : fam.ask(vals);
      return {
        title: `${fam.title} · ${ctx.label}`,
        description: `${intro} ${qtext}${isChoice ? "" : ` (${rng.pick(["Formule utile", "Rappel", "Indice", "Pour mémoire"])} : ${fam.hint})`}${rng.chance(0.6) ? ` ${rng.pick(ctx.outro)}` : ""}`,
        criteria: [isChoice ? "Bonne réponse" : `Réponse à ${fam.tol ? "la tolérance indiquée" : "1 %"} près`],
        params: { ...vals, _fam: fam.key, _ctx: ci },
      };
    },
    check: () => 0,
    ...(isChoice
      ? { choiceQuiz: (_s: GameState, m: Mission) => fam.choice!(P(m.params)) }
      : { quiz: (_s: GameState, m: Mission) => { const p = P(m.params), a = fam.ans!(p), tol = fam.tol!(a); return { answer: a, tolerance: tol, unit: fam.unit, question: fam.ask(p), explain: fam.explain!(p, a) }; } }),
    guide: () => ({ steps: ["Lisez l'énoncé et posez le calcul avec les chiffres donnés.", `Rappel : ${fam.hint}`, isChoice ? "Choisissez la bonne réponse ci-dessous." : "Saisissez votre résultat ci-dessous : une tolérance est admise pour les arrondis."], link: "/play/missions", linkLabel: "Retour aux missions", tip: fam.hint }),
  };
}

/* ───────── 72 missions d'action ───────── */
const SECTORS: Sector[] = ["Technologie", "Banque", "Industrie", "Énergie", "Santé", "Luxe", "Distribution", "Télécoms", "Automobile", "Immobilier", "Assurance", "Matériaux"];
const ZONES: [ZoneId, string][] = [["US", "États-Unis"], ["EZ", "zone euro"], ["UK", "Royaume-Uni"], ["JP", "Japon"], ["CN", "Chine"], ["EM", "pays émergents"]];
const CLASSES: [AssetClass, string, string][] = [["etf", "un ETF", "ETF"], ["obligation", "une obligation", "obligations"], ["matiere", "une matière première", "matières premières"], ["crypto", "un cryptoactif", "cryptoactifs"], ["devise", "une paire de devises", "devises"]];
const manual = (s: GameState, m: Mission) => s.fills.filter((f) => f.t >= m.startT && (f.account === "perso" || f.account === "desk") && !s.orders.find((o) => o.id === f.orderId)?.tag);
const notion = (f: { qty: number; price: number }) => f.qty * f.price;
const baseEq = (s: GameState) => Math.max(accountEquity(s, "perso"), 3000);
const round50 = (x: number) => Math.max(250, Math.round(x / 50) * 50);
const mk = (partial: Omit<BankTpl, "kind" | "rep"> & { rep?: BankTpl["rep"] }): BankTpl => ({ kind: "action", rep: { professionnelle: 1 }, ...partial });
const G = (steps: string[], link: string, linkLabel: string, tip?: string) => () => ({ steps, link, linkLabel, tip });
const heldViews = (s: GameState) => [...positionViews(s, "perso"), ...(s.accounts.desk ? positionViews(s, "desk") : [])];

function actionTemplates(): BankTpl[] {
  const out: BankTpl[] = [];
  // 1. une position dans un secteur (12)
  for (const sec of SECTORS) out.push(mk({ id: `a_secteur_${sec}`, category: "trading", xp: 40, days: 5, family: "secteur",
    make: (s) => { if (!Object.values(s.instruments).some((d) => d.cls === "action" && d.sector === sec)) return null; const target = round50(baseEq(s) * 0.04); return { title: `Prendre position dans le secteur ${sec}`, description: `Votre responsable veut une idée dans le secteur ${sec} : achetez des actions du secteur pour au moins ${eur(target)} (compte personnel ou book du desk).`, criteria: [`≥ ${eur(target)} d'actions ${sec} achetées`], params: { target, sec } }; },
    check: (s, m) => Math.min(1, manual(s, m).filter((f) => f.side === "buy" && s.instruments[f.instrumentId]?.sector === m.params.sec && s.instruments[f.instrumentId]?.cls === "action").reduce((a, f) => a + notion(f), 0) / Number(m.params.target)),
    guide: G([`Ouvrez la recherche et filtrez par secteur « ${sec} ».`, "Ouvrez la fiche d'une valeur, vérifiez PER et actualités.", "Achetez au moins le montant demandé."], "/play/recherche", "Rechercher un titre", "Comparez au moins deux valeurs du secteur avant d'acheter.") }));
  // 2. une position dans une zone (6)
  for (const [z, label] of ZONES) out.push(mk({ id: `a_zone_${z}`, category: "marches", xp: 40, days: 5, family: "zone",
    make: (s) => { if (!Object.values(s.instruments).some((d) => (d.cls === "action" || d.cls === "etf") && d.zone === z)) return null; const target = round50(baseEq(s) * 0.04); return { title: `Exposition ${label}`, description: `Le comité souhaite une exposition ${label} : achetez des actions ou ETF cotés dans cette zone pour au moins ${eur(target)}.`, criteria: [`≥ ${eur(target)} d'actions ou d'ETF de la zone ${label}`], params: { target, z } }; },
    check: (s, m) => Math.min(1, manual(s, m).filter((f) => f.side === "buy" && s.instruments[f.instrumentId]?.zone === m.params.z && ["action", "etf"].includes(s.instruments[f.instrumentId]?.cls)).reduce((a, f) => a + notion(f), 0) / Number(m.params.target)),
    guide: G([`Dans la recherche, repérez les titres de la zone ${label}.`, "Achetez-en pour le montant demandé."], "/play/recherche", "Rechercher un titre") }));
  // 3. par classe d'actifs : acheter, détenir, vendre avec profit (15)
  for (const [cls, one, many] of CLASSES) {
    out.push(mk({ id: `a_classe_achat_${cls}`, category: "trading", xp: 35, days: 5, family: "classe_achat",
      make: (s) => { if (!Object.values(s.instruments).some((d) => d.cls === cls)) return null; return { title: `Acheter ${one}`, description: `Découvrez les ${many} : achetez ${one} (compte personnel ou book du desk).`, criteria: [`Au moins un achat de ${many}`], params: { cls } }; },
      check: (s, m) => (manual(s, m).some((f) => f.side === "buy" && s.instruments[f.instrumentId]?.cls === cls) ? 1 : 0),
      guide: G([`Cherchez un instrument de la catégorie « ${many} ».`, "Passez un ordre d'achat, même modeste."], "/play/recherche", "Rechercher un instrument") }));
    out.push(mk({ id: `a_classe_detenir_${cls}`, category: "risque", xp: 45, days: 7, family: "classe_detenir",
      make: (s) => { if (!Object.values(s.instruments).some((d) => d.cls === cls)) return null; const target = round50(baseEq(s) * 0.05); return { title: `Détenir des ${many}`, description: `Constituez une ligne en ${many} d'au moins ${eur(target)} de valeur de marché (compte personnel ou desk) avant l'échéance.`, criteria: [`≥ ${eur(target)} de ${many} détenus`], params: { cls, target } }; },
      check: (s, m) => Math.min(1, heldViews(s).filter((v) => v.cls === cls).reduce((a, v) => a + Math.abs(v.mvEur), 0) / Number(m.params.target)),
      guide: G([`Achetez des ${many} pour la valeur demandée.`, "La valeur se lit dans le portefeuille."], "/play/portefeuille", "Voir mon portefeuille") }));
    out.push(mk({ id: `a_classe_profit_${cls}`, category: "trading", xp: 60, days: 10, family: "classe_profit",
      make: (s) => { if (!Object.values(s.instruments).some((d) => d.cls === cls)) return null; return { title: `Un gain réalisé sur ${one}`, description: `Réalisez un profit : vendez ${one} avec un gain réalisé positif (achat puis vente).`, criteria: [`Une vente de ${many} avec P&L réalisé > 0`], params: { cls } }; },
      check: (s, m) => (manual(s, m).some((f) => f.side === "sell" && f.realized > 0 && s.instruments[f.instrumentId]?.cls === cls) ? 1 : 0),
      guide: G([`Achetez ${one}, attendez une hausse, puis vendez.`, "Le P&L réalisé apparaît dans l'historique des transactions."], "/play/transactions", "Voir les transactions", "Un stop-loss limite la casse si le marché tourne.") }));
  }
  // 4. types d'ordre (6)
  const orderM = (id: string, title: string, desc: string, crit: string, pred: (o: GameState["orders"][number]) => boolean, steps: string[]) => out.push(mk({ id, category: "trading", xp: 40, days: 7, family: "ordre",
    make: () => ({ title, description: desc, criteria: [crit], params: {} }),
    check: (s, m) => (s.orders.some((o) => o.createdT >= m.startT && (o.account === "perso" || o.account === "desk") && pred(o)) ? 1 : 0),
    guide: G(steps, "/play/ordres", "Passer un ordre") }));
  orderM("a_ordre_limite", "Placer un ordre à cours limité", "Un ordre limité garantit un prix maximum d'achat (ou minimum de vente) : placez-en un.", "Un ordre « limite » placé", (o) => o.type === "limit", ["Ouvrez une fiche, choisissez le type « Limite ».", "Fixez un prix, validez."]);
  orderM("a_ordre_stop", "Protéger une position avec un stop", "Placez un ordre stop pour limiter la perte d'une position ouverte.", "Un ordre « stop » placé", (o) => o.type === "stop" || o.type === "stop_limit", ["Choisissez le type « Stop » avec un prix en dessous du cours.", "Validez."]);
  orderM("a_ordre_vente_limite", "Vendre à un objectif de cours", "Placez un ordre de vente limité au-dessus du cours actuel pour sécuriser un gain.", "Un ordre de vente limité placé", (o) => o.type === "limit" && o.side === "sell", ["Sur une position gagnante, choisissez Vendre, type « Limite ».", "Fixez le prix cible."]);
  orderM("a_ordre_achat_limite", "Acheter moins cher", "Placez un ordre d'achat limité sous le cours actuel : on n'achète que si le prix baisse.", "Un ordre d'achat limité placé", (o) => o.type === "limit" && o.side === "buy", ["Choisissez Acheter, type « Limite », prix sous le cours.", "Validez."]);
  orderM("a_ordre_oco", "Un ordre qui en annule un autre", "Placez deux ordres liés (OCO) : l'exécution de l'un annule l'autre.", "Un ordre lié OCO placé", (o) => !!o.ocoWith, ["Sur une position, placez stop-loss et objectif liés (option OCO).", "Validez."]);
  orderM("a_ordre_annuler", "Savoir annuler un ordre", "Un ordre en attente peut être annulé : placez un ordre limité éloigné du cours puis annulez-le.", "Un ordre annulé", (o) => o.status === "annule", ["Placez un ordre limité loin du cours.", "Dans les ordres en attente, annulez-le."]);
  // 5. structure de portefeuille (8)
  for (const n of [3, 4, 6, 8, 10]) out.push(mk({ id: `a_lignes_${n}`, category: "risque", xp: 30 + n * 4, days: 10, family: "lignes",
    make: () => ({ title: `Un portefeuille d'au moins ${n} lignes`, description: `La diversification commence par le nombre de lignes : détenez au moins ${n} positions différentes sur votre compte personnel.`, criteria: [`≥ ${n} positions ouvertes`], params: { n } }),
    check: (s, m) => Math.min(1, positionViews(s, "perso").length / Number(m.params.n)), guide: G([`Achetez des instruments différents jusqu'à ${n} lignes.`], "/play/recherche", "Chercher des instruments") }));
  for (const n of [2, 3, 4]) out.push(mk({ id: `a_classes_${n}`, category: "risque", xp: 40 + n * 5, days: 10, family: "classes",
    make: () => ({ title: `Diversifier sur ${n} classes d'actifs`, description: `Détenez, sur votre compte personnel, des positions dans au moins ${n} classes d'actifs différentes (actions, ETF, obligations, matières premières, devises…).`, criteria: [`≥ ${n} classes d'actifs`], params: { n } }),
    check: (s, m) => Math.min(1, new Set(positionViews(s, "perso").map((v) => v.cls)).size / Number(m.params.n)), guide: G(["Combinez par exemple un ETF actions, une obligation et de l'or."], "/play/recherche", "Chercher des instruments") }));
  // 6. limites de risque (7)
  for (const x of [50, 60, 70]) out.push(mk({ id: `a_var_${x}`, category: "risque", xp: 40 + (80 - x), days: 7, family: "var",
    make: (s) => (s.accounts.desk ? { title: `Ramener la VaR sous ${x} % de la limite`, description: `Le risk manager demande une VaR du desk sous ${x} % de la limite, avec au moins 3 positions ouvertes (pas de book vide !).`, criteria: [`VaR ≤ ${x} % de la limite`, "≥ 3 positions"], params: { x } } : null),
    check: (s, m) => { if (Object.keys(s.accounts.desk?.positions ?? {}).length < 3) return 0; const v = valueAtRisk(s, "desk").var, lim = s.career.deskLimitVaR / 100; return v <= (Number(m.params.x) / 100) * lim ? 1 : Math.max(0, Math.min(0.9, 1 - (v / lim - Number(m.params.x) / 100))); },
    guide: G(["Ouvrez Risques : repérez les positions les plus volatiles.", "Réduisez-les jusqu'à passer sous le seuil, en gardant 3 lignes."], "/play/risques", "Voir la VaR") }));
  for (const x of [15, 20, 25, 35]) out.push(mk({ id: `a_poids_${x}`, category: "risque", xp: 70 - x, days: 10, family: "poids",
    make: () => ({ title: `Aucune ligne au-dessus de ${x} %`, description: `Sur votre compte personnel, aucune ligne ne doit dépasser ${x} % du portefeuille, avec au moins 4 positions.`, criteria: [`Poids maximal ≤ ${x} %`, "≥ 4 positions"], params: { x } }),
    check: (s, m) => { const ex = exposures(s, "perso"); if (positionViews(s, "perso").length < 4) return Math.min(0.5, positionViews(s, "perso").length / 8); return ex.largestWeight <= Number(m.params.x) ? 1 : 0.6; }, guide: G(["Vendez une partie de la plus grosse ligne, rachetez ailleurs."], "/play/portefeuille", "Voir mon portefeuille") }));
  // 7. outils du terminal (7)
  for (const n of [6, 8, 10, 12]) out.push(mk({ id: `a_veille_${n}`, category: "analyse", xp: 20 + n, days: 7, family: "veille",
    make: () => ({ title: `Une liste de suivi de ${n} valeurs`, description: `Suivez le marché de près : ajoutez des instruments à votre liste de surveillance jusqu'à en avoir ${n}.`, criteria: [`≥ ${n} instruments surveillés`], params: { n } }),
    check: (s, m) => Math.min(1, s.watchlist.length / Number(m.params.n)), guide: G(["Sur une fiche, cliquez « ☆ Surveiller »."], "/play/recherche", "Rechercher") }));
  for (const n of [1, 2, 3]) out.push(mk({ id: `a_alertes_${n}`, category: "analyse", xp: 15 + n * 8, days: 7, family: "alertes",
    make: () => ({ title: `${n} alerte${n > 1 ? "s" : ""} de prix en place`, description: `Configurez ${n} alerte${n > 1 ? "s" : ""} de prix pour être prévenu quand un cours franchit un niveau.`, criteria: [`≥ ${n} alerte${n > 1 ? "s" : ""}`], params: { n } }),
    check: (s, m) => Math.min(1, s.alerts.length / Number(m.params.n)), guide: G(["Sur une fiche, saisissez un niveau dans « Alerte à… » puis cliquez 🔔."], "/play/recherche", "Rechercher") }));
  // 8. collecte clients (4)
  for (const t of [10000, 25000, 50000, 100000]) out.push(mk({ id: `a_collecte_${t}`, category: "client", xp: 30 + t / 2500, days: 10, family: "collecte",
    make: (s) => (s.clients.some((c) => !c.lost) ? { title: `Collecter ${eur(t)} auprès des clients`, description: `Appelez vos clients et obtenez au moins ${eur(t)} de nouveaux versements cumulés avant l'échéance.`, criteria: [`≥ ${eur(t)} de collecte`], params: { t }, baseline: { sales: Number(s.flags["salesYtd"] ?? 0) } } : null),
    check: (s, m) => Math.min(1, (Number(s.flags["salesYtd"] ?? 0) - (m.baseline?.sales ?? 0)) / Number(m.params.t)), guide: G(["Ouvrez Clients et appelez ceux dont la satisfaction est élevée.", "Proposez un produit adapté à leur profil."], "/play/clients", "Mes clients") }));
  // 9. taille d'une position (6) et culture (3)
  for (const [i, fr] of ([0.02, 0.05, 0.1, 0.15, 0.2, 0.25] as number[]).entries()) out.push(mk({ id: `a_taille_${i}`, category: "trading", xp: 30 + i * 5, days: 7, family: "taille",
    make: (s) => { const target = round50(baseEq(s) * fr); return { title: `Une position d'au moins ${eur(target)}`, description: `Prenez une position significative : un seul achat d'au moins ${eur(target)} (≈ ${Math.round(fr * 100)} % de votre compte personnel).`, criteria: [`Un achat ≥ ${eur(target)}`], params: { target } }; },
    check: (s, m) => Math.min(1, Math.max(0, ...manual(s, m).filter((f) => f.side === "buy").map(notion)) / Number(m.params.target)), guide: G(["Passez un ordre d'achat d'un seul bloc du montant demandé."], "/play/terminal", "Salle des marchés") }));
  for (const n of [3, 5, 8]) out.push(mk({ id: `a_culture_${n}`, category: "analyse", xp: 20 + n * 4, days: 10, family: "culture",
    make: (s) => ({ title: `Répondre à ${n} questions de culture économique`, description: `Entraînez-vous : répondez à ${n} questions du quiz d'économie avant l'échéance.`, criteria: [`${n} questions répondues`], params: { n }, baseline: { a: quizState(s).answered } }),
    check: (s, m) => Math.min(1, (quizState(s).answered - (m.baseline?.a ?? 0)) / Number(m.params.n)), guide: G(["Ouvrez le quiz d'économie et répondez."], "/play/culture", "Quiz d'économie") }));
  return out;
}

export const BANK: BankTpl[] = [...FAMS.flatMap((f) => CTX.map((_c, ci) => famTemplate(f, ci))), ...actionTemplates(), ...CONTEXT];
/** Missions de situation : nées de l'état réel de la partie (crise, résultats, banques centrales, actualité, portefeuille) */
export const BANK_CTX = CONTEXT;
export const BANK_BY_ID: Record<string, BankTpl> = Object.fromEntries(BANK.map((t) => [t.id, t]));
export const BANK_CALC = BANK.filter((t) => t.kind === "calc" && !CONTEXT.includes(t));
export const BANK_ACTION = BANK.filter((t) => t.kind === "action" && !CONTEXT.includes(t));
/** Contexte (donneur d'ordre conseillé) d'un modèle de calcul */
export const bankGiver = (t: BankTpl) => (t.kind === "calc" ? CTX[Number(t.id.split("_").pop())]?.giver : undefined);
