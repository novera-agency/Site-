/**
 * Prospection : votre responsable (N+1) vous confie régulièrement des prospects à démarcher par téléphone ;
 * les clients satisfaits vous en recommandent. Un prospect convaincu ouvre un mandat et devient client.
 */
import type { Client, GameState, Prospect } from "./types";
import { Rng } from "./rng";
import { nextId, notify } from "./core";
import { weekday, MIN_PER_DAY } from "./time";
import { onboardSeed } from "./clients";
import type { ClientSeed } from "./people";

const FIRST = ["Claire", "Thomas", "Sophie", "Nicolas", "Isabelle", "Julien", "Camille", "Antoine", "Hélène", "Mathieu", "Nathalie", "Olivier", "Aurélie", "Laurent", "Émilie", "Stéphane", "Céline", "Romain", "Valérie", "Hugo", "Sarah", "Karim", "Inès", "Mehdi", "Léa", "Yann", "Fatou", "Paul"];
const LAST = ["Marchand", "Fontaine", "Rousseau", "Morel", "Garnier", "Chevalier", "Lambert", "Bonnet", "Girard", "Mercier", "Dufour", "Blanchard", "Gauthier", "Perrin", "Robin", "Clément", "Morin", "Nicolas", "Henry", "Roussel", "Mathieu", "Benali", "Nguyen", "Diallo", "Lefèvre", "Picard", "Renaud"];
const PROFILES: { desc: string; kind: Client["kind"]; wealth: [number, number]; risk: [number, number]; horizon: [number, number]; objective: string; knowledge: number; avatar: string }[] = [
  { desc: "Médecin libéral, 45 ans", kind: "particulier", wealth: [600_000, 2_000_000], risk: [3, 5], horizon: [10, 20], objective: "Préparer la retraite et réduire la fiscalité", knowledge: 3, avatar: "🩺" },
  { desc: "Avocate associée, 38 ans", kind: "particulier", wealth: [400_000, 1_500_000], risk: [4, 6], horizon: [10, 25], objective: "Faire croître un patrimoine encore jeune", knowledge: 3, avatar: "⚖️" },
  { desc: "Chef d'entreprise qui vient de vendre sa société", kind: "particulier", wealth: [3_000_000, 12_000_000], risk: [3, 5], horizon: [8, 15], objective: "Placer le produit de la cession", knowledge: 4, avatar: "💼" },
  { desc: "Pharmacienne, 52 ans", kind: "particulier", wealth: [700_000, 1_800_000], risk: [2, 4], horizon: [8, 15], objective: "Sécuriser le patrimoine avant la retraite", knowledge: 2, avatar: "💊" },
  { desc: "Ingénieur en technologie, 32 ans, stock-options", kind: "particulier", wealth: [300_000, 1_200_000], risk: [5, 7], horizon: [15, 30], objective: "Diversifier un patrimoine concentré sur les actions de son employeur", knowledge: 5, avatar: "💻" },
  { desc: "Couple de retraités, ancien cadre", kind: "particulier", wealth: [500_000, 1_500_000], risk: [1, 3], horizon: [5, 12], objective: "Revenus complémentaires réguliers", knowledge: 2, avatar: "🧓" },
  { desc: "Sportif professionnel, 27 ans", kind: "particulier", wealth: [800_000, 4_000_000], risk: [3, 5], horizon: [15, 30], objective: "Préparer l'après-carrière", knowledge: 1, avatar: "⚽" },
  { desc: "Héritière d'un domaine viticole", kind: "particulier", wealth: [2_000_000, 6_000_000], risk: [2, 4], horizon: [15, 25], objective: "Transmettre le patrimoine familial", knowledge: 2, avatar: "🍇" },
  { desc: "PME industrielle régionale (120 salariés)", kind: "entreprise", wealth: [5_000_000, 20_000_000], risk: [1, 3], horizon: [1, 3], objective: "Placer la trésorerie excédentaire", knowledge: 4, avatar: "🏭" },
  { desc: "Start-up qui vient de lever des fonds", kind: "entreprise", wealth: [3_000_000, 15_000_000], risk: [1, 2], horizon: [1, 2], objective: "Sécuriser la levée de fonds en attendant de la dépenser", knowledge: 3, avatar: "🚀" },
];
const COMPANY = ["Ateliers", "Groupe", "Société", "Laboratoires", "Transports", "Maison"];
const SOURCES = ["Fichier de prospection de la banque", "Rencontré au salon du patrimoine", "Liste des dirigeants de la région", "A rempli un formulaire sur le site de la banque", "Contact d'un partenaire notaire"];
const roundK = (x: number) => Math.round(x / 10000) * 10000;

