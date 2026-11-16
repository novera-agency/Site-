/**
 * « Point culture » : chaque jour ouvré, le responsable (N+1) pose quelques questions de culture économique et financière pour
 * développer vos connaissances et vérifier que vous maîtrisez les bases. Il commence par vos deux questions du jour ; tant que vous
 * n'avez pas donné 2 bonnes réponses, il en pose d'autres, plus simples ou sur le même thème, sans dépasser 5 questions.
 */
import type { GameState } from "./types";
import { registerMeeting, type MeetingCtx, type MeetingNode, type Choice } from "./meetingEngine";
import { answerQuiz, quizBatch, quizById, quizToday, quizAvailable, quizState, QUIZ_BANK, type QuizQ } from "./quiz";
import { genQuestion, GEN_FAMILIES } from "./quizGen";
import { changeTrust } from "./core";
import { dayIndex } from "./time";

export const CULTURE_MIN = 2, CULTURE_MAX = 5;
const bossName = (c: MeetingCtx) => c.s.npcs.boss?.name ?? "Votre responsable";
const ids = (vars: Record<string, number | string>) => String(vars.ids ?? "").split("|").filter(Boolean);
const qAt = (vars: Record<string, number | string>, i: number): QuizQ | undefined => { const id = ids(vars)[i]; return id ? quizById(id) : undefined; };
const OK = ["Exactement.", "C'est ça.", "Très bien.", "Bonne réponse.", "Parfait."];
const KO = ["Pas tout à fait.", "Non, pas celle-là.", "Attention, c'est une base.", "Ce n'est pas ça."];
const THEME: Record<string, string> = { micro: "de microéconomie", macro: "de macroéconomie", finance: "de finance de marché", histoire: "d'histoire financière", calcul: "de calcul", assurance: "d'assurance", immobilier: "d'immobilier" };

export function cultureLabel(vars: Record<string, number | string>, nodeId: string, id: string): string {
  return qAt(vars, Number(nodeId.slice(1)))?.options[Number(id.slice(1))] ?? "";
}

/** Questions de départ : les deux questions du jour non encore traitées, complétées au besoin par des questions de culture */
function initialIds(s: GameState): string[] {
  const st = quizState(s);
  const today = quizToday(s);
  const out = today.ids.filter((id) => !today.answered.includes(id) && quizById(id));
  for (const q of quizBatch(s, "mix", 4)) { if (out.length >= CULTURE_MIN) break; if (!out.includes(q.id)) out.push(q.id); }
  void st;
  return out.slice(0, CULTURE_MIN);
}
/** Question de rattrapage : même thème que celle ratée, niveau égal ou inférieur (les bases d'abord) ; à défaut, une base d'un autre thème ou un calcul */
function followUp(s: GameState, used: string[], missed?: QuizQ): string {
  const pool = QUIZ_BANK.filter((q) => !used.includes(q.id) && quizAvailable(s, q.id));
  const rank = (q: QuizQ) => (missed && q.cat === missed.cat && q.level <= missed.level ? 0 : q.level === 1 ? 1 : 2) * 10 + q.level;
  const hit = pool.filter((q) => rank(q) < 20).sort((a, b) => rank(a) - rank(b) || (a.id < b.id ? -1 : 1))[0];
  if (hit) return hit.id;
  const day = dayIndex(s.t);
  return genQuestion(day % GEN_FAMILIES, day * 7 + used.length + 1).id;
}

const choiceFor = (i: number, k: number): Choice => ({
  id: `c${k}`, label: "",
  requires: (c) => (qAt(c.m.vars, i)?.options.length ?? 0) > k,
  apply: (c) => {
    const id = ids(c.m.vars)[i];
    const q = qAt(c.m.vars, i);
    const r = answerQuiz(c.s, id, k);
    if (!r.ok || !q) { c.m.vars.fb = ""; return; }
    const ok = r.data.correct;
    c.m.vars.asked = i + 1;
    c.m.vars.res = `${c.m.vars.res ? c.m.vars.res + "," : ""}${ok ? 1 : 0}`;
    if (ok) { c.m.vars.right = Number(c.m.vars.right ?? 0) + 1; c.m.score.communication += 1; }
    else { c.m.vars.wrong = Number(c.m.vars.wrong ?? 0) + 1; c.m.vars.lastWrong = id; }
    c.m.vars.fb = `${ok ? "✔ " + OK[(i + k) % OK.length] : "✘ " + KO[(i + k) % KO.length]} ${r.data.explain}`;
    // Pas encore 2 bonnes réponses : le responsable en pose une autre (jamais plus de 5 au total)
    if (Number(c.m.vars.right) < CULTURE_MIN && i + 1 < CULTURE_MAX && !ids(c.m.vars)[i + 1]) {
      const missed = c.m.vars.lastWrong ? quizById(String(c.m.vars.lastWrong)) : undefined;
      c.m.vars.ids = [...ids(c.m.vars), followUp(c.s, ids(c.m.vars), missed)].join("|");
    }
  },
  reply: (c) => String(c.m.vars.fb ?? ""),
  next: (c) => (Number(c.m.vars.right ?? 0) >= CULTURE_MIN || i + 1 >= CULTURE_MAX || !ids(c.m.vars)[i + 1] ? "end" : `q${i + 1}`),
});

