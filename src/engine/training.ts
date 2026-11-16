/**
 * Séances de formation (heures supplémentaires « me former ») : de vraies leçons du centre de formation (fiche à lire + exercice corrigé),
 * des définitions, des exercices de calcul et des questions de culture, ciblés sur la compétence choisie ou la plus faible.
 * Chaque question est corrigée avec une explication ; les erreurs alimentent un carnet de formation à relire.
 * Les bonnes réponses font progresser les compétences (qui comptent pour les promotions) ; une séance réussie à 80 % rapporte aussi
 * de la confiance et de la réputation.
 */
import type { GameState, SkillBranch } from "./types";
import { LESSONS, type Lesson } from "./data/learning";
import { genQuestion, GEN_FAMILIES } from "./quizGen";
import { QUIZ_BANK, quizById } from "./quiz";
import { gainXp, changeTrust, changeRep, notify, skillLevel, nextId } from "./core";
import { dayIndex } from "./time";
import { recordMistake, markFixed, unresolved, keyOf } from "./notebook";

export type TItem = { k: "lesson" | "def" | "calc" | "quiz"; id: string; seed?: number };
/** Une séance par jour, de 2 à 5 questions */
export const MIN_Q = 2, MAX_Q = 5;
export const TRAIN_BRANCHES: SkillBranch[] = ["marches", "analyse", "maths", "macro", "risque"];
const LESSON_BY_ID = Object.fromEntries(LESSONS.map((l) => [l.id, l]));
const QUIZ_CATS: Record<string, string[]> = { marches: ["finance"], analyse: ["micro", "immobilier", "finance"], maths: ["finance"], macro: ["macro", "histoire"], risque: ["assurance", "finance"] };

const mulberry = (a: number) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const hash = (str: string) => { let x = 2166136261; for (let i = 0; i < str.length; i++) x = Math.imul(x ^ str.charCodeAt(i), 16777619) >>> 0; return x; };

export interface TQ {
  kind: "qcm" | "num"; label: "Fiche et exercice" | "Définition" | "Calcul" | "Culture";
  prompt: string; options?: string[]; answer: number; tolerance?: number; unit?: string; explain: string; branch: SkillBranch;
  card?: { term: string; definition: string; simple: string; example: string; application: string; level: number };
}
const fmtN = new Intl.NumberFormat("fr-FR", { maximumFractionDigits: 3 });
/** Question chiffrée → 4 réponses proposées (la bonne et trois ordres de grandeur plausibles) : tout se répond à voix haute ou au clic en réunion */
function numericOptions(answer: number, tolerance: number, unit: string, seed: string) {
  const fmt = (x: number) => `${fmtN.format(x)}${unit ? " " + unit : ""}`;
  const dec = Math.min(3, (String(answer).split(".")[1] ?? "").length);
  const r = (x: number) => Math.round(x * 10 ** Math.max(dec, 2)) / 10 ** Math.max(dec, 2);
  const step = Math.max(1, Math.abs(answer) * 0.2);
  const cands = [answer * 2, answer / 2, answer * 10, answer / 10, answer * 1.5, answer * 0.75, answer + step, answer - step, answer * 3].map(r);
  const right = fmt(answer);
  const seen = new Set([right]);
  const wrong: string[] = [];
  for (const x of cands.map((v, i) => ({ v, h: hash(`${seed}:${i}`) })).sort((a, b) => a.h - b.h).map((o) => o.v)) {
    if (wrong.length >= 3) break;
    if (!Number.isFinite(x) || Math.abs(x - answer) <= Math.max(tolerance * 2, Math.abs(answer) * 0.05)) continue;
    if (answer > 0 && x <= 0) continue;
    const f = fmt(x); if (seen.has(f)) continue;
    seen.add(f); wrong.push(f);
  }
  for (let k = 1; wrong.length < 3; k++) { const f = fmt(answer + k * 7); if (!seen.has(f)) { seen.add(f); wrong.push(f); } }
  const pos = hash(seed) % 4;
  const options = [...wrong]; options.splice(pos, 0, right);
  return { options, index: pos };
}
const shuffle = <T,>(arr: T[], seed: string) => arr.map((v, i) => ({ v, h: hash(`${seed}:${i}`) })).sort((a, b) => a.h - b.h).map((x) => x.v);

