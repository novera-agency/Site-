/**
 * Quiz de culture économique (microéconomie et macroéconomie) : chaque bonne réponse rapporte de l'expérience
 * en compétences (analyse pour la micro, macro pour la macro), avec une explication à chaque réponse.
 * Les questions sont validées côté moteur : l'écran ne reçoit jamais la bonne réponse avant de répondre.
 */
import type { GameState } from "./types";
import { gainXp, notify, changeRep } from "./core";
import { dayIndex } from "./time";
import { recordMistake, markFixed, itemOfQuizId } from "./notebook";
import { BANK2 } from "./quizBank2";
import { BANK3 } from "./quizBank3";
import { BANK4 } from "./quizBank4";
import { genQuestion, histQuestion, histIds, GEN_FAMILIES, HIST_COUNT } from "./quizGen";

export type QuizCat = "micro" | "macro" | "finance" | "histoire" | "calcul" | "assurance" | "immobilier";
export interface QuizQ { id: string; cat: QuizCat; level: 1 | 2 | 3; q: string; options: string[]; correct: number; explain: string }
const Q = (id: string, cat: QuizCat, level: 1 | 2 | 3, q: string, options: string[], correct: number, explain: string): QuizQ => ({ id, cat, level, q, options, correct, explain });

const BANK1: QuizQ[] = [
  // ───────── Microéconomie ─────────
  Q("mi_offre", "micro", 1, "Si la demande d'un bien augmente alors que l'offre reste identique, que se passe-t-il en général pour son prix ?", ["Il baisse", "Il augmente", "Il ne change pas", "Il devient nul"], 1, "Plus d'acheteurs pour la même quantité disponible : les vendeurs peuvent monter leurs prix jusqu'à un nouvel équilibre, plus haut."),
  Q("mi_elast", "micro", 2, "Le prix du sel augmente de 10 %, mais on en achète à peine moins. Que dit-on de la demande de sel ?", ["Elle est inélastique", "Elle est très élastique", "Elle est négative", "Elle est parfaite"], 0, "Une demande est inélastique quand la quantité achetée varie moins que le prix : les besoins de base ou sans substitut en sont l'exemple type."),
  Q("mi_cmarg", "micro", 1, "Le coût marginal, c'est…", ["Le coût total divisé par la production", "Le coût de production d'une unité supplémentaire", "Le coût fixe de l'usine", "La marge du vendeur"], 1, "On compare le coût marginal au revenu de la dernière unité : tant que celui-ci est plus élevé, produire davantage augmente le profit."),
  Q("mi_concu", "micro", 3, "En concurrence parfaite, à l'équilibre, le prix est égal à…", ["Zéro", "Au coût marginal", "Au double du coût moyen", "À la valeur de la marque"], 1, "Sans pouvoir de marché, chaque producteur est « preneur de prix » et produit jusqu'à ce que son coût marginal rejoigne le prix."),
  Q("mi_copp", "micro", 1, "Vous renoncez à un job d'été payé 2 000 € pour partir en vacances. Ces 2 000 € sont…", ["Un coût fixe", "Un coût d'opportunité", "Un impôt", "Un revenu différé"], 1, "Le coût d'opportunité d'un choix est la valeur de la meilleure alternative abandonnée."),
  Q("mi_decr", "micro", 2, "On ajoute des ouvriers dans un atelier dont le matériel ne change pas. Au bout d'un moment, chaque ouvrier supplémentaire apporte moins que le précédent. C'est…", ["Les économies d'échelle", "Les rendements décroissants", "Le dumping", "L'effet de levier"], 1, "Avec un facteur fixe (machines, surface), la productivité marginale du facteur variable finit par baisser."),
  Q("mi_surplus", "micro", 2, "Le surplus du consommateur est la différence entre…", ["Le prix et le coût de production", "Ce que le consommateur est prêt à payer et ce qu'il paie vraiment", "Le salaire et le prix", "Le prix de gros et de détail"], 1, "Si vous étiez prêt à payer 30 € et que vous payez 20 €, votre surplus est de 10 €."),
  Q("mi_subst", "micro", 1, "Le prix du beurre monte fortement. Que devient probablement la demande de margarine ?", ["Elle baisse", "Elle augmente", "Elle est inchangée", "Elle disparaît"], 1, "Le beurre et la margarine sont des biens substituts : quand l'un devient plus cher, on se reporte sur l'autre."),
  Q("mi_exter", "micro", 2, "Une usine rejette de la pollution sans la payer. Les économistes parlent d'…", ["Externalité négative", "Rendement d'échelle", "Surplus du producteur", "Bien public"], 0, "Les coûts subis par des tiers ne sont pas dans le prix : le marché produit trop. Une taxe ou un quota peut corriger ce défaut."),
  Q("mi_public", "micro", 3, "Un éclairage public bénéficie à tous sans qu'on puisse en exclure quelqu'un. C'est un bien…", ["Privé", "De club", "Public", "Inférieur"], 2, "Un bien public est non rival (l'usage de l'un ne gêne pas les autres) et non exclusif : le marché le fournit mal, d'où le financement par l'impôt."),
  Q("mi_oligo", "micro", 1, "Quelques opérateurs seulement se partagent le marché des télécoms d'un pays. Quelle structure de marché ?", ["Monopole", "Oligopole", "Concurrence parfaite", "Monopsone"], 1, "Un oligopole réunit peu de vendeurs, qui tiennent compte des réactions de leurs rivaux."),
  Q("mi_seuil", "micro", 2, "Le seuil de rentabilité d'une entreprise est atteint quand…", ["Le chiffre d'affaires égale les coûts totaux", "Les stocks sont vides", "La marge brute est de 100 %", "La dette est remboursée"], 0, "En dessous de ce niveau d'activité l'entreprise perd de l'argent, au-dessus elle en gagne."),
  Q("mi_marge", "micro", 1, "Une boutique achète un article 60 € et le vend 100 €. Son taux de marque (marge ÷ prix de vente) est de…", ["40 %", "60 %", "66 %", "167 %"], 0, "Marge = 100 − 60 = 40 €, soit 40 € ÷ 100 € = 40 % du prix de vente."),
  Q("mi_akerlof", "micro", 3, "Sur le marché des voitures d'occasion, l'acheteur connaît moins bien la qualité que le vendeur. Résultat possible : les bonnes voitures disparaissent du marché. C'est…", ["L'antisélection", "L'aléa moral", "Le monopole naturel", "L'effet de cliquet"], 0, "L'asymétrie d'information fait baisser le prix moyen, ce qui chasse les vendeurs de bonnes voitures (Akerlof, prix Nobel 2001)."),
  Q("mi_alea", "micro", 3, "Une fois assuré contre tous les dégâts, un conducteur devient moins prudent. Les économistes parlent d'…", ["Antisélection", "Aléa moral", "Externalité positive", "Rationnement"], 1, "L'aléa moral : le comportement change après la signature du contrat, car on ne supporte plus le risque. D'où les franchises."),
  Q("mi_plafond", "micro", 2, "L'État plafonne les loyers sous le prix d'équilibre. Effet le plus probable ?", ["Excès d'offre de logements", "Pénurie de logements à louer", "Baisse de la demande", "Aucun effet"], 1, "À prix bloqué trop bas, la demande dépasse l'offre : les logements disponibles se raréfient et se dégradent parfois."),
  Q("mi_echelle", "micro", 2, "Quand le coût moyen par unité baisse parce que la production augmente, on parle d'…", ["Économies d'échelle", "Inflation", "Dumping", "Rendements décroissants"], 0, "Répartir les coûts fixes sur plus d'unités fait baisser le coût moyen : un avantage des grandes entreprises."),
  Q("mi_barr", "micro", 2, "Quelle situation est une barrière à l'entrée sur un marché ?", ["Un brevet détenu par un seul producteur", "Un grand nombre d'acheteurs", "Des prix qui baissent", "Un marché mondial"], 0, "Brevets, licences, coûts d'installation énormes : ils protègent les acteurs en place et limitent la concurrence."),
  Q("mi_utilite", "micro", 1, "La première part de pizza apporte plus de plaisir que la quatrième. C'est le principe de…", ["L'utilité marginale décroissante", "L'offre élastique", "La loi des rendements croissants", "L'inflation"], 0, "Chaque unité consommée en plus apporte une satisfaction moindre, ce qui explique que le prix qu'on accepte de payer diminue."),
  Q("mi_nash", "micro", 3, "Deux entreprises se font une guerre des prix alors qu'elles gagneraient plus en s'entendant. Chacune a intérêt à baisser son prix quoi que fasse l'autre. Quel concept ?", ["L'équilibre de Nash (dilemme du prisonnier)", "L'effet de levier", "Le multiplicateur", "La main invisible"], 0, "Chacun joue sa meilleure réponse et le résultat est moins bon pour tous : c'est aussi pourquoi les ententes sont tentantes… et interdites."),
  Q("mi_levier", "micro", 3, "Une entreprise emprunte à 3 % pour financer un projet qui rapporte 8 %. L'endettement…", ["Augmente la rentabilité des capitaux propres", "La réduit toujours", "N'a aucun effet", "Annule le risque"], 0, "C'est l'effet de levier : tant que le rendement dépasse le coût de la dette, l'emprunt gonfle le rendement des actionnaires… mais aussi leurs pertes si le projet déçoit."),
  Q("mi_per", "micro", 1, "Une action cote 50 € et l'entreprise gagne 5 € par action et par an. Son PER (price earnings ratio) est de…", ["0,1", "10", "45", "250"], 1, "PER = cours ÷ bénéfice par action = 50 ÷ 5 = 10 : il faut 10 ans de bénéfices actuels pour « rembourser » le cours."),
  Q("mi_taxe", "micro", 3, "L'État taxe un bien dont la demande est très inélastique. Qui supporte l'essentiel de la taxe ?", ["Les consommateurs", "Les producteurs", "L'État", "Les importateurs uniquement"], 0, "Quand les acheteurs ne peuvent pas se passer du bien, ils absorbent la hausse de prix : c'est pourquoi on taxe volontiers tabac et carburants."),
  Q("mi_va", "micro", 2, "À 5 % par an, 1 000 € reçus dans un an valent aujourd'hui environ…", ["1 050 €", "952 €", "1 000 €", "500 €"], 1, "Valeur actuelle = 1 000 ÷ 1,05 ≈ 952 € : un euro demain vaut moins qu'un euro aujourd'hui. C'est la base de la valorisation des obligations et des actions."),
  // ───────── Macroéconomie ─────────
  Q("ma_pib", "macro", 1, "Le PIB mesure…", ["La richesse totale d'un pays (patrimoine)", "La valeur de ce qui est produit dans un pays sur une période", "Les exportations d'un pays", "Les dépenses de l'État"], 1, "Le produit intérieur brut additionne la valeur ajoutée de toutes les entreprises installées dans le pays sur une période (trimestre, année)."),
  Q("ma_inflation", "macro", 1, "L'inflation, c'est…", ["Une hausse durable et générale des prix", "Une hausse du prix d'un seul produit", "Une baisse des salaires", "Une hausse du chômage"], 0, "L'inflation est mesurée par l'évolution d'un panier de produits (indice des prix à la consommation). Elle réduit le pouvoir d'achat de la monnaie."),
  Q("ma_recession", "macro", 1, "On parle souvent de récession technique après…", ["Deux trimestres consécutifs de baisse du PIB", "Un mois de hausse du chômage", "Une baisse de la Bourse de 10 %", "Une année de déficit public"], 0, "C'est la convention la plus courante ; certains instituts (comme le NBER américain) jugent plutôt l'ensemble de l'activité, de l'emploi et des revenus."),
  Q("ma_taux", "macro", 2, "Une banque centrale relève fortement son taux directeur. Effet attendu à court terme ?", ["Le crédit devient plus cher et l'inflation ralentit", "Le crédit devient moins cher", "Les prix montent plus vite", "Le chômage baisse tout de suite"], 0, "Emprunter coûte plus cher : consommation et investissement ralentissent, ce qui freine les prix. L'effet secondaire : un risque pour la croissance."),
  Q("ma_bce", "macro", 1, "Quel est l'objectif principal de la Banque centrale européenne ?", ["Une inflation proche de 2 % à moyen terme", "Zéro chômage", "Un euro faible", "Un budget équilibré pour chaque pays"], 0, "Le mandat prioritaire de la BCE est la stabilité des prix, définie par une inflation de 2 % sur le moyen terme."),
  Q("ma_chom", "macro", 1, "Le taux de chômage est la part…", ["Des actifs sans emploi qui en cherchent un", "De la population sans emploi", "Des jeunes sans diplôme", "Des salariés en congé"], 0, "Il se calcule sur la population active (personnes en emploi ou en recherche), pas sur toute la population."),
  Q("ma_defl", "macro", 2, "La déflation, c'est…", ["Une baisse générale et durable des prix", "Une inflation très faible", "Une chute de la Bourse", "Une dévaluation"], 0, "Redoutée car les ménages repoussent leurs achats en attendant des prix plus bas, et les dettes pèsent plus lourd : le Japon l'a connue pendant des années."),
  Q("ma_stag", "macro", 2, "Quelle situation combine inflation élevée, croissance faible et chômage élevé, comme dans les années 1970 ?", ["La stagflation", "La déflation", "L'hyperinflation", "Le plein-emploi"], 0, "Les chocs pétroliers de 1973 et 1979 ont fait grimper les prix tout en freinant l'activité : un dilemme pour les banques centrales."),
  Q("ma_politique", "macro", 2, "Le gouvernement baisse les impôts et augmente ses dépenses pour soutenir l'activité. Quelle politique ?", ["Budgétaire", "Monétaire", "De change", "Structurelle"], 0, "La politique budgétaire relève de l'État (impôts, dépenses) ; la politique monétaire relève de la banque centrale (taux, achats de titres)."),
  Q("ma_dette", "macro", 2, "Quelle différence entre déficit public et dette publique ?", ["Le déficit est un flux annuel, la dette est un stock accumulé", "Aucune", "Le déficit est le stock, la dette le flux", "Le déficit concerne les entreprises"], 0, "Chaque année de déficit s'ajoute à la dette existante, comme un découvert qui s'ajoute à un emprunt."),
  Q("ma_change", "macro", 2, "L'euro s'apprécie fortement face au dollar. Effet probable pour les exportateurs de la zone euro ?", ["Leurs produits deviennent plus chers pour les clients hors zone", "Leurs produits deviennent moins chers à l'étranger", "Aucun effet", "Leurs coûts s'envolent forcément"], 0, "Un euro fort pénalise la compétitivité-prix des exportations, mais allège la facture des importations (pétrole, facturé en dollars)."),
  Q("ma_balance", "macro", 1, "La balance commerciale d'un pays est la différence entre…", ["Ses exportations et ses importations de biens", "Ses recettes et ses dépenses publiques", "Ses salaires et ses profits", "Son PIB et sa dette"], 0, "Si les exportations dépassent les importations, la balance est excédentaire (comme en Allemagne) ; sinon elle est déficitaire (comme en France depuis les années 2000)."),
  Q("ma_inversee", "macro", 3, "Les taux à 2 ans sont supérieurs aux taux à 10 ans : la courbe des taux est dite « inversée ». Elle précède souvent…", ["Une récession", "Une envolée de l'inflation", "Une dévaluation", "Une baisse de la dette"], 0, "Les marchés anticipent des baisses de taux futures, car l'économie ralentit : l'inversion a précédé la plupart des récessions américaines depuis les années 1960."),
  Q("ma_multi", "macro", 3, "Selon le multiplicateur keynésien, 1 € de dépense publique supplémentaire peut augmenter le PIB de…", ["Plus de 1 €", "Exactement 1 €", "Moins de 0 €", "Rien du tout, jamais"], 0, "La dépense devient revenu de quelqu'un, qui en dépense une partie à son tour : l'effet se propage. Son ampleur dépend de l'épargne, des importations et de la conjoncture."),
  Q("ma_qe", "macro", 2, "L'assouplissement quantitatif (QE) consiste, pour une banque centrale, à…", ["Acheter massivement des titres pour faire baisser les taux longs", "Vendre de l'or", "Relever ses taux", "Imprimer des billets pour l'État directement"], 0, "Employé après 2008, puis lors du Covid, quand les taux directeurs étaient déjà proches de zéro."),
  Q("ma_phillips", "macro", 3, "La courbe de Phillips décrit à court terme une relation entre…", ["L'inflation et le chômage", "Le PIB et la dette", "Les taux et le change", "Les salaires et les impôts"], 0, "Moins de chômage tend à pousser les salaires et les prix. Mais dans les années 1970, la stagflation a montré les limites de cet arbitrage."),
  Q("ma_ipc", "macro", 1, "Comment l'inflation est-elle le plus souvent mesurée ?", ["Par l'indice des prix à la consommation (IPC)", "Par le PIB par habitant", "Par le taux de change", "Par la masse monétaire seule"], 0, "L'IPC suit l'évolution du prix d'un panier représentatif de produits et services achetés par les ménages."),
  Q("ma_reel", "macro", 2, "Un livret rapporte 4 % par an alors que l'inflation est de 3 %. Le taux d'intérêt réel est d'environ…", ["1 %", "7 %", "3 %", "12 %"], 0, "Taux réel ≈ taux nominal − inflation = 4 − 3 = 1 %. Si l'inflation dépasse le taux nominal, votre épargne perd du pouvoir d'achat."),
  Q("ma_eviction", "macro", 3, "Quand l'État emprunte beaucoup et fait monter les taux, au détriment de l'investissement des entreprises, on parle d'…", ["Effet d'éviction", "Effet de richesse", "Effet de cliquet", "Effet d'aubaine"], 0, "L'emprunt public « évince » l'investissement privé en renchérissant le crédit. L'effet dépend du niveau de l'épargne disponible et de la politique monétaire."),
  Q("ma_2008", "macro", 2, "Quel événement a déclenché la crise financière de 2008 ?", ["L'effondrement des crédits immobiliers américains à risque (subprimes) et la faillite de Lehman Brothers", "L'introduction de l'euro", "Une panne informatique mondiale", "L'éclatement de la bulle Internet"], 0, "Des crédits accordés à des ménages fragiles avaient été titrisés et vendus dans le monde entier : leur chute a gelé le crédit interbancaire."),
  Q("ma_70", "macro", 3, "Avec une croissance de 2 % par an, en combien d'années le PIB double-t-il environ (règle des 70) ?", ["35 ans", "10 ans", "70 ans", "100 ans"], 0, "Temps de doublement ≈ 70 ÷ taux de croissance = 70 ÷ 2 = 35 ans. Avec 7 % (la Chine des années 2000), il faut 10 ans."),
  Q("ma_deval", "macro", 2, "Quelle différence entre dévaluation et dépréciation d'une monnaie ?", ["La dévaluation est décidée par les autorités, la dépréciation vient du marché", "Aucune", "La dévaluation vient du marché, la dépréciation de l'État", "La dévaluation ne concerne que l'or"], 0, "Sous change fixe, un gouvernement peut dévaluer sa monnaie d'un coup ; sous change flottant, la monnaie se déprécie via l'offre et la demande."),
  Q("ma_euro", "macro", 1, "En quelle année les pièces et billets en euros sont-ils entrés en circulation ?", ["2002", "1992", "1999", "2008"], 0, "L'euro existait depuis 1999 comme monnaie scripturale (comptes et marchés) ; les billets et les pièces ont remplacé les monnaies nationales en janvier 2002."),
  Q("ma_pouvoir", "macro", 1, "Votre salaire augmente de 2 % alors que les prix montent de 3 %. Votre pouvoir d'achat…", ["Baisse", "Augmente", "Reste stable", "Double"], 0, "Le pouvoir d'achat évolue comme le revenu moins l'inflation : environ −1 % ici."),
  Q("ma_oblig", "macro", 2, "Les taux d'intérêt montent. Que devient le prix des obligations déjà émises à taux fixe ?", ["Il baisse", "Il monte", "Il reste fixe", "Il est remboursé"], 0, "Les nouvelles obligations rapportent plus : les anciennes, moins généreuses, doivent baisser de prix pour rester attractives. Plus l'échéance est longue, plus la baisse est forte."),
  Q("ma_ratio", "macro", 3, "Un pays a une dette publique de 3 000 Md€ et un PIB de 2 500 Md€. Son ratio dette/PIB est d'environ…", ["120 %", "83 %", "12 %", "250 %"], 0, "3 000 ÷ 2 500 = 1,2, soit 120 % du PIB. On compare ainsi les pays entre eux (le critère de Maastricht fixe 60 %)."),
];

