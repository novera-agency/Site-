/**
 * Progression : un parcours en chapitres qui présente chaque système au moment où il devient utile,
 * des succès à débloquer, un score de carrière et des fins de partie (retraite, faillite personnelle, fortune).
 */
import type { GameState } from "./types";
import { notify, gainXp, avgRep, careerLog } from "./core";
import { wealthOf } from "./wealth";
import { MIN_PER_DAY } from "./time";
import { quizCorrectCount } from "./quiz";

export interface Objective { id: string; label: string; hint: string; link: string; check: (s: GameState) => boolean; }
export interface Chapter { id: string; title: string; intro: string; objectives: Objective[]; reward: { xp: number; text: string }; }

const salesYtd = (s: GameState) => Number(s.flags["salesYtd"] ?? 0);
const leisure = (s: GameState) => (s.life?.log ?? []).filter((l) => !/Facture|Emménagement|Transport|impay/i.test(l.text)).length;
const dailyDone = (s: GameState) => s.missions.filter((m) => m.daily && m.status === "reussie").length;
const fills = (s: GameState) => s.fills.filter((f) => f.account === "perso" || f.account === "desk").length;
const props = (s: GameState) => s.life?.properties ?? [];
const daysPlayed = (s: GameState) => s.stats.daysPlayed;