const nodes: Record<string, MeetingNode> = {};
for (let i = 0; i < CULTURE_MAX; i++) {
  nodes[`q${i}`] = {
    speaker: "boss",
    text: (c) => {
      const q = qAt(c.m.vars, i);
      if (!q) return "Reprenons.";
      const opening = i === 0 ? `Point culture du jour, ${c.s.profile.firstName}. Quelques questions pour développer vos connaissances et vérifier que les bases sont acquises : deux bonnes réponses et nous passons à autre chose, et je n'irai pas au-delà de ${CULTURE_MAX} questions. ` : "";
      const retry = i > 0 && Number(c.m.vars.wrong ?? 0) > 0 && Number(c.m.vars.right ?? 0) < CULTURE_MIN ? "Revenons à l'essentiel. " : "";
      const kind = q.cat === "calcul" ? "Un calcul, que vous devez pouvoir faire de tête. " : q.level === 1 ? `Une question de base ${THEME[q.cat] ?? ""}. ` : `Une question ${THEME[q.cat] ?? ""}. `;
      return `${opening}${retry}${kind}${q.q}`;
    },
    choices: [0, 1, 2, 3].map((k) => choiceFor(i, k)),
  };
}
nodes.end = {
  speaker: "boss",
  text: (c) => {
    const right = Number(c.m.vars.right ?? 0), asked = Number(c.m.vars.asked ?? 0), wrong = Number(c.m.vars.wrong ?? 0);
    if (right >= CULTURE_MIN && wrong === 0) return "Les bases sont solides : bravo. À demain pour le prochain point.";
    if (right >= CULTURE_MIN) return `${right} bonnes réponses sur ${asked} : les bases sont là, mais relisez les corrections. À demain.`;
    return `Seulement ${right} bonne${right > 1 ? "s" : ""} réponse${right > 1 ? "s" : ""} sur ${asked} : il faut retravailler les bases. Passez par le quiz d'économie et le centre de formation, on refait le point demain.`;
  },
  end: true,
};

registerMeeting({
  id: "culture_n1", type: "Entretien avec un supérieur", location: "Salle des marchés", title: (c) => `Point culture avec ${bossName(c)}`,
  participants: () => ["boss"], agenda: ["Questions de culture économique et financière", "Corrections", "Bilan"], objectives: [`Donner ${CULTURE_MIN} bonnes réponses`, "Retenir les corrections"],
  readChoices: true,
  init: (c) => {
    // Serveur de test (E2E_HOOKS) : questions imposées, pour des tests déterministes
    const forced = process.env.E2E_HOOKS === "1" ? String(c.m.context?.ids ?? "") : "";
    c.m.vars.ids = forced || initialIds(c.s).join("|"); c.m.vars.replyWho = "boss"; c.m.vars.right = 0; c.m.vars.wrong = 0; c.m.vars.asked = 0; },
  recap: (c) => {
    const res = String(c.m.vars.res ?? "").split(",").filter(Boolean).map(Number);
    const right = Number(c.m.vars.right ?? 0), wrong = Number(c.m.vars.wrong ?? 0);
    const points = res.map((ok, i) => { const q = qAt(c.m.vars, i); return q ? `${ok ? "✔" : "✘"} ${q.q} → ${q.options[q.correct].replace(/[.\s]+$/, "")}. ${q.explain}` : ""; }).filter(Boolean);
    const missed = res.map((ok, i) => (ok ? null : qAt(c.m.vars, i))).filter(Boolean) as QuizQ[];
    const tips = missed.length ? [`À revoir : ${[...new Set(missed.map((q) => THEME[q.cat]?.replace(/^de /, "") ?? q.cat))].join(", ")}. Ces questions reviennent dans le quiz d'économie.`] : ["Les bases sont solides : continuez le quiz d'économie pour monter en niveau."];
    tips.push("Un point culture chaque jour ouvré : 2 bonnes réponses suffisent, 5 questions au maximum.");
    const families = res.map((ok, i) => ({ ok, id: ids(c.m.vars)[i] })).filter((x) => x.id?.startsWith("g:")).sort((a, b) => Number(a.ok) - Number(b.ok)).map((x) => Number(x.id.split(":")[1]));
    return { points, tips, families, verdict: right >= CULTURE_MIN && wrong === 0 ? { label: "Bases solides", tone: "gain" } : right >= CULTURE_MIN ? { label: "Bases acquises", tone: "warn" } : { label: "Bases à retravailler", tone: "loss" }, skipTerms: true, skipDecisions: true };
  },
  start: "q0", nodes,
  conclude: (c) => {
    const right = Number(c.m.vars.right ?? 0), asked = Number(c.m.vars.asked ?? 0), wrong = Number(c.m.vars.wrong ?? 0);
    if (right >= CULTURE_MIN && wrong === 0) changeTrust(c.s, "boss", 0.6, "Bases solides au point culture");
    else if (right < CULTURE_MIN) changeTrust(c.s, "boss", -0.5, "Bases fragiles au point culture");
    return `Point culture : ${right} bonne${right > 1 ? "s" : ""} réponse${right > 1 ? "s" : ""} sur ${asked} question${asked > 1 ? "s" : ""}${right >= CULTURE_MIN ? "" : " · bases à retravailler"}.`;
  },
});
