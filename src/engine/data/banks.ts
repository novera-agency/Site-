import type { Track } from "../types";

export interface BankDef {
  id: string; name: string; short: string; city: string; country: string; type: string;
  color: string; accent: string; monogram: string;
  prestige: number;        // 1..5
  difficulty: number;      // 1..5 (difficulté d'intégration)
  culture: string; specialties: string[]; riskPolicy: string;
  aumBn: number; employees: number; salaryMult: number; bonusMult: number; promoSpeed: number;
  riskStrictness: number;  // 0.5..1.5 sévérité des limites de risque
  deskCapitalM: number;    // capital de desk junior (M€)
  stockId?: string; tracks: Track[]; roe: number; capitalRatio: number;
  internalEvents: string[]; motto: string;
}

export const BANKS: BankDef[] = [
  { id: "lutece", name: "Banque Lutèce & Associés", short: "Lutèce", city: "Paris", country: "France", type: "Grande banque française", color: "#1e3a8a", accent: "#60a5fa", monogram: "BL",
    prestige: 4, difficulty: 2, culture: "Institution prestigieuse, hiérarchique, attachée à la conformité et au long terme.", specialties: ["Dérivés actions", "Produits structurés", "Financement d'entreprises"],
    riskPolicy: "Limites strictes, comité des risques hebdomadaire.", aumBn: 1200, employees: 180000, salaryMult: 1, bonusMult: 1, promoSpeed: 1, riskStrictness: 1.1, deskCapitalM: 5, stockId: "LUTB",
    tracks: ["trader", "sales", "structurer", "analyste", "gerant", "risk", "ib"], roe: 0.1, capitalRatio: 0.135, internalEvents: ["plan stratégique", "contrôle de l'ACPR"], motto: "La confiance se construit sur la durée." },
  { id: "hudson", name: "Hudson Meridian Partners", short: "Hudson Meridian", city: "New York", country: "États-Unis", type: "Banque d'investissement américaine", color: "#0f172a", accent: "#fbbf24", monogram: "HM",
    prestige: 5, difficulty: 5, culture: "Méritocratie intense, bonus élevés, horaires extrêmes, « up or out ».", specialties: ["Fusions-acquisitions", "Trading actions", "Prime brokerage"],
    riskPolicy: "Appétit pour le risque élevé mais tolérance zéro pour les pertes non expliquées.", aumBn: 2400, employees: 45000, salaryMult: 1.45, bonusMult: 1.8, promoSpeed: 1.25, riskStrictness: 0.9, deskCapitalM: 10, stockId: "HDMP",
    tracks: ["trader", "sales", "structurer", "analyste", "risk", "ib"], roe: 0.15, capitalRatio: 0.12, internalEvents: ["revue de fin d'année", "réduction d'effectifs"], motto: "Excellence. Always." },
  { id: "lindqvist", name: "Lindqvist & Aar Banquiers Privés", short: "Lindqvist & Aar", city: "Genève", country: "Suisse", type: "Banque privée suisse", color: "#3f2a14", accent: "#d4a373", monogram: "LA",
    prestige: 4, difficulty: 4, culture: "Discrétion absolue, relation client multigénérationnelle, prudence.", specialties: ["Gestion de fortune", "Gestion discrétionnaire", "Family office"],
    riskPolicy: "Très conservatrice, adéquation client contrôlée.", aumBn: 450, employees: 6000, salaryMult: 1.3, bonusMult: 0.9, promoSpeed: 0.85, riskStrictness: 1.3, deskCapitalM: 3, stockId: "LAAR",
    tracks: ["gerant", "sales", "analyste", "risk"], roe: 0.12, capitalRatio: 0.19, internalEvents: ["succession familiale", "audit fiscal international"], motto: "Depuis 1867, le temps est notre allié." },
  { id: "ubc", name: "Union Bancaire Continentale", short: "UBC", city: "Francfort", country: "Allemagne", type: "Banque universelle européenne", color: "#14532d", accent: "#4ade80", monogram: "UBC",
    prestige: 3, difficulty: 2, culture: "Grande organisation matricielle, processus lourds, bonne formation.", specialties: ["Taux", "Change", "Banque de détail"],
    riskPolicy: "Encadrement réglementaire très fort après des difficultés passées.", aumBn: 900, employees: 90000, salaryMult: 0.95, bonusMult: 0.8, promoSpeed: 0.95, riskStrictness: 1.2, deskCapitalM: 4, stockId: "UBCE",
    tracks: ["trader", "sales", "structurer", "analyste", "gerant", "risk", "ib"], roe: 0.06, capitalRatio: 0.14, internalEvents: ["plan de restructuration", "fusion envisagée"], motto: "Ensemble, plus solides." },
  { id: "seiryu", name: "Seiryu Markets Holdings", short: "Seiryu", city: "Tokyo / Singapour", country: "Japon", type: "Banque asiatique spécialisée marchés", color: "#7f1d1d", accent: "#f87171", monogram: "SM",
    prestige: 4, difficulty: 3, culture: "Discipline, consensus, culture du travail collectif, forte expertise quantitative.", specialties: ["Dérivés de change", "Marchés asiatiques", "Trading quantitatif"],
    riskPolicy: "Limites quantitatives rigoureuses (VaR, stress tests).", aumBn: 800, employees: 38000, salaryMult: 1.1, bonusMult: 1.1, promoSpeed: 0.9, riskStrictness: 1.05, deskCapitalM: 6, stockId: "SEIR",
    tracks: ["trader", "sales", "structurer", "analyste", "risk"], roe: 0.09, capitalRatio: 0.15, internalEvents: ["expansion régionale", "revue de modèles"], motto: "La précision avant la vitesse." },
  { id: "cassini", name: "Cassini Gestion", short: "Cassini", city: "Lyon", country: "France", type: "Société de gestion indépendante", color: "#312e81", accent: "#a78bfa", monogram: "CG",
    prestige: 2, difficulty: 1, culture: "Structure à taille humaine, autonomie rapide, convictions fortes.", specialties: ["Actions européennes", "Gestion flexible", "ISR"],
    riskPolicy: "Contrôle des risques léger, mandats de gestion à respecter.", aumBn: 12, employees: 85, salaryMult: 0.85, bonusMult: 1.2, promoSpeed: 1.3, riskStrictness: 0.9, deskCapitalM: 2,
    tracks: ["gerant", "analyste", "sales", "risk", "entrepreneur"], roe: 0.2, capitalRatio: 0.3, internalEvents: ["départ d'un associé", "lancement de fonds"], motto: "Investir avec conviction." },
  { id: "northwall", name: "Northwall Capital", short: "Northwall", city: "Londres", country: "Royaume-Uni", type: "Hedge fund", color: "#111827", accent: "#22d3ee", monogram: "NW",
    prestige: 5, difficulty: 5, culture: "Performance pure, très peu de hiérarchie, P&L comme seul juge.", specialties: ["Global macro", "Long/short actions", "Arbitrage de volatilité"],
    riskPolicy: "Stop-loss par gérant : -8 % de drawdown = réduction du capital, -12 % = départ.", aumBn: 35, employees: 220, salaryMult: 1.2, bonusMult: 2.5, promoSpeed: 1.4, riskStrictness: 0.8, deskCapitalM: 15,
    tracks: ["trader", "gerant", "analyste", "risk"], roe: 0.25, capitalRatio: 0.5, internalEvents: ["retraits d'investisseurs", "rentrée d'un gros mandat"], motto: "Alpha or nothing." },
];
export const BANK_BY_ID = Object.fromEntries(BANKS.map((b) => [b.id, b])) as Record<string, BankDef>;