export const CHAPTERS: Chapter[] = [
  { id: "ch1", title: "Premiers pas", intro: "Votre première semaine : découvrez le bureau, la salle des marchés et vos premières missions.", reward: { xp: 60, text: "La direction remarque votre bonne intégration." },
    objectives: [
      { id: "tuto", label: "Terminer la première journée", hint: "Suivez le guide en haut du bureau jusqu'à l'évaluation de 18 h.", link: "/play", check: (s) => s.tutorial.done },
      { id: "ordre", label: "Passer un premier ordre", hint: "Salle des marchés → un instrument → Acheter.", link: "/play/terminal", check: (s) => fills(s) > 0 },
      { id: "mis3", label: "Réussir 3 missions", hint: "Onglet Missions : commencez par celles à enjeu faible.", link: "/play/missions", check: (s) => s.career.missionsDone >= 3 },
    ] },
  { id: "ch2", title: "Faire ses preuves", intro: "Chaque jour, de nouvelles missions arrivent. Réussissez-les pour gagner la confiance de votre responsable.", reward: { xp: 120, text: "Votre responsable vous confie davantage de responsabilités." },
    objectives: [
      { id: "daily5", label: "Réussir 5 missions du jour", hint: "Elles se rendent avant 18 h 30 ; l'aide 💡 donne les étapes.", link: "/play/missions", check: (s) => dailyDone(s) >= 5 },
      { id: "trust60", label: "Atteindre 60 de confiance avec votre responsable", hint: "Missions réussies, réunions bien menées, limites respectées.", link: "/play/reseau", check: (s) => (s.npcs.boss?.trust ?? 0) >= 60 },
      { id: "review", label: "Obtenir au moins 60/100 à une évaluation", hint: "Évaluation chaque vendredi à 18 h.", link: "/play/carriere", check: (s) => s.career.reviews.some((r) => r.score >= 60) },
    ] },
  { id: "ch3", title: "La relation client", intro: "Vos clients ont chacun leurs demandes. Et votre N+1 vous confie des prospects à démarcher.", reward: { xp: 150, text: "Votre réputation commerciale grandit." },
    objectives: [
      { id: "call", label: "Appeler un client", hint: "Onglet Clients → 📞 Appeler.", link: "/play/clients", check: (s) => s.clients.some((c) => c.history.some((h) => /Appel|téléphone/i.test(h.text))) },
      { id: "collect", label: "Obtenir un premier versement", hint: "Écoutez la demande du client, proposez une solution adaptée, évitez les fautes.", link: "/play/clients", check: (s) => salesYtd(s) > 0 },
      { id: "prospect", label: "Démarcher un prospect", hint: "Clients → section Prospection.", link: "/play/clients", check: (s) => (s.prospects ?? []).some((p) => p.attempts > 0) },
    ] },
  { id: "ch4", title: "Une vie à côté", intro: "Le travail ne fait pas tout : santé mentale, amis, loisirs… et les factures qui tombent chaque mois.", reward: { xp: 100, text: "Un esprit sain dans un corps sain." },
    objectives: [
      { id: "fun5", label: "Faire 5 activités de loisirs", hint: "Vie perso → Vie privée : sorties, sport, famille…", link: "/play/vie", check: (s) => leisure(s) >= 5 },
      { id: "mental", label: "Tenir 2 mois avec une santé mentale ≥ 50", hint: "Alternez travail et repos ; évitez les découverts.", link: "/play/vie", check: (s) => daysPlayed(s) >= 60 && (s.life?.mental ?? 0) >= 50 },
      { id: "epargne", label: "Avoir 3 mois de dépenses d'avance", hint: "Gardez du cash : loyer, factures, imprévus.", link: "/play/vie", check: (s) => !!s.life && (s.life.budget[0]?.bills ?? 0) > 0 && wealthOf(s).cash >= 3 * (s.life.budget[0]?.bills ?? 0) },
    ] },
  { id: "ch5", title: "Ambition", intro: "Faites reconnaître votre valeur : négociez, progressez, visez la promotion.", reward: { xp: 200, text: "Vous êtes désormais vu comme un talent à fidéliser." },
    objectives: [
      { id: "nego", label: "Négocier avec votre responsable", hint: "Vie privée → 🤝 Demander un rendez-vous pour négocier.", link: "/play/vie", check: (s) => s.life?.lastRaiseAskT !== undefined },
      { id: "promo", label: "Obtenir une promotion", hint: "Les promotions se décident aux revues trimestrielles.", link: "/play/carriere", check: (s) => s.career.rank >= 2 },
      { id: "clients4", label: "Gérer 4 clients", hint: "Démarchez les prospects confiés par votre N+1.", link: "/play/clients", check: (s) => s.clients.filter((c) => !c.lost).length >= 4 },
    ] },
  { id: "ch6", title: "Investisseur", intro: "Faites travailler votre argent : bourse et immobilier locatif.", reward: { xp: 200, text: "Votre patrimoine commence à travailler pour vous." },
    objectives: [
      { id: "bien", label: "Acheter un bien locatif", hint: "Vie perso → Investissement immobilier.", link: "/play/immobilier", check: (s) => props(s).length > 0 },
      { id: "loue", label: "Le louer", hint: "Fixez un loyer proche du marché.", link: "/play/immobilier", check: (s) => props(s).some((p) => p.status === "loue") },
      { id: "w100", label: "Atteindre 100 000 € de patrimoine", hint: "Épargne, placements, immobilier.", link: "/play/patrimoine", check: (s) => wealthOf(s).total >= 100_000 },
    ] },
  { id: "ch7", title: "Bâtisseur", intro: "Vous changez de dimension : responsabilités, clientèle, patrimoine.", reward: { xp: 300, text: "On parle de vous dans les couloirs de la direction." },
    objectives: [
      { id: "rank4", label: "Atteindre le grade 4", hint: "Évaluations régulières au-dessus de 70.", link: "/play/carriere", check: (s) => s.career.rank >= 4 },
      { id: "w500", label: "Atteindre 500 000 € de patrimoine", hint: "Diversifiez, réinvestissez les loyers.", link: "/play/patrimoine", check: (s) => wealthOf(s).total >= 500_000 },
      { id: "rep70", label: "Réputation moyenne ≥ 70", hint: "Conformité, fiabilité, clients satisfaits.", link: "/play/reputation", check: (s) => avgRep(s) >= 70 },
    ] },
  { id: "ch8", title: "Le sommet", intro: "La dernière marche : diriger, ou bâtir votre propre empire.", reward: { xp: 500, text: "Vous êtes au sommet de la finance." },
    objectives: [
      { id: "top", label: "Devenir Managing Director (grade 6) ou fonder une société", hint: "Carrière ou entrepreneuriat.", link: "/play/carriere", check: (s) => s.career.rank >= 6 || !!s.company },
      { id: "w2m", label: "Atteindre 2 millions d'euros de patrimoine", hint: "Le temps et la discipline font le reste.", link: "/play/patrimoine", check: (s) => wealthOf(s).total >= 2_000_000 },
    ] },
];

