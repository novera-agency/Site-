/**
 * Demandes spéciales des clients au téléphone : chaque appel tire une situation différente (héritage, achat immobilier,
 * retraite, peur de l'inflation, cryptoactifs, retrait, frais, panique après une baisse, fiscalité, recommandation…),
 * avec plusieurs formulations et des réactions variées selon la qualité de votre réponse.
 */
import type { Client } from "./types";

export type Quality = "bon" | "moyen" | "mauvais" | "faute";
export interface ReqChoice { label: string; q: Quality; why: string; sat?: number; fees?: number; prospect?: boolean; ethics?: boolean; }
export interface ClientRequest {
  id: string; kinds: Client["kind"][]; collect: boolean;
  /** Formulations possibles ({amount} = montant en jeu) */
  intro: string[];
  choices: ReqChoice[];
}

export const REACTIONS: Record<Quality, string[]> = {
  bon: ["Voilà exactement ce que j'avais besoin d'entendre.", "C'est clair, merci de prendre le temps de m'expliquer.", "Je sens que vous connaissez votre métier. On continue.", "Parfait, ça me rassure.", "Enfin quelqu'un qui pose les bonnes questions !"],
  moyen: ["Hmm… pourquoi pas, mais je ne suis pas complètement convaincu.", "D'accord, c'est une option. Vous êtes sûr que c'est ce qu'il y a de mieux ?", "Bon. Ce n'est pas tout à fait ce que j'imaginais.", "Je vais y réfléchir…"],
  mauvais: ["Je ne suis pas sûr que vous ayez compris ma situation.", "Ah non, ça ne me convient pas du tout.", "Vous me proposez ça à moi ? Vous avez lu mon dossier ?", "Ça me met mal à l'aise, franchement."],
  faute: ["Pardon ? Vous êtes sérieux ? Ce n'est pas très professionnel.", "Je vais faire comme si je n'avais rien entendu…", "Si votre direction savait ce que vous me proposez…"],
};

