/** Moteur de réunions : graphe de nœuds (dialogues, choix, questions chiffrées, actions structurées) évalué par le moteur. */
import type { GameState, MeetingInstance } from "./types";
import { nextId, notify, logDecision, changeRep, changeTrust } from "./core";
import { findTerm, usesTerm, normalize } from "./glossary";

export interface MeetingCtx { s: GameState; m: MeetingInstance; }
export interface Doc { title: string; rows: [string, string][]; note?: string; }
export interface Choice {
  id: string; label: string; detail?: string;
  requires?: (c: MeetingCtx) => boolean;
  apply?: (c: MeetingCtx) => void;
  reply?: (c: MeetingCtx) => string;
  next: string | ((c: MeetingCtx) => string);
}
export interface NumericQ { prompt: string; unit: string; answer: (c: MeetingCtx) => number; tolerance: (c: MeetingCtx) => number; hint?: string; onCorrect: (c: MeetingCtx) => void; onWrong: (c: MeetingCtx, given: number) => void; next: string; explain: (c: MeetingCtx) => string; }
export interface MeetingNode { speaker: string | ((c: MeetingCtx) => string); text: (c: MeetingCtx) => string; choices?: Choice[]; numeric?: NumericQ; end?: boolean; }
/** Contenu spécifique d'une fiche de synthèse (sinon, fiche générale construite à partir de la conversation) */
export interface RecapExtra { points: string[]; tips?: string[]; verdict?: { label: string; tone: "gain" | "warn" | "loss" | "info" }; skipTerms?: boolean; skipDecisions?: boolean }
export interface MeetingTemplate {
  id: string; type: string; title: (c: MeetingCtx) => string; location: string;
  participants: (c: MeetingCtx) => string[]; agenda: string[];
  init?: (c: MeetingCtx) => void;
  docs?: (c: MeetingCtx) => Doc[];
  objectives: string[];
  tension?: string;
  /** Mode oral : les réponses possibles sont lues à voix haute après la question (QCM) */
  readChoices?: boolean;
  /** Fiche « à retenir » de fin d'entretien */
  recap?: (c: MeetingCtx) => RecapExtra;
  start: string; nodes: Record<string, MeetingNode>;
  conclude: (c: MeetingCtx) => string;
}

const REGISTRY: Record<string, MeetingTemplate> = {};
type LabelResolver = (s: GameState, templateId: string, nodeId: string, vars: Record<string, number | string>, id: string, fallback: string) => string;
let labelResolver: LabelResolver = (_s, _t, _n, _v, _i, f) => f;
export function setLabelResolver(f: LabelResolver) { labelResolver = f; }
export function registerMeeting(t: MeetingTemplate) { REGISTRY[t.id] = t; }
export function meetingTemplate(id: string) { return REGISTRY[id]; }
export function allMeetingTemplates() { return Object.values(REGISTRY); }

export function startMeeting(s: GameState, templateId: string, params: Record<string, string> = {}): MeetingInstance | null {
  const tpl = REGISTRY[templateId];
  if (!tpl) return null;
  if (s.activeMeetingId) { const cur = s.meetings.find((x) => x.id === s.activeMeetingId); if (cur && !cur.done) return cur; }
  const m: MeetingInstance = { id: nextId(s, "mtg"), templateId, nodeId: tpl.start, startedT: s.t, vars: { ...params }, score: { finance: 0, risque: 0, communication: 0, ethique: 0 }, log: [], done: false, context: params };
  s.meetings.unshift(m);
  if (s.meetings.length > 120) s.meetings.length = 120;
  s.activeMeetingId = m.id;
  s.paused = true; s.pauseReason = `Réunion : ${tpl.title({ s, m })}`;
  const c = { s, m };
  tpl.init?.(c);
  if (templateId === "comite_investissement" && (s.npcs.analyst?.trust ?? 50) <= 25) { m.score.communication -= 1; m.log.push({ who: "—", text: `(${s.npcs.analyst.name} se méfie de vous et contestera vos idées : −1 point de départ)` }); }
  pushNodeText(c);
  return m;
}
function speakerName(c: MeetingCtx, sp: string) { if (sp === "narrateur") return "—"; if (sp === "vous") return `${c.s.profile.firstName} (vous)`; return c.s.npcs[sp]?.name ?? sp; }
function pushNodeText(c: MeetingCtx) {
  const tpl = REGISTRY[c.m.templateId];
  const node = tpl.nodes[c.m.nodeId];
  const sp = typeof node.speaker === "function" ? node.speaker(c) : node.speaker;
  c.m.log.push({ who: speakerName(c, sp), text: node.text(c) });
  if (node.end) finish(c);
}
/** Nombre d'avertissements (hors-sujet, silences) qui fait échouer la réunion */
export const MAX_PENALTIES = 3;
/** Score total en dessous duquel une réunion menée jusqu'au bout est malgré tout jugée ratée */
const FAIL_SCORE = -6;
const total = (m: MeetingInstance) => m.score.finance + m.score.risque + m.score.communication + m.score.ethique;