// ───────────── Succès ─────────────
export interface Achievement { id: string; title: string; desc: string; icon: string; secret?: boolean; check: (s: GameState) => boolean; }
export const ACHIEVEMENTS: Achievement[] = [
  { id: "eco10", title: "Curieux", desc: "Réussir 10 questions du quiz d'économie.", icon: "💡", check: (s) => quizCorrectCount(s) >= 10 },
  { id: "eco30", title: "Esprit éclairé", desc: "Réussir 30 questions du quiz d'économie.", icon: "🎓", check: (s) => quizCorrectCount(s) >= 30 },
  { id: "eco100", title: "Érudit", desc: "Réussir 100 questions du quiz d'économie.", icon: "📚", check: (s) => quizCorrectCount(s) >= 100 },
  { id: "eco_jours7", title: "Rendez-vous quotidien", desc: "Répondre aux deux questions du jour 7 fois d'affilée.", icon: "📅", check: (s) => (s.quiz?.dailyBest ?? 0) >= 7 },
  { id: "eco_jours30", title: "Rituel", desc: "Répondre aux deux questions du jour 30 fois d'affilée.", icon: "🗓️", check: (s) => (s.quiz?.dailyBest ?? 0) >= 30 },
  { id: "eco_serie", title: "Sans faute", desc: "Enchaîner 8 bonnes réponses d'affilée au quiz d'économie.", icon: "🔥", check: (s) => (s.quiz?.best ?? 0) >= 8 },
  { id: "first_trade", title: "Baptême du feu", desc: "Passer son premier ordre.", icon: "🎯", check: (s) => fills(s) > 0 },
  { id: "missions10", title: "Fiable", desc: "Réussir 10 missions.", icon: "✅", check: (s) => s.career.missionsDone >= 10 },
  { id: "missions50", title: "Machine de guerre", desc: "Réussir 50 missions.", icon: "🏅", check: (s) => s.career.missionsDone >= 50 },
  { id: "high_stakes", title: "Sang-froid", desc: "Réussir une mission à fort enjeu.", icon: "🔴", check: (s) => s.missions.some((m) => m.daily && m.stakes === 3 && m.status === "reussie") },
  { id: "promo1", title: "Premier galon", desc: "Obtenir une promotion.", icon: "⬆️", check: (s) => s.career.rank >= 2 },
  { id: "md", title: "Managing Director", desc: "Atteindre le grade 6.", icon: "👔", check: (s) => s.career.rank >= 6 },
  { id: "raise", title: "Ça se négocie", desc: "Obtenir une augmentation en négociant.", icon: "💶", check: (s) => s.decisions.some((d) => /Augmentation négociée/.test(d.text)) },
  { id: "first_client", title: "Chasseur", desc: "Gagner un client par la prospection.", icon: "🎣", check: (s) => Number(s.flags["prospectsWon"] ?? 0) >= 1 },
  { id: "five_clients", title: "Carnet d'adresses", desc: "Gagner 5 clients par la prospection.", icon: "📇", check: (s) => Number(s.flags["prospectsWon"] ?? 0) >= 5 },
  { id: "sales1m", title: "Million collecté", desc: "Collecter 1 million d'euros auprès des clients.", icon: "💰", check: (s) => salesYtd(s) >= 1_000_000 },
  { id: "landlord", title: "Propriétaire bailleur", desc: "Louer un bien immobilier.", icon: "🔑", check: (s) => props(s).some((p) => p.status === "loue") },
  { id: "portfolio3", title: "Petit empire immobilier", desc: "Posséder 3 biens locatifs.", icon: "🏘️", check: (s) => props(s).length >= 3 },
  { id: "homeowner", title: "Chez soi", desc: "Acheter sa résidence principale.", icon: "🏠", check: (s) => !!s.life?.housing.owned },
  { id: "w100k", title: "Six chiffres", desc: "100 000 € de patrimoine.", icon: "📈", check: (s) => wealthOf(s).total >= 100_000 },
  { id: "w1m", title: "Millionnaire", desc: "1 million d'euros de patrimoine.", icon: "💎", check: (s) => wealthOf(s).total >= 1_000_000 },
  { id: "w10m", title: "Fortune", desc: "10 millions d'euros de patrimoine.", icon: "👑", check: (s) => wealthOf(s).total >= 10_000_000 },
  { id: "zen", title: "Zen", desc: "Santé mentale ≥ 90.", icon: "🧘", check: (s) => (s.life?.mental ?? 0) >= 90 },
  { id: "athlete", title: "Athlète", desc: "Forme physique ≥ 90.", icon: "🏃", check: (s) => (s.life?.physique ?? 0) >= 90 },
  { id: "couple", title: "Coup de foudre", desc: "Vivre une histoire d'amour.", icon: "❤️", check: (s) => !!s.life?.partner },
  { id: "parent", title: "Jeune parent", desc: "Avoir un enfant.", icon: "👶", check: (s) => (s.life?.children ?? 0) > 0 },
  { id: "learner", title: "Éternel étudiant", desc: "Valider 10 modules de formation.", icon: "🎓", check: (s) => s.learning.completed.length >= 10 },
  { id: "entrepreneur", title: "Entrepreneur", desc: "Créer sa société.", icon: "🚀", check: (s) => !!s.company },
  { id: "crisis", title: "Survivant", desc: "Traverser une crise financière en restant en poste.", icon: "🛡️", check: (s) => s.crises.some((c) => c.resolved) && s.career.employed },
  { id: "burnout", title: "Le mur", desc: "Faire un burn-out… à éviter.", icon: "🔥", secret: true, check: (s) => !!s.career.history.find((h) => /épuisement/.test(h.text)) },
  { id: "evicted", title: "À la rue", desc: "Se faire expulser pour impayés.", icon: "🏚️", secret: true, check: (s) => !!s.life?.log.find((l) => /Expulsé/.test(l.text)) },
  { id: "dot_com", title: "Rescapé de la bulle", desc: "Mode historique : être encore en poste fin 2002.", icon: "💻", check: (s) => !!s.historical && s.career.employed && s.t >= (1095 * MIN_PER_DAY) },
  { id: "lehman", title: "Septembre 2008", desc: "Mode historique : traverser la faillite de Lehman Brothers en poste.", icon: "🏦", check: (s) => !!s.historical && s.career.employed && s.t >= (3240 * MIN_PER_DAY) },
];

