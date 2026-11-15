# FINANCIAL EMPIRE

Simulateur de carrière dans la finance de marché, entièrement en français.
**Simulation — monnaie virtuelle — aucune transaction réelle.** Toutes les sociétés, banques, personnes et cryptoactifs du jeu sont fictifs. L'application n'est pas une plateforme de courtage.

Deux époques au choix :
- **2000 → 2025, l'histoire réelle** (par défaut) : départ le 3 janvier 2000. Les vrais événements sont publiés à leur date (bulle Internet, 11 septembre, Enron, guerre d'Irak, subprimes, Lehman Brothers, crise de l'euro, Fukushima, Brexit, élections françaises et américaines, Covid, guerre en Ukraine, inflation 2022, SVB, droits de douane 2025…). Les banques centrales appliquent leurs décisions réelles. Les indices, matières premières, changes et taux suivent leurs trajectoires réelles, **reconstituées de façon approchée** (repères de fin d'année et points de retournement, voir `src/engine/data/history2000.ts`), avec la volatilité du modèle par-dessus : ce ne sont pas des cours officiels. À partir de 2026, le marché redevient simulé.
- **2027, monde imaginaire** : marchés, crises et événements entièrement simulés.

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

Voir `ARCHITECTURE.md`, `FINANCIAL_MODELS.md`, `TESTING.md` et l'état exact dans `PROGRESS.md`.
