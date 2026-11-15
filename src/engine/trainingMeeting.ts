/**
 * Réunion « Séance de formation » : le N+1 (le responsable) pose lui-même les questions de la séance issue des heures supplémentaires,
 * rappelle la notion avant de la tester, corrige chaque réponse à voix haute et conclut par un bilan.
 * Chaque question est un QCM (les questions chiffrées proposent des ordres de grandeur) pour pouvoir y répondre à l'oral comme à l'écrit.
 */
import type { GameState } from "./types";
import { registerMeeting, type MeetingCtx, type MeetingNode, type Choice, type Doc } from "./meetingEngine";
import { answerTraining, buildQuestion, startTraining, type TQ } from "./training";

const MAX_Q = 12;
const bossName = (c: MeetingCtx) => c.s.npcs.boss?.name ?? "Votre responsable";
const session = (s: GameState) => s.life?.training;
const q = (c: MeetingCtx, i: number): TQ | null => { const t = session(c.s); return t && t.items[i] ? buildQuestion(t.items[i]) : null; };
const OK = ["Exactement.", "C'est ça.", "Très bien.", "Bonne réponse.", "Parfait."];
const KO = ["Pas tout à fait.", "Non, pas celle-là.", "Attention, c'est une erreur classique.", "Ce n'est pas ça."];
const pickLine = (arr: string[], seed: number) => arr[seed % arr.length];

/** Libellé d'une réponse (appelé par le moteur de réunions pour construire les choix de chaque question) */
export function trainingLabel(s: GameState, nodeId: string, id: string): string {
  const i = Number(nodeId.slice(1));
  const t = session(s);
  const tq = t && t.items[i] ? buildQuestion(t.items[i]) : null;
  return tq?.options?.[Number(id.slice(1))] ?? "";
}

function intro(c: MeetingCtx, i: number, tq: TQ) {
  const t = session(c.s)!;
  const it = t.items[i];
  const opening = i === Number(c.m.vars.first ?? 0) ? `${c.s.profile.firstName}, vous restez tard : profitons-en pour travailler les fondamentaux. ${t.items.length - i} question${t.items.length - i > 1 ? "s" : ""}, je corrige au fur et à mesure. ` : "";
  if (it.k === "lesson" && tq.card) {
    const k = tq.card;
    return `${opening}Reprenons la notion de « ${k.term} ». ${k.definition} En clair : ${k.simple} Exemple : ${k.example} À quoi ça sert : ${k.application} Question : ${tq.prompt}`;
  }
  if (it.k === "def") return `${opening}Une question de vocabulaire, indispensable en salle. ${tq.prompt}`;
  if (it.k === "calc") return `${opening}Un petit calcul, que vous devez pouvoir faire de tête. ${tq.prompt}`;
  return `${opening}Un peu de culture générale. ${tq.prompt}`;
}

const choiceFor = (i: number, k: number): Choice => ({
  id: `c${k}`, label: "",
  requires: (c) => (q(c, i)?.options?.length ?? 0) > k,
  apply: (c) => {
    const r = answerTraining(c.s, i, { choice: k });
    if (!r.ok) { c.m.vars.fb = ""; return; }
    const ok = r.data.ok;
    if (ok) c.m.score.communication += 1;
    c.m.vars.right = Number(c.m.vars.right ?? 0) + (ok ? 1 : 0);
    c.m.vars.fb = `${ok ? "✔ " + pickLine(OK, i + k) : "✘ " + pickLine(KO, i + k)} ${r.data.explain}`;
  },
  reply: (c) => String(c.m.vars.fb ?? ""),
  next: (c) => { const t = session(c.s); return t && i + 1 < t.items.length ? `q${i + 1}` : "end"; },
});

const nodes: Record<string, MeetingNode> = {};
for (let i = 0; i < MAX_Q; i++) {
  nodes[`q${i}`] = {
    speaker: "boss",
    text: (c) => { const tq = q(c, i); return tq ? intro(c, i, tq) : "Reprenons."; },
    choices: [0, 1, 2, 3].map((k) => choiceFor(i, k)),
  };
}
nodes.end = {
  speaker: "boss",
  text: (c) => {
    const t = session(c.s);
    const done = t?.done;
    if (!done) return "On s'arrête là pour ce soir.";
    const pct = done.correct / done.total;
    return pct >= 0.8 ? `${done.correct} sur ${done.total} : c'est du sérieux. Continuez à vous former, ça se verra dans votre travail.`
      : pct >= 0.5 ? `${done.correct} sur ${done.total}. C'est un début ; relisez les corrections dans votre carnet de formation et on refera le point.`
      : `${done.correct} sur ${done.total}. Il faut reprendre les bases : reprenez les fiches du centre de formation, puis on s'y remet.`;
  },
  end: true,
};

registerMeeting({
  id: "formation_n1", type: "Entretien avec un supérieur", location: "Bureau du responsable (en soirée)", title: (c) => `Séance de formation avec ${bossName(c)}`,
  participants: () => ["boss"], agenda: ["Rappel des notions", "Questions et corrections", "Bilan"], objectives: ["Répondre juste", "Retenir les corrections"],
  readChoices: true,
  init: (c) => {
    const l = c.s.life;
    if (!l) return;
    if (!l.training || l.training.done) startTraining(c.s, Math.max(1, Math.min(4, Number(c.m.context?.hours ?? 1))), (c.m.context?.subject as never) ?? "auto");
    const t = l.training!;
    c.m.vars.replyWho = "boss";
    c.m.vars.first = t.answers.length;
    c.m.nodeId = t.answers.length >= t.items.length ? "end" : `q${t.answers.length}`;
  },
  docs: (c): Doc[] => {
    const i = Number(c.m.nodeId.slice(1));
    const tq = c.m.nodeId.startsWith("q") ? q(c, i) : null;
    return tq?.card ? [{ title: `Fiche — ${tq.card.term}`, rows: [["Définition", tq.card.definition], ["En clair", tq.card.simple], ["Exemple", tq.card.example], ["À quoi ça sert", tq.card.application]] }] : [];
  },
  start: "q0", nodes,
  conclude: (c) => {
    const t = session(c.s);
    const d = t?.done;
    return d ? `Séance de formation : ${d.correct}/${d.total}${d.bonusXp ? ` · +${d.bonusXp} XP et la confiance de ${bossName(c)}` : " · révisez le carnet de formation"}.` : "Séance interrompue : vous pourrez la reprendre depuis la page Planning.";
  },
});