/** Conséquences d'une réunion ratée : réalistes et proportionnées (confiance des participants, image interne) */
function applyFailure(c: MeetingCtx, reason: string) {
  const tpl = REGISTRY[c.m.templateId];
  c.m.vars.failed = 1;
  const parts = tpl.participants(c);
  for (const id of parts) changeTrust(c.s, id, -4, `Réunion ratée : ${tpl.title(c)}`);
  changeRep(c.s, "interne", -3, "Réunion ratée");
  changeRep(c.s, "fiabilite", -2);
  const client = c.s.clients.find((x) => x.id === c.m.vars.client);
  if (client) { client.satisfaction = Math.max(0, client.satisfaction - 8); client.history.unshift({ t: c.s.t, text: "Entretien raté : le client repart insatisfait" }); }
  c.s.flags["meetingsFailed"] = ((c.s.flags["meetingsFailed"] as number) ?? 0) + 1;
  if (c.m.templateId === "entretien_embauche") c.s.career.pendingOffers = c.s.career.pendingOffers.filter((o) => o.id !== c.m.vars.offer);
  notify(c.s, "critique", `Réunion ratée : ${tpl.title(c)}`, reason, "/play/reunions");
}
function failMeeting(c: MeetingCtx, reason: string) {
  const tpl = REGISTRY[c.m.templateId];
  if (c.m.done) return;
  const main = tpl.participants(c)[0];
  c.m.log.push({ who: speakerName(c, main), text: c.m.vars.objInit ? "Écoutez, je n'ai plus le temps. Au revoir." : "Je crois qu'on va s'arrêter là. On en reparlera." });
  c.m.done = true;
  applyFailure(c, reason);
  c.m.outcome = `Réunion ratée — ${reason} La confiance des participants baisse et votre image en interne en pâtit.`;
  c.m.log.push({ who: "Bilan", text: c.m.outcome });
  c.s.activeMeetingId = undefined;
  c.s.stats.meetingsCount++;
  logDecision(c.s, "reunion", `${tpl.title(c)} : réunion ratée (${reason})`);
}
/**
 * Objectif de vente (appels commerciaux) : chaque faute le fait baisser d'une fraction de l'objectif initial.
 * Sous 30 % de l'objectif initial, le client met fin à l'appel.
 */
export const SALES_FLOOR = 0.3;
export function salesFault(c: MeetingCtx, pct: number, why: string) {
  const ini = Number(c.m.vars.objInit ?? 0);
  if (!ini) return;
  const cur = Math.max(0, Number(c.m.vars.objective ?? ini) - ini * pct);
  c.m.vars.objective = Math.round(cur);
  c.m.vars.faults = Number(c.m.vars.faults ?? 0) + 1;
  c.m.log.push({ who: "—", text: `(faute : ${why} — objectif de vente −${Math.round(pct * 100)} % → ${Math.round(cur).toLocaleString("fr-FR")} €)` });
}
function salesBroken(c: MeetingCtx) { const ini = Number(c.m.vars.objInit ?? 0); return ini > 0 && Number(c.m.vars.objective ?? ini) < ini * SALES_FLOOR; }

