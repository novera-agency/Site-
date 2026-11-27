/** Aide « Je ne comprends pas » d'une mission : la question en mots simples, tous ses mots de métier expliqués, la méthode et des exemples résolus. */
import type { GameState, Mission } from "./types";
import { termsIn, type TermDef } from "./glossary";
import { missionQuestion, missionGuide } from "./missions";
import { famExamples, famHint, famPlain, BANK_BY_ID } from "./missionBank";

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

/** Explication en mots simples des missions qui ne sont pas des problèmes de calcul génériques (missions d'action, de situation, missions historiques) */
const PLAIN_TPL: Record<string, string> = {
  c_crise_var: "Une crise est en cours : les marchés sont nerveux et les pertes peuvent s'amplifier. Le risk manager veut que la perte potentielle du desk (la VaR) soit réduite. Il faut vendre une partie des positions les plus risquées, mais en gardant au moins trois lignes.",
  c_crise_expo: "Les actions et les ETF d'actions chutent en crise. On vous demande d'en détenir moins de 40 % de votre compte, donc de vendre une partie et de garder le reste en liquidités, obligations ou or.",
  c_crise_choix: "Question de bon sens en crise : on protège d'abord le capital, on réduit le risque, on vérifie la liquidité, et seulement ensuite on cherche des occasions.",
  c_resultats_per: "Avant qu'une entreprise publie ses résultats, on regarde si son action est chère ou bon marché : le PER (cours ÷ bénéfice par action) donne la réponse. Lisez le cours et le bénéfice par action sur la fiche, puis divisez.",
  c_resultats_pos: "Les résultats vont bientôt tomber et peuvent faire bouger fortement le cours. Si votre analyse est favorable, on vous demande de prendre une position acheteuse avant la publication.",
  c_bc_taux: "Le taux directeur est le taux fixé par la banque centrale : il influence tous les autres. La réponse se lit sur la page Macroéconomie, pour la zone demandée.",
  c_bc_reel: "Le taux réel = taux directeur − inflation. Il dit si la politique de la banque centrale freine vraiment l'économie (positif) ou la soutient (négatif). Lisez les deux chiffres sur la page Macroéconomie et soustrayez.",
  c_courbe: "La courbe des taux montre les taux selon la durée. La pente 2-10 ans est l'écart (taux à 10 ans − taux à 2 ans), à exprimer en points de base (1 point de base = 0,01 %). Négative = courbe inversée, signal de ralentissement.",
  c_ecart_zones: "On compare ce que rapporte l'emprunt d'État à 10 ans aux États-Unis et en zone euro : soustrayez les deux taux et exprimez l'écart en points de base.",
  c_inflation: "L'inflation est la hausse générale des prix. La page Macroéconomie donne le taux actuel de chaque zone.",
  c_croissance: "Comparez trois zones : la croissance est la hausse de la production en un an. Lisez-la sur la page Macroéconomie et choisissez la plus forte.",
  c_mouvement: "On cherche de combien l'action la plus agitée de la dernière séance a bougé. La variation = clôture ÷ clôture de la veille − 1, en pourcentage ; sur la fiche, la variation du jour est affichée.",
  c_indice_semaine: "La performance sur 5 séances est la variation du cours de l'indice entre il y a une semaine de bourse et aujourd'hui : visible sur le graphique « 1 semaine » de la fiche.",
  c_eurusd: "EURUSD = nombre de dollars pour 1 euro. S'il monte, l'euro s'apprécie. On demande sa variation en pourcentage sur 5 séances (graphique 1 semaine).",
  c_volatil: "On compare le mouvement (à la hausse ou à la baisse) de trois indices sur 5 séances : le plus grand écart, sans tenir compte du signe, l'emporte.",
  c_news_signe: "Une dépêche annonce un événement. Demandez-vous : est-ce bon ou mauvais pour les bénéfices ou la solidité de cette entreprise ? Bonne nouvelle = plutôt favorable pour le cours.",
  c_ptf_valeur: "Faites le point sur votre compte personnel : valeur des titres + argent disponible. La page Portefeuille donne ce total.",
  c_ptf_poids: "Le poids d'une ligne est sa part du portefeuille. On cherche la plus grosse : si elle dépasse 25-30 %, le portefeuille dépend trop d'un seul titre.",
  c_ptf_gagnant: "Un gain latent n'est pas encore à vous tant que vous n'avez pas vendu. Vendez une partie d'une ligne gagnante pour le transformer en gain réalisé.",
  premier_ordre: "Un ordre est une instruction pour acheter ou vendre. Choisissez un instrument, indiquez la quantité et validez. Commencez petit.",
  analyse_actif: "Comparez le PER actuel de l'action à son PER « normal » (celui d'une entreprise comparable) : si le PER actuel est plus bas, l'action semble moins chère que la normale.",
  vendre_position: "Vendre ce qu'on détient transforme le gain ou la perte « sur le papier » en résultat réel. Vendez une ligne puis regardez le résultat dans l'historique.",
  diversifier: "Diversifier, c'est répartir son argent sur plusieurs placements différents pour qu'un seul ne puisse pas tout faire perdre : au moins 5 lignes, 3 secteurs ou classes, aucune au-delà de 30 %.",
  reduire_secteur: "Le book est trop concentré sur un secteur : si ce secteur chute, tout chute. Vendez une partie des positions de ce secteur pour redescendre sous le seuil.",
  couvrir_change: "Détenir des actifs en dollars expose aux variations du dollar. Vendre la paire EURUSD revient à vendre des dollars contre des euros et réduit cette exposition.",
  rendement_obligation: "Le rendement actuariel est le rendement annuel complet d'une obligation gardée jusqu'à l'échéance : il tient compte du coupon, du prix payé et du remboursement final. La fiche donne le calcul.",
  duration_obligation: "La duration modifiée dit de combien le prix d'une obligation baisse quand les taux montent de 1 %. Elle se lit sur la fiche de l'obligation.",
  pnl_semaine: "Le P&L est votre profit net. Il faut gagner la somme demandée sur le book du desk sans dépasser la limite de risque (VaR).",
  respect_var: "La VaR est la perte à ne pas dépasser (sauf rare exception). Pendant 10 jours elle doit rester sous 90 % de la limite : gardez une marge de sécurité.",
  satisfaction_client: "La satisfaction d'un client monte quand on l'appelle, qu'on l'écoute et que son allocation correspond à son profil de risque.",
  allocation_client: "L'allocation est la répartition de l'argent d'un client entre actions et le reste. Un client prudent doit avoir moins d'actions : la page Clients indique la bande adaptée.",
  prevision_bc: "Avant la réunion de la banque centrale, prévoyez si elle va monter, baisser ou laisser ses taux. Inflation haute → plutôt hausse ; économie faible → plutôt baisse.",
  prevision_resultats: "Prévoyez si le cours montera ou baissera après la publication des résultats, selon la santé de l'entreprise et de son économie.",
  recommandation: "Votre recommandation d'achat est suivie pendant 20 jours : elle est réussie si l'action fait mieux que l'indice mondial. Il n'y a rien à faire, sinon patienter.",
  strategie_options: "Un « protective put » protège des actions : on achète un put qui prend de la valeur si le cours baisse. Il faut détenir au moins 100 titres et un put sur le même sous-jacent.",
  formation: "Lisez des modules du centre de formation et réussissez leurs exercices, jusqu'au nombre demandé.",
  watchlist: "La liste de surveillance rassemble les instruments qu'on suit ; une alerte prévient quand un prix franchit un niveau.",
  concentration: "Quelle est la plus grosse position du book ? La page Risques classe les positions par exposition.",
  battre_benchmark: "Le benchmark est l'indice de référence (ETF Monde). Il faut faire mieux que lui sur 20 jours : souvent, éviter les grosses pertes compte plus que chercher le gros gain.",
  creer_societe: "Créer une société demande du capital et de la réputation ; commencez par une activité de conseil, la moins coûteuse.",
  encours_societe: "L'encours est la somme que vos clients vous confient. Il croît avec le marketing et les commerciaux, mais surveillez la trésorerie.",
  d_revue: "On compare la variation de plusieurs indices lors de la dernière séance pour trouver le meilleur : elle est affichée sur chaque indice.",
  d_dividende: "Le rendement du dividende = dividende annuel ÷ cours × 100 : la part du prix de l'action rendue chaque année en dividende.",
  d_change: "Le cours de l'EURUSD est le nombre de dollars pour 1 euro : pour convertir des euros en dollars, on multiplie.",
  d_per: "Le PER = cours ÷ bénéfice par action : le plus bas est le moins cher par rapport à ses bénéfices.",
  d_secteur: "On compare la performance moyenne de plusieurs secteurs sur une semaine pour trouver le meilleur.",
  d_conformite: "Question de règles de bonne conduite : la réponse prudente, transparente et conforme à la réglementation est presque toujours la bonne.",
  d_ordre: "Un gérant vous demande d'exécuter un achat précis sur le book du desk : choisissez le bon compte, la bonne quantité, puis validez pendant les heures de marché.",
  d_pnl: "L'objectif est un gain minimal sur la journée, en respectant la limite de risque.",
  d_var: "La VaR du desk doit rester sous le pourcentage demandé de la limite à la fin de la journée.",
  d_client: "Appelez le client et obtenez un versement d'au moins le montant demandé, sans maladresse.",
  d_varchiffre: "Relevez la VaR 99 % à 1 jour du desk sur la page Risques et donnez-la au comité.",
  d_culture: "Une question d'économie : réfléchissez à la logique avant de choisir.",
  d_or_eur: "L'or cote en dollars ; pour l'avoir en euros, divisez le prix en dollars par l'EURUSD.",
  d_capi: "Capitalisation = cours × nombre d'actions, la valeur de l'entreprise vue par la bourse.",
  d_semaine: "Comparez la hausse de plusieurs actions sur cinq séances et trouvez celle qui a le plus progressé.",
  d_interets: "Des intérêts composés : le capital est multiplié chaque année par (1 + taux), pendant le nombre d'années donné.",
};
const PLAIN_FAMILY: Record<string, string> = {
  secteur: "On vous demande de prendre une position dans un secteur précis : achetez des actions de ce secteur, pour le montant demandé.",
  zone: "On vous demande de vous exposer à une zone géographique : achetez des actions ou des ETF cotés dans cette zone.",
  classe_achat: "Découvrez une classe d'actifs (ETF, obligations, matières premières…) en achetant un instrument de cette catégorie.",
  classe_detenir: "Il faut détenir, à l'échéance, une ligne d'une certaine classe d'actifs d'une valeur minimale.",
  classe_profit: "Réalisez un gain sur une classe d'actifs : achetez, attendez une hausse, vendez avec un profit.",
  ordre: "On vous demande de savoir utiliser un type d'ordre précis (limite, stop, lié, annulation) : passez-en un.",
  lignes: "La diversification commence par le nombre de lignes : détenez au moins le nombre de positions différentes demandé.",
  classes: "Diversifiez sur plusieurs classes d'actifs différentes (actions, obligations, or…).",
  var: "La VaR est la perte potentielle du desk : réduisez les positions risquées pour passer sous le seuil demandé, en gardant 3 lignes.",
  poids: "Aucune ligne ne doit peser trop lourd dans votre portefeuille : vendez un peu de la plus grosse ligne et répartissez ailleurs.",
  veille: "Suivez le marché de près : ajoutez des instruments à votre liste de surveillance.",
  alertes: "Créez des alertes de prix pour être prévenu quand un cours franchit un niveau.",
  collecte: "Appelez vos clients et obtenez de nouveaux versements jusqu'au montant demandé.",
  taille: "Prenez une position significative : un achat d'un seul bloc au moins égal au montant demandé.",
  culture: "Répondez à des questions de culture économique pour entretenir vos bases.",
};

const toTerm = (d: TermDef): HelpTerm => ({ term: d.term, simple: d.simple, example: d.example });

export function missionHelp(s: GameState, m: Mission): MissionHelp {
  const q = m.status === "active" ? missionQuestion(s, m) : null;
  const texts = [m.title, m.description, ...m.criteria, ...(q && "question" in q ? [q.question as string] : []), ...(q && "options" in q && Array.isArray(q.options) ? (q.options as string[]) : [])];
  const fam = typeof m.params._fam === "string" ? String(m.params._fam) : "";
  const formula = fam ? famHint(fam) : undefined;
  if (formula) texts.push(formula);
  const g = missionGuide(s, m);
  return {
    plain: fam ? famPlain(fam) : (PLAIN_TPL[m.templateId] ?? PLAIN_FAMILY[BANK_BY_ID[m.templateId]?.family ?? ""]),
    formula,
    terms: termsIn(texts).map(toTerm),
    examples: fam ? famExamples(fam, 2) : [],
    steps: g.steps,
  };
}
