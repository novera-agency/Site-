# FINANCIAL EMPIRE

Simulateur de carrière dans la finance de marché, entièrement en français.
**Simulation — monnaie virtuelle — aucune transaction réelle.** Toutes les sociétés, banques, personnes et cryptoactifs du jeu sont fictifs. L'application n'est pas une plateforme de courtage.

Deux époques au choix :
- **2000 → 2025, l'histoire réelle** (par défaut) : départ le 3 janvier 2000. Les vrais événements sont publiés à leur date (bulle Internet, 11 septembre, Enron, guerre d'Irak, subprimes, Lehman Brothers, crise de l'euro, Fukushima, Brexit, élections françaises et américaines, Covid, guerre en Ukraine, inflation 2022, SVB, droits de douane 2025…). Les banques centrales appliquent leurs décisions réelles. Les indices, matières premières, changes et taux suivent leurs trajectoires réelles, **reconstituées de façon approchée** (repères de fin d'année et points de retournement, voir `src/engine/data/history2000.ts`), avec la volatilité du modèle par-dessus : ce ne sont pas des cours officiels. À partir de 2026, le marché redevient simulé.
- **2027, monde imaginaire** : marchés, crises et événements entièrement simulés.

**Écran d’accueil** : à l’arrivée sur le site, une courte introduction animée (une fois par session, passable d’un clic ou avec Entrée).

**Voix plus naturelles** : le jeu classe les voix françaises de l’appareil et utilise d’abord les plus naturelles (« Natural » de Microsoft Edge, « Premium / Améliorée » d’Apple, Google), une voix différente par personnage. Dans Options → Paramètres et son : liste des voix avec leur qualité, bouton pour écouter chacune, choix manuel des voix et conseils pour installer de meilleures voix selon l’appareil.

**Navigation en 5 catégories** (barre du bas sur mobile, menu latéral sur ordinateur) : 🏢 Bureau (journée, missions, agenda, réunions, messages, actualités) · 💼 Vie professionnelle (marchés, portefeuille et risques, économie, carrière) · 🏠 Vie personnelle (vie privée, salaire, patrimoine) · 👥 Relations (collègues, clients, réputation, RH, établissements) · ⚙️ Options. Chaque onglet ouvre la page de sa catégorie (/play, /play/pro, /play/perso, /play/relations, /play/reglages), avec ses rubriques en tuiles expliquées en une ligne ; l'onglet reste allumé sur toutes les sous-pages.

**Missions du jour** : chaque jour ouvré, au moins deux nouvelles missions (trois pour un poste élevé ou si vous êtes très apprécié), différentes de la veille, à rendre avant 18 h 30 : revue de marché, calculs pour un client, valorisation, conformité, exécution d'ordre, objectif de P&L, maîtrise de la VaR, collecte auprès d'un client, chiffre pour le comité… Leur enjeu dépend de votre appréciation (confiance de la hiérarchie, réputation, dernière évaluation) et de votre grade : apprécié, on vous confie des dossiers à fort enjeu (grosses récompenses et bonus, mais un échec coûte cher) ; mal vu, des tâches sans risque qui font peu progresser.

**Appels clients variés et prospection** : à chaque appel, le client a une demande du moment, tirée parmi 13 situations (héritage, achat immobilier à venir, retraite, études des enfants, placement responsable, peur de l'inflation, envie de cryptoactifs, trésorerie d'entreprise, retrait d'argent, frais jugés trop élevés, panique après une baisse, question fiscale, recommandation d'un proche), avec plusieurs formulations, des objections différentes et des réactions variées selon la qualité de votre réponse. Les demandes de placement ont un objectif de collecte qui baisse à chaque faute ; les demandes de service jouent sur la satisfaction (et les frais). Votre N+1 vous confie des prospects à démarcher chaque lundi et chaque jeudi (et dès le premier jour), les clients satisfaits vous en recommandent : accroche, objection, découverte, proposition de rendez-vous ; un prospect convaincu devient client avec un premier versement, un prospect brusqué refuse.

