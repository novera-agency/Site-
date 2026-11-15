# Architecture

## Choix techniques

| Domaine | Choix | Justification |
|---|---|---|
| Framework | Next.js 15 (App Router), React 19, TypeScript strict | Interface + API serveur dans un même projet. |
| Style | Tailwind CSS v4 + composants maison (`src/components/ui.tsx`) | Identité visuelle originale, aucune dépendance de génération (shadcn/ui non utilisé). |
| Graphiques | Lightweight Charts v5 (chandeliers, volumes, indicateurs, courbes) + SVG (profils de gain, barres) | Recharts non nécessaire. |
| État client | Zustand (instantané + toasts) ; abonnements ciblés par sélecteurs | Évite les rerenders inutiles. |
| Validation | Zod sur toutes les routes d'API | Le serveur rejette toute action malformée. |
| Persistance | Fichiers JSON compactés, écriture atomique (tmp + rename), 1 sauvegarde auto/partie + 3 emplacements manuels | Démarrage sans infrastructure. **Écart assumé** par rapport à PostgreSQL/Prisma : `src/server/store.ts` est le seul module à remplacer pour passer à une base de données. |
| Temps réel | Interrogation `POST /tick` chaque seconde (2,5 s en pause) | Le serveur mesure lui-même le temps réel écoulé (plafonné à 3 s) : pas de WebSocket nécessaire, et le client ne peut pas « accélérer » la simulation. |
| Tests | Vitest (moteur) + Playwright (parcours) | |
| IA | `@anthropic-ai/sdk`, côté serveur uniquement | Facultative, bornée par le moteur. |

## Séparation des couches

```
src/engine/        Moteur pur, déterministe, sans dépendance au navigateur ni au serveur
  rng.ts           Générateur sfc32 sérialisable (graine → reproductibilité)
  time.ts          SimulationClock : calendrier simulé, sessions de marché, pas de 5 minutes
  types.ts         Modèle de données complet (GameState sérialisable)
  money.ts         Arithmétique monétaire en centimes entiers
  ledger.ts        AccountingLedger : partie double, balance de vérification
  market.ts        MarketEngine : modèle multi-facteurs, liquidité, carnet, chocs
  regimes.ts       10 régimes de marché + matrice de transition
  macro.ts         MacroEconomyEngine : zones, banques centrales, statistiques, calendrier
  pricing.ts       PricingEngine : Black-Scholes, binomial, obligations, futures, Monte-Carlo
  orders.ts        OrderExecutionEngine : validation, déclenchement, exécution, marge, échéances
  portfolio.ts     PortfolioEngine + RiskEngine : valorisation, expositions, VaR, stress, Sharpe
  corporate.ts     Résultats, dividendes, coupons, remboursements, défauts
  structured.ts    Produits structurés : émission, observation contractuelle, scénarios MC
  crisis.ts        Moteur de crises à phases et signaux faibles
  career.ts        CareerEngine : paie, évaluations, promotions, offres, burnout, limites
  missions.ts      MissionEngine : 22 modèles paramétrables, critères vérifiés
  meetingEngine.ts Moteur de réunions (graphe de nœuds, questions chiffrées, actions)
  meetings.ts      Contenu des 17 réunions
  people.ts        RelationshipEngine : PNJ, clients, mémoire, opinions
  clients.ts       Mandats clients, rééquilibrage, adéquation, satisfaction
  events.ts        EventEngine narratif + NPCDecisionEngine (banques concurrentes)
  company.ts       Entreprise du joueur, états financiers
  agenda.ts        Cycle quotidien (agenda, rendez-vous)
  history.ts       Pré-historique de marché (≈ 1 an) au même modèle
  historical.ts    Mode historique 2000 → 2025 : guidage des cours vers des trajectoires approchées
                   (avance de la cible + rappel, correction collective par zone pour que l'indice suive),
                   décisions réelles des banques centrales, régimes et événements datés, réémission des obligations
  data/universe.ts     Générateur déterministe de plus de 1 100 sociétés fictives (pays, secteurs, tailles, fondamentaux)
  data/history2000.ts  Repères de marché approchés, taux directeurs, macro annuelle, chronologie des événements
  engine.ts        Orchestration, création de partie, tutoriel, migrations de sauvegarde
src/server/        Autorité serveur : sessions (auth.ts), persistance (store.ts), actions validées (actions.ts),
                   vues de lecture (views.ts), IA (ai.ts), utilitaires HTTP (http.ts)
src/app/api/       Routes : auth, saves, game/new, game/[id]/{tick, action, view, ai}
src/app/, src/components/, src/lib/   Interface
```

