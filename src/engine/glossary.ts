/** Glossaire utilisé en réunion : un participant explique un terme quand le joueur demande « Qu'est-ce que… ? ». */
import { LESSONS } from "./data/learning";

export function normalize(t: string) {
  return t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[’']/g, " ").replace(/[^a-z0-9%&+,.\s-]/g, " ").replace(/-/g, " ").replace(/\s+/g, " ").trim();
}

export interface TermDef { term: string; aliases: string[]; simple: string; example?: string; }
/** Jargon employé dans les réunions, en plus des fiches du centre de formation */
const EXTRA: TermDef[] = [
  { term: "DV01", aliases: ["dv01", "dv 01"], simple: "C'est ce que gagne ou perd une position quand les taux bougent d'un point de base, c'est-à-dire de 0,01 %.", example: "Un DV01 de 500 € veut dire qu'une hausse des taux de 0,01 % nous coûte 500 €." },
  { term: "Point de base", aliases: ["point de base", "points de base", "pb", "bp"], simple: "Un point de base, c'est un centième de pour cent : 0,01 %.", example: "Une hausse de 50 points de base, c'est +0,50 %." },
  { term: "P&L", aliases: ["p&l", "p et l", "pnl", "profit and loss"], simple: "Le P&L, c'est le résultat : ce qu'on a gagné ou perdu sur une période.", example: "Un P&L de +20 000 € sur la semaine veut dire qu'on a gagné 20 000 €." },
  { term: "Book", aliases: ["book", "livre"], simple: "Le book, c'est l'ensemble des positions que le desk gère avec l'argent de la banque.", example: "Notre book contient des obligations d'État et quelques ETF." },
  { term: "Desk", aliases: ["desk"], simple: "Le desk, c'est l'équipe de marché : nous, ici, autour de cette table.", example: "Le desk actions, le desk taux…" },
  { term: "Couverture", aliases: ["couverture", "couvrir", "hedge", "hedging"], simple: "Couvrir, c'est prendre une position inverse pour limiter une perte possible, comme une assurance.", example: "Vendre des futures Bund protège un portefeuille d'obligations contre une hausse des taux." },
  { term: "Future", aliases: ["future", "futures", "contrat a terme", "contrats a terme"], simple: "Un future est un contrat pour acheter ou vendre plus tard à un prix fixé aujourd'hui. On ne verse qu'un dépôt de garantie.", example: "Un future sur l'indice EUROPA 50 gagne quand l'indice monte." },
  { term: "Bund", aliases: ["bund"], simple: "Le Bund, c'est l'obligation de l'État allemand à 10 ans, la référence des taux en zone euro.", example: "Le future Bund sert à couvrir le risque de taux." },
  { term: "Taux directeur", aliases: ["taux directeur", "taux directeurs"], simple: "C'est le taux fixé par la banque centrale. Il influence tous les autres taux de l'économie.", example: "Quand la BCE monte son taux directeur, les crédits coûtent plus cher." },
  { term: "Stress test", aliases: ["stress test", "stress tests"], simple: "Un stress test, c'est simuler un choc extrême pour voir combien on perdrait.", example: "Que perd-on si les actions chutent de 20 % d'un coup ?" },
  { term: "Notation", aliases: ["notation", "note", "rating"], simple: "La notation mesure la solidité d'un emprunteur, de AAA (très sûr) à C (très risqué).", example: "Une obligation notée BB est considérée comme spéculative." },
  { term: "High yield", aliases: ["high yield", "haut rendement"], simple: "Ce sont des obligations d'émetteurs plus fragiles : elles rapportent plus, mais le risque de défaut est plus élevé.", example: "Une obligation à 8 % d'une entreprise notée B." },
  { term: "Investment grade", aliases: ["investment grade"], simple: "Ce sont les obligations des émetteurs solides, notées BBB- ou mieux.", example: "Les obligations d'État allemandes sont investment grade." },
  { term: "ETF", aliases: ["etf", "tracker", "trackers"], simple: "Un ETF est un fonds coté qui reproduit un indice. On achète tout un panier d'actions en une seule fois.", example: "L'ETF Monde suit toutes les grandes entreprises du jeu." },
  { term: "BPA", aliases: ["bpa", "benefice par action"], simple: "Le BPA, c'est le bénéfice de l'entreprise divisé par le nombre d'actions.", example: "1 milliard de bénéfice et 100 millions d'actions : BPA de 10 €." },
  { term: "Valeur fondamentale", aliases: ["valeur fondamentale", "fair value", "juste valeur"], simple: "C'est ce que vaut l'entreprise selon ses bénéfices et les taux, indépendamment des humeurs du marché.", example: "Si le cours est sous la valeur fondamentale, le titre est peut-être bon marché." },
  { term: "Momentum", aliases: ["momentum", "dynamique"], simple: "Le momentum, c'est la tendance récente du cours : ce qui monte a tendance à continuer à court terme.", example: "Une action qui a pris 10 % en un mois a un fort momentum." },
  { term: "Mandat", aliases: ["mandat", "mandats"], simple: "Un mandat, c'est le contrat par lequel un client nous confie la gestion de son argent, avec des règles à respecter.", example: "Mandat prudent : pas plus de 45 % d'actions." },
  { term: "Allocation", aliases: ["allocation", "allocations"], simple: "L'allocation, c'est la répartition de l'argent entre actions, obligations, liquidités…", example: "60 % actions, 40 % obligations." },
  { term: "Profil de risque", aliases: ["profil de risque", "profil"], simple: "C'est le niveau de risque qu'un client peut et veut supporter.", example: "Un retraité qui a besoin de ses revenus a un profil prudent." },
  { term: "Délit d'initié", aliases: ["delit d initie", "information privilegiee", "initie"], simple: "C'est utiliser une information confidentielle, pas encore publique, pour faire une opération en bourse. C'est interdit et puni par la loi.", example: "Acheter une action parce qu'on sait qu'une acquisition sera annoncée demain." },
  { term: "Conformité", aliases: ["conformite", "compliance"], simple: "La conformité vérifie que la banque et ses employés respectent les lois et les règles internes.", example: "Signaler une demande suspecte d'un client." },
  { term: "Limite", aliases: ["limite", "limites", "limite de risque"], simple: "Une limite, c'est le risque maximum qu'on a le droit de prendre. La dépasser est un incident.", example: "Une limite de VaR de 80 000 €." },
  { term: "Exposition", aliases: ["exposition", "expositions", "expose"], simple: "L'exposition, c'est le montant qu'on peut gagner ou perdre sur un risque donné.", example: "Une exposition de 2 millions au secteur bancaire." },
  { term: "Refinancement", aliases: ["refinancement", "refinancer"], simple: "Se refinancer, c'est emprunter de nouveau pour rembourser les dettes qui arrivent à échéance.", example: "Une banque qui ne trouve plus de prêteurs a un problème de refinancement." },
  { term: "Prêteur en dernier ressort", aliases: ["preteur en dernier ressort"], simple: "C'est la banque centrale quand elle prête aux banques solvables qui manquent de liquidités en urgence." },
  { term: "Consensus", aliases: ["consensus"], simple: "Le consensus, c'est la moyenne des prévisions des économistes avant une publication.", example: "Si l'inflation sort au-dessus du consensus, c'est une surprise." },
];

const LESSON_DEFS: TermDef[] = LESSONS.map((l) => {
  const base = l.term.split(/[(/]/).map((x) => normalize(x)).filter((x) => x.length > 1);
  return { term: l.term, aliases: [...new Set([...base, normalize(l.term)])], simple: l.simple + " " + l.definition, example: l.example };
});
const ALL = [...EXTRA, ...LESSON_DEFS];
const extraAliases: Record<string, string[]> = { "VaR (Value at Risk)": ["var", "value at risk", "valeur a risque"], "Ratio de Sharpe": ["sharpe"], "Marge / appel de marge": ["appel de marge", "marge"], "ITM / ATM / OTM": ["itm", "atm", "otm", "dans la monnaie", "a la monnaie", "hors de la monnaie"], "Duration": ["duration", "duration modifiee"], "Sensibilité": ["sensibilite"], "Effet de levier": ["levier", "effet de levier"], "Inflation et politique monétaire": ["inflation", "politique monetaire"], "Produits structurés": ["produit structure", "produits structures", "autocall", "phoenix"], "Risque de contrepartie": ["contrepartie"], "Free cash-flow": ["free cash flow", "cash flow"] };
for (const d of ALL) for (const a of extraAliases[d.term] ?? []) d.aliases.push(a);

const QUESTION = /(qu\s?est\s?ce\s?(que|qu)|c\s?est\s?quoi|ca\s?veut\s?dire\s?quoi|que\s?veut\s?dire|qu\s?entendez\s?vous\s?par|que\s?signifie|ca\s?signifie\s?quoi|definition|definissez|expliquez\s?moi|je\s?(ne\s?)?(connais|comprends)\s?pas)/;
/** La phrase est-elle une demande de définition ? */
export function isTermQuestion(text: string) { return QUESTION.test(normalize(text)); }

/** Retrouve le terme demandé (l'alias le plus long présent dans la question) */
export function findTerm(question: string): TermDef | null {
  const q = ` ${normalize(question)} `;
  let best: { d: TermDef; len: number } | null = null;
  for (const d of ALL) for (const a of d.aliases) {
    if (a.length < 2) continue;
    if (q.includes(` ${a} `) || q.includes(` ${a}s `) || q.includes(` ${a}?`)) { if (!best || a.length > best.len) best = { d, len: a.length }; }
  }
  return best?.d ?? null;
}
/** Le texte emploie-t-il ce terme ? */
export function usesTerm(text: string, d: TermDef) { const t = ` ${normalize(text)} `; return d.aliases.some((a) => a.length > 1 && (t.includes(` ${a} `) || t.includes(` ${a}s `))); }