export const QUIZ_BANK: QuizQ[] = [...BANK1, ...BANK2, ...BANK3, ...BANK4];
const BY_ID = Object.fromEntries(QUIZ_BANK.map((q) => [q.id, q]));
const cache = new Map<string, QuizQ>();
/** Retrouve une question par identifiant : banque rédigée, exercice de calcul (g:famille:graine) ou événement historique (h:n) */
export function quizById(id: string): QuizQ | undefined {
  if (BY_ID[id]) return BY_ID[id];
  const hit = cache.get(id); if (hit) return hit;
  let q: QuizQ | undefined;
  if (id.startsWith("g:")) { const [, f, sd] = id.split(":"); if (Number.isInteger(Number(f)) && Number.isInteger(Number(sd))) q = genQuestion(Number(f), Number(sd)); }
  else if (id.startsWith("h:")) q = histQuestion(id);
  if (q) { if (cache.size > 2000) cache.clear(); cache.set(id, q); }
  return q;
}
const BRANCH: Record<QuizCat, "analyse" | "macro" | "marches" | "maths" | "risque"> = { micro: "analyse", macro: "macro", finance: "marches", histoire: "macro", calcul: "maths", assurance: "risque", immobilier: "analyse" };
const CAT_LABEL: Record<QuizCat, string> = { micro: "micro", macro: "macro", finance: "finance", histoire: "histoire financière", calcul: "calcul", assurance: "assurance", immobilier: "immobilier" };
export const QUIZ_TOTALS = (() => { const t = { micro: 0, macro: 0, finance: 0, histoire: HIST_COUNT, calcul: 0, assurance: 0, immobilier: 0 } as Record<QuizCat, number>; for (const q of QUIZ_BANK) t[q.cat]++; return t; })();
export const QUIZ_TOTAL = QUIZ_BANK.length + HIST_COUNT;

