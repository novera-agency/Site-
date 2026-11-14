# FINANCIAL EMPIRE

Simulateur de carrière dans la finance de marché, entièrement en français.
**Simulation — monnaie virtuelle — aucune transaction réelle.** Toutes les sociétés, banques, personnes, cotations et cryptoactifs sont fictifs. L'application n'est pas une plateforme de courtage.

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
- 17 réunions jouables, 12 PNJ persistants + clients, 22 modèles de missions paramétrables, 35 modules de formation, crises à phases.
- Création de société (6 types) avec bilan, compte de résultat, flux de trésorerie et risque de faillite.

Voir `ARCHITECTURE.md`, `FINANCIAL_MODELS.md`, `TESTING.md` et l'état exact dans `PROGRESS.md`.