export function addProspect(s: GameState, rng: Rng, opts: { source?: string; warm?: boolean; kind?: Client["kind"]; givenBy?: string } = {}): Prospect | null {
  const pool = PROFILES.filter((p) => !opts.kind || p.kind === opts.kind);
  const pr = rng.pick(pool.length ? pool : PROFILES);
  const used = new Set([...(s.prospects ?? []).map((p) => p.name), ...s.clients.map((c) => c.name)]);
  let name = "";
  for (let i = 0; i < 20 && (!name || used.has(name)); i++) name = pr.kind === "entreprise" ? `${rng.pick(COMPANY)} ${rng.pick(LAST)}` : `${rng.pick(FIRST)} ${rng.pick(LAST)}`;
  const wealth = roundK(rng.range(pr.wealth[0], pr.wealth[1]));
  const p: Prospect = {
    id: nextId(s, "pros"), name, kind: pr.kind, desc: pr.desc, source: opts.source ?? rng.pick(SOURCES), warm: !!opts.warm,
    wealth, potential: roundK(wealth * rng.range(0.15, 0.35)), risk: rng.int(pr.risk[0], pr.risk[1]), horizon: rng.int(pr.horizon[0], pr.horizon[1]),
    objective: pr.objective, knowledge: pr.knowledge, avatar: pr.avatar, status: "a_appeler", attempts: 0, givenT: s.t, givenBy: opts.givenBy,
  };
  s.prospects = [p, ...(s.prospects ?? [])].slice(0, 40);
  return p;
}
export const activeProspects = (s: GameState) => (s.prospects ?? []).filter((p) => p.status === "a_appeler" || p.status === "rappel");

/** Deux fois par semaine (lundi et jeudi), le N+1 transmet des prospects à démarcher */
export function assignProspects(s: GameState, rng: Rng, force = false) {
  if (s.mode !== "carriere" || !s.career.employed) return;
  const wd = weekday(s.t);
  if (!force && wd !== 1 && wd !== 4) return;
  if (activeProspects(s).length >= 6) return;
  const n = rng.int(1, 2);
  const list: Prospect[] = [];
  for (let i = 0; i < n; i++) { const p = addProspect(s, rng, { givenBy: "boss" }); if (p) list.push(p); }
  if (!list.length) return;
  const boss = s.npcs.boss;
  s.messages.unshift({ id: nextId(s, "msg"), t: s.t, from: `${boss?.name ?? "Votre responsable"} — ${boss?.role ?? "N+1"}`, subject: `Prospection : ${list.length} contact${list.length > 1 ? "s" : ""} à démarcher`, read: false,
    body: `${s.profile.firstName},\n\nVoici de nouveaux contacts à appeler cette semaine :\n\n${list.map((p) => `• ${p.name} — ${p.desc}. Patrimoine estimé : ${p.wealth.toLocaleString("fr-FR")} €. Source : ${p.source}.`).join("\n")}\n\nPrésentez-vous clairement, écoutez, et décrochez un rendez-vous. Les prospects sont dans l'onglet Clients.\n\n${boss?.name ?? ""}` });
  notify(s, "info", `${list.length} nouveau${list.length > 1 ? "x" : ""} prospect${list.length > 1 ? "s" : ""} à démarcher`, "Votre responsable vous les a confiés : onglet Clients.", "/play/clients");
}

const ALLOC: Record<number, Record<string, number>> = {
  1: { XAGG: 0.6, CASH: 0.25, XWLD: 0.15 }, 2: { XAGG: 0.55, CASH: 0.2, XWLD: 0.25 }, 3: { XAGG: 0.45, XWLD: 0.35, XGLD: 0.05, CASH: 0.15 },
  4: { XWLD: 0.45, XAGG: 0.35, XEUR: 0.1, CASH: 0.1 }, 5: { XWLD: 0.5, XUSA: 0.15, XAGG: 0.2, XEMG: 0.05, CASH: 0.1 },
  6: { XUSA: 0.35, XTEC: 0.2, XWLD: 0.25, XEMG: 0.1, CASH: 0.1 }, 7: { XUSA: 0.35, XTEC: 0.25, XWLD: 0.2, XEMG: 0.1, CASH: 0.1 },
};
/** Prospect convaincu → mandat ouvert avec un premier versement */
export function convertProspect(s: GameState, p: Prospect, ratio: number) {
  const aum = roundK(p.potential * Math.max(0.4, Math.min(1, ratio)));
  const seed: ClientSeed = {
    name: p.name, kind: p.kind, wealth: p.wealth, aum, income: p.kind === "particulier" ? roundK(p.wealth * 0.1) : 0, objective: p.objective, horizon: p.horizon, risk: p.risk,
    liquidity: p.kind === "entreprise" ? 0.4 : 0.1, knowledge: p.knowledge, demands: p.kind === "entreprise" ? "Liquidité, sécurité, reporting clair." : "Être écouté, comprendre ce qui est fait de son argent.",
    expected: 0.02 + p.risk * 0.012, fee: p.kind === "entreprise" ? 20 : 90, constraints: p.risk <= 3 ? ["Actions ≤ 40 %"] : [], alloc: ALLOC[p.risk] ?? ALLOC[4],
    personality: `Ancien prospect (${p.source.toLowerCase()}). ${p.desc}.`, avatar: p.avatar,
  };
  const c = onboardSeed(s, seed);
  c.satisfaction = 65;
  c.history.unshift({ t: s.t, text: `Nouveau client gagné par prospection (${p.source}) : ${aum.toLocaleString("fr-FR")} € confiés` });
  p.status = "converti";
  s.flags["salesYtd"] = ((s.flags["salesYtd"] as number) ?? 0) + aum;
  s.flags["prospectsWon"] = ((s.flags["prospectsWon"] as number) ?? 0) + 1;
  return { client: c, aum };
}
export const RECALL_DAYS = 3;
export function canCall(s: GameState, p: Prospect) { return (p.status === "a_appeler" || p.status === "rappel") && (!p.lastCallT || s.t - p.lastCallT >= (p.status === "rappel" ? RECALL_DAYS : 1) * MIN_PER_DAY); }