## Autorité du serveur

- L'état complet (`GameState`) ne quitte jamais le serveur. Le navigateur reçoit un **instantané** léger à chaque tick et des **vues** ciblées (`views.ts`).
- Toute mutation passe par `POST /api/game/[id]/action` validée par Zod (`actions.ts`), puis par les fonctions du moteur qui revérifient tout (trésorerie, marge, accès selon le poste, idempotence `clientRef`).
- Node.js exécute chaque gestionnaire de requête de façon synchrone sur l'état de la partie : pas d'entrelacement de deux exécutions sur un même ordre.
- Autorisation : une partie n'est accessible qu'au propriétaire de la session (`ownerId`).
- Les clés d'API ne sont lues que dans `src/server/ai.ts`.

## Ordre de traitement d'un pas (5 minutes simulées)

1. Horloge (+5 min) → 2. traitements de début de journée (macro, régime, coupons, concurrents, crises, événements de carrière, agenda, paie mensuelle, revues) → 3. calendrier (banques centrales, statistiques, résultats, dividendes, observations) → 4. courbes de taux → 5. marchés (actions, devises, matières, crypto, puis dérivés : obligations, ETF/indices, futures, options) → 6. ordres en attente → 7. crises → 8. alertes, marges (toutes les 30 min) → 9. missions (toutes les heures) → 10. clôtures (règlement des futures et échéances à 17 h 30, fin de journée 22 h 05) → 11. agenda → 12. tutoriel.

Les vitesses ne changent que le **nombre de pas par seconde réelle** : pour une même graine et les mêmes décisions aux mêmes instants simulés, le résultat est identique (testé).

## Communication entre systèmes

Les modules communiquent par l'état partagé typé et par des événements métier explicites : actualités (`NewsItem`), chocs de prix (`applyShock` → `pending` intégré progressivement), calendrier (`CalendarEvent`), notifications, messages, éléments d'agenda (qui déclenchent des réunions), journal des décisions. Exemple de chaîne : décision de banque centrale → choc de taux → pertes obligataires du desk → convocation « pertes obligataires » → couverture par futures → VaR du desk → évaluation → promotion.

## Performance

Un pas coûte ≈ 0,2 ms pour 117 instruments ; x100 = 20 pas/s. Les barres intrajournalières sont limitées à 300 par instrument, les journalières à 520 ; le grand livre vivant à 4 000 écritures (les plus anciennes sont archivées avec leur somme de contrôle, les soldes restent exacts). Les sauvegardes compactent les séries de prix (≈ 3 Mo en début de partie).

## Époque d'une partie
`time.ts` exprime le temps en minutes depuis le 1er janvier de l'année de départ (`epochYear` : 2027 par défaut, 2000 en mode historique).
L'époque est un réglage de module : `useEpoch(s)` est appelé par `advance`, `applyAction`, `snapshot`, `buildView` et à la désérialisation ;
le navigateur la reçoit avec chaque instantané (`epochYear`). Les listes de sauvegardes formatent les dates avec `fmtDateFor(t, epochYear)`.

## Univers étendu (valeurs « lite »)
Les sociétés générées portent `lite: true`. Tant que le joueur ne les suit pas (liste de surveillance, position, ordre, mission),
elles sont recalculées toutes les 30 minutes simulées, ne conservent que 130 séances et pas de barres 15 minutes ;
leurs publications et dividendes sont traités sans encombrer le calendrier. À la sauvegarde, seules leurs clôtures sont
écrites et leurs définitions (déterministes) sont reconstruites au chargement. Les boucles du moteur utilisent des listes
d'instruments par catégorie mises en cache (`catsOf`).
