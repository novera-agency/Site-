/** Moteur de réunions : graphe de nœuds (dialogues, choix, questions chiffrées, actions structurées) évalué par le moteur. */
import type { GameState, MeetingInstance } from "./types";
import { nextId, notify, logDecision } from "./core";

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
export interface MeetingTemplate {
  id: string; type: string; title: (c: MeetingCtx) => string; location: string;
  participants: (c: MeetingCtx) => string[]; agenda: string[];
  init?: (c: MeetingCtx) => void;
  docs?: (c: MeetingCtx) => Doc[];
  objectives: string[];
  tension?: string;
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
function finish(c: MeetingCtx) {
  const tpl = REGISTRY[c.m.templateId];
  if (c.m.done) return;
  c.m.done = true;
  c.m.outcome = tpl.conclude(c);
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
export function answerMeeting(s: GameState, meetingId: string, input: { choiceId?: string; value?: number; spoken?: string; timeout?: boolean }) {
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
  if (ch.reply) { const r = ch.reply(c); if (r) m.log.push({ who: "—", text: r }); }
  m.nodeId = typeof ch.next === "function" ? ch.next(c) : ch.next;
  if (!tpl.nodes[m.nodeId]) { finish(c); return { ok: true as const, meeting: m }; }
  pushNodeText(c);
  return { ok: true as const, meeting: m };
}

export function meetingView(s: GameState, m: MeetingInstance) {
  const tpl = REGISTRY[m.templateId];
  const c = { s, m };
  const node = tpl.nodes[m.nodeId];
  return {
    id: m.id, templateId: m.templateId, title: tpl.title(c), type: tpl.type, location: tpl.location, done: m.done, outcome: m.outcome, startedT: m.startedT,
    participants: tpl.participants(c).map((p) => ({ id: p, name: s.npcs[p]?.name ?? p, role: s.npcs[p]?.role ?? "", avatar: s.npcs[p]?.avatar ?? "👤", trust: s.npcs[p]?.trust ?? 50 })),
    agenda: tpl.agenda, objectives: tpl.objectives, tension: tpl.tension, docs: tpl.docs ? tpl.docs(c) : [], log: m.log, score: m.score,
    choices: m.done ? [] : meetingChoices(s, m), numeric: !m.done && node?.numeric ? { prompt: node.numeric.prompt, unit: node.numeric.unit, hint: s.difficulty === "debutant" || s.settings.explanations ? node.numeric.hint : undefined } : null,
  };
}