function addPenalty(c: MeetingCtx) {
  c.m.vars.penalites = Number(c.m.vars.penalites ?? 0) + 1;
  return Number(c.m.vars.penalites) >= MAX_PENALTIES;
}

function finish(c: MeetingCtx) {
  const tpl = REGISTRY[c.m.templateId];
  if (c.m.done) return;
  c.m.done = true;
  c.m.outcome = tpl.conclude(c);
  if (total(c.m) <= FAIL_SCORE && !c.m.vars.failed) { applyFailure(c, "Vos réponses ont été jugées très insuffisantes."); c.m.outcome = `Réunion ratée — vos réponses ont été jugées très insuffisantes. ${c.m.outcome}`; }
  c.m.log.push({ who: "Bilan", text: c.m.outcome });
  c.s.activeMeetingId = undefined;
  c.s.stats.meetingsCount++;
  logDecision(c.s, "reunion", `${tpl.title(c)} : ${c.m.outcome.slice(0, 140)}`);
  notify(c.s, "info", `Réunion terminée : ${tpl.title(c)}`, c.m.outcome.slice(0, 160), "/play/reunions");
}

export function meetingChoices(s: GameState, m: MeetingInstance) {
  const tpl = REGISTRY[m.templateId];
  const node = tpl.nodes[m.nodeId];
  const c = { s, m };
  return (node.choices ?? []).filter((ch) => !ch.requires || ch.requires(c)).map((ch) => ({ id: ch.id, label: ch.label || labelResolver(s, m.templateId, m.nodeId, m.vars, ch.id, ch.label), detail: ch.detail }));
}

/**
 * Réponse à une réunion. Trois formes : un choix (clic), une valeur chiffrée,
 * une phrase prononcée à voix haute (`spoken`, déjà rapprochée d'un choix ou d'un nombre par le client),
 * ou un silence (`timeout` : temps de réponse écoulé — pénalité et la discussion continue sans vous).
 */
