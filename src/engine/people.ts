/** RelationshipEngine — création des PNJ et des clients, mémoire et opinions. */
import type { Client, GameState, Npc } from "./types";
import { Rng } from "./rng";
import { nextId } from "./core";
import { toCents } from "./money";
import { BANK_BY_ID } from "./data/banks";

const FIRST = ["Mathilde", "Henri", "Marc", "Inès", "Thomas", "Claire", "Victor", "Sophie", "Damien", "Alexandre", "Léa", "Bernard", "Camille", "Hugo", "Yasmine", "Julien", "Nadia", "Olivier", "Chloé", "Karim", "Elena", "Pierre", "Aiko", "Ravi", "Hannah", "Lucas", "Margaux", "Samuel"];
const LAST = ["Arnaud", "de Villeneuve", "Delorme", "Haddad", "Nguyen", "Fontaine", "Lambert", "Marchetti", "Roux", "Kessler", "Morel", "Collet", "Bertin", "Lefort", "Benali", "Moreau", "Sato", "Iyer", "Weiss", "Garnier", "Castel", "Duval", "Mercier", "Perrin"];

export const NPC_ROLES: { id: string; role: string; personality: string; relation: Npc["relation"]; risk: number; trust: number; goals: string[]; avatar: string }[] = [
  { id: "boss", role: "Responsable du desk (N+1)", personality: "Directeur exigeant : direct, impatient, obsédé par la rigueur et les chiffres. Déteste les excuses, respecte ceux qui reconnaissent leurs erreurs.", relation: "hierarchie", risk: 0.5, trust: 50, goals: ["Atteindre l'objectif de P&L du desk", "Zéro incident de risque"], avatar: "🧭" },
  { id: "director", role: "Managing Director", personality: "Stratège politique, calme en apparence, juge sur la durée et la réputation de la banque.", relation: "hierarchie", risk: 0.4, trust: 45, goals: ["Rentabilité de la division", "Image de la banque"], avatar: "🏛️" },
  { id: "senior", role: "Trader expérimenté", personality: "Vétéran de trois crises, sarcastique mais généreux en conseils. Se méfie des modèles, croit au flux.", relation: "collegue", risk: 0.7, trust: 50, goals: ["Garder son autonomie", "Former les juniors… à sa façon"], avatar: "🎯" },
  { id: "analyst", role: "Analyste financière", personality: "Analyste prudente, méthodique, attachée aux fondamentaux et à la valorisation. Conteste toute idée non chiffrée.", relation: "collegue", risk: 0.3, trust: 50, goals: ["Des recommandations justes", "Être reconnue par le comité"], avatar: "📊" },
  { id: "colleague", role: "Collègue junior", personality: "Ambitieux, sympathique, parfois imprudent. Peut devenir un allié ou un rival.", relation: "collegue", risk: 0.6, trust: 55, goals: ["Être promu avant vous"], avatar: "🤝" },
  { id: "compliance", role: "Responsable conformité", personality: "Intransigeante sur les règles, pédagogue avec ceux qui posent des questions avant d'agir.", relation: "conformite", risk: 0.1, trust: 55, goals: ["Aucune infraction", "Protéger les clients"], avatar: "⚖️" },
  { id: "risk", role: "Risk Manager", personality: "Quantitatif, calme, alerte au moindre dépassement de limite. Respecte les traders qui anticipent.", relation: "risque", risk: 0.2, trust: 50, goals: ["Respect des limites VaR", "Stress tests à jour"], avatar: "🛡️" },
  { id: "journalist", role: "Journaliste financière", personality: "Curieuse, insistante, cherche le scoop. Peut faire ou défaire une réputation.", relation: "externe", risk: 0.5, trust: 40, goals: ["Obtenir des informations exclusives"], avatar: "📰" },
  { id: "recruiter", role: "Chasseur de têtes", personality: "Charmant, flatteur, pressé. Ne vous appelle que si votre réputation le justifie.", relation: "externe", risk: 0.5, trust: 45, goals: ["Placer des talents"], avatar: "🕴️" },
  { id: "rival", role: "Trader concurrent", personality: "Brillant et arrogant, travaille chez un concurrent, adore se comparer à vous.", relation: "externe", risk: 0.8, trust: 35, goals: ["Battre votre performance"], avatar: "⚔️" },
  { id: "founder", role: "Entrepreneur fintech", personality: "Visionnaire, optimiste, cherche des associés et des capitaux.", relation: "externe", risk: 0.8, trust: 45, goals: ["Lever des fonds", "Trouver un associé financier"], avatar: "🚀" },
  { id: "regulator", role: "Inspecteur du régulateur", personality: "Formel, méticuleux, jamais pressé. Apprécie la transparence totale.", relation: "externe", risk: 0.1, trust: 50, goals: ["Faire respecter la réglementation"], avatar: "🔍" },
];