export const REQUESTS: ClientRequest[] = [
  { id: "heritage", kinds: ["particulier"], collect: true,
    intro: ["Ma tante est décédée le mois dernier et j'hérite d'environ {amount}. Je n'ai jamais eu autant d'argent d'un coup, je ne sais pas quoi en faire.", "Bonne et triste nouvelle : je viens de toucher un héritage, à peu près {amount}. Que me conseillez-vous ?"],
    choices: [
      { label: "Toutes mes condoléances. Prenons le temps : la succession est-elle réglée, avez-vous des projets ou des dettes ? Ensuite on investit progressivement.", q: "bon", why: "écoute et prudence face à un événement de vie" },
      { label: "On le place selon votre allocation habituelle, tout simplement.", q: "moyen", why: "réponse correcte mais impersonnelle" },
      { label: "Parfait timing : on met tout en actions technologiques dès aujourd'hui.", q: "mauvais", why: "précipitation inadaptée" },
      { label: "Si vous ne déclarez pas tout au notaire, vous économiserez des droits de succession.", q: "faute", why: "conseil de fraude fiscale", ethics: true },
    ] },
  { id: "immo", kinds: ["particulier"], collect: true,
    intro: ["On a trouvé la maison de nos rêves, mais on n'achète que dans deux ans. En attendant, j'ai {amount} à placer.", "Je prépare l'achat d'un appartement d'ici 18 mois. J'aimerais faire travailler {amount} d'ici là."],
    choices: [
      { label: "Avec un horizon de deux ans et un besoin certain, il faut un placement peu risqué et disponible : monétaire et obligations courtes.", q: "bon", why: "placement adapté à un horizon court" },
      { label: "Moitié actions, moitié obligations : un bon compromis.", q: "moyen", why: "trop risqué pour un achat programmé" },
      { label: "Les actions rapportent 8 % par an en moyenne, vous aurez plus pour votre maison.", q: "mauvais", why: "risque de perte juste avant l'achat" },
      { label: "Je vous garantis que vous récupérerez au moins votre mise.", q: "faute", why: "promesse de garantie interdite", ethics: true },
    ] },
  { id: "retraite", kinds: ["particulier"], collect: true,
    intro: ["J'ai 50 ans et je me réveille : il faut que je prépare ma retraite. Je peux verser {amount} maintenant.", "Mon comptable me dit que ma retraite sera maigre. Je voudrais investir {amount} pour compléter."],
    choices: [
      { label: "Bonne décision. Sur 15 ans, une part importante d'actions diversifiées est raisonnable, avec des versements réguliers en plus de ce montant.", q: "bon", why: "horizon long bien exploité" },
      { label: "On peut tout mettre sur un fonds en euros sécurisé.", q: "moyen", why: "sécurisé mais peu de rendement sur 15 ans" },
      { label: "J'ai un produit garanti à 8 % par an, sans aucun risque.", q: "faute", why: "promesse irréaliste", ethics: true },
      { label: "Vous auriez dû commencer il y a 20 ans, honnêtement.", q: "mauvais", why: "remarque blessante" },
    ] },
  { id: "etudes", kinds: ["particulier"], collect: true,
    intro: ["Je voudrais mettre de côté {amount} pour les études de mes enfants, dans huit ans environ.", "Ma fille veut faire médecine. Je veux placer {amount} pour ses études dans 7-8 ans."],
    choices: [
      { label: "Huit ans, c'est assez pour prendre un peu de risque au début, puis sécuriser progressivement à l'approche de l'échéance.", q: "bon", why: "gestion à horizon avec sécurisation progressive" },
      { label: "On met tout sur un livret pour ne prendre aucun risque.", q: "moyen", why: "trop prudent, l'inflation grignote" },
      { label: "Crypto : en huit ans, ça peut être multiplié par dix !", q: "mauvais", why: "spéculation inadaptée" },
    ] },
  { id: "esg", kinds: ["particulier", "institutionnel"], collect: true,
    intro: ["Mes enfants me reprochent d'investir dans le pétrole. Je veux placer {amount}, mais de façon responsable.", "Notre conseil a voté une politique d'investissement responsable. Nous voulons investir {amount} dans ce cadre."],
    choices: [
      { label: "Je peux vous proposer des fonds avec des critères environnementaux et sociaux précis, et je vous montrerai leur composition réelle.", q: "bon", why: "transparence sur les critères" },
      { label: "Tous nos fonds sont verts, ne vous inquiétez pas.", q: "faute", why: "écoblanchiment (greenwashing)", ethics: true },
      { label: "L'investissement responsable rapporte moins, ce n'est pas une bonne idée.", q: "mauvais", why: "ignore la demande du client" },
      { label: "On exclut simplement l'énergie fossile de votre allocation actuelle.", q: "moyen", why: "réponse partielle" },
    ] },
  { id: "inflation", kinds: ["particulier", "entreprise"], collect: true,
    intro: ["Avec l'inflation, j'ai l'impression de m'appauvrir. J'ai {amount} qui dorment sur un compte courant.", "Les prix montent partout. Je voudrais protéger {amount} contre l'inflation."],
    choices: [
      { label: "Le cash perd effectivement du pouvoir d'achat. Une diversification avec des actifs réels et des obligations indexées sur l'inflation peut aider.", q: "bon", why: "réponse diversifiée et pédagogique" },
      { label: "Tout en or : c'est la seule protection.", q: "mauvais", why: "concentration excessive" },
      { label: "L'inflation va vite redescendre, gardez votre cash.", q: "moyen", why: "prévision hasardeuse" },
    ] },
  { id: "crypto", kinds: ["particulier"], collect: true,
    intro: ["Mon neveu a gagné une fortune en cryptomonnaies. Je veux mettre {amount} là-dedans !", "Tout le monde parle du bitcoin. Je voudrais investir {amount} en cryptos."],
    choices: [
      { label: "Je comprends l'envie. C'est très volatil : au plus une petite part compatible avec votre profil, le reste diversifié. Je vous explique les risques par écrit.", q: "bon", why: "devoir de conseil respecté" },
      { label: "Allons-y, tout en cryptos, c'est votre argent.", q: "mauvais", why: "inadéquation au profil" },
      { label: "Les cryptos, c'est pour les escrocs. Hors de question.", q: "mauvais", why: "refus brutal sans explication" },
    ] },
  { id: "tresorerie", kinds: ["entreprise", "institutionnel"], collect: true,
    intro: ["Nous avons {amount} de trésorerie excédentaire pour six mois. Il faut que ce soit disponible et sans risque.", "Le directeur financier me demande de placer {amount} sur un horizon court, sans prendre de risque."],
    choices: [
      { label: "Pour six mois : fonds monétaires et titres courts de grande qualité, disponibles rapidement.", q: "bon", why: "adapté à une trésorerie" },
      { label: "Un produit structuré à 3 ans offre un meilleur rendement.", q: "mauvais", why: "horizon et liquidité ignorés" },
      { label: "Mettons une partie en actions pour doper le rendement.", q: "mauvais", why: "risque inadapté à de la trésorerie" },
    ] },
  { id: "retrait", kinds: ["particulier", "entreprise"], collect: false,
    intro: ["J'ai besoin de récupérer une partie de mon argent pour des travaux. C'est possible rapidement ?", "Coup dur : je dois retirer de l'argent de mon mandat pour un imprévu familial."],
    choices: [
      { label: "Bien sûr, c'est votre argent. Je vends en priorité les liquidités et les obligations pour ne pas déséquilibrer le reste, et je vous confirme par écrit.", q: "bon", why: "service rendu sans résistance", sat: 6 },
      { label: "Êtes-vous sûr ? Retirer maintenant, c'est une mauvaise idée.", q: "mauvais", why: "pression pour garder l'argent", sat: -6 },
      { label: "Il faudra compter un mois de délai.", q: "moyen", why: "délai inutile", sat: -2 },
    ] },
  { id: "frais", kinds: ["particulier", "institutionnel", "entreprise"], collect: false,
    intro: ["Une banque en ligne me propose des frais deux fois moins élevés. Pourquoi je resterais chez vous ?", "J'ai comparé : vos frais sont trop élevés. Convainquez-moi."],
    choices: [
      { label: "Je vous détaille ce que couvrent nos frais (suivi, conseil, gestion des risques) et je peux faire un geste raisonnable.", q: "bon", why: "valeur expliquée, geste mesuré", sat: 5, fees: 0.9 },
      { label: "Je divise vos frais par deux tout de suite.", q: "moyen", why: "client satisfait, mais revenus de la banque amputés", sat: 7, fees: 0.5 },
      { label: "Nos frais ne se discutent pas.", q: "mauvais", why: "fermeture totale", sat: -8 },
    ] },
  { id: "panique", kinds: ["particulier"], collect: false,
    intro: ["J'ai regardé mon relevé, ça a baissé ! Vendez tout, je ne dors plus.", "Les journaux annoncent une crise. Je veux tout vendre avant que ce soit pire !"],
    choices: [
      { label: "Je comprends votre inquiétude. Regardons ensemble votre horizon et ce qui a baissé : vendre au plus bas cristalliserait la perte. On peut réduire un peu le risque si vous dormez mieux.", q: "bon", why: "accompagnement émotionnel et rationnel", sat: 6 },
      { label: "Très bien, je vends tout immédiatement.", q: "moyen", why: "vente au plus bas", sat: 1 },
      { label: "Ne vous inquiétez pas, ça remonte toujours, c'est garanti.", q: "faute", why: "promesse impossible", sat: -3, ethics: true },
    ] },
  { id: "fiscalite", kinds: ["particulier"], collect: false,
    intro: ["Je paie trop d'impôts. Vous auriez une astuce ?", "Mon voisin dit qu'il ne paie presque pas d'impôt sur ses placements. Comment il fait ?"],
    choices: [
      { label: "Il existe des enveloppes légales avantageuses (PEA, assurance-vie, épargne retraite). Je vous les présente, et pour le reste, voyez un conseiller fiscal.", q: "bon", why: "conseil légal et dans votre périmètre", sat: 5 },
      { label: "Ouvrez un compte dans un pays discret, personne ne le saura.", q: "faute", why: "incitation à la fraude fiscale", sat: -2, ethics: true },
      { label: "Ce n'est pas mon métier.", q: "mauvais", why: "aucune aide", sat: -4 },
    ] },
  { id: "recommandation", kinds: ["particulier", "entreprise"], collect: false,
    intro: ["Je suis très content de vous. Un ami à moi cherche un conseiller, je peux lui donner votre numéro ?", "Mon associé voudrait vous rencontrer, je lui ai parlé de vous en bien."],
    choices: [
      { label: "Merci beaucoup, c'est la plus belle des reconnaissances. Donnez-moi ses coordonnées, je l'appelle cette semaine.", q: "bon", why: "recommandation transformée en prospect", sat: 4, prospect: true },
      { label: "Oui, qu'il appelle l'accueil de la banque.", q: "moyen", why: "occasion mal exploitée", sat: 0 },
    ] },
];