**Investissement immobilier** (Vie personnelle) : 13 villes françaises (Paris, Lyon, Bordeaux, Lille, Montpellier, Toulouse, Nantes, Rennes, Strasbourg, Nice, Marseille, Limoges, Saint-Étienne) avec leurs prix et loyers au m², leur demande locative, leurs avantages et leurs limites (encadrement des loyers, vacance, impayés, prix en baisse…). Quatre annonces par ville et par mois, achat comptant ou à crédit (apport, frais de notaire, endettement ≤ 35 %). Vous fixez le loyer ou le prix de vente : au-dessus du marché, personne ne signe ; en dessous, les candidats sont plus nombreux mais la demande de la ville reste limitée. Charges, taxe foncière, impôt sur les loyers, révision annuelle, départs de locataires, impayés, travaux (DPE), plus-value imposée à la revente. En mode historique, les prix suivent l'indice réel des prix des logements depuis 2000.

**Une croix ✕ sur chaque page** ramène à la page de sa catégorie (et depuis une catégorie, au Bureau), avec un fil d'Ariane indiquant où vous êtes.

**Une vie en dehors du bureau** (mode carrière) : fiche de paie précise (brut, cotisations, impôt sur le revenu prélevé à la source, net), loyer ou crédit immobilier, factures, transport, abonnements et assurances prélevés chaque mois. Le reste est à vous : épargner, investir ou vous faire plaisir. Quatre jauges (santé mentale, forme physique, vie sociale, épanouissement) s'usent avec le temps et le stress ; les loisirs coûtent de l'argent et du temps libre (limité en semaine). Négligez-les et le stress monte, l'énergie baisse, vos évaluations en pâtissent, jusqu'à l'arrêt pour épuisement. Impayés pendant trois mois : expulsion. Vous pouvez demander à tout moment un rendez-vous pour négocier une augmentation, du télétravail ou des congés (une fois tous les six mois). Événements de la vie : mariages, anniversaires, pannes, dégâts des eaux, maladies…

**Une cote de plus de 1 200 actions** (sociétés fictives) dans 13 pays et 12 secteurs : géants, valeurs moyennes et petites capitalisations, avec des fondamentaux cohérents par secteur (PER, marges, dividendes, endettement, volatilité, bêta). Indices AMERICA 100 / 500, PARIS 40, FRANKFURT 40, LONDON 100, TOKYO 100, EUROPA 50, ASIA PACIFIC, MONDE, et ETF nationaux, sectoriels et petites capitalisations. En mode historique, chaque valeur suit la trajectoire de son pays et de son secteur selon son bêta, et des sociétés s'introduisent en bourse au fil des années.

## Démarrage

```bash
npm install
npm run build && npm start        # http://localhost:3000  (ou: npm run dev)
```

Prérequis : Node.js ≥ 20. Aucune base de données ni service externe n'est requis.

Variables d'environnement facultatives (voir `.env.example`) :

| Variable | Rôle |
|---|---|
| `SESSION_SECRET` | Secret HMAC des cookies de session (sinon un secret local est généré dans `data/.session_secret`). |
| `SAVE_DIR` | Répertoire des sauvegardes (défaut `./data`). |
| `ANTHROPIC_API_KEY` | Active les dialogues IA des PNJ (côté serveur uniquement). Sans clé : dialogues scénarisés déterministes. |
| `AI_MODEL` | Modèle utilisé pour les PNJ (défaut `claude-opus-5-5`). |

## Version en ligne (GitHub Pages)

**Adresse :** https://novera-agency.github.io/Site-/

Le workflow `.github/workflows/pages.yml` vérifie le code (TypeScript, 37 tests), construit l'**édition navigateur** (`npm run build:static`) et la publie sur GitHub Pages à chaque push.