export function answerMeeting(s: GameState, meetingId: string, input: { choiceId?: string; value?: number; spoken?: string; timeout?: boolean; offtopic?: boolean }) {
  const m = s.meetings.find((x) => x.id === meetingId);
  if (!m || m.done) return { ok: false as const, error: "Réunion terminée ou introuvable." };
  const tpl = REGISTRY[m.templateId];
  const node = tpl.nodes[m.nodeId];
  const c = { s, m };
  const me = speakerName(c, "vous");
  const spoken = input.spoken?.trim().slice(0, 500);
  if (input.timeout) {
    m.log.push({ who: me, text: "(silence — vous n'avez pas répondu à temps)" });
    m.score.communication -= 2;
    salesFault(c, 0.1, "silence au téléphone");
    if (salesBroken(c)) { failMeeting(c, "Le client, lassé, a mis fin à l'appel."); return { ok: true as const, meeting: m }; }
    if (addPenalty(c)) { failMeeting(c, "Trop de silences et de réponses hors sujet."); return { ok: true as const, meeting: m }; }
    const sp = typeof node.speaker === "function" ? node.speaker(c) : node.speaker;
    if (s.npcs[sp]) { const n = s.npcs[sp]; n.trust = Math.max(0, n.trust - 2); n.memory.unshift({ t: s.t, text: "N'a pas su répondre en réunion", impact: -2 }); }
    if (node.numeric) {
      node.numeric.onWrong(c, NaN);
      m.log.push({ who: "Correction", text: `Pas de réponse. ${node.numeric.explain(c)}` });
      m.nodeId = node.numeric.next;
      pushNodeText(c);
      return { ok: true as const, meeting: m };
    }
    // Sans réponse, la discussion se poursuit sur l'option la plus passive (dernière proposée)
    const avail = (node.choices ?? []).filter((x) => !x.requires || x.requires(c));
    const fallback = avail[avail.length - 1];
    if (!fallback) { finish(c); return { ok: true as const, meeting: m }; }
    m.log.push({ who: "—", text: `Faute de réponse de votre part, la discussion continue : « ${fallback.label || labelResolver(s, m.templateId, m.nodeId, m.vars, fallback.id, fallback.label)} »` });
    return applyChoice(c, tpl, fallback);
  }
  if (input.offtopic && m.vars.pickup !== undefined && Number(m.vars.pickup) === 0) {
    // Messagerie : tout ce qui est dit est enregistré comme un message laissé au client
    const leave = (node.choices ?? [])[0];
    if (leave) { m.log.push({ who: me, text: `« ${spoken ?? ""} »` }); m.log.push({ who: "—", text: "(message enregistré sur la messagerie)" }); return applyChoice(c, tpl, leave); }
  }
  if (input.offtopic) {
    m.log.push({ who: me, text: spoken ? `« ${spoken} »` : "(réponse incompréhensible)" });
    m.score.communication -= 2;
    const sp = typeof node.speaker === "function" ? node.speaker(c) : node.speaker;
    if (s.npcs[sp]) changeTrust(s, sp, -1);
    salesFault(c, 0.1, "réponse hors sujet");
    if (salesBroken(c)) { failMeeting(c, "Le client, agacé, a mis fin à l'appel."); return { ok: true as const, meeting: m }; }
    if (addPenalty(c)) { failMeeting(c, "Trop de réponses hors sujet."); return { ok: true as const, meeting: m }; }
    const reactions = ["Je ne vois pas le rapport avec ma question.", "Pardon ? Restons concentrés, s'il vous plaît.", "Ce n'est pas ce que je vous demande.", "Je ne vous suis pas. Soyez précis."];
    const left = MAX_PENALTIES - Number(m.vars.penalites);
    m.log.push({ who: speakerName(c, sp), text: `${reactions[Number(m.vars.penalites) % reactions.length]} Je répète : ${node.text(c)}` });
    m.log.push({ who: "—", text: `(réponse hors sujet : −2 en communication · encore ${left} avertissement${left > 1 ? "s" : ""} avant l'échec de la réunion)` });
    return { ok: true as const, meeting: m };
  }
  if (node.numeric) {
    if (input.value === undefined || !Number.isFinite(input.value)) return { ok: false as const, error: "Réponse chiffrée attendue." };
    const ans = node.numeric.answer(c), tol = node.numeric.tolerance(c);
    m.log.push({ who: me, text: spoken ? `« ${spoken} »` : `${input.value.toLocaleString("fr-FR")} ${node.numeric.unit}` });
    if (spoken) m.log.push({ who: "—", text: `(compris : ${input.value.toLocaleString("fr-FR")} ${node.numeric.unit})` });
    const ok = Math.abs(input.value - ans) <= tol;
    if (ok) node.numeric.onCorrect(c); else node.numeric.onWrong(c, input.value);
    m.log.push({ who: "Correction", text: `${ok ? "✔ Juste." : "✘ Inexact."} ${node.numeric.explain(c)}` });
    m.nodeId = node.numeric.next;
    pushNodeText(c);
    return { ok: true as const, meeting: m };
  }
  const ch = (node.choices ?? []).find((x) => x.id === input.choiceId && (!x.requires || x.requires(c)));
  if (!ch) return { ok: false as const, error: "Choix invalide." };
  const label = ch.label || labelResolver(s, m.templateId, m.nodeId, m.vars, ch.id, ch.label);
  if (spoken) { m.log.push({ who: me, text: `« ${spoken} »` }); m.log.push({ who: "—", text: `(interprété comme : ${label})` }); }
  else m.log.push({ who: me, text: label });
  return applyChoice(c, tpl, ch);
}

function applyChoice(c: MeetingCtx, tpl: MeetingTemplate, ch: Choice) {
  const m = c.m;
  ch.apply?.(c);
  if (salesBroken(c)) { failMeeting(c, "Trop de maladresses : le client a mis fin à l'appel."); return { ok: true as const, meeting: m }; }
  // Si la réunion le demande (variable replyWho), le retour sur la réponse est prononcé par ce personnage plutôt que par le narrateur
  if (ch.reply) { const r = ch.reply(c); if (r) m.log.push({ who: m.vars.replyWho ? speakerName(c, String(m.vars.replyWho)) : "—", text: r }); }
  m.nodeId = typeof ch.next === "function" ? ch.next(c) : ch.next;
  if (!tpl.nodes[m.nodeId]) { finish(c); return { ok: true as const, meeting: m }; }
  pushNodeText(c);
  return { ok: true as const, meeting: m };
}

