/**
 * Fiche de synthèse de fin d'entretien : ce qu'il faut retenir (corrections, chiffres clés, notions employées, décisions prises, conseils),
 * pensée pour être photographiée ou téléchargée en image. Construite à partir de la conversation, avec un contenu propre aux séances de formation.
 */
import type { GameState, MeetingInstance } from "./types";
import { meetingTemplate, type MeetingCtx } from "./meetingEngine";
import { allTerms, usesTerm } from "./glossary";
import { fmtDate, fmtTime } from "./time";

export interface Recap {
  title: string; subtitle: string; when: string;
  verdict: { label: string; tone: "gain" | "warn" | "loss" | "info" };
  outcome: string;
  points: string[];
  facts: [string, string][];
  terms: { term: string; text: string; example?: string }[];
  decisions: string[];
  /** Réponses des interlocuteurs à vos décisions */
  reactions: string[];
  tips: string[];
}
const IGNORED_TERMS = new Set(["Desk", "Book", "Limite", "Notation", "Allocation", "Profil de risque", "Exposition", "Mandat", "Consensus", "Momentum", "Couverture"]);
const clip = (t: string, n: number) => (t.length > n ? t.slice(0, n - 1).trimEnd() + "…" : t);
const strip = (t: string) => t.replace(/^[✔✘]\s*/, "").trim();

export function buildRecap(s: GameState, m: MeetingInstance): Recap | null {
  const tpl = meetingTemplate(m.templateId);
  if (!tpl) return null;
  const c: MeetingCtx = { s, m };
  const extra = tpl.recap?.(c);
  const sc = m.score;
  const total = sc.finance + sc.risque + sc.communication + sc.ethique;
  const verdict = extra?.verdict ?? (m.vars.failed ? { label: "Réunion ratée", tone: "loss" as const } : total >= 4 ? { label: "Très bien", tone: "gain" as const } : total <= -3 ? { label: "À retravailler", tone: "loss" as const } : total !== 0 ? { label: "Correct", tone: "warn" as const } : { label: "Terminée", tone: "info" as const });
  const names = new Map(tpl.participants(c).map((id) => [s.npcs[id]?.name ?? id, id]));
  const others = m.log.filter((l) => names.has(l.who));
  // Corrections du moteur (questions chiffrées) : ce qu'il faut retenir
  const corrections = m.log.filter((l) => l.who === "Correction").map((l) => clip(l.text, 260));
  const points = extra ? extra.points : corrections.slice(0, 4);
  if (!extra && tpl.objectives.length) points.unshift(`Objectifs de la réunion : ${tpl.objectives.join(" · ")}.`);
  if (!extra && points.length < 2 && m.outcome) points.push(clip(m.outcome, 260));
  // Chiffres clés : premières lignes de la fiche documentaire de la réunion
  const docs = tpl.docs ? tpl.docs(c) : [];
  const facts: [string, string][] = !extra && docs[0] ? docs[0].rows.slice(0, 5).map(([a, b]) => [a, clip(String(b), 80)] as [string, string]) : [];
  // Notions employées par les participants, expliquées en clair
  const terms: Recap["terms"] = [];
  if (!extra?.skipTerms) {
    const text = others.map((l) => l.text).join(" ");
    const scored = allTerms().filter((d) => !IGNORED_TERMS.has(d.term) && d.aliases.some((a) => a.length >= 4) && usesTerm(text, d)).map((d) => ({ d, n: others.filter((l) => usesTerm(l.text, d)).length }));
    scored.sort((a, b) => b.n - a.n);
    for (const { d } of scored.slice(0, 5)) terms.push({ term: d.term, text: clip(d.simple, 220), example: d.example ? clip(d.example, 160) : undefined });
  }
  const decisions = extra?.skipDecisions ? [] : m.log.filter((l) => l.who.includes("(vous)") && !l.text.startsWith("(") && !l.text.startsWith("«")).slice(0, 5).map((l) => clip(l.text, 150));
  // Ce que vos interlocuteurs ont répondu à vos décisions
  const reactions: string[] = [];
  if (!extra) for (let i = 0; i < m.log.length - 1 && reactions.length < 3; i++) { const l = m.log[i], n = m.log[i + 1]; if (l.who.includes("(vous)") && !l.text.startsWith("(") && names.has(n.who)) reactions.push(`${n.who.split(" ")[0]} : ${clip(n.text, 200)}`); }
  const tips: string[] = extra?.tips ? [...extra.tips] : [];
  if (!extra) {
    if (Number(m.vars.penalites ?? 0) > 0) tips.push("Répondez précisément à la question posée : les réponses hors sujet et les silences sont sanctionnés.");
    if (sc.ethique < 0) tips.push("Conformité : un conseil doit être adapté au profil du client et honnête sur les risques, jamais de promesse de gain.");
    if (Number(m.vars.faults ?? 0) > 0) tips.push("Au téléphone, chaque maladresse réduit l'objectif de vente : écoutez le client avant de proposer.");
    if (m.vars.failed) tips.push("Avant la prochaine réunion, relisez l'ordre du jour et préparez vos chiffres.");
    if (!tips.length && total >= 4) tips.push("Bonne préparation : gardez ce réflexe (documents lus, réponses précises).");
  }
  return {
    title: tpl.title(c), subtitle: `${tpl.location} · ${tpl.participants(c).map((id) => s.npcs[id]?.name ?? id).join(", ")}`, when: `${fmtDate(m.startedT)} · ${fmtTime(m.startedT)}`,
    verdict, outcome: m.outcome ? clip(m.outcome, 300) : "", points: points.slice(0, 8), facts, terms, decisions, reactions, tips: tips.slice(0, 4),
  };
}
