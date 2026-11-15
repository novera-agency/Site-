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
| `tests/voice.test.ts` | Lecture des nombres dits en français et rapprochement des phrases libres avec les réponses. |
| `tests/relations.test.ts` | Hors-sujet et échec de réunion, définition par la personne qui a employé le terme, détection des questions, effets des avis (N+1, Managing Director, conformité), annonces de changement d'avis. |
| `tests/longrun.test.ts` | 120 jours simulés : cohérence des prix, régimes, crises, équilibre comptable. |
| `e2e/navigation.spec.ts` | Sur ordinateur (1440 px) et mobile (390 px) : les 32 onglets s'affichent sans erreur console, la page défile à la molette (souris au-dessus des graphiques comprise), la barre de navigation du bas et le menu « Plus » fonctionnent, la salle de réunion défile et ses choix restent atteignables sur petit écran. |
| `e2e/aide.spec.ts` | Aide de mission : invisible tant que le joueur ne l'active pas, visible sur les autres onglets, réductible, rouvrable, conservée après rechargement, lien vers l'écran d'action, fermeture. |
| `e2e/vocal.spec.ts` | Micro et haut-parleur simulés. Mode oral : autorisation du micro, aucune transcription ni réponse écrite affichée, plusieurs profils de voix, phrase libre et « la première » comprises, demande de reformulation, silence sanctionné, compte rendu écrit après coup. Appel client : sonnerie, décroché, faute → objectif de vente en baisse, montant obtenu. Mode écrit : historique avec noms et rôles, aucune voix ; micro refusé → message clair. |
| `e2e/parcours.spec.ts` | Les 20 étapes du cahier des charges dans un vrai navigateur : lancement, création de carrière, banque, capital, marchés en mouvement, accélération/pause, achat, solde, position, variation, revente, résultat, réunion, mission, événement économique et conséquences, évaluation, sauvegarde, fermeture, reprise. |

## Dernière exécution
Voir `PROGRESS.md` (section « Vérifications »).

Pour tester l'édition navigateur : `BASE_PATH=/Site- npm run build:static`, servir `out/` sous `/Site-/`, puis `E2E_URL=http://localhost:8080 E2E_BASE=/Site- npx playwright test`.

| `tests/appel.test.ts` | Appel client parfait (montant investi), fautes successives → le client raccroche, messagerie → rappel planifié sans objectif ni pénalité. |
| `tests/historique.test.ts` | Mode historique : départ le 3 janvier 2000 (taux Fed 5,5 %, BCE 3 %, euro ≈ 1 $, or ≈ 288 $, cryptoactifs pas encore créés, historique 1999 reconstitué) ; 140 jours simulés : hausse réelle de la Fed du 16 mai 2000, krach du Nasdaq publié, indice américain et Brent proches de leurs trajectoires, comptabilité équilibrée ; la sauvegarde conserve l'époque et une partie fictive reste en 2027. |
| `tests/mission-terminal.test.ts` | Progression des missions recalculée après chaque action ; « premier ordre » non validé par les ordres automatiques. |