/** Reconstruit la question d'un élément de séance (déterministe : la bonne réponse n'est jamais stockée dans la vue) */
export function buildQuestion(it: TItem): TQ | null {
  if (it.k === "lesson") {
    const l = LESSON_BY_ID[it.id]; if (!l) return null;
    const card = { term: l.term, definition: l.definition, simple: l.simple, example: l.example, application: l.application, level: l.level };
    const ex = l.exercise;
    if (ex.kind === "qcm") return { kind: "qcm", label: "Fiche et exercice", prompt: ex.question, options: ex.options, answer: ex.answer, explain: ex.correction, branch: l.branch, card };
    const nq = numericOptions(ex.answer, ex.tolerance, ex.unit, `lesson:${l.id}`);
    return { kind: "qcm", label: "Fiche et exercice", prompt: ex.question, options: nq.options, answer: nq.index, explain: ex.correction, branch: l.branch, card };
  }
  if (it.k === "def") {
    const l = LESSON_BY_ID[it.id]; if (!l) return null;
    const seed = String(it.seed ?? 0);
    const others = shuffle(LESSONS.filter((x) => x.id !== l.id), `${it.id}:${seed}`).sort((a, b) => Number(b.branch === l.branch) - Number(a.branch === l.branch)).slice(0, 3);
    const explain = `${l.term} : ${l.definition} Exemple : ${l.example}`;
    if (hash(`${it.id}:${seed}`) % 2 === 0) {
      const opts = shuffle([l, ...others], `${seed}:d`);
      return { kind: "qcm", label: "Définition", prompt: `Quelle est la définition de « ${l.term} » ?`, options: opts.map((x) => x.definition), answer: opts.indexOf(l), explain, branch: l.branch };
    }
    const opts = shuffle([l, ...others], `${seed}:t`);
    return { kind: "qcm", label: "Définition", prompt: `Quel terme correspond à cette définition : « ${l.definition} » ?`, options: opts.map((x) => x.term), answer: opts.indexOf(l), explain, branch: l.branch };
  }
  if (it.k === "calc") {
    const [fam, seed] = it.id.split(":").map(Number);
    const q = genQuestion(fam, seed);
    return { kind: "qcm", label: "Calcul", prompt: q.q, options: q.options, answer: q.correct, explain: q.explain, branch: "maths" };
  }
  const q = quizById(it.id); if (!q) return null;
  const br = q.cat === "macro" || q.cat === "histoire" ? "macro" : q.cat === "assurance" ? "risque" : q.cat === "finance" ? "marches" : "analyse";
  return { kind: "qcm", label: "Culture", prompt: q.q, options: q.options, answer: q.correct, explain: q.explain, branch: br };
}

