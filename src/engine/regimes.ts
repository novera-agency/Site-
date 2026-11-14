import type { RegimeId, Sector } from "./types";

export interface RegimeParams { label: string; drift: number; volMult: number; corr: number; riskAversion: number; liquidity: number; description: string; sectorTilt: Partial<Record<Sector, number>>; cryptoDrift: number; }
export const REGIMES: Record<RegimeId, RegimeParams> = {
  haussier: { label: "Marché haussier", drift: 0.14, volMult: 0.9, corr: 0.5, riskAversion: 0.25, liquidity: 1.05, description: "Tendance positive, volatilité modérée, appétit pour le risque.", sectorTilt: { Technologie: 0.05, Luxe: 0.03 }, cryptoDrift: 0.6 },
  baissier: { label: "Marché baissier", drift: -0.18, volMult: 1.3, corr: 0.65, riskAversion: 0.6, liquidity: 0.9, description: "Baisse durable des actifs risqués, rotation défensive.", sectorTilt: { Santé: 0.06, Distribution: 0.05, Technologie: -0.06 }, cryptoDrift: -0.6 },
  lateral: { label: "Marché latéral", drift: 0.02, volMult: 0.8, corr: 0.42, riskAversion: 0.35, liquidity: 1, description: "Absence de tendance, range étroit.", sectorTilt: {}, cryptoDrift: 0 },
  volatil: { label: "Forte volatilité", drift: -0.02, volMult: 1.8, corr: 0.7, riskAversion: 0.6, liquidity: 0.85, description: "Amplitudes fortes dans les deux sens, incertitude élevée.", sectorTilt: {}, cryptoDrift: -0.2 },
  crise: { label: "Crise financière", drift: -0.55, volMult: 2.2, corr: 0.85, riskAversion: 0.95, liquidity: 0.55, description: "Panique, corrélations proches de 1, liquidité asséchée.", sectorTilt: { Banque: -0.25, Immobilier: -0.15, Santé: 0.1 }, cryptoDrift: -1.5 },
  reprise: { label: "Reprise économique", drift: 0.2, volMult: 1.25, corr: 0.6, riskAversion: 0.45, liquidity: 0.95, description: "Rebond après une phase de stress, rattrapage des cycliques.", sectorTilt: { Banque: 0.08, Industrie: 0.06, Automobile: 0.08 }, cryptoDrift: 0.8 },
  bulle: { label: "Bulle spéculative", drift: 0.35, volMult: 1.2, corr: 0.55, riskAversion: 0.1, liquidity: 1.1, description: "Euphorie, valorisations déconnectées des fondamentaux.", sectorTilt: { Technologie: 0.25, Automobile: 0.1 }, cryptoDrift: 2.0 },
  recession: { label: "Récession", drift: -0.12, volMult: 1.4, corr: 0.65, riskAversion: 0.7, liquidity: 0.85, description: "Contraction de l'activité, hausse du chômage, défauts en hausse.", sectorTilt: { Santé: 0.08, Distribution: 0.04, Industrie: -0.08, Automobile: -0.1 }, cryptoDrift: -0.5 },
  expansion: { label: "Expansion économique", drift: 0.1, volMult: 0.95, corr: 0.48, riskAversion: 0.3, liquidity: 1.05, description: "Croissance solide, bénéfices en hausse.", sectorTilt: { Industrie: 0.04, Matériaux: 0.04 }, cryptoDrift: 0.3 },
  stagflation: { label: "Stagflation", drift: -0.1, volMult: 1.35, corr: 0.6, riskAversion: 0.65, liquidity: 0.9, description: "Inflation élevée et croissance faible : actions et obligations souffrent.", sectorTilt: { Énergie: 0.12, Matériaux: 0.05, Technologie: -0.1 }, cryptoDrift: -0.3 },
};

/** Matrice de transition journalière de base (probabilités ; le reste = rester dans le régime) */
export const TRANSITIONS: Record<RegimeId, Partial<Record<RegimeId, number>>> = {
  haussier: { lateral: 0.006, volatil: 0.004, bulle: 0.003, expansion: 0.004, baissier: 0.001 },
  baissier: { reprise: 0.006, crise: 0.003, lateral: 0.006, recession: 0.004, volatil: 0.004 },
  lateral: { haussier: 0.006, baissier: 0.004, volatil: 0.004, expansion: 0.004 },
  volatil: { lateral: 0.012, baissier: 0.007, crise: 0.003, haussier: 0.005 },
  crise: { reprise: 0.025, recession: 0.012, volatil: 0.012 },
  reprise: { haussier: 0.012, expansion: 0.01, volatil: 0.004 },
  bulle: { volatil: 0.008, crise: 0.004, baissier: 0.004 },
  recession: { reprise: 0.012, crise: 0.003, stagflation: 0.003 },
  expansion: { haussier: 0.006, lateral: 0.005, stagflation: 0.002, bulle: 0.002 },
  stagflation: { recession: 0.008, lateral: 0.005, volatil: 0.006 },
};

/** Duration « actions » approximative par secteur (sensibilité des valorisations aux taux longs) */
export const EQUITY_DURATION: Record<Sector, number> = {
  Technologie: 14, Banque: -2, Industrie: 6, Énergie: 3, Santé: 8, Luxe: 9, Distribution: 6, Télécoms: 10, Automobile: 5, Immobilier: 14, Assurance: 0, Matériaux: 5,
};
