# Modèles financiers et économiques

Simulation pédagogique crédible — elle ne prétend pas reproduire les marchés réels.

## Aléa et reproductibilité
Générateur sfc32 (`rng.ts`) dont l'état est sauvegardé. Graine choisie à la création (ou aléatoire). Toutes les décisions aléatoires du moteur (prix, régimes, événements, crises, PNJ) en dérivent ; les scénarios Monte-Carlo des produits structurés utilisent une graine propre `(produit, jour)` pour ne pas perturber le monde.

## Temps
Minutes simulées depuis le 1er janvier 2027 (heure de Paris, sans heure d'été). Pas fixe de 5 minutes. Sessions : Europe 9 h–17 h 30, États-Unis 15 h 30–22 h, Asie 1 h–7 h 30, Forex 24 h/5 j, matières premières 8 h–22 h, crypto 24 h/7 j. x1 = 1 minute simulée par seconde réelle (configurable de 0,25 à 60).

## Moteur de marché (`market.ts`)
Rendement logarithmique d'une action sur un pas de fraction d'année `dt` (normalisée sur la durée de la session) :

```
r = (μ + κ·ln(V/P) − ½σ²)·dt + β·f_zone + β_s·f_secteur + σ_idio·√dt·ε + effet_taux + choc_en_attente
f_zone    = σ_M·√dt·(√ρ·Z_global + √(1−ρ)·Z_zone),   σ_M = 15 % × multiplicateur de volatilité du régime
f_secteur = 10 % × mult × √dt × Z_secteur
σ_idio    = √(σ_eff² − variance systématique),        σ_eff = σ × mult × (1 + ½·choc_vol) × (1 + 1,5·stress)
effet_taux = − duration_actions(secteur) × Δy10(zone)
μ = 3 % + dérive_régime × β × 0,8 + biais sectoriel du régime + effet croissance − pénalité de stress
```
- **Valeur fondamentale** `V = BPA × PER normatif × e^{−duration×(y10 − y10₀)} × sentiment` ; retour à la moyenne κ = 0,35/an (0,1 en bulle).
- **Résultats trimestriels** : surprise normale + biais macro (croissance de la zone, régime, stress) → mise à jour du BPA et du dividende → choc de prix.
- **Chocs d'actualité** : `pending` intégré à 30 % par pas de cotation (≈ 85 % en 30 minutes) ; une nouvelle hors séance produit un écart à l'ouverture.
- **Régimes** (10) : haussier, baissier, latéral, forte volatilité, crise, reprise, bulle, récession, expansion, stagflation. Chaîne de Markov journalière dont les probabilités dépendent de l'aversion au risque, de la liquidité, de la croissance et de l'inflation ; durée minimale 8 jours ; les crises forcent certains régimes.
- **Devises** : log-valeur de chaque devise contre USD (portage, valeur refuge selon l'aversion au risque, chocs de politique monétaire) ; toutes les paires sont cohérentes par construction.
- **Matières premières** : facteur pétrole commun, retour à la moyenne vers un ancrage, prime géopolitique / choc d'offre ; or sensible à l'aversion au risque et à l'inflation.
- **Cryptoactifs fictifs** : facteur commun, forte volatilité, sauts rares.
- **ETF et indices** : paniers à unités fixes (pondérations initiales par capitalisation), valorisés à partir des constituants convertis en devise du fonds.
- **Liquidité** : volume moyen (ADV) par classe ; spread = spread de base × (régime) × (stress)² / liquidité de marché, doublé hors séance ; carnet indicatif à 5 niveaux.
- **Impact de marché** (loi en racine carrée) : `impact = 0,5 × σ_jour × √(Q / ADV)`, plafonné à 5 % ; au plus 5 % de l'ADV exécuté par pas (sinon exécution partielle).

## Macroéconomie (`macro.ts`)
Six zones (États-Unis, zone euro, Royaume-Uni, Japon, Chine, émergents). Chaque jour ouvré : croissance qui revient vers le potentiel + effet du régime et des conditions financières ; inflation (courbe de Phillips simplifiée, pétrole, anticipations) ; chômage (loi d'Okun) ; confiance, production industrielle, déficit, dette, PIB nominal.
**Banques centrales** : règle de Taylor `i* = r_neutre + π + 0,5(π − cible) + 0,5(g − potentiel)`, mouvement par pas de 25/50 pb, baisse d'urgence en crise, et ~16 % de décisions qui s'écartent d'un cran (imprévisibilité). Le consensus est calculé la veille ; la **surprise** (réalisé − consensus) choque taux 2 ans, taux longs, devises et actions de la zone.
**Courbe des taux** : 2, 10 et 30 ans avec retour vers des cibles (politique monétaire anticipée, taux neutre, anticipations d'inflation, prime de terme liée à la dette) et fuite vers la qualité en crise.
**Statistiques** : IPC, chômage, PIB trimestriel, PMI publiés avec consensus/réalisé ; les surprises affectent les marchés.

## Valorisation (`pricing.ts`)
- **Options européennes** : Black-Scholes-Merton avec dividende continu ; grecques analytiques (thêta par jour, véga et rho pour 1 point). Volatilité implicite modélisée : volatilité de référence (mélange volatilité paramétrique × régime et volatilité réalisée 60 j) × structure par terme × smile/skew quadratique en log-moneyness. Volatilité implicite inverse par Newton-Raphson. Arbre binomial CRR disponible pour les options américaines (référence, non négociées).
- **Obligations** : prix « sale » = valeur actualisée des flux au taux actuariel `y = taux souverain(maturité) + spread × f(aversion au risque, notation) × (1 + 10·stress²)` ; duration de Macaulay, modifiée, convexité, DV01 ; obligations à taux variable (coupon = taux directeur + marge, sensibilité limitée au prochain fixing). Défaut : probabilité journalière ∝ stress⁴ de l'émetteur, recouvrement 30–40 %.
- **Futures** : portage `F = S·e^{(r−q)T}`, multiplicateur, dépôt de garantie, marge de variation quotidienne à 17 h 30, règlement en espèces à l'échéance (3e vendredi de mars/juin/septembre/décembre).
- **Produits structurés** : moteur d'observation contractuelle (autocall avec effet boule de neige, Phoenix à mémoire, reverse convertible, capital protégé 95 %, participation 130 %, bonus à barrière continue), worst-of sur paniers, défaut de l'émetteur (recouvrement 30 %). Valeur indicative et probabilités par Monte-Carlo log-normal corrélé (400 trajectoires, déterministe).

## Comptabilité (`ledger.ts`)
Partie double en centimes entiers. Chaque écriture : identifiant, compte débité, compte crédité, montant, devise, date simulée, motif, référence. Comptes joueur (`perso:cash`, `perso:marge`, `desk:…`, `client_…`, `societe:…`) et contreparties externes (`ext:marche`, `ext:frais`, `ext:employeur`, `ext:emetteurs`, `ext:change`, `ext:chambre_compensation`, …). **Invariant testé : pour chaque devise, la somme de tous les soldes est nulle** (aucune création monétaire). Les positions sont tenues dans un sous-registre (quantité, prix de revient moyen, P&L réalisé). Arrondi demi-pair au centime.

## Risque (`portfolio.ts`)
VaR historique 99 % 1 jour sur les 100 dernières séances simulées (exposition delta pour les options, notionnel pour les futures), expected shortfall, 5 stress tests instantanés, expositions sectorielles / géographiques / devises, HHI, levier brut, Sharpe (taux sans risque 2 %), drawdown maximal. Marge : 50 % des ventes à découvert, primes + 20 % du sous-jacent (moins hors-la-monnaie) pour les options vendues, dépôt des futures ; maintenance à 60 % de l'exigence ; appel de marge 24 h puis liquidation forcée.

## Carrière
Score composite pondéré selon le métier (P&L vs capital, consommation de VaR et incidents, satisfaction clients, réussite des missions, réputation, conformité). Promotion trimestrielle seulement si : score ≥ 60, risque ≥ 60 et conformité ≥ 50, compétences clés suffisantes, réputation moyenne ≥ 40 + 5×rang, ancienneté minimale. Bonus : provisions trimestrielles + part du P&L annuel, réduite de 70 % si la gestion du risque est insuffisante.

## Limites connues du modèle
- Pas de carnet d'ordres multi-agents : l'impact de marché du joueur est temporaire et n'affecte pas le cours de référence.
- Les banques concurrentes influencent la liquidité de façon agrégée, pas instrument par instrument.
- Prix obligataires sans distinction « pied de coupon / coupon couru » à l'affichage (le couru est fourni à titre indicatif).
