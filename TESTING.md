# Tests

```bash
npm test         # Vitest : 37 tests (finance, simulation, carrière) — ~10 s
npm run e2e      # Playwright : parcours de validation en 20 étapes — ~50 s (build + serveur sur le port 3100)
npm run lint     # TypeScript strict
```

## Couverture

| Fichier | Tests |
|---|---|
| `tests/finance.test.ts` | Parité call-put et grecques, volatilité implicite, binomial ; prix ↔ taux actuariel et duration ; arrondi monétaire ; achat (trésorerie, frais, ask), vente (P&L réalisé), conversion automatique de devises, fonds insuffisants, limite jamais franchie, stop-loss + OCO, idempotence et annulation, frais par classe, conversion de devises, dividende, coupon et remboursement à l'échéance (y compris rattrapage des dates de week-end), exercice et expiration d'options, futures → appel de marge → liquidation, produit structuré sous barrière, conservation comptable après 40 opérations. |
| `tests/simulation.test.ts` | Pause, invariance à la vitesse (pas de 5 min vs gros incréments), reproductibilité par graine, marchés autonomes cohérents, décision de banque centrale planifiée, changement de régime + krach, sauvegarde/rechargement puis poursuite, création de carrière. |
| `tests/career.test.ts` | Promotion refusée puis accordée, fort P&L + risque excessif = pas de promotion, réunion complète, réponse chiffrée vérifiée sur la duration réelle, satisfaction client et conformité, échec de mission, changement de banque, licenciement, création d'entreprise, XP de formation non cumulable. |
| `tests/longrun.test.ts` | 120 jours simulés : cohérence des prix, régimes, crises, équilibre comptable. |
| `e2e/parcours.spec.ts` | Les 20 étapes du cahier des charges dans un vrai navigateur : lancement, création de carrière, banque, capital, marchés en mouvement, accélération/pause, achat, solde, position, variation, revente, résultat, réunion, mission, événement économique et conséquences, évaluation, sauvegarde, fermeture, reprise. |

## Dernière exécution
Voir `PROGRESS.md` (section « Vérifications »).