export interface QuizState {
  done: Record<string, 0 | 1>; /** jour de la dernière bonne réponse : une question réussie revient au bout de REVIEW_DAYS jours */ last?: Record<string, number>; streak: number; best: number; answered: number; correct: number;
  /** Les 2 questions du jour (figées au premier affichage) */
  today?: { day: number; ids: string[]; answered: string[] };
  /** Derniers exercices générés proposés (seuls ceux-là peuvent être validés) */
  served?: string[];
  dailyDone?: number; dailyStreak?: number; dailyBest?: number; lastDaily?: number;
}
/** Intervalle minimal avant qu'une question déjà réussie soit reposée (révision espacée) */
export const REVIEW_DAYS = 30;
export const quizState = (s: GameState): QuizState => (s.quiz ??= { done: {}, streak: 0, best: 0, answered: 0, correct: 0 });
export const quizCorrectCount = (s: GameState) => Object.values(s.quiz?.done ?? {}).filter((v) => v === 1).length;

/** Une question est « disponible » si elle n'a jamais été réussie, ou si sa dernière réussite remonte à au moins 30 jours */
const isDue = (st: QuizState, id: string, day: number) => st.done[id] === 1 && (st.last?.[id] === undefined || day - st.last[id] >= REVIEW_DAYS);
const available = (st: QuizState, id: string, day: number) => st.done[id] !== 1 || isDue(st, id, day);
/** 0 = jamais vue, 1 = ratée, 2 = à réviser */
const rank = (st: QuizState, id: string) => (st.done[id] === undefined ? 0 : st.done[id] === 0 ? 1 : 2);
/** Niveau d'une question de culture (1 = bases) ; les questions tirées de l'histoire du jeu sont de niveau 2 */
export function quizServed(s: GameState, id: string) { const st = quizState(s); return !!st.served?.includes(id) || !!st.today?.ids.includes(id); }
const markServed = (st: QuizState, ids: string[]) => { const l = (st.served ??= []); for (const id of ids) if (id.startsWith("g:") && !l.includes(id)) l.push(id); if (l.length > 80) l.splice(0, l.length - 80); };
const levelOf = (id: string) => BY_ID[id]?.level ?? 2;
/** La question peut-elle être posée aujourd'hui (jamais réussie, ou réussie il y a 30 jours ou plus) ? */
export const quizAvailable = (s: GameState, id: string) => available(quizState(s), id, dayIndex(s.t));
const h32 = (str: string) => { let x = 2166136261; for (let i = 0; i < str.length; i++) x = Math.imul(x ^ str.charCodeAt(i), 16777619) >>> 0; return x; };
/** Questions de connaissances (banque rédigée + histoire) dans un ordre propre à la partie */
const orderCache = new Map<string, string[]>();
function knowledgeOrder(s: GameState): string[] {
  let o = orderCache.get(s.seed);
  if (!o) { if (orderCache.size > 20) orderCache.clear(); o = [...QUIZ_BANK.map((q) => q.id), ...histIds()].sort((a, b) => h32(a + s.seed) - h32(b + s.seed)); orderCache.set(s.seed, o); }
  return o;
}
/** Les 2 questions du jour : une de culture (jamais réussie si possible), une de calcul. Figées pour la journée. */
export function quizToday(s: GameState) {
  const st = quizState(s);
  const day = dayIndex(s.t);
  if (st.today && st.today.day === day) return st.today;
  const order = knowledgeOrder(s);
  let know: string | undefined;
  // D'abord les questions jamais vues (les bases avant le reste), puis les ratées, puis celles à réviser (les plus anciennes d'abord)
  for (const wanted of [0, 1, 2]) {
    let bestKey = Infinity;
    for (let k = 0; k < order.length; k++) {
      const id = order[k];
      if (rank(st, id) !== wanted || !available(st, id, day) || st.today?.ids.includes(id)) continue;
      const key = wanted === 2 ? (st.last?.[id] ?? -1e9) : levelOf(id) * 1e6 + k; // niveau 1 avant 2 avant 3 ; l'ordre propre à la partie départage
      if (key < bestKey) { bestKey = key; know = id; }
    }
    if (know) break;
  }
  const calc = `g:${day % GEN_FAMILIES}:${day}`;
  const ids = [know ?? `g:${(day + 7) % GEN_FAMILIES}:${day + 100000}`, calc];
  st.today = { day, ids, answered: [] };
  return st.today;
}