export function createNpcs(s: GameState, rng: Rng) {
  const used = new Set<string>();
  const name = () => { for (;;) { const n = `${rng.pick(FIRST)} ${rng.pick(LAST)}`; if (!used.has(n)) { used.add(n); return n; } } };
  for (const r of NPC_ROLES) {
    s.npcs[r.id] = { id: r.id, name: name(), role: r.role, personality: r.personality, bankId: ["boss", "director", "senior", "analyst", "colleague", "compliance", "risk"].includes(r.id) ? s.career.bankId : undefined, avatar: r.avatar, trust: r.trust, riskTolerance: r.risk, mood: 0.5, goals: r.goals, opinion: "Neutre, attend de voir", memory: [], relation: r.relation };
  }
  // ajustements selon la banque
  const b = BANK_BY_ID[s.career.bankId];
  if (b?.id === "hudson" || b?.id === "northwall") s.npcs.boss.personality += " Culture du résultat poussée à l'extrême.";
  if (b?.id === "lindqvist") s.npcs.boss.personality = "Associé discret et exigeant : la relation client passe avant tout, la moindre imprudence est impardonnable.";
}

interface ClientSeed { name: string; kind: Client["kind"]; wealth: number; aum: number; income: number; objective: string; horizon: number; risk: number; liquidity: number; knowledge: number; demands: string; expected: number; fee: number; constraints: string[]; alloc: Record<string, number>; personality: string; avatar: string; }
export const CLIENT_SEEDS: ClientSeed[] = [
  { name: "Famille Delacroix", kind: "particulier", wealth: 4_500_000, aum: 1_200_000, income: 180_000, objective: "Préserver et transmettre le patrimoine familial", horizon: 10, risk: 3, liquidity: 0.1, knowledge: 2, demands: "Rendement régulier, aucune mauvaise surprise, explications claires.", expected: 0.04, fee: 90, constraints: ["Pas de cryptoactifs", "Actions ≤ 45 %"], alloc: { XWLD: 0.25, XEUR: 0.15, XAGG: 0.45, XGLD: 0.05, CASH: 0.1 }, personality: "Client fortuné, anxieux à la moindre baisse, très attaché à la relation personnelle.", avatar: "👨‍👩‍👧" },
  { name: "Caisse de Retraite des Ingénieurs", kind: "institutionnel", wealth: 900_000_000, aum: 25_000_000, income: 0, objective: "Financer les retraites : battre l'indice de référence 60/40", horizon: 15, risk: 4, liquidity: 0.05, knowledge: 6, demands: "Surperformance mesurée, reporting rigoureux, respect strict du mandat.", expected: 0.055, fee: 25, constraints: ["Actions ≤ 60 %", "Pas de cryptoactifs", "High yield ≤ 10 %"], alloc: { XWLD: 0.35, XUSA: 0.1, XEUR: 0.1, XAGG: 0.35, XHYD: 0.05, CASH: 0.05 }, personality: "Client institutionnel exigeant, comité d'investissement procédurier.", avatar: "🏦" },
  { name: "Gaspard Leroy", kind: "particulier", wealth: 800_000, aum: 300_000, income: 250_000, objective: "Faire fructifier rapidement un bonus de cession d'entreprise", horizon: 5, risk: 6, liquidity: 0.2, knowledge: 3, demands: "Veut du rendement, et vite. Supporte mal d'être contredit.", expected: 0.12, fee: 120, constraints: ["Liquidités ≥ 5 %"], alloc: { XUSA: 0.35, XTEC: 0.25, XEMG: 0.15, XCOM: 0.1, XAGG: 0.1, CASH: 0.05 }, personality: "Investisseur impatient, sûr de lui, attiré par les modes.", avatar: "💼" },
  { name: "Groupe Industriel Vauban", kind: "entreprise", wealth: 120_000_000, aum: 8_000_000, income: 0, objective: "Placer la trésorerie excédentaire sans risque de perte", horizon: 1, risk: 2, liquidity: 0.4, knowledge: 4, demands: "Liquidité quotidienne, capital préservé, couverture du risque de change USD.", expected: 0.025, fee: 15, constraints: ["Actions ≤ 10 %", "Obligations investment grade uniquement"], alloc: { XAGG: 0.6, XWLD: 0.05, CASH: 0.35 }, personality: "Directeur financier rigoureux et peu bavard.", avatar: "🏭" },
  { name: "Fondation Horizon Santé", kind: "institutionnel", wealth: 60_000_000, aum: 12_000_000, income: 0, objective: "Financer des bourses de recherche (retrait annuel de 4 %)", horizon: 20, risk: 4, liquidity: 0.05, knowledge: 4, demands: "Investissement responsable, pas d'énergies fossiles, rendement réel positif.", expected: 0.05, fee: 35, constraints: ["Pas de secteur énergie fossile", "Actions ≤ 65 %"], alloc: { XWLD: 0.4, XEUR: 0.15, XAGG: 0.35, XGLD: 0.05, CASH: 0.05 }, personality: "Conseil d'administration bienveillant mais attentif à l'éthique.", avatar: "🎗️" },
];
export const ALLOC_BUCKETS: { id: string; label: string; equity: number }[] = [
  { id: "XWLD", label: "Actions Monde", equity: 1 }, { id: "XUSA", label: "Actions États-Unis", equity: 1 }, { id: "XEUR", label: "Actions Europe", equity: 1 },
  { id: "XEMG", label: "Actions émergentes", equity: 1 }, { id: "XTEC", label: "Technologie", equity: 1 }, { id: "XNRG", label: "Énergie", equity: 1 },
  { id: "XAGG", label: "Obligations IG", equity: 0 }, { id: "XHYD", label: "Obligations High Yield", equity: 0.4 }, { id: "XGLD", label: "Or", equity: 0.3 },
  { id: "XCOM", label: "Matières premières", equity: 0.6 }, { id: "CASH", label: "Liquidités", equity: 0 },
];

export function makeClient(s: GameState, seed: ClientSeed): Client {
  const npcId = nextId(s, "npc_c");
  s.npcs[npcId] = { id: npcId, name: seed.name, role: seed.kind === "institutionnel" ? "Client institutionnel" : seed.kind === "entreprise" ? "Client entreprise" : "Client privé", personality: seed.personality, avatar: seed.avatar, trust: 50, riskTolerance: seed.risk / 7, mood: 0.5, goals: [seed.objective], opinion: "Neutre, attend de voir", memory: [], relation: "client" };
  const id = nextId(s, "cl");
  return {
    id, name: seed.name, kind: seed.kind, npcId, wealth: toCents(seed.wealth), income: toCents(seed.income), objective: seed.objective, horizonYears: seed.horizon, riskTolerance: seed.risk,
    liquidityNeed: seed.liquidity, knowledge: seed.knowledge, demands: seed.demands, satisfaction: 60, trust: 50, accountId: `client_${id}`, targetAllocation: { ...seed.alloc }, expectedReturn: seed.expected,
    feeBps: seed.fee, constraints: seed.constraints, history: [], lastContactT: s.t, joinedT: s.t,
  };
}