// ───────────── Score et fins ─────────────
export function careerScore(s: GameState) {
  const w = wealthOf(s).total;
  const wealthPts = Math.round(Math.max(0, Math.log10(Math.max(1, w / 10000))) * 120);
  const rankPts = s.career.rank * 60;
  const repPts = Math.round(avgRep(s) * 2);
  const achPts = (s.progress?.achievements.length ?? 0) * 25;
  const lifePts = s.life ? Math.round((s.life.mental + s.life.physique + s.life.social + s.life.fun) / 4) : 50;
  const chapPts = (s.progress?.chapters.length ?? 0) * 40;
  return { total: wealthPts + rankPts + repPts + achPts + lifePts + chapPts, parts: { patrimoine: wealthPts, carriere: rankPts, reputation: repPts, succes: achPts, equilibre: lifePts, parcours: chapPts } };
}
export type EndingId = "retraite" | "faillite" | "fortune";
export const ENDINGS: Record<EndingId, { title: string; text: string }> = {
  retraite: { title: "Une retraite bien méritée", text: "Vous quittez la finance la tête haute. Il est temps de profiter de la vie." },
  faillite: { title: "Faillite personnelle", text: "Les dettes ont eu raison de vous. La banque de France ouvre un dossier de surendettement." },
  fortune: { title: "Empire bâti", text: "Avec plus de 50 millions d'euros, vous n'avez plus besoin de travailler. Votre empire est bâti." },
};
/** Fin choisie (retraite) ou subie (faillite) ; la fortune est proposée, pas imposée */
export function endingAvailable(s: GameState): EndingId[] {
  const out: EndingId[] = [];
  const age = s.profile.age + daysPlayed(s) / 365;
  if (age >= 55 || wealthOf(s).total >= 2_000_000) out.push("retraite");
  if (wealthOf(s).total >= 50_000_000) out.push("fortune");
  return out;
}
export function endGame(s: GameState, id: EndingId) {
  if (s.ended) return { ok: false as const, error: "Partie déjà terminée." };
  const sc = careerScore(s);
  s.ended = { id, t: s.t, score: sc.total };
  s.paused = true; s.pauseReason = ENDINGS[id].title;
  careerLog(s, `Fin de partie : ${ENDINGS[id].title} (score ${sc.total})`);
  return { ok: true as const, message: `${ENDINGS[id].title} — score final ${sc.total}.` };
}

