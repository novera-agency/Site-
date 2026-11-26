# Tests

```bash
npm test         # Vitest : 162 tests (finance, simulation, carrière) — ~10 s
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
| `tests/univers.test.ts` | Plus de 1 000 actions, tickers uniques, 13 pays, 12 secteurs, prix valides ; indices nationaux (500/40/40/100/100 valeurs) ; achat d'une petite valeur, sauvegarde < 5 Mo, définitions et clôtures restaurées au chargement. |
| `e2e/univers.spec.ts` | Recherche : plus de 1 000 résultats, filtres pays + secteur, ouverture de la fiche d'une valeur. |
| `e2e/historique.spec.ts` | Choix de l'époque, départ le 3 janvier 2000 ou le 4 janvier 2027, actualités et banques centrales réelles, date affichée dans le menu. |
| `tests/vie.test.ts` | Fiche de paie (cotisations, impôt progressif), factures prélevées ; loisirs (coût, temps libre limité, week-end) ; achat immobilier refusé sans apport puis accepté, mensualité ; impayés → expulsion ; négociation salariale réussie et délai de six mois ; prix et salaires plus bas en 2000. |
| `e2e/vie.spec.ts` | Page Vie privée : jauges, fiche de paie, factures, une activité consomme le temps libre, demande de rendez-vous de négociation. |
| `tests/explain.test.ts` | Explications : découpage d'un texte en mots explicables (expressions longues, pluriels, accents, rien de perdu), une seule mise en évidence par notion, couverture du vocabulaire des questions, chaque type de problème a explication simple + formule + 2 exemples résolus cohérents, aide complète d'une mission, recherche libre d'un mot. |
| `e2e/explications.spec.ts` | Un mot souligné s'ouvre avec définition et exemple et se ferme ; « Je ne comprends pas » affiche les mots de la question et la recherche de mot ; même aide sur la formation. |
| `tests/missionBank.test.ts` | Banque de 506 missions : identifiants et titres uniques, chaque calcul se crée et se résout (bonne réponse réussie, mauvaise échouée, correction fournie), chiffres différents à chaque attribution, missions d'action vérifiées, validation par une action réelle, variété et dominante « pratique » sur 45 jours ouvrés. |
| `tests/missions-jour.test.ts` | Au moins deux missions par jour ouvré, différentes de la veille, à rendre le jour même ; enjeu élevé si apprécié, faible si mal vu ; fort enjeu réussi → bonus, raté → réputation et confiance en baisse ; quiz du jour notés. |
| `tests/immobilier.test.ts` | 13 villes, annonces mensuelles, rendements contrastés ; loyer trop cher jamais signé, loyer de marché signé, loyer bradé non garanti ; flux mensuels équilibrés ; encadrement et DPE G ; vente trop chère impossible, au prix du marché vendue ; crédit refusé au-delà de 35 % d'endettement. |
| `e2e/immobilier.spec.ts` | Croix de retour (sous-page → catégorie → bureau) ; achat à crédit à Saint-Étienne, mise en location, chances affichées. |
| `tests/appel.test.ts` (complété) | Demandes variées d'un appel à l'autre ; demande de service sans objectif de vente (satisfaction, frais) ; une recommandation crée un prospect. |
| `tests/prospection.test.ts` | Prospects confiés par le N+1 le lundi avec un message ; bon démarchage → nouveau client et versement ; démarchage agressif → refus. |
| `tests/voice.test.ts` (complété) | Classement des voix : naturelles, puis premium, puis Google, voix fantaisie en dernier. |
| `e2e/voix.spec.ts` | Appareil simulé avec 5 voix : les voix naturelles sont en tête et utilisées pour deux personnages différents ; choix manuel d'une voix, conservé après rechargement. |
| `tests/progression.test.ts` | Chapitre 1 validé et succès débloqués ; fin « retraite » qui fige la partie ; notifications regroupées « Mission échouée (×3) » ; rencontre, mariage et enfant ; événements mondiaux marqués « simulé ». |
| `tests/contenu.test.ts` | 25 demandes clients uniques avec une bonne réponse ; nouvelles missions du jour justes ; événements de vie équilibrés en comptabilité ; 26 événements mondiaux sans répétition rapprochée ; calcul plafonné dans le temps ; avertissement puis message de fin des données historiques. |
| `e2e/accessibilite.spec.ts` | Interface en anglais puis retour au français ; visite guidée complète et fermeture par Échap ; texte agrandi conservé après rechargement ; audit axe WCAG A/AA sans erreur sur trois écrans. |
| `tests/quiz.test.ts` | Banque de 50 questions équilibrée ; XP une seule fois, série remise à zéro, question ratée reproposée ; la vue ne révèle pas les réponses ; succès ; mission du jour de culture ; repères 2026 ; partie ancienne recommencée en 2000 une seule fois. |
| `tests/hist2026.test.ts` | Simulation en mars-avril 2026 proche des repères, bascule en simulation libre le 14 novembre 2026 sans valeur aberrante, comptabilité équilibrée. |
| `e2e/culture.spec.ts` | Quiz accessible depuis Vie professionnelle ; réponse, explication, question suivante ; catégories ; fin de série. |
| `tests/quiz.test.ts` (complété) | 20 familles de calculs : 4 réponses distinctes, reproductibles ; questions d'histoire datées ; 2 questions du jour figées, bonus et série ; 7 300 jours simulés. |
| `tests/quiz.test.ts` (complété) | Révision espacée à 30 jours (exclue 29 jours, revient au 30e, réponse fausse = à retravailler) ; sur 7 300 jours aucune question de culture n'est reposée avant 30 jours ; banques assurance et immobilier. |
| `e2e/zoom.spec.ts` | Mobile : aucun champ ni menu sous 16 px sur 10 écrans ; échelle verrouillée à la saisie puis rétablie à la sortie du champ. |
| `tests/vie.test.ts` (complété) | Activités refusées avant 18 h, saut à 18 h pile, l'horloge avance exactement de la durée, refus si l'activité finirait après minuit, week-end possible dès le matin, pause conservée. |
| `tests/vie.test.ts` (planning) | Validation des horaires, activités et horaires de départ, sommeil (réveil exact, effets, refus), nuit courte, heures supplémentaires (3 objectifs, avance du lendemain, plafonds), effets d'une journée longue ou courte, agenda replacé dans les horaires. |
| `e2e/planning.spec.ts` | Page planning : horaires, réveil refusé trop tard, sommeil et heures supplémentaires verrouillés pendant le travail, activités selon l'horaire. |
| `tests/vie.test.ts` (formation) | Séance de 2 h = 6 questions variées sans bonne réponse dans la vue ; XP, validation des leçons, bonus et succès ; erreurs au carnet sans bonus ; blocage d'une 2e séance ; leçons non répétées ; matières. |
| `e2e/formation.spec.ts` | Parcours de l'écran de séance (fiche, QCM, numérique, corrections, bilan, fermeture) sur séance injectée, avec audit d'accessibilité. |
| `tests/vie.test.ts` (réunion de formation) | « Me former » ouvre la réunion avec le N+1, qui pose la question ; réponses ✔/✘ corrigées par le responsable ; bilan ; reprise après avoir quitté ; toutes les leçons en QCM. |
| `e2e/formation.spec.ts` | Séance complète à l'écrit (bilan et carnet sur Planning), reprise d'une séance interrompue, séance à l'oral (lecture des réponses, « la deuxième »). Le serveur de test active E2E_HOOKS pour lancer la réunion directement. |
| `tests/culture-n1.test.ts` | Point culture dans l'agenda chaque jour ouvré (suivant les horaires, pas le week-end) ; 2 bonnes réponses = 2 questions ; rattrapage du même thème et niveau ≤ ; 5 questions maximum ; quiz du jour compté ; lecture des réponses à l'oral ; bases d'abord (niveaux croissants). |
| `e2e/formation.spec.ts` (point culture) | Réunion du point culture : 2 à 5 questions, corrections, quiz du jour compté 2/2. |
| `tests/recap.test.ts` | Fiche seulement une fois la réunion terminée ; fiche générale (corrections, décisions, notions, verdict) ; fiche du point culture et de la séance de formation ; historique consultable. |
| `e2e/formation.spec.ts` (fiche) | Fiche visible à la fin du point culture, une ligne par question, audit d'accessibilité, téléchargement d'un vrai PNG de 1 080 px de large. |
| `tests/recap.test.ts` (formules) | 30 formules : chaque famille d'exercices a sa formule, corrigés rédigés vérifiés numériquement, repérage dans le texte, formule travaillée en premier, exercice supplémentaire toujours présent, aucune répétition ni double point. |
| `e2e/formation.spec.ts` (fiche) | Exercice supplémentaire visible, corrigé masquable. |
| `e2e/vocal.spec.ts` (appel) | Début d'appel : un seul bip bref de 440 Hz (plus de sonnerie répétée). |
| `tests/sound-prefs.test.ts` | Réglages du son : valeurs par défaut, mode silencieux qui n'efface pas le détail, conservation, valeurs abîmées ignorées. |
| `e2e/sons.spec.ts` | Page Sons et bruits, bouton silence, bip de test, voix coupées → mode oral indisponible, case de l'accueil. |
| `tests/revision.test.ts` | Carnet d'erreurs (une ligne par question, compteur, maîtrisée/à revoir), anciens carnets, fiche de révision complète (réponse, fiche de cours, formule, exercice), refaire une question (gain unique), séance « Mes erreurs passées » (ordre, intro du N+1, maîtrise), limite de 60. |
| `e2e/revision.spec.ts` | 5 erreurs provoquées au point culture (questions imposées par le serveur de test), fiches de révision intégrées avec audit d'accessibilité, refaire la question, filtre, séance de révision menée par le N+1. |