/** Série de questions : du jour, ou d'une catégorie (jamais celles déjà réussies ; les ratées en dernier) */
export function quizBatch(s: GameState, cat: QuizCat | "mix" | "jour", n = 5): QuizQ[] {
  const st = quizState(s);
  if (cat === "jour") { markServed(st, quizToday(s).ids); } 
  if (cat === "jour") return quizToday(s).ids.filter((id) => !st.today!.answered.includes(id)).map((id) => quizById(id)!).filter(Boolean);
  if (cat === "calcul") {
    const out: QuizQ[] = [];
    let k = 0; const base = 1000 + st.answered * 3;
    while (out.length < n && k < 200) { const q = genQuestion((base + k) % GEN_FAMILIES, base + k); k++; if (st.done[q.id] === undefined) out.push(q); }
    markServed(st, out.map((x) => x.id));
    return out;
  }
  const day = dayIndex(s.t);
  const h = (id: string) => h32(id + s.seed + day);
  let ids = QUIZ_BANK.map((q) => q.id);
  if (cat === "histoire") ids = [...QUIZ_BANK.filter((q) => q.cat === "histoire").map((q) => q.id), ...histIds()];
  else if (cat === "mix") ids = [...ids, ...histIds()];
  else ids = QUIZ_BANK.filter((q) => q.cat === cat).map((q) => q.id);
  const pool = ids.filter((id) => available(st, id, day)).map((id) => quizById(id)!).filter(Boolean);
  pool.sort((a, b) => rank(st, a.id) - rank(st, b.id) || a.level - b.level || h(a.id) - h(b.id));
  const head = pool.slice(0, Math.max(n * 3, n));
  head.sort((a, b) => rank(st, a.id) - rank(st, b.id) || h(a.id) - h(b.id));
  const out = head.slice(0, n);
  if (out.length < n && cat === "mix") for (const q of quizBatch(s, "calcul", n - out.length)) out.push(q);
  markServed(st, out.map((x) => x.id));
  return out;
}