// ───────────── Vérification ─────────────
export function initProgress(s: GameState) { s.progress ??= { chapters: [], objectives: [], achievements: [] }; return s.progress; }
export function currentChapter(s: GameState) { const p = initProgress(s); return CHAPTERS.find((c) => !p.chapters.includes(c.id)) ?? null; }
export function checkProgress(s: GameState, daily = false) {
  if (s.mode !== "carriere" || s.ended) return;
  const p = initProgress(s);
  // Chapitre en cours : objectifs dans l'ordre libre, chapitre validé quand tout est fait
  const ch = currentChapter(s);
  if (ch) {
    for (const o of ch.objectives) if (!p.objectives.includes(o.id) && o.check(s)) { p.objectives.push(o.id); notify(s, "succes", `Objectif atteint : ${o.label}`, `Chapitre « ${ch.title} »`, "/play/parcours"); }
    if (ch.objectives.every((o) => p.objectives.includes(o.id))) {
      p.chapters.push(ch.id);
      gainXp(s, "management", ch.reward.xp, `Chapitre terminé : ${ch.title}`);
      const next = currentChapter(s);
      notify(s, "succes", `Chapitre terminé : ${ch.title}`, `${ch.reward.text}${next ? ` Prochain chapitre : « ${next.title} ».` : " Vous avez terminé le parcours !"}`, "/play/parcours");
      careerLog(s, `Chapitre terminé : ${ch.title}`);
    }
  }
  for (const a of ACHIEVEMENTS) if (!p.achievements.includes(a.id) && a.check(s)) { p.achievements.push(a.id); notify(s, "succes", `🏆 Succès débloqué : ${a.title}`, a.desc, "/play/parcours"); }
  if (!daily) return;
  // Faillite personnelle : dettes massives durables
  const w = wealthOf(s);
  if (w.cash < -Math.max(30000, w.total < 0 ? 0 : 30000)) { s.flags["debtDays"] = Number(s.flags["debtDays"] ?? 0) + 1; if (Number(s.flags["debtDays"]) === 60) notify(s, "critique", "Surendettement", "Votre compte est lourdement débiteur depuis deux mois. Encore deux mois et c'est la faillite personnelle.", "/play/vie"); if (Number(s.flags["debtDays"]) >= 120) endGame(s, "faillite"); }
  else s.flags["debtDays"] = 0;
}
