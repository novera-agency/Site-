/**
 * Avis des collaborateurs : chaque personnage se forge une opinion (confiance) qui produit des effets concrets et réalistes.
 * Allié : confiance ≥ 70 · Défavorable : confiance ≤ 25. Entre les deux : neutre, sans effet particulier.
 */
import type { GameState } from "./types";
import { notify, nextId } from "./core";

export type Tier = "allie" | "neutre" | "reserve" | "defavorable";
export const ALLY = 70, HOSTILE = 25;
export function tierOf(trust: number): Tier { return trust >= ALLY ? "allie" : trust <= HOSTILE ? "defavorable" : trust < 40 ? "reserve" : "neutre"; }
const TIER_LABEL: Record<Tier, string> = { allie: "Allié", neutre: "Neutre", reserve: "Réservé", defavorable: "Défavorable" };

/** Effets par rôle (identifiant du PNJ) : avantage si allié, inconvénient si défavorable */
export const ROLE_EFFECTS: Record<string, { ally: string; hostile: string }> = {
  boss: { ally: "Défend votre dossier : +5 points à vos évaluations et ancienneté requise pour une promotion réduite de 20 %.", hostile: "Évaluations plus sévères : −5 points à vos évaluations." },
  director: { ally: "Parraine votre carrière : enveloppe de bonus +15 % à la revue annuelle.", hostile: "Bonus −15 % à la revue annuelle, et aucune promotion au-delà du rang Associate sans son soutien." },
  risk: { ally: "Tolère un dépassement de VaR de moins de 10 % sans incident formel, le temps de corriger.", hostile: "Vous surveille de près : votre limite de VaR est resserrée de 10 %." },
  compliance: { ally: "Vous accorde le bénéfice du doute : pénalités de conformité réduites de 25 %.", hostile: "Contrôles renforcés : pénalités de conformité augmentées de 25 %." },
  senior: { ally: "Partage une idée de marché chaque lundi (titre en forte tendance).", hostile: "Critique votre travail auprès de l'équipe : −1 en réputation interne chaque mois." },
  analyst: { ally: "Vous envoie sa note de recherche chaque lundi (titre le plus sous-évalué selon son modèle).", hostile: "Conteste systématiquement vos idées en comité d'investissement (−1 point de départ)." },
  colleague: { ally: "Vous couvre si vous manquez un rendez-vous (une fois par mois, sans pénalité).", hostile: "Rivalité : s'attribue une part de vos succès (−1 en réputation interne à chaque mission réussie)." },
  recruiter: { ally: "Pense à vous en premier : deux fois plus d'offres d'emploi.", hostile: "Ne vous propose presque plus de postes : deux fois moins d'offres." },
  journalist: { ally: "Vous cite comme une source fiable : +1 en réputation commerciale chaque mois.", hostile: "Écrit des articles critiques sur votre équipe : −1 en réputation interne chaque mois." },
};
const CLIENT_EFFECT = { ally: "Client fidèle : sa satisfaction progresse plus facilement et il vous confie plus volontiers des versements complémentaires.", hostile: "Client méfiant : sa satisfaction se dégrade plus vite et il risque de partir." };

export function relationStatus(s: GameState, id: string) {
  const n = s.npcs[id];
  if (!n) return null;
  const tier = tierOf(n.trust);
  const eff = n.relation === "client" ? CLIENT_EFFECT : ROLE_EFFECTS[id];
  const effect = tier === "allie" ? eff?.ally : tier === "defavorable" ? eff?.hostile : null;
  return { tier, label: TIER_LABEL[tier], effect: effect ?? null, kind: tier === "allie" && effect ? "avantage" as const : tier === "defavorable" && effect ? "inconvenient" as const : null, toAlly: Math.max(0, ALLY - Math.round(n.trust)), ally: eff?.ally ?? null, hostile: eff?.hostile ?? null };
}
export const isAlly = (s: GameState, id: string) => (s.npcs[id]?.trust ?? 50) >= ALLY;
export const isHostile = (s: GameState, id: string) => (s.npcs[id]?.trust ?? 50) <= HOSTILE;

/** Annonce les changements d'avis (quotidien) */
export function checkRelationChanges(s: GameState) {
  for (const id of Object.keys(ROLE_EFFECTS)) {
    const n = s.npcs[id];
    if (!n) continue;
    const t = tierOf(n.trust), key = `tier_${id}`, prev = s.flags[key] as Tier | undefined;
    if (prev === undefined) { s.flags[key] = t; continue; }
    if (prev === t) continue;
    s.flags[key] = t;
    if (t === "allie") notify(s, "succes", `${n.name} vous apprécie désormais`, `${n.role} — avantage : ${ROLE_EFFECTS[id].ally}`, "/play/reseau");
    else if (t === "defavorable") notify(s, "alerte", `${n.name} se méfie de vous`, `${n.role} — inconvénient : ${ROLE_EFFECTS[id].hostile}`, "/play/reseau");
  }
}

/** Effets hebdomadaires (lundi) : idées de marché et notes de recherche des alliés */
export function mondayRelations(s: GameState) {
  if (!s.career.employed || s.mode !== "carriere") return;
  const stocks = Object.values(s.instruments).filter((d) => d.cls === "action" && !s.quotes[d.id].defaulted && s.quotes[d.id].daily.length > 6);
  if (isAlly(s, "senior") && stocks.length) {
    const mom = stocks.map((d) => { const b = s.quotes[d.id].daily; return { d, r: s.quotes[d.id].price / b[b.length - 6].c - 1 }; }).sort((a, b) => Math.abs(b.r) - Math.abs(a.r))[0];
    s.messages.unshift({ id: nextId(s, "msg"), t: s.t, from: `${s.npcs.senior.name} — ${s.npcs.senior.role}`, subject: "Idée de marché de la semaine", body: `Entre nous : regarde ${mom.d.name} (${mom.d.id}). ${mom.r >= 0 ? "+" : ""}${(mom.r * 100).toFixed(1)} % en cinq séances, le flux est ${mom.r >= 0 ? "acheteur" : "vendeur"}. Ce n'est pas une recommandation officielle : fais ta propre analyse et mets un stop.`, read: false });
  }
  if (isAlly(s, "analyst") && stocks.length) {
    const val = stocks.filter((d) => s.quotes[d.id].fair).map((d) => ({ d, gap: (s.quotes[d.id].fair ?? 0) / s.quotes[d.id].price - 1 })).sort((a, b) => b.gap - a.gap)[0];
    if (val) s.messages.unshift({ id: nextId(s, "msg"), t: s.t, from: `${s.npcs.analyst.name} — ${s.npcs.analyst.role}`, subject: "Note de recherche (diffusion restreinte)", body: `Mon modèle place ${val.d.name} (${val.d.id}) ${(val.gap * 100).toFixed(0)} % sous sa valeur fondamentale estimée. Risques principaux : ${val.d.risks?.join(", ") ?? "spécifiques"}. Une décote peut durer longtemps : dimensionne la position en conséquence.`, read: false });
  }
}

/** Effets mensuels */
export function monthlyRelations(s: GameState) {
  if (s.mode !== "carriere") return;
  const rep = (k: "interne" | "commerciale", d: number) => { s.reputation[k] = Math.max(0, Math.min(100, s.reputation[k] + d)); };
  if (s.career.employed && isHostile(s, "senior")) rep("interne", -1);
  if (isAlly(s, "journalist")) rep("commerciale", 1);
  if (isHostile(s, "journalist")) rep("interne", -1);
}
