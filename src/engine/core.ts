/** Utilitaires partagés par les modules du moteur (identifiants, notifications, devises, compétences). */
import type { Currency, GameState, InstrumentDef, NewsItem, Notification, RepKey, SkillBranch, ZoneId } from "./types";
import { Rng } from "./rng";

export function rngOf(s: GameState) { return new Rng(s.rng); }
export function nextId(s: GameState, prefix: string) { s.seq += 1; return `${prefix}${s.seq.toString(36)}`; }

/** Taux de change : valeur d'une unité de `cur` en USD */
export function usdValue(s: GameState, cur: Currency) { return Math.exp(s.macro.fxLog[cur]); }
/** Convertit un montant de `from` vers `to` au cours moyen */
export function fx(s: GameState, amount: number, from: Currency, to: Currency) {
  if (from === to) return amount;
  return (amount * usdValue(s, from)) / usdValue(s, to);
}
export const toEur = (s: GameState, amount: number, cur: Currency) => fx(s, amount, cur, "EUR");

export function multiplier(def: InstrumentDef) {
  if (def.option) return def.option.multiplier;
  if (def.future) return def.future.multiplier;
  if (def.bond) return def.bond.nominal / 100;
  return 1;
}
export function priceOf(s: GameState, id: string) { return s.quotes[id]?.price ?? 0; }
/** Valeur de marché d'une quantité (devise de l'instrument). Futures : valeur notionnelle. */
export function marketValueLocal(s: GameState, id: string, qty: number) { const d = s.instruments[id]; return priceOf(s, id) * qty * multiplier(d); }

export function notify(s: GameState, level: Notification["level"], title: string, body?: string, link?: string) {
  s.notifications.unshift({ id: nextId(s, "n"), t: s.t, level, title, body, link, read: false });
  if (s.notifications.length > 150) s.notifications.length = 150;
}
export function pushNews(s: GameState, n: Omit<NewsItem, "id" | "t">) {
  const item: NewsItem = { id: nextId(s, "news"), t: s.t, ...n };
  s.news.unshift(item);
  if (s.news.length > 400) s.news.length = 400;
  return item;
}
export function logDecision(s: GameState, kind: string, text: string) {
  s.decisions.unshift({ t: s.t, kind, text });
  if (s.decisions.length > 500) s.decisions.length = 500;
}
export function careerLog(s: GameState, text: string) { s.career.history.unshift({ t: s.t, text }); if (s.career.history.length > 200) s.career.history.length = 200; }

export const SKILL_LEVELS = [0, 100, 250, 500, 900, 1400, 2100, 3000, 4200, 5800, 8000];
export function skillLevel(xp: number) { let l = 0; for (let i = 0; i < SKILL_LEVELS.length; i++) if (xp >= SKILL_LEVELS[i]) l = i; return l; }
export function gainXp(s: GameState, branch: SkillBranch, xp: number, reason: string) {
  if (xp <= 0) return;
  const before = skillLevel(s.skills[branch]);
  // rendement décroissant pour éviter le farming d'une même action
  const key = `xp:${branch}:${reason}`;
  const count = (s.eventCooldowns[key] ?? 0) + 1;
  s.eventCooldowns[key] = count;
  const eff = Math.max(1, Math.round(xp / Math.sqrt(count)));
  s.skills[branch] += eff;
  s.skillLog.unshift({ t: s.t, branch, xp: eff, reason });
  if (s.skillLog.length > 200) s.skillLog.length = 200;
  const after = skillLevel(s.skills[branch]);
  if (after > before) notify(s, "succes", `Compétence améliorée : ${SKILL_NAMES[branch]} niveau ${after}`, reason, "/play/competences");
}
export function changeRep(s: GameState, key: RepKey, delta: number, why?: string) {
  const v = s.reputation[key] + delta;
  s.reputation[key] = Math.max(0, Math.min(100, v));
  if (why && Math.abs(delta) >= 4) notify(s, delta > 0 ? "succes" : "alerte", `Réputation ${REP_NAMES[key]} ${delta > 0 ? "+" : ""}${delta}`, why, "/play/reputation");
}
export function changeTrust(s: GameState, npcId: string, delta: number, memory?: string) {
  const n = s.npcs[npcId];
  if (!n) return;
  n.trust = Math.max(0, Math.min(100, n.trust + delta));
  if (memory) { n.memory.unshift({ t: s.t, text: memory, impact: delta }); if (n.memory.length > 30) n.memory.length = 30; }
  n.opinion = n.trust >= 75 ? "Vous fait pleinement confiance" : n.trust >= 55 ? "Opinion favorable" : n.trust >= 40 ? "Neutre, attend de voir" : n.trust >= 25 ? "Méfiant" : "Opinion très défavorable";
}
export function pause(s: GameState, reason: string) {
  if (!s.settings.autoPauseImportant) return;
  s.paused = true; s.pauseReason = reason;
}

export const SKILL_NAMES: Record<SkillBranch, string> = {
  analyse: "Analyse financière", marches: "Marchés", maths: "Mathématiques financières", macro: "Macroéconomie",
  risque: "Gestion des risques", client: "Relation client", management: "Management", entrepreneuriat: "Entrepreneuriat",
};
export const REP_NAMES: Record<RepKey, string> = {
  professionnelle: "professionnelle", commerciale: "commerciale", clients: "auprès des clients", interne: "interne",
  fiabilite: "fiabilité", risque: "gestion du risque", conformite: "conformité", leadership: "leadership",
};
export const ZONE_NAMES: Record<ZoneId, string> = { US: "États-Unis", EZ: "Zone euro", UK: "Royaume-Uni", JP: "Japon", CN: "Chine", EM: "Émergents" };
export function avgRep(s: GameState) { const v = Object.values(s.reputation); return v.reduce((a, b) => a + b, 0) / v.length; }
export const clamp = (x: number, a: number, b: number) => Math.max(a, Math.min(b, x));