/** Concurrents supplémentaires (non employeurs) intervenant dans les crises */
export const OTHER_BANKS = [
  { id: "pacific", name: "Pacific Crest Bancorp", stockId: "PCBK", strategy: "Dépôts d'entreprises tech, portefeuille obligataire long", riskAppetite: 0.8 },
  { id: "adriatica", name: "Banca Adriatica", stockId: "BADR", strategy: "Crédit aux PME italiennes et dette souveraine", riskAppetite: 0.6 },
];

export interface TrackDef { id: Track; name: string; description: string; missions: string[]; skills: string[]; win: string; ranks: string[]; instruments: string[]; }
export const TRACKS: Record<Track, TrackDef> = {
  trader: { id: "trader", name: "Trader", description: "Spécialiste des marchés et de l'exécution des ordres. Vous gérez un book de trading dans des limites de risque.", missions: ["Générer du P&L", "Respecter la VaR", "Exécuter les ordres clients"], skills: ["marches", "maths", "risque"], win: "Devenir responsable de desk avec un P&L régulier et sans incident de risque.", ranks: ["Stagiaire", "Trader junior", "Trader", "Senior trader", "Vice President", "Director", "Managing Director", "Responsable de desk", "Directeur des marchés"], instruments: ["action", "etf", "devise", "matiere", "future", "option", "obligation", "crypto"] },
  sales: { id: "sales", name: "Sales", description: "Responsable de la relation commerciale avec des clients institutionnels. Vous placez des produits et conseillez.", missions: ["Développer le chiffre d'affaires", "Fidéliser les clients", "Placer des produits"], skills: ["client", "marches", "macro"], win: "Diriger la vente institutionnelle avec un portefeuille de clients fidèles.", ranks: ["Stagiaire", "Sales junior", "Sales", "Associate", "Vice President", "Director", "Managing Director", "Responsable des ventes", "Directeur commercial"], instruments: ["action", "etf", "obligation", "devise"] },
  structurer: { id: "structurer", name: "Structureur", description: "Concepteur de produits financiers complexes (autocalls, protections, dérivés sur mesure).", missions: ["Concevoir des produits", "Valoriser les dérivés", "Gérer les barrières"], skills: ["maths", "marches", "client"], win: "Devenir responsable de l'ingénierie financière.", ranks: ["Stagiaire", "Structureur junior", "Structureur", "Associate", "Vice President", "Director", "Managing Director", "Responsable structuration", "Directeur des solutions"], instruments: ["action", "etf", "option", "obligation", "future"] },
  analyste: { id: "analyste", name: "Analyste financier", description: "Analyse des entreprises, valorisation, recommandations d'investissement.", missions: ["Publier des recommandations", "Modéliser les résultats", "Présenter au comité"], skills: ["analyse", "macro", "maths"], win: "Diriger la recherche avec des recommandations reconnues.", ranks: ["Stagiaire", "Analyste junior", "Analyste", "Associate", "Vice President", "Director", "Managing Director", "Responsable recherche", "Directeur de la recherche"], instruments: ["action", "etf", "obligation"] },
  gerant: { id: "gerant", name: "Gestionnaire de portefeuille", description: "Gestion de capitaux selon des mandats, des objectifs et des contraintes clients.", missions: ["Battre le benchmark", "Respecter les mandats", "Retenir les clients"], skills: ["analyse", "client", "risque"], win: "Devenir directeur de la gestion avec des encours en croissance.", ranks: ["Stagiaire", "Gérant junior", "Gérant", "Gérant senior", "Vice President", "Director", "Managing Director", "Directeur de gestion", "CIO"], instruments: ["action", "etf", "obligation", "devise", "matiere"] },
  risk: { id: "risk", name: "Risk Manager", description: "Surveillance des risques de marché, de crédit et de liquidité ; contrôle des limites.", missions: ["Mesurer la VaR", "Réaliser des stress tests", "Alerter la direction"], skills: ["risque", "maths", "macro"], win: "Devenir Chief Risk Officer.", ranks: ["Stagiaire", "Risk analyst junior", "Risk analyst", "Associate", "Vice President", "Director", "Managing Director", "Responsable des risques", "Chief Risk Officer"], instruments: ["action", "etf", "obligation", "future", "option"] },
  ib: { id: "ib", name: "Banquier d'investissement", description: "Opérations de financement (introductions, émissions) et de fusions-acquisitions.", missions: ["Valoriser des cibles", "Conseiller des dirigeants", "Mener des opérations"], skills: ["analyse", "client", "management"], win: "Devenir Managing Director en M&A.", ranks: ["Stagiaire", "Analyste junior", "Analyste", "Associate", "Vice President", "Director", "Managing Director", "Responsable M&A", "Directeur BFI"], instruments: ["action", "etf", "obligation"] },
  entrepreneur: { id: "entrepreneur", name: "Entrepreneur financier", description: "Vous commencez dans une société de gestion avec l'objectif de fonder votre propre structure.", missions: ["Constituer un capital", "Développer un réseau", "Fonder une société"], skills: ["entrepreneuriat", "client", "management"], win: "Bâtir une société rentable avec plus de 500 M€ d'encours.", ranks: ["Stagiaire", "Chargé d'affaires junior", "Chargé d'affaires", "Associate", "Vice President", "Director", "Associé", "Associé gérant", "Président"], instruments: ["action", "etf", "obligation", "devise", "matiere", "crypto"] },
};

/** Grille salariale de base (€ annuels) par rang */
export const BASE_SALARY = [24000, 55000, 75000, 105000, 150000, 210000, 320000, 420000, 600000];
/** Instruments accessibles par rang minimal (accès limité au terminal en début de carrière) */
export const ACCESS_BY_RANK: Record<string, number> = { action: 0, etf: 0, devise: 1, obligation: 1, matiere: 1, future: 2, option: 2, crypto: 2, indice: 99 };
