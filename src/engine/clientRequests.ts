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
  { id: "divorce", kinds: ["particulier"], collect: false,
    intro: ["Je suis en train de divorcer. Mon ex-conjoint veut la moitié du portefeuille, je ne sais pas comment ça se passe.", "Situation compliquée : nous nous séparons et il faut partager nos placements communs."],
    choices: [
      { label: "Je suis désolé pour vous. Je vous prépare un relevé précis des avoirs communs et propres, et le partage se fera selon ce que décidera votre notaire ou avocat.", q: "bon", why: "neutralité et transparence", sat: 6 },
      { label: "Vendez tout maintenant, ce sera plus simple.", q: "moyen", why: "vente précipitée et fiscalement coûteuse", sat: 0 },
      { label: "On peut transférer discrètement une partie sur un compte à votre seul nom avant le partage.", q: "faute", why: "dissimulation d'actifs", sat: -4, ethics: true },
    ] },
  { id: "entreprise_vente", kinds: ["entreprise", "particulier"], collect: true,
    intro: ["Je viens de vendre ma société après vingt ans de travail. J'ai {amount} sur mon compte et aucune idée de la suite.", "La cession de mon entreprise est signée : {amount} à placer. Je veux surtout ne pas tout perdre."],
    choices: [
      { label: "Félicitations ! Avant d'investir, parlons de vos besoins de revenus, de votre fiscalité et de vos projets. On construira ensuite un portefeuille diversifié, investi par étapes.", q: "bon", why: "approche patrimoniale complète", sat: 4 },
      { label: "Je vous propose notre fonds phare, tout de suite.", q: "moyen", why: "solution standard sans analyse", sat: 0 },
      { label: "Avec une telle somme, prenez du levier pour doubler la mise.", q: "mauvais", why: "risque démesuré", sat: -5 },
    ] },
  { id: "loto", kinds: ["particulier"], collect: true,
    intro: ["Vous n'allez pas me croire : j'ai gagné au loto ! {amount}. Je tremble encore.", "J'ai gagné {amount} à un jeu à gratter… enfin, un gros lot. Aidez-moi à ne pas faire de bêtise."],
    choices: [
      { label: "Bravo ! Première règle : ne rien décider dans l'euphorie. On met l'argent en sécurité quelques semaines, puis on bâtit un plan avec vos projets.", q: "bon", why: "prudence et temps de réflexion", sat: 5 },
      { label: "On place tout en actions dès demain.", q: "moyen", why: "précipitation", sat: 0 },
      { label: "Le moment idéal pour tenter les cryptoactifs à fort potentiel !", q: "mauvais", why: "spéculation inadaptée à un gain soudain", sat: -4 },
    ] },
  { id: "expatriation", kinds: ["particulier"], collect: false,
    intro: ["Je pars travailler trois ans à Singapour. Qu'est-ce que je fais de mes placements ?", "Mutation à l'étranger le mois prochain : je garde mon portefeuille en France ?"],
    choices: [
      { label: "On vérifie vos obligations fiscales dans les deux pays et ce que vous pouvez conserver ici. Je vous mets en relation avec notre service international.", q: "bon", why: "conseil prudent et orienté", sat: 5 },
      { label: "Ne déclarez rien, personne ne vérifiera depuis l'étranger.", q: "faute", why: "incitation à la fraude", sat: -3, ethics: true },
      { label: "Fermez tout, ce sera plus simple.", q: "moyen", why: "solution radicale et coûteuse", sat: -1 },
    ] },
  { id: "dette", kinds: ["particulier"], collect: false,
    intro: ["J'ai un crédit à la consommation à 9 % et 20 000 € placés à côté. Je rembourse ou je garde ?", "Est-ce que je devrais rembourser mon prêt plus vite au lieu d'investir ?"],
    choices: [
      { label: "Un crédit à 9 % coûte plus que ce que rapportent la plupart des placements : rembourser en gardant une épargne de précaution est souvent le meilleur choix.", q: "bon", why: "conseil honnête même s'il réduit les encours", sat: 7 },
      { label: "Gardez vos placements, la bourse rapporte plus.", q: "mauvais", why: "rendement incertain contre coût certain", sat: -3 },
      { label: "Je ne sais pas, faites comme vous voulez.", q: "mauvais", why: "absence de conseil", sat: -4 },
    ] },
  { id: "or_peur", kinds: ["particulier"], collect: true,
    intro: ["Avec tout ce qui se passe dans le monde, je veux mettre {amount} dans l'or. Vous en pensez quoi ?", "Mon beau-frère ne jure que par l'or. Je voudrais y placer {amount}."],
    choices: [
      { label: "L'or protège en partie en période de crise, mais ne verse aucun revenu. Une part de 5 à 10 % dans un portefeuille diversifié est raisonnable.", q: "bon", why: "diversification mesurée", sat: 4 },
      { label: "Mettez tout en or, c'est la seule valeur sûre.", q: "mauvais", why: "concentration excessive", sat: -2 },
      { label: "L'or ne sert à rien, oubliez.", q: "moyen", why: "réponse fermée sans explication", sat: -2 },
    ] },
  { id: "fondation", kinds: ["institutionnel"], collect: true,
    intro: ["Notre fondation doit financer ses bourses d'études chaque année. Nous avons {amount} à placer, avec un objectif de revenu régulier.", "Le conseil d'administration de notre association veut confier {amount} avec un risque maîtrisé."],
    choices: [
      { label: "Nous pouvons construire un portefeuille obligataire et actions à dividendes, avec une règle de distribution prudente et un reporting trimestriel au conseil.", q: "bon", why: "réponse adaptée à une obligation de revenu", sat: 5 },
      { label: "Le plus simple : tout en actions de croissance.", q: "mauvais", why: "pas de revenu régulier, trop volatil", sat: -4 },
      { label: "Un fonds monétaire suffira.", q: "moyen", why: "trop peu de rendement à long terme", sat: 0 },
    ] },
  { id: "rachat_concurrent", kinds: ["entreprise"], collect: false,
    intro: ["Nous envisageons de racheter un concurrent. Vous pouvez nous aider à financer l'opération ?", "Une acquisition se présente. Il nous faudrait un financement rapide."],
    choices: [
      { label: "Avec plaisir. Je vous mets en relation avec notre équipe de financement d'acquisitions, et je vous envoie la liste des documents à préparer.", q: "bon", why: "orientation vers le bon service", sat: 6, prospect: true },
      { label: "Je peux vous accorder le prêt moi-même, tout de suite.", q: "faute", why: "promesse hors de votre délégation", sat: -2, ethics: true },
      { label: "Ce n'est pas de mon ressort.", q: "mauvais", why: "occasion manquée", sat: -4 },
    ] },
  { id: "deces_conjoint", kinds: ["particulier"], collect: false,
    intro: ["Mon mari est décédé il y a deux semaines. Je ne sais même pas ce que nous avions chez vous.", "Ma femme s'occupait de tous nos placements. Elle nous a quittés… je suis un peu perdu."],
    choices: [
      { label: "Toutes mes condoléances. Rien ne presse. Je vous envoie un récapitulatif simple de vos comptes et je vous accompagne pour les démarches avec le notaire.", q: "bon", why: "empathie et accompagnement", sat: 9 },
      { label: "C'est le bon moment pour réorganiser tout le portefeuille.", q: "mauvais", why: "pression commerciale indécente", sat: -8 },
      { label: "Je vous envoie les formulaires, remplissez-les.", q: "moyen", why: "froideur administrative", sat: -2 },
    ] },
  { id: "influenceur", kinds: ["particulier"], collect: true,
    intro: ["J'ai vu une vidéo d'un influenceur qui fait 30 % par mois avec une méthode secrète. Vous pouvez faire pareil avec {amount} ?", "Un groupe sur les réseaux sociaux promet des rendements énormes. Je voudrais investir {amount} comme eux."],
    choices: [
      { label: "Méfiez-vous : 30 % par mois, c'est le signe d'une arnaque. Je peux vous proposer un placement sérieux pour cette somme, avec des attentes réalistes.", q: "bon", why: "protection du client contre une fraude", sat: 5 },
      { label: "Oui, on peut essayer avec des produits à levier.", q: "mauvais", why: "validation d'attentes irréalistes", sat: -3 },
      { label: "Je vous garantis 10 % par an, c'est déjà bien.", q: "faute", why: "promesse de rendement", sat: -2, ethics: true },
    ] },
  { id: "salaries", kinds: ["entreprise"], collect: true,
    intro: ["Nous voulons mettre en place une épargne salariale pour nos employés. L'entreprise peut abonder {amount} cette année.", "Notre comité social nous demande un plan d'épargne pour les salariés. Budget : {amount}."],
    choices: [
      { label: "Excellente idée pour fidéliser vos équipes. Je vous présente un plan avec plusieurs fonds au choix, du prudent au dynamique, et une réunion d'information pour les salariés.", q: "bon", why: "solution complète et pédagogique", sat: 5 },
      { label: "On place tout dans un seul fonds actions, c'est plus simple.", q: "moyen", why: "aucun choix pour les salariés", sat: -1 },
      { label: "Mettez les salariés dans les actions de votre propre société, c'est motivant.", q: "mauvais", why: "concentration du risque sur l'employeur", sat: -3 },
    ] },
  { id: "plainte_retard", kinds: ["particulier", "institutionnel", "entreprise"], collect: false,
    intro: ["Mon virement d'il y a trois jours n'est toujours pas arrivé. C'est inadmissible !", "Votre banque a fait une erreur sur mon relevé. Je suis furieux."],
    choices: [
      { label: "Vous avez raison d'appeler. Je vérifie immédiatement avec le service des opérations et je vous rappelle avant ce soir avec une réponse précise.", q: "bon", why: "prise en charge et engagement clair", sat: 7 },
      { label: "Ce n'est pas mon service, appelez le standard.", q: "mauvais", why: "renvoi de responsabilité", sat: -7 },
      { label: "Ça arrive, il faut être patient.", q: "moyen", why: "minimisation du problème", sat: -3 },
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