export function answerQuiz(s: GameState, id: string, choice: number) {
  const q = quizById(id);
  if (!q) return { ok: false as const, error: "Question inconnue." };
  if (!Number.isInteger(choice) || choice < 0 || choice >= q.options.length) return { ok: false as const, error: "Réponse invalide." };
  const st = quizState(s);
  const right = choice === q.correct;
  const day0 = dayIndex(s.t);
  const review = isDue(st, id, day0); // question déjà réussie il y a au moins 30 jours
  const first = st.done[id] === undefined || st.done[id] === 0;
  st.answered++;
  if (!right) recordMistake(s, { item: itemOfQuizId(id), kind: q.cat === "calcul" ? "Calcul" : "Culture", title: q.q, text: q.explain, yours: q.options[choice], from: "culture" });
  else markFixed(s, itemOfQuizId(id));
  let xp = 0;
  if (right) {
    st.correct++; st.streak++; st.best = Math.max(st.best, st.streak);
    if (first || review) {
      st.done[id] = 1; (st.last ??= {})[id] = day0;
      xp = first ? 4 * q.level + (st.streak >= 3 ? 2 : 0) : 2 * q.level; // une révision réussie rapporte moins qu'une découverte
      gainXp(s, BRANCH[q.cat], xp, `Quiz d'économie : ${CAT_LABEL[q.cat]}`);
      const total = quizCorrectCount(s);
      if (first && total % 25 === 0) { changeRep(s, "professionnelle", 1, "Solide culture économique"); notify(s, "succes", `Culture économique : ${total} questions réussies`, "Votre responsable remarque votre curiosité intellectuelle.", "/play/culture"); }
    }
  } else { st.streak = 0; if (st.done[id] === undefined || review) st.done[id] = 0; }
  // Questions du jour : bonus quand les deux sont traitées
  const day = dayIndex(s.t);
  let daily: { done: boolean; streak: number } | undefined;
  if (st.today && st.today.day === day && st.today.ids.includes(id) && !st.today.answered.includes(id)) {
    st.today.answered.push(id);
    if (st.today.answered.length >= st.today.ids.length) {
      st.dailyDone = (st.dailyDone ?? 0) + 1;
      st.dailyStreak = st.lastDaily !== undefined && day - st.lastDaily <= 3 && day > st.lastDaily ? (st.dailyStreak ?? 0) + 1 : 1;
      st.dailyBest = Math.max(st.dailyBest ?? 0, st.dailyStreak);
      st.lastDaily = day;
      gainXp(s, "macro", 6, "Questions du jour terminées");
      notify(s, "succes", "Questions du jour terminées ✔", `Série de ${st.dailyStreak} jour${st.dailyStreak > 1 ? "s" : ""}. À demain pour les deux suivantes.`, "/play/culture");
      daily = { done: true, streak: st.dailyStreak };
    }
  }
  return { ok: true as const, data: { correct: right, answer: q.correct, explain: q.explain, xp, streak: st.streak, first, review, daily } };
}