- GitHub Pages n'héberge que des fichiers statiques. Dans cette édition, le **même moteur** tourne dans le navigateur ; les routes `/api/*` sont servies localement (`src/lib/local-backend.ts`) avec les mêmes validations Zod et les mêmes vues. Les parties sont sauvegardées dans le navigateur (IndexedDB) ; export et import JSON sont disponibles.
- Différences avec la version serveur : pas de comptes, pas d'autorité serveur (l'état vit chez le joueur) et dialogues des PNJ uniquement scénarisés (aucune clé d'API dans un site statique).
- Activation, une seule fois : **Settings → Pages → Build and deployment → Source : « GitHub Actions »**.

## Commandes

| Commande | Effet |
|---|---|
| `npm run dev` | Serveur de développement |
| `npm run build` / `npm start` | Build et serveur de production |
| `npm run lint` | Vérification TypeScript stricte |
| `npm test` | Tests unitaires et de simulation (Vitest) |
| `npm run e2e` | Parcours de validation end-to-end (Playwright, 20 étapes) |
| `npm run build:static` | Édition navigateur statique dans `out/` (`BASE_PATH=/Site-` pour GitHub Pages) |

## Ce que contient le jeu

- Nouvelle carrière (8 métiers, 7 banques fictives), bac à sable, mode défi (3 scénarios), 4 niveaux de difficulté.
- Moteur boursier autonome : 117 instruments (55 actions, 18 obligations, 9 paires de devises, 7 matières premières, 4 cryptoactifs fictifs, 11 ETF, 4 indices, futures trimestriels) + options générées à la demande.
- Temps accéléré de Pause à x100, horloge simulée indépendante, pause automatique sur événements importants.
- Ordres marché / limite / stop / stop-limite, stop-loss & take-profit attachés (OCO), validité, exécutions partielles, frais, spread, slippage, marge, liquidation.
- Grand livre en partie double (centimes entiers), comptes personnels / desk / clients / société strictement séparés.
- Carrière : salaires, bonus, évaluations hebdomadaires / trimestrielles / annuelles, promotions multicritères, licenciement, offres, entretiens, burnout, congés.
- Réunions en **mode oral** (les personnages parlent avec des voix différentes, vous répondez au micro en temps limité, sans texte à l'écran) ou en **mode écrit** (historique de la conversation, réponses au clic).
- **Appeler vos clients** depuis l'écran Clients : sonnerie, le client décroche (ou messagerie et rappel le lendemain), et **chaque faute fait baisser l'objectif de vente** (−5 à −30 %) ; sous 30 % de l'objectif initial, il raccroche. Chaque collaborateur a sa propre voix.
- 17 réunions jouables, 12 PNJ persistants + clients, 22 modèles de missions paramétrables, 35 modules de formation, crises à phases.
- Création de société (6 types) avec bilan, compte de résultat, flux de trésorerie et risque de faillite.
- **Parcours** : 8 chapitres avec objectifs, 27 succès, score de carrière ; trois fins (retraite, faillite, fortune) et tableau d'honneur local.
- **Vie privée complète** : salaire précis, factures, logement, jauges (santé mentale, forme, vie sociale, plaisir), rencontres, couple, mariage, enfants, histoires de collègues.
- Investissement immobilier dans 13 villes françaises, prospection confiée par le N+1, au moins deux missions générées par jour.
- Événements mondiaux simulés (parties fictives), notifications regroupées avec trois niveaux, ambiance de nature (pluie, vent) et petits bruits synthétisés, sans musique ni instrument, portraits générés.
- Sauvegarde complète exportable en fichier et réimportable depuis l'accueil.
- Visite guidée de l'interface au premier lancement (relançable dans Options → Paramètres).
- Accessibilité : texte agrandi, contraste renforcé, animations réduites, navigation au clavier ; audit automatique WCAG A/AA sans erreur.
- Interface en anglais (menus, navigation, visite guidée, accueil) ; les dialogues et missions restent en français.
- **Histoire réelle de 2000 au 13 novembre 2026** (guerre contre l'Iran, choc pétrolier, remontée des taux, krach de l'IA…), puis simulation libre. Les parties créées avec une ancienne version sont recommencées une fois au 3 janvier 2000.
- **Quiz d'économie** : 2 questions par jour de jeu (soit environ 14 600 sur les 20 ans) tirées de trois sources : 270 questions rédigées (micro, macro, finance : analyse technique et fondamentale, portefeuille, entreprise, épargne et crédit, devises, risques, banques centrales, marchés, finance durable, biais ; histoire financière), une centaine de questions tirées des vrais événements de l'histoire du jeu, et 20 familles d'exercices de calcul à chiffres générés (illimités). Séries libres par catégorie, explication à chaque réponse, séries quotidiennes, succès et expérience en compétences.
- Contenu enrichi : 25 demandes clients, 26 événements mondiaux simulés, 20 événements de vie, 15 types de missions du jour.
- Sur les appareils lents, le calcul est limité à chaque seconde : le temps ralentit au lieu de figer l'écran.

Voir `ARCHITECTURE.md`, `FINANCIAL_MODELS.md`, `TESTING.md` et l'état exact dans `PROGRESS.md`.