/** Choix des questions : leçons pas encore validées de la compétence ciblée d'abord, puis définitions, calculs et culture */
/** Une séance de formation par jour de jeu */
export function trainedToday(s: GameState) { return s.life?.trainDay === dayIndex(s.t); }
export function startTraining(s: GameState, hours: number, subject: SkillBranch | "auto" | "erreurs") {
  const l = s.life!;
  if (l.training && !l.training.done) return { ok: false as const, error: "Terminez d'abord votre séance de formation en cours (ou fermez-la)." };
  const stats = l.trainStats ?? { sessions: 0, perfect: 0, correct: 0, total: 0 };
  const rnd = mulberry(hash(`${s.seed}:train:${dayIndex(s.t)}:${stats.sessions}`));
  let branch: SkillBranch;
  if (subject === "auto" || subject === "erreurs") { const byXp = [...TRAIN_BRANCHES].sort((a, b) => s.skills[a] - s.skills[b] || hash(a + s.seed) - hash(b + s.seed)); branch = byXp[0]; }
  else branch = subject;
  const done = new Set(s.learning.completed);
  const inBranch = LESSONS.filter((x) => x.branch === branch);
  const lvl = skillLevel(s.skills[branch]);
  const fresh = inBranch.filter((x) => !done.has(x.id) && x.level <= lvl + 2).sort((a, b) => a.level - b.level);
  const freshAny = LESSONS.filter((x) => !done.has(x.id)).sort((a, b) => a.level - b.level);
  const used = new Set<string>();
  const items: TItem[] = [];
  const quizPool = QUIZ_BANK.filter((q) => (QUIZ_CATS[branch] ?? []).includes(q.cat)).map((q) => q.id);
  // 2 à 5 questions : 1 h → 2 questions … 4 h → 5 questions, selon le schéma leçon, définition, calcul, leçon, définition
  const count = Math.max(MIN_Q, Math.min(MAX_Q, hours + 1));
  const PATTERN: ("lesson" | "def" | "calc")[] = ["lesson", "def", "calc", "lesson", "def"];
  for (let h = 0; h < count; h++) {
    const kind = PATTERN[h];
    if (kind === "lesson") {
      // une leçon (fiche + exercice) : nouvelle de préférence ; sinon une question de culture de la même matière ; sinon révision
      let lesson: Lesson | undefined = fresh.find((x) => !used.has(x.id));
      if (!lesson) {
        const qid = quizPool.filter((id) => !used.has(id) && !(s.quiz?.done[id] === 1)).sort((a, b) => hash(a + s.seed + h) - hash(b + s.seed + h))[0];
        if (qid) { used.add(qid); items.push({ k: "quiz", id: qid }); continue; }
        lesson = freshAny.find((x) => !used.has(x.id)) ?? inBranch.filter((x) => !used.has(x.id)).sort((a, b) => hash(a.id + s.seed + h) - hash(b.id + s.seed + h))[0];
      }
      if (lesson) { used.add(lesson.id); items.push({ k: "lesson", id: lesson.id }); continue; }
    }
    if (kind === "calc") {
      const fam = Math.floor(rnd() * GEN_FAMILIES);
      items.push({ k: "calc", id: `${fam}:${Math.floor(rnd() * 1e6) + 1}` });
      continue;
    }
    // définition (de la même matière, hors fiches déjà utilisées)
    const poolDef = (inBranch.length > 3 ? inBranch : LESSONS).filter((x) => !used.has("d:" + x.id));
    const def = poolDef.sort((a, b) => hash(a.id + s.seed + h + stats.sessions) - hash(b.id + s.seed + h + stats.sessions))[0] ?? LESSONS[0];
    used.add("d:" + def.id);
    items.push({ k: "def", id: def.id, seed: Math.floor(rnd() * 1e6) });
  }
  // Séance de révision : on reprend d'abord les questions déjà ratées (les plus ratées et les plus récentes d'abord), complétées au besoin par de nouvelles questions
  let finalItems = items;
  if (subject === "erreurs") {
    const rev: TItem[] = unresolved(s).sort((a, b) => b.count - a.count || b.t - a.t).slice(0, count).map((e) => ({ ...e.item!, rev: true }));
    const seen = new Set(rev.map((it) => keyOf(it)));
    finalItems = [...rev, ...items.filter((it) => !seen.has(keyOf(it)))].slice(0, count);
  }
  l.training = { id: nextId(s, "train"), startT: s.t, hours, subject: branch, ...(subject === "erreurs" ? { revision: true } : {}), items: finalItems, answers: [] };
  l.trainDay = dayIndex(s.t);
  return { ok: true as const, branch, count: items.length };
}

