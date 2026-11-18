# État d'avancement (exact)

Légende : ✅ fonctionnel et relié au moteur · 🟡 partiel · ❌ non réalisé

## Critères d'acceptation (parcours end-to-end, automatisé dans `e2e/parcours.spec.ts`)
1 Lancer ✅ · 2 Créer une carrière ✅ · 3 Choisir une banque ✅ · 4 Capital virtuel ✅ · 5 Marchés qui évoluent ✅ · 6 Accélérer/pause ✅ · 7 Acheter ✅ · 8 Solde qui diminue ✅ · 9 Position en portefeuille ✅ · 10 Variations de valeur ✅ · 11 Revendre ✅ · 12 Résultat ✅ · 13 Réunion ✅ · 14 Mission ✅ · 15 Événement économique ✅ · 16 Conséquences sur le marché ✅ · 17 Évaluation professionnelle ✅ · 18 Sauvegarder ✅ · 19 Fermer ✅ · 20 Reprendre sans perte ✅

## Fonctionnalités
| Domaine | État | Détail |
|---|---|---|
| Accueil, nouvelle carrière, continuer, bac à sable, défi, paramètres | ✅ | 3 défis ; paramètres globaux (ratio de temps) + par partie |
| Personnage (prénom, nom, nationalité, âge, formation, connaissances, objectif, spécialisation, risque) | ✅ | Le niveau de connaissances détermine les banques accessibles et les compétences initiales |
| 8 parcours, 7 banques fictives avec identité, culture, grille, politique de risque | ✅ | + 2 banques concurrentes cotées (crises) |
| Entretiens, négociation salariale, offres, changement de banque, licenciement | ✅ | Entretien technique pour les offres ; à la création, l'accès est conditionné au profil (pas d'entretien) |
| Mutations, réorganisations | 🟡 | Événement narratif ; pas de changement de métier mécanique |
| Fusions bancaires | 🟡 | Rachat de la banque en crise par un concurrent ; pas de fusion de l'employeur |
| Burnout, congés, train de vie | ✅ | |
| Économie virtuelle, comptes séparés, devises virtuelles | ✅ | 8 devises, conversion avec commission |
| Capital 1 000 / 10 000 / 100 000 / libre | ✅ | |
| Moteur boursier autonome (facteurs, régimes, corrélations, liquidité, spreads, impact) | ✅ | |
| 10 régimes, transitions probabilistes, déterminisme par graine | ✅ | Testé |
| Temps : pause, x1…x100, ratio configurable, pause automatique, « avancer jusqu'à » | ✅ | |
| Actions (55), ETF (11), obligations (18 dont FRN, IG, HY), devises (9), matières (7), crypto fictives (4) | ✅ | |
| Options call/put, grecques, payoff, ITM/ATM/OTM, 9 stratégies, marge | ✅ | Européennes, règlement en espèces |
| Futures (indices, Bund, Brent, or) | ✅ | |
| Forwards, swaps de taux/devises, CDS, warrants | ❌ | Expliqués au centre de formation ; CDS représentés par le stress/spread de crédit |
| Produits structurés (autocall, Phoenix, reverse convertible, capital protégé, participation, barrière, paniers) | ✅ | Pas de marché secondaire |
| Terminal : chandeliers, volumes, carnet, bid/ask, MM, RSI, MACD, Bollinger, ATR, volatilité, watchlist, alertes, actualités, calendrier, recherche | ✅ | « Comparaison d'actifs » : benchmark sur le portefeuille, pas de superposition libre de deux actifs 🟡 |
| Ordres marché/limite/stop/stop-limite/SL/TP, durée, partiel, statuts, short, marge, liquidation, idempotence | ✅ | |
| Portefeuille : valeur, P&L latent/réalisé, perf jour/cumulée/annualisée, drawdown, volatilité, Sharpe, expositions, benchmark, journal comptable | ✅ | |
| Dividendes, coupons, remboursements, défauts, échéances | ✅ | |
| Hiérarchie de 9 rangs par métier, salaires, bonus, promotions multicritères, revues | ✅ | |
| Réunions (17) avec contexte, participants, ordre du jour, documents, questions chiffrées, actions exécutées, conséquences | ✅ | |
| Réunions : choix du mode à l'entrée. **Oral** : autorisation du micro demandée, voix distinctes par personnage, aucune transcription affichée pendant la réunion, réponse à voix haute en temps limité (30/20/15/12 s), « Faire répéter », compte rendu écrit consultable à la fin. **Écrit** : historique complet avec les noms et rôles, réponses au clic | ✅ | API vocales du navigateur (micro : Chrome, Edge, Safari). Compréhension hors ligne par mots-clés, sans IA |
| Réunions : hors-sujet = −2 en communication et avertissement ; 3 avertissements (hors-sujet ou silences) = réunion ratée (confiance −4 de chaque participant, réputation interne −3, fiabilité −2, client −8) ; score final ≤ −6 = réunion ratée | ✅ | |
| « Qu'est-ce que… ? » en réunion (oral ou écrit) : la personne qui a employé le terme l'explique (35 fiches + 27 termes de jargon), sans pénalité | ✅ | |
| Avis des collaborateurs : allié (confiance ≥ 70) / défavorable (≤ 25) avec effets par rôle — N+1 ±5 aux évaluations et ancienneté −20 % ; MD bonus ±15 % et parrainage au-delà d'Associate ; risques : tolérance de 10 % ou limite resserrée de 10 % ; conformité : pénalités ×0,75 / ×1,25 ; trader senior et analyste : idées et notes de recherche hebdomadaires ; collègue : couverture d'un rendez-vous manqué ou rivalité ; recruteur : offres ×2 / ×0,5 ; journaliste : ±1 de réputation par mois | ✅ | Effets affichés dans Relations et Votre équipe ; changements d'avis notifiés |
| PNJ (12 + clients) avec état persistant, mémoire, opinion | ✅ | |
| IA conversationnelle (propose, le moteur valide) + mode hors ligne | 🟡 | Code complet ; non exercé contre l'API réelle dans cet environnement (pas de clé) |
| Clients difficiles (pertes, produit risqué, retrait, frais, rendement irréaliste, conformité, panique) | ✅ | |
| Actualités dynamiques (8 rubriques) | ✅ | |
| Crises (liquidité bancaire détaillée en 4 phases, krach, bulle tech, énergie, dette souveraine, taux, faillite d'entreprise, change, immobilier) | ✅ | Récession/inflation via régimes |
| Macroéconomie 6 zones, banques centrales | ✅ | |
| Missions (22 modèles paramétrables, centaines de combinaisons) | ✅ | |
| Compétences (8 branches), réputation (8 indicateurs) | ✅ | |
| Formation (35 termes × 6 volets) + dictionnaire + infobulles | ✅ | |
| Événements narratifs (11 types, délais de réapparition) | ✅ | |
| Entreprise (6 types), bilan, résultat, flux, faillite, levée, emprunt, dividendes | ✅ | Modèle agrégé des encours |
| Concurrents (banques agents) | ✅ | Influence agrégée sur la liquidité |
| Difficulté (4 niveaux) | ✅ | Assistance, marges, vente à découvert, fréquence d'événements |
| Sauvegardes : auto, 3 emplacements, export/import, versions + migration | ✅ | |
| Authentification, sessions signées, autorisations, limitation de débit, validation Zod | ✅ | Comptes locaux (fichier `data/users.json`) |
| Réunions vocales (mode oral / écrit, voix distincte par collaborateur, « qu'est-ce que… ») | ✅ | Web Speech API du navigateur |
| Appels clients (sonnerie, décroché ou messagerie, rappel, objectif de vente qui baisse à chaque faute) | ✅ | Le client raccroche sous 30 % de l'objectif |
| Mode historique 2000 → 13 novembre 2026 (événements réels datés, décisions réelles des banques centrales, trajectoires approchées des indices, matières premières, changes et taux) | ✅ | Repères approximatifs, pas de cours officiels ; sociétés du jeu fictives ; simulation libre à partir de 2026 |
| Univers de plus de 1 200 actions fictives (13 pays, 12 secteurs, indices nationaux, ETF) | ✅ | Petites valeurs non suivies : calcul toutes les 30 min et sauvegarde compacte (clôtures seules) |
| Vie privée : fiche de paie et impôt, logement (location/achat à crédit), factures, transport, abonnements, loisirs à temps limité, 4 jauges, événements de la vie, impayés et expulsion, négociation salariale à la demande | ✅ | Impôt : barème progressif simplifié (une part) |
| Missions du jour (≥ 2 par jour ouvré, 11 modèles, enjeu selon appréciation et grade) | ✅ | |
| Navigation en 5 catégories (Bureau, Vie professionnelle, Vie personnelle, Relations, Options) | ✅ | Barre du bas + menu latéral repliable |
| Investissement immobilier locatif (13 villes, annonces, marché de la location et de la vente, encadrement, DPE, fiscalité) | ✅ | Fiscalité simplifiée |
| Croix de retour et fil d'Ariane sur chaque page | ✅ | |
| Appels clients à demandes variées (13 situations, objections, réactions) et prospection (prospects du N+1 et recommandations, conversion en client) | ✅ | |
| Cours réels exacts (flux de données) | ❌ | Aucune source de données accessible ni licence de diffusion |
| PostgreSQL / Prisma | ❌ | Remplacé par des fichiers JSON (voir ARCHITECTURE) |
| Responsive (ordinateur, tablette, mobile) | ✅ | Menu latéral repliable |

## Écrans (30 demandés)
Accueil · Création de carrière · Choix de banque · Création de personnage · Bureau · Tableau de bord carrière · Terminal · Recherche · Fiche d'actif · Passage d'ordres · Portefeuille · Transactions · Risques · Actualités · Calendrier · Réunions · Messagerie · Clients · Missions · Formation · Dictionnaire · Compétences · Relations · RH · Rémunération · Patrimoine · Entrepreneuriat · Gestion de société · Paramètres · Sauvegardes — **tous présents** (+ Options, Produits structurés, Macroéconomie, Agenda, Réputation, Établissements).

## Mise en ligne
- Édition navigateur (export statique, moteur côté client, sauvegardes IndexedDB) : ✅ parcours e2e 20/20 validé sur un serveur statique avec le préfixe `/Site-`.
- Workflow GitHub Pages : ✅ ajouté (build + tests verts sur GitHub). Prérequis côté dépôt : Pages réglé sur « GitHub Actions ». Adresse : https://novera-agency.github.io/Site-/

## Vérifications (dernière exécution)
- `npm run lint` : OK
- `npm test` : 104/104
- `npm run e2e` : 32/32 (dont parcours 20 étapes, appel client, immobilier, vie privée, voix)
- Affichage émulé iPhone 13, Pixel 7 et iPad : aucune page ne déborde horizontalement (38 écrans)
- `npm run build` : OK

## Bugs corrigés pendant les tests
- Coupons dont la date tombait un week-end jamais versés → rattrapage au jour ouvré suivant.
- Volatilité réalisée trop élevée (cumul des chocs de volatilité) → amortissement et plafonnement.
- Historique obligataire décalé du prix courant → recollage sur le dernier cours.

## Dernier lot (parcours, fins, vie de famille, équilibrage)
- ✅ Chapitres, succès, score, fins de partie (retraite, faillite après 120 jours de dettes, fortune) et tableau d'honneur.
- ✅ Couple, mariage, enfants (coûts et temps libre), histoires de collègues, événements mondiaux simulés.
- ✅ Notifications regroupées (×n) et filtrées (toutes / importantes / critiques), son et musique désactivables, portraits.
- ✅ Export / import de toutes les sauvegardes en un fichier.
- ✅ Équilibrage vérifié par simulation de 3 ans : un joueur passif n'est plus promu (confiance du N+1 ≥ 45 et 50 % de missions réussies requises), plus de burn-out en boucle (récupération à 45, avertissement puis congé forcé au troisième).
- ⚠️ Version anglaise : menus, navigation, visite guidée et accueil traduits ; dialogues, missions et actualités en français.
- ❌ Synchronisation dans le cloud : impossible sur un hébergement statique ; remplacée par l'export de fichier.
- ⚠️ Classement : local à l'appareil uniquement. Tests mobiles : émulés, pas sur de vrais téléphones.

## Lot suivant (visite guidée, accessibilité, contenu)
- ✅ Visite guidée de l'interface (lancement automatique la première fois, relançable).
- ✅ Accessibilité : réglages texte agrandi / contraste / animations ; contrastes corrigés partout ; champs étiquetés ; audit axe WCAG A/AA : 0 erreur sur 16 écrans.
- ✅ Mode historique : avertissement un mois avant la fin des données réelles, message à l'entrée en 2026, badge « Histoire réelle / Simulation libre ».
- ✅ Performances : calcul plafonné par seconde (150 ms dans le navigateur), badge « Appareil limité ».
- ✅ Contenu : +12 demandes clients, +12 événements mondiaux, +8 événements de vie (animal de compagnie), +4 missions du jour.
- ❌ Sauvegarde dans le cloud, classement mondial, voix humaines de synthèse : nécessitent un service externe (compte, clé, serveur).

## Histoire jusqu'en 2026, quiz d'économie
- ✅ Repères réels étendus jusqu'au 13 novembre 2026 (indices, or, pétrole, devises, taux, cryptoactifs, taux directeurs Fed/BCE/BoE, 21 événements datés) ; sources : presse financière consultée le 15 novembre 2026. Les séries peu couvertes (émergents, banques, cuivre, blé, devises secondaires) sont des estimations prudentes ; la macro 2026 (PIB, inflation, chômage) est estimée.
- ✅ Parties créées avant cette version : recommencées une fois au 3 janvier 2000 (même personnage, banque, nom, capital).
- ✅ Quiz d'économie : 50 questions (25 micro, 25 macro), explications, séries, 3 succès, mission du jour « culture ».
- ⚠️ Les valeurs 2026 viennent de recherches web aux chiffres parfois divergents : approximations, pas des cours officiels.

## Quiz à grande échelle, ambiance sans musique
- ✅ 2 questions du jour (une de culture, une de calcul), figées pour la journée ; 7 300 jours simulés sans répétition notable ni erreur.
- ✅ 335 questions rédigées + questions tirées de la chronologie historique + 20 familles de calculs à chiffres générés.
- ✅ Musique retirée : ambiance de nature (pluie douce, vent) synthétisée et simples tapotements pour les alertes ; plus aucune mélodie ni instrument. Les activités « concert » sont devenues « spectacle ».
- ⚠️ Les 14 600 questions ne sont pas toutes rédigées : le renouvellement vient des exercices générés et des événements historiques ; la banque rédigée est parcourue une fois, puis les calculs prennent le relais.

## Assurance, immobilier, révision espacée
- ✅ 28 questions d'assurance et 34 d'immobilier (France) ; 2 nouvelles catégories du quiz (compétence « risque » pour l'assurance).
- ✅ Révision espacée : une question réussie ne revient jamais avant 30 jours de jeu ; réussie à la révision, elle rapporte moins d'expérience ; ratée, elle repasse en « à retravailler ». Les nouvelles questions passent toujours avant les révisions.
- ✅ Son de fond (pluie, vent) retiré à la demande de l'utilisateur : il ne reste que de très courts bruits lors des notifications, désactivables dans Paramètres.
- ✅ Zoom automatique sur mobile : champs et menus déroulants à 16 px minimum (pas de zoom au toucher), échelle verrouillée pendant la saisie puis rendue au pincement ; double-toucher sans zoom. Vérifié en émulation (écran iPhone sous Chromium), pas sur un vrai iPhone.
- ✅ Activités de loisirs : possibles seulement après le travail (18 h les jours ouvrés ; dès le matin le week-end, en congés ou sans emploi) et doivent finir avant minuit ; l'horloge avance de leur durée (1 h = +1 h au compteur du haut), s'arrête si une réunion ou un événement important survient, et l'état de pause est conservé. Nouveau saut « Jusqu'à la fin du travail (18 h) ».

## Planning, sommeil, heures supplémentaires
- ✅ Page « Planning et sommeil » (Bureau) : horaires de travail (arrivée, départ) et heure de réveil au quart d'heure, frise de la journée.
- ✅ Dormir : l'horloge avance jusqu'au réveil choisi ; 7 à 9 h = excellent, moins de 6 h = fatigue ; le sommeil est **obligatoire** : rappel à 22 h 30, et à l'heure du réveil une nuit sans dormir = nuit blanche (forme −10, moral −7, stress +9, confiance du responsable −0,3) ; trois nuits blanches de suite = arrêt pour épuisement. Le saut « Jusqu'à demain matin » le soir = aller dormir.
- ✅ Horaires : journée de référence 9,5 h (7 h 30 → 18 h, déjeuner déduit) ; plus long = fatigue, stress, un peu de confiance du responsable ; plus court = sérénité mais confiance en baisse. Agenda, activités et temps libre suivent les horaires ; le bilan clôt la journée à l'heure de fin.
- ✅ Heures supplémentaires (après l'horaire de fin, 1 à 4 h, avant 23 h 30) : prendre de l'avance (partir plus tôt le lendemain, 4 h de réserve), traiter des dossiers en retard (échéances repoussées), se former (expérience). Elles fatiguent, davantage au-delà de 3 h par jour, 12 h par semaine et le week-end. Elles ne sont pas rémunérées (forfait cadre).
- ✅ Heures supplémentaires « me former » : de vraies séances de formation (3 questions par heure). Chaque heure = une leçon du centre de formation (fiche : définition, en clair, exemple, à quoi ça sert, puis exercice corrigé), une définition (QCM dans les deux sens) et un exercice de calcul à chiffres générés ; matière au choix ou compétence la plus faible. Corrections détaillées, XP par bonne réponse (leçons validées au premier succès), bonus + confiance du responsable à 80 %, carnet de formation des erreurs à revoir, 3 succès. Les leçons déjà validées ne reviennent pas avant les nouvelles ; une séance en cours bloque la suivante.
- ✅ La séance de formation se déroule maintenant en réunion avec le N+1 (« Séance de formation avec … ») : il rappelle la notion (fiche), pose la question, corrige chaque réponse à voix haute (✔/✘ et explication) et conclut par un bilan. Tout est en choix multiples (les exercices chiffrés proposent des ordres de grandeur), à l'écrit ou à l'oral : en mode oral, le responsable lit les quatre réponses (« Première réponse : … ») et on répond « la deuxième » ou par le contenu. Réunion quittée : « Reprendre avec mon responsable » à la page Planning. Le bilan, les erreurs et le carnet restent sur la page Planning.
- ✅ Séance de formation limitée à une par jour et de 2 à 5 questions : 1 h supplémentaire = 2 questions, 2 h = 3, 3 h = 4, 4 h = 5 (schéma fiche, définition, calcul, fiche, définition). Une seconde séance le même jour est refusée ; les autres heures supplémentaires restent possibles.
- ✅ Point culture quotidien avec le N+1 : chaque jour ouvré (rendez-vous d'agenda 45 min après l'arrivée, 8 h 15 par défaut), le responsable pose 2 à 5 questions de culture économique et financière. Il commence par les deux questions du jour (qui sont ainsi comptées, avec bonus et série) ; tant qu'il n'y a pas 2 bonnes réponses, il pose une question de rattrapage du même thème et de niveau égal ou inférieur (les bases d'abord), sans dépasser 5. Correction dite par le responsable à chaque réponse, bilan, confiance +0,6 si tout est juste, −0,5 si les bases sont fragiles. À l'oral il lit les réponses. Les questions de culture du jour montent désormais en niveau (1, 2, puis 3) au fil des réussites. Manquer le rendez-vous compte comme une absence.
- ✅ Fiche « à retenir » à la fin de chaque entretien (toutes les réunions, et consultable dans l'historique des réunions) : titre, date, lieu et participants, verdict, bilan, ce qu'il faut retenir (corrections, objectifs), chiffres clés de la fiche documentaire, notions du glossaire employées par les interlocuteurs avec une explication en clair, vos décisions, réactions des interlocuteurs et conseils. Pour le point culture et la séance de formation : une ligne par question avec la bonne réponse et l'explication, et la notion de la fiche de cours. À capturer à l'écran, à télécharger en image PNG (1080 px de large) ou à copier en texte.
- ✅ Fiche « à retenir » enrichie : « Formules à connaître » (formule détaillée, légende des variables, calcul pas à pas avec de nouveaux chiffres, piège classique) pour 30 formules (rendement du dividende, PER, intérêts composés, valeur actuelle, VAN, VaR, duration, delta, options, levier, marges, ROE, PEG, dette/EBITDA, rendement locatif, capacité d'emprunt, mensualité…), repérées dans l'entretien ; celles des exercices de calcul ratés ou travaillés passent en premier. « Exercice supplémentaire » avec corrigé détaillé (masquable pour s'entraîner), toujours présent. Présent dans l'écran, l'image PNG et le texte copié.
- ✅ Sonnerie d'appel remplacée par un seul bip court et doux (440 Hz, ¼ de seconde, sans répétition), conçu pour fonctionner sur iPhone (contexte audio débloqué au premier toucher) ; silencieux si le son des notifications est coupé dans les Paramètres. L'attente avant que le client décroche reste affichée.
- ✅ Réglages du son : Options → Paramètres → « Sons et bruits » : mode silencieux (coupe tout), et un interrupteur par type de bruit (bruits de notification, bip d'appel, voix des personnages). Bouton 🔊/🔇 en haut de l'écran et case « mode silencieux » à l'accueil. Réglages propres à l'appareil, conservés d'une partie à l'autre ; voix coupées = mode oral des réunions indisponible (mode écrit seul). L'ancien réglage de la partie « sons coupés » est repris une fois.
- ✅ Erreurs passées dans les heures supplémentaires de formation : chaque question ratée (séance de formation ou point culture / quiz) est gardée une seule fois (nombre d'échecs, votre réponse, de quoi la refaire). Page Planning, carte « Mes erreurs passées » : liste des erreurs à revoir (ou toutes), avec pour chacune une **fiche de révision intégrée** (votre réponse, bonne réponse, explication, fiche de cours de la notion, formules avec calcul pas à pas, exercice supplémentaire corrigé, téléchargeable en image) et la possibilité de **refaire la question sans la correction** (réussie : « maîtrisée », un peu d'expérience, une seule fois). Nouvelle matière de séance « Mes erreurs passées (révision) » : le N+1 reprend d'abord les erreurs (les plus ratées en premier) en le disant. Carnet limité à 60 erreurs ; anciens carnets repris.

## Avatar 3D et banque 3D
- ✅ Avatar du joueur (indices validés côté serveur, `src/engine/avatar.ts`) : teint, visage, coiffure, barbe, carrure, taille, costume, chemise, cravate, lunettes, montre, pochette, boutons de manchette ; déblocage par grade ; action `set_avatar`.
- ✅ Rendu 3D temps réel (Three.js, modèles construits par code) : atelier de tailleur (création et garde-robe), parvis et hall de la banque (arrivée du joueur, portes coulissantes, globe d'or, réceptionniste, collègues), caméra qui suit l'avatar.
- ✅ Accueil et hub du jeu : le joueur marche jusqu'à la pièce touchée ; étiquettes cliquables (clavier, lecteur d'écran) ; plan 2D de repli sans WebGL ; navigateurs automatisés en 2D sauf `?3d=1`.
- ✅ Portrait 2D de l'avatar dans le menu, les réunions et la garde-robe.

## Refonte du personnage 3D
- ✅ Modèle humanoïde réel (GLB Ready Player Me, 67 os) remplaçant l'ancien assemblage de formes ; avatar procédural conservé comme secours si le fichier ne charge pas.
- ✅ Habillage : costume trois pièces recoloré en conservant le relief du tissu, matériaux distincts (laine, coton, soie, cuir, peau), cheveux en mèches, cravate modélisée, lunettes, montre, chapeau/fleur/nœud papillon d'origine retirés.
- ✅ Animation procédurale : machine à états (IDLE, WALK, RUN, TURN, SIT, STAND_UP, INTERACT, GESTURE), jambes par cinématique inverse (pas de glissement), 12 gestes, regard (yeux + tête), clignements, sourire / surprise, assise sur chaise, pivot vers l'utilisateur.
- ✅ Atelier : 7 angles de vue, rotation, zoom molette / pincement, recentrage, éclairage de studio (principale, remplissage, deux contre-jours), ombre de contact, rideau.
- ⚠️ Limites : seulement deux cibles de morphing sur ce modèle (sourire, bouche ouverte) : pas de mouvement de sourcils ; mouvements secondaires (cravate, cheveux, veste) non simulés ; pas de niveaux de détail ni de textures compressées ; fluidité sur appareil réel non mesurée (tests en rendu logiciel).

## Code de carrière
- ✅ Paramètres, Sauvegardes et accueil : génération d'un code (gzip + base64 url-safe + somme de contrôle `FE1.<crc>.<données>`), copie / fichier .txt, reprise sur un autre appareil ou une autre session ; erreurs explicites (code tronqué, modifié, autre version) ; tests unitaires (aller-retour, tolérance aux retours à la ligne, altération) et test Playwright à deux navigateurs.
- Code « court » : cours réduits au prix (historique conservé seulement pour les titres suivis/détenus, 30 clôtures), définitions d'instruments reconstruites depuis le catalogue ; ≈ 50 000 caractères mesurés après 20 jours (≈ 16× moins qu'avant).
- ⚠️ Un code de quelques dizaines de caractères est impossible sans serveur : il se colle, il ne se tape pas à la main.

- Code de carrière court en base (Supabase) : `src/lib/career-cloud.ts`, `src/components/CloudSync.tsx`, `supabase/careers.sql` ; tests unitaires avec base simulée. Non vérifié contre une vraie base (aucun identifiant fourni) ni en navigateur.

- Introduction cinématographique AAA (nouvelle partie) : scène 3D dédiée réutilisant le hall et le personnage du jeu ; rue, tours de verre, voitures, passants, portes automatiques, caméra à plans successifs avec inertie, étalonnage, son synthétisé. Yeux du personnage refaits (le modèle d'origine les avait tout blancs). Vérifié par captures en navigateur à 9 instants clés (qualité faible et moyenne, rendu logiciel) et par test Playwright ; NON mesuré : fluidité sur mobile/GPU réels, rendu en qualité « haute » (reflets du sol), mixage sonore à l'oreille (aucune écoute possible ici), synchro audio/images sur appareil lent.