/**
 * « Qu'est-ce que… ? » : la personne qui a employé le terme l'explique (à défaut, celle qui pose la question en cours).
 * Ne consomme pas le tour de parole et n'entraîne aucune pénalité.
 */
export function explainTerm(s: GameState, meetingId: string, question: string) {
  const m = s.meetings.find((x) => x.id === meetingId);
  if (!m || m.done) return { ok: false as const, error: "Réunion terminée ou introuvable." };
  const tpl = REGISTRY[m.templateId];
  const c = { s, m };
  const node = tpl.nodes[m.nodeId];
  const q = question.trim().slice(0, 300);
  m.log.push({ who: speakerName(c, "vous"), text: `« ${q} »` });
  const term = findTerm(q);
  const ids = tpl.participants(c);
  const nameToId = new Map(ids.map((id) => [speakerName(c, id), id]));
  let by: string | undefined;
  if (term) for (let i = m.log.length - 2; i >= 0 && !by; i--) { const id = nameToId.get(m.log[i].who); if (id && usesTerm(m.log[i].text, term)) by = id; }
  if (!by) { const sp = typeof node.speaker === "function" ? node.speaker(c) : node.speaker; by = s.npcs[sp] ? sp : ids[0]; }
  const n = s.npcs[by];
  if (!term) {
    m.log.push({ who: speakerName(c, by), text: "De quel terme parlez-vous exactement ? Reformulez votre question." });
    return { ok: true as const, term: null, by };
  }
  const asked = Number(m.vars[`def_${normalize(term.term)}`] ?? 0) + 1;
  m.vars[`def_${normalize(term.term)}`] = asked;
  const intro = asked > 1 ? "Comme je vous le disais : " : n?.relation === "hierarchie" && s.difficulty !== "debutant" ? "C'est une notion de base, retenez-la. " : "Bonne question. ";
  m.log.push({ who: speakerName(c, by), text: `${intro}${term.simple}${term.example ? ` Par exemple : ${term.example}` : ""}` });
  return { ok: true as const, term: term.term, by };
}

export function meetingView(s: GameState, m: MeetingInstance) {
  const tpl = REGISTRY[m.templateId];
  const c = { s, m };
  const node = tpl.nodes[m.nodeId];
  return {
    id: m.id, templateId: m.templateId, title: tpl.title(c), type: tpl.type, location: tpl.location, done: m.done, outcome: m.outcome, startedT: m.startedT,
    participants: tpl.participants(c).map((p) => ({ id: p, name: s.npcs[p]?.name ?? p, role: s.npcs[p]?.role ?? "", avatar: s.npcs[p]?.avatar ?? "👤", trust: s.npcs[p]?.trust ?? 50 })),
    agenda: tpl.agenda, objectives: tpl.objectives, penalties: Number(m.vars.penalites ?? 0), maxPenalties: MAX_PENALTIES, failed: !!m.vars.failed,
    sales: m.vars.objInit ? { initial: Number(m.vars.objInit), current: Number(m.vars.objective), faults: Number(m.vars.faults ?? 0), floor: SALES_FLOOR, obtained: m.vars.obtained !== undefined ? Number(m.vars.obtained) : null } : null,
    phone: tpl.type === "Appel téléphonique", readChoices: !!tpl.readChoices, pickup: m.vars.pickup === undefined ? null : Number(m.vars.pickup) === 1, tension: tpl.tension, docs: tpl.docs ? tpl.docs(c) : [], log: m.log, score: m.score,
    choices: m.done ? [] : meetingChoices(s, m), numeric: !m.done && node?.numeric ? { prompt: node.numeric.prompt, unit: node.numeric.unit, hint: s.difficulty === "debutant" || s.settings.explanations ? node.numeric.hint : undefined } : null,
  };
}
