# Plan d'implémentation

Priorité : un jeu verticalement intégré (chaque fonctionnalité utilisable de bout en bout) avant l'ampleur.

| Phase | Contenu | Statut |
|---|---|---|
| 1 — Fondations | Architecture, design system, navigation, persistance, authentification (comptes locaux + invité), profils, création de carrière, choix de banque | ✅ (persistance fichiers au lieu de PostgreSQL — voir ARCHITECTURE) |
| 2 — Marchés | Horloge, macroéconomie, instruments, prix, graphiques, actualités, événements, calendrier | ✅ |
| 3 — Trading | Ordres, exécution, portefeuilles, comptabilité, risques, historique | ✅ |
| 4 — Carrière | Métiers, missions, salaires, promotions, compétences, réputation | ✅ |
| 5 — Interactions | PNJ, réunions, clients, dialogues, conséquences, IA facultative | ✅ (IA non testée contre l'API réelle faute de clé) |
| 6 — Finance avancée | Obligations, options, futures, produits structurés, valorisation, sensibilités | ✅ ; swaps / CDS / forwards / warrants : non négociables (voir PROGRESS) |
| 7 — Entrepreneuriat | Création, recrutement, gestion financière, clients, concurrence | ✅ (modèle agrégé) |
| 8 — Finalisation | Sauvegardes, tests, optimisation, responsive, documentation | ✅ première version |

## Prochaines étapes recommandées
1. Persistance PostgreSQL/Prisma derrière l'interface de `src/server/store.ts` (multi-instance).
2. Swaps de taux et CDS négociables (le pricing des flux et le stress de crédit existent déjà).
3. Marché secondaire des produits structurés (valorisation Monte-Carlo déjà disponible).
4. Davantage de réunions et d'événements narratifs ; fusions bancaires scénarisées.
5. Mode de consultation de données réelles séparé (clairement distingué des cours simulés).
6. Push serveur (SSE/WebSocket) si le nombre de joueurs simultanés augmente.