/** Objections possibles en fin d'appel de collecte */
export interface Objection { text: string[]; choices: ReqChoice[]; }
export const OBJECTIONS: Objection[] = [
  { text: ["Et si ça baisse, je perds combien ?", "Qu'est-ce qui me garantit que je ne vais pas perdre ?"], choices: [
    { label: "Honnêtement, une baisse est possible. Dans un mauvais scénario, l'ordre de grandeur serait celui-ci, et voici pourquoi c'est cohérent avec votre horizon.", q: "bon", why: "transparence sur le risque" },
    { label: "Rien ne peut baisser, je vous le garantis.", q: "faute", why: "garantie interdite", ethics: true },
  ] },
  { text: ["Vos frais, au final, ils sont de combien ?", "Ça va me coûter combien, tout ça ?"], choices: [
    { label: "Je vous donne le chiffre exact, tout compris, et je vous l'envoie par écrit.", q: "bon", why: "transparence sur les frais" },
    { label: "Ne vous occupez pas des frais, c'est le rendement qui compte.", q: "mauvais", why: "esquive" },
  ] },
  { text: ["Il faut que j'en parle à mon conjoint avant.", "Je dois en discuter avec mon associé."], choices: [
    { label: "Bien sûr. Voulez-vous que je vous envoie un résumé, ou que nous en parlions tous ensemble ?", q: "bon", why: "respect de la décision partagée" },
    { label: "Décidez maintenant, l'offre ne durera pas.", q: "mauvais", why: "pression commerciale" },
  ] },
  { text: ["J'ai lu dans la presse que les marchés étaient trop chers.", "Ce n'est pas le pire moment pour investir ?"], choices: [
    { label: "Personne ne sait prédire le bon moment. Investir progressivement sur plusieurs mois réduit ce risque.", q: "bon", why: "investissement progressif" },
    { label: "La presse se trompe toujours, foncez.", q: "mauvais", why: "affirmation non fondée" },
  ] },
];

export function requestsFor(kind: Client["kind"]) { return REQUESTS.filter((r) => r.kinds.includes(kind)); }