/** Répond à la question suivante de la séance (dans l'ordre) */
export function answerTraining(s: GameState, index: number, input: { choice?: number; value?: number }) {
  const l = s.life; const tr = l?.training;
  if (!l || !tr) return { ok: false as const, error: "Aucune séance de formation en cours." };
  if (tr.done) return { ok: false as const, error: "Cette séance est terminée." };
  if (index !== tr.answers.length) return { ok: false as const, error: "Répondez aux questions dans l'ordre." };
  const it = tr.items[index]; const q = buildQuestion(it);
  if (!q) return { ok: false as const, error: "Question introuvable." };
  let ok: boolean; let value: number | undefined;
  if (q.kind === "qcm") { if (!Number.isInteger(input.choice) || input.choice! < 0 || input.choice! >= q.options!.length) return { ok: false as const, error: "Réponse invalide." }; ok = input.choice === q.answer; value = input.choice; }
  else { if (typeof input.value !== "number" || !Number.isFinite(input.value)) return { ok: false as const, error: "Entrez un nombre." }; ok = Math.abs(input.value - q.answer) <= (q.tolerance ?? 0); value = input.value; }
  let xp = 0;
  if (it.k === "lesson") {
    const les = LESSON_BY_ID[it.id];
    s.learning.attempts[les.id] = (s.learning.attempts[les.id] ?? 0) + 1;
    if (ok) {
      if (!s.learning.completed.includes(les.id)) { s.learning.completed.push(les.id); xp = 30 * les.level; gainXp(s, les.branch, xp, `Formation : ${les.term}`); }
      else { xp = 6; gainXp(s, les.branch, xp, `Révision : ${les.term}`); }
    }
  } else if (ok) {
    xp = it.k === "quiz" ? 5 * (quizById(it.id)?.level ?? 1) : 8;
    gainXp(s, q.branch, xp, it.k === "calc" ? `Séance : calcul ${it.id.split(":")[0]}` : it.k === "def" ? `Séance : ${LESSON_BY_ID[it.id].term}` : `Séance : culture ${it.id}`);
  }
  tr.answers.push({ ok, value });
  const plain: TItem = { k: it.k, id: it.id, ...(it.seed !== undefined ? { seed: it.seed } : {}) };
  if (!ok) recordMistake(s, { item: plain, kind: q.label, title: q.prompt, text: q.explain, yours: q.kind === "qcm" ? q.options?.[value as number] : undefined, from: "formation" });
  else markFixed(s, plain);
  let finished: TDone | undefined;
  if (tr.answers.length === tr.items.length) finished = finalize(s);
  return { ok: true as const, data: { ok, answer: q.kind === "qcm" ? q.answer : q.answer, explain: q.explain, xp, finished } };
}
type TDone = { correct: number; total: number; bonusXp: number; trust: number };
function finalize(s: GameState): TDone {
  const l = s.life!; const tr = l.training!;
  const correct = tr.answers.filter((a) => a.ok).length, total = tr.items.length;
  const score = correct / total;
  const st = (l.trainStats ??= { sessions: 0, perfect: 0, correct: 0, total: 0 });
  st.sessions++; st.correct += correct; st.total += total; if (correct === total) st.perfect++;
  let bonusXp = 0, trust = 0;
  if (score >= 0.8) {
    bonusXp = 6 * tr.hours + (correct === total ? 6 : 0);
    gainXp(s, tr.subject, bonusXp, "Séance de formation réussie");
    trust = 0.8 * tr.hours; changeTrust(s, "boss", trust, "Soirées de formation");
    changeRep(s, "professionnelle", tr.hours >= 2 ? 1 : 0.5);
    notify(s, "succes", `Séance de formation réussie (${correct}/${total})`, `Votre responsable remarque votre investissement : +${bonusXp} XP en ${tr.subject}.`, "/play/planning");
  } else {
    notify(s, "info", `Séance de formation terminée (${correct}/${total})`, "Relisez les corrections dans votre carnet de formation : les erreurs sont les meilleures leçons.", "/play/planning");
  }
  tr.done = { correct, total, bonusXp, trust };
  return tr.done;
}
export function closeTraining(s: GameState) {
  const l = s.life;
  if (!l?.training) return { ok: false as const, error: "Aucune séance à fermer." };
  l.training = undefined;
  return { ok: true as const };
}

/** Vue de la séance (page Planning) : état, et corrections une fois les questions traitées ; jamais la bonne réponse avant d'avoir répondu */
export function trainingView(s: GameState) {
  const l = s.life; const tr = l?.training;
  if (!l || !tr) return null;
  return {
    id: tr.id, hours: tr.hours, subject: tr.subject, revision: !!tr.revision, count: tr.items.length, answered: tr.answers.length, done: tr.done ?? null, meetingActive: !!s.activeMeetingId && s.meetings.find((m) => m.id === s.activeMeetingId)?.templateId === "formation_n1",
    items: tr.items.map((it, i) => {
      const q = buildQuestion(it)!; const a = tr.answers[i];
      return { i, label: q.label, prompt: q.prompt, result: a ? { ok: a.ok, explain: q.explain } : null };
    }),
  };
}
export function notebookView(s: GameState) {
  const l = s.life;
  return {
    notes: (l?.notebook ?? []).slice(0, 20),
    unresolved: l ? unresolved(s).length : 0,
    lessons: s.learning.completed.map((id) => LESSON_BY_ID[id]).filter(Boolean).map((x) => ({ id: x.id, term: x.term, simple: x.simple, example: x.example, application: x.application, branch: x.branch })),
    totalLessons: LESSONS.length,
    stats: l?.trainStats ?? { sessions: 0, perfect: 0, correct: 0, total: 0 },
  };
}
