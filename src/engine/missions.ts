/** MissionEngine — modèles de missions paramétrables, critères explicites vérifiés par le moteur. */
import type { GameState, Mission, RepKey, SkillBranch } from "./types";
import { Rng } from "./rng";
import { accountEquity, exposures, valueAtRisk, positionViews } from "./portfolio";
import { bondPriceFromYield } from "./pricing";
import { bondYield } from "./market";
import { changeRep, changeTrust, gainXp, nextId, notify, careerLog } from "./core";
import { equityWeight, suitableEquityBand } from "./clients";
import { dayIndex, MIN_PER_DAY, fmtShortDate } from "./time";

interface Tpl {
  id: string; category: Mission["category"]; xp: number; rep: Partial<Record<RepKey, number>>; days: number;
  make: (s: GameState, p: Record<string, number | string>, rng: Rng) => { title: string; description: string; criteria: string[]; params: Record<string, number | string>; baseline?: Record<string, number> } | null;
  /** renvoie progression 0..1 ; 1 = réussite. -1 = échec immédiat */
  check: (s: GameState, m: Mission) => number;
  quiz?: (s: GameState, m: Mission) => { answer: number; tolerance: number; unit: string; question: string; explain: string };
  choiceQuiz?: (s: GameState, m: Mission) => { question: string; options: string[]; correct: number; explain: string };
}

const pctTxt = (x: number) => `${(x * 100).toFixed(0)} %`;
const TEMPLATES: Tpl[] = [
  { id: "premier_ordre", category: "trading", xp: 30, rep: { fiabilite: 2 }, days: 3,
    make: () => ({ title: "Passer votre premier ordre", description: "Achetez un instrument (action ou ETF) sur votre compte personnel ou sur le book du desk.", criteria: ["Au moins un ordre d'achat exécuté"], params: {} }),
    check: (s, m) => (s.fills.some((f) => f.side === "buy" && f.t >= m.startT && (f.account === "perso" || f.account === "desk")) ? 1 : 0) },
  { id: "analyse_actif", category: "analyse", xp: 40, rep: { professionnelle: 2 }, days: 3,
    make: (s, p, rng) => { const pool = ["MAIS", "NOVX", "TERA", "LUTB", "AERO", "CURA"]; const id = String(p.instrument ?? rng.pick(pool)); return { title: `Analyser ${s.instruments[id].name}`, description: `Ouvrez la fiche de ${id}, étudiez sa valorisation et répondez : son PER actuel est-il supérieur ou inférieur à son PER normatif ?`, criteria: ["Réponse correcte au quiz d'analyse"], params: { instrument: id } }; },
    check: () => 0,
    choiceQuiz: (s, m) => { const id = String(m.params.instrument); const q = s.quotes[id]; const per = q.price / (q.eps ?? 1); const fpe = s.instruments[id].fairPE!; return { question: `Le PER actuel de ${id} (${per.toFixed(1)}) est-il supérieur ou inférieur à son PER normatif ?`, options: ["Supérieur : le titre est relativement cher", "Inférieur : le titre est relativement bon marché"], correct: per > fpe ? 0 : 1, explain: `PER actuel ${per.toFixed(1)} vs normatif ${fpe}. Un PER bas peut aussi refléter un risque ou une croissance faible : il ne suffit pas à conclure.` }; } },
  { id: "vendre_position", category: "trading", xp: 25, rep: {}, days: 7,
    make: () => ({ title: "Clôturer une position et mesurer le résultat", description: "Revendez une position et consultez le P&L réalisé dans l'historique des transactions.", criteria: ["Au moins une vente réduisant une position longue"], params: {} }),
    check: (s, m) => (s.fills.some((f) => f.side === "sell" && f.t >= m.startT && f.realized !== 0) ? 1 : 0) },
  { id: "diversifier", category: "gerant" as never, xp: 60, rep: { risque: 3 }, days: 10,
    make: (s, p) => ({ title: "Construire un portefeuille diversifié", description: "Sur votre compte personnel, détenez au moins 5 lignes réparties sur au moins 3 classes ou secteurs, aucune ligne ne dépassant 30 % du portefeuille.", criteria: ["≥ 5 positions", "≥ 3 secteurs / classes", "Poids maximal ≤ 30 %"], params: { account: String(p.account ?? "perso") } }),
    check: (s, m) => { const acc = String(m.params.account); const v = positionViews(s, acc); const secs = new Set(v.map((x) => x.sector ?? x.cls)); const ex = exposures(s, acc); return (Math.min(1, v.length / 5) + Math.min(1, secs.size / 3) + (ex.largestWeight <= 30 && v.length ? 1 : 0)) / 3; } },
  { id: "reduire_secteur", category: "risque", xp: 50, rep: { risque: 3 }, days: 5,
    make: (s, p) => { const ex = exposures(s, "desk"); const top = Object.entries(ex.sector).sort((a, b) => b[1] - a[1])[0]; if (!top || top[1] < 10) return null; const target = Math.max(5, Math.floor(top[1] * 0.6)); return { title: `Réduire l'exposition au secteur ${top[0]}`, description: `L'exposition du desk au secteur ${top[0]} représente ${top[1].toFixed(0)} % du capital. Ramenez-la sous ${target} %.`, criteria: [`Exposition ${top[0]} < ${target} %`], params: { sector: top[0], target } }; },
    check: (s, m) => { const ex = exposures(s, "desk"); const cur = ex.sector[String(m.params.sector)] ?? 0; return cur < Number(m.params.target) ? 1 : 0; } },
  { id: "couvrir_change", category: "risque", xp: 60, rep: { risque: 3, professionnelle: 2 }, days: 7,
    make: (s) => { const ex = exposures(s, "desk"); const usd = ex.currency.USD ?? 0; if (Math.abs(usd) < 8) return null; return { title: "Couvrir le risque de change USD", description: `Le book du desk est exposé à ${usd.toFixed(0)} % au dollar. Ramenez l'exposition nette USD sous 5 % (par exemple en vendant de l'USD à terme via EURUSD).`, criteria: ["|Exposition nette USD| < 5 %"], params: {} }; },
    check: (s) => (Math.abs(exposures(s, "desk").currency.USD ?? 0) < 5 ? 1 : 0) },
  { id: "rendement_obligation", category: "maths", xp: 50, rep: { professionnelle: 2 }, days: 5,
    make: (s, p, rng) => { const id = String(p.instrument ?? rng.pick(["FR10Y", "LUTB30", "IT10Y", "SIGA31", "CARV29", "US10Y"])); return { title: `Calculer le rendement de ${id}`, description: `Calculez le taux de rendement actuariel de l'obligation ${s.instruments[id].name} à partir de son prix, de son coupon et de sa maturité (voir la fiche de l'actif).`, criteria: ["Réponse à ±0,15 point"], params: { instrument: id } }; },
    check: () => 0,
    quiz: (s, m) => { const d = s.instruments[String(m.params.instrument)]; const y = bondYield(s, d, dayIndex(s.t)) * 100; return { answer: y, tolerance: 0.15, unit: "%", question: `Taux actuariel de ${d.id} au prix de ${s.quotes[d.id].price.toFixed(2)} % (coupon ${(d.bond!.couponRate * 100).toFixed(2)} %, échéance ${fmtShortDate(d.bond!.maturityDay * MIN_PER_DAY)}) ?`, explain: `Le taux actuariel est le taux qui égalise la valeur actualisée des flux et le prix : ${y.toFixed(2)} %.` }; } },
  { id: "duration_obligation", category: "maths", xp: 50, rep: { professionnelle: 2 }, days: 5,
    make: (s, p, rng) => { const id = String(p.instrument ?? rng.pick(["DE10Y", "US30Y", "FR10Y", "HDMP32", "QBIT34"])); return { title: `Mesurer la sensibilité de ${id}`, description: `Déterminez la duration modifiée de ${s.instruments[id].name}.`, criteria: ["Réponse à ±0,4"], params: { instrument: id } }; },
    check: () => 0,
    quiz: (s, m) => { const d = s.instruments[String(m.params.instrument)]; const day = dayIndex(s.t); const a = bondPriceFromYield(d, day, bondYield(s, d, day)); return { answer: a.modified, tolerance: 0.4, unit: "ans", question: `Duration modifiée de ${d.id} ?`, explain: `Duration de Macaulay ${a.macaulay.toFixed(2)} / (1 + taux) = ${a.modified.toFixed(2)}. Une hausse de 1 point de taux ferait baisser le prix d'environ ${a.modified.toFixed(1)} %.` }; } },
  { id: "pnl_semaine", category: "trading", xp: 70, rep: { professionnelle: 3 }, days: 7,
    make: (s) => { const cap = (s.accounts.desk?.capitalAllocated ?? 0) / 100; if (!cap) return null; const target = Math.round(cap * 0.002); return { title: "Dégager un P&L positif sans dépasser les limites", description: `Générez au moins ${target.toLocaleString("fr-FR")} € de P&L sur le book du desk cette semaine, sans dépassement de VaR.`, criteria: [`P&L ≥ ${target.toLocaleString("fr-FR")} €`, "Aucun dépassement de limite"], params: { target }, baseline: { equity: accountEquity(s, "desk"), breaches: s.career.breaches } }; },
    check: (s, m) => { if (s.career.breaches > (m.baseline?.breaches ?? 0)) return -1; const pnl = accountEquity(s, "desk") - (m.baseline?.equity ?? 0); return Math.max(0, Math.min(1, pnl / Number(m.params.target))); } },
  { id: "respect_var", category: "risque", xp: 50, rep: { risque: 4 }, days: 10,
    make: (s) => ({ title: "Tenir la limite de VaR pendant 10 jours", description: "Gardez la VaR du desk sous 90 % de sa limite à chaque clôture, avec au moins 3 positions ouvertes.", criteria: ["VaR < 90 % de la limite chaque jour", "≥ 3 positions"], params: {}, baseline: { breaches: s.career.breaches } }),
    check: (s, m) => { if (s.career.breaches > (m.baseline?.breaches ?? 0)) return -1; const v = valueAtRisk(s, "desk").var; if (v > s.career.deskLimitVaR / 100 * 0.9) return -1; const n = Object.keys(s.accounts.desk?.positions ?? {}).length; const elapsed = (s.t - m.startT) / (m.deadlineT - m.startT); return n >= 3 ? Math.min(0.99, elapsed) : 0; } },
  { id: "satisfaction_client", category: "client", xp: 60, rep: { clients: 4, commerciale: 2 }, days: 20,
    make: (s, p, rng) => { const list = s.clients.filter((c) => !c.lost); if (!list.length) return null; const c = p.client ? list.find((x) => x.id === p.client) ?? list[0] : rng.pick(list); const target = Math.min(90, Math.round(c.satisfaction + 10)); return { title: `Améliorer la satisfaction de ${c.name}`, description: `Portez la satisfaction de ${c.name} à ${target}/100 (suivi, allocation adaptée, communication).`, criteria: [`Satisfaction ≥ ${target}`], params: { client: c.id, target } }; },
    check: (s, m) => { const c = s.clients.find((x) => x.id === m.params.client); if (!c || c.lost) return -1; return Math.min(1, c.satisfaction / Number(m.params.target)); } },
  { id: "allocation_client", category: "client", xp: 50, rep: { conformite: 3, clients: 2 }, days: 5,
    make: (s, p) => { const c = s.clients.find((x) => x.id === p.client) ?? s.clients.find((x) => !x.lost); if (!c) return null; const [lo, hi] = suitableEquityBand(c.riskTolerance); return { title: `Adapter l'allocation de ${c.name} à son profil`, description: `Ramenez l'exposition actions du mandat dans la bande ${pctTxt(lo)} – ${pctTxt(hi)} adaptée au profil ${c.riskTolerance}/7.`, criteria: [`Exposition actions entre ${pctTxt(lo)} et ${pctTxt(hi)}`], params: { client: c.id, lo, hi } }; },
    check: (s, m) => { const c = s.clients.find((x) => x.id === m.params.client); if (!c || c.lost) return -1; const w = equityWeight(s, c.accountId); return w >= Number(m.params.lo) && w <= Number(m.params.hi) ? 1 : 0; } },
  { id: "prevision_bc", category: "macro", xp: 60, rep: { professionnelle: 3 }, days: 50,
    make: (s, p, rng) => { const z = (p.zone as "US" | "EZ") ?? rng.pick(["US", "EZ"] as const); const day = s.macro.zones[z].nextCbDay; return { title: `Anticiper la décision de la banque centrale (${z === "US" ? "Fed" : "BCE"})`, description: `Avant la réunion du ${fmtShortDate(day * MIN_PER_DAY)}, prévoyez la décision de taux à partir de l'inflation, de la croissance et du chômage.`, criteria: ["Prévision exacte (hausse / statu quo / baisse)"], params: { zone: z, day, rate: s.macro.zones[z].policyRate } }; },
    check: (s, m) => { if (dayIndex(s.t) <= Number(m.params.day) && !m.params.answer) return 0; if (!m.params.answer) return dayIndex(s.t) > Number(m.params.day) ? -1 : 0; if (dayIndex(s.t) <= Number(m.params.day)) return 0.5; const r = s.macro.zones[m.params.zone as "US"].policyRate; const real = r > Number(m.params.rate) + 0.01 ? "hausse" : r < Number(m.params.rate) - 0.01 ? "baisse" : "statu_quo"; return real === m.params.answer ? 1 : -1; } },
  { id: "prevision_resultats", category: "analyse", xp: 60, rep: { professionnelle: 3 }, days: 60,
    make: (s, p, rng) => { const pool = Object.values(s.instruments).filter((d) => d.cls === "action" && (s.quotes[d.id].nextEarningsDay ?? 0) > dayIndex(s.t) + 1 && (s.quotes[d.id].nextEarningsDay ?? 0) < dayIndex(s.t) + 30); if (!pool.length) return null; const d = rng.pick(pool); return { title: `Analyser ${d.name} avant publication`, description: `${d.name} publie ses résultats le ${fmtShortDate((s.quotes[d.id].nextEarningsDay ?? 0) * MIN_PER_DAY)}. Prévoyez si l'action montera ou baissera sur les 2 jours suivant la publication.`, criteria: ["Prévision de direction correcte"], params: { instrument: d.id, day: s.quotes[d.id].nextEarningsDay ?? 0 } }; },
    check: (s, m) => { const day = Number(m.params.day); if (!m.params.answer) return dayIndex(s.t) >= day ? -1 : 0; if (m.params.ref === undefined && dayIndex(s.t) >= day) { m.params.ref = s.quotes[String(m.params.instrument)].prevClose; } if (dayIndex(s.t) < day + 2) return 0.5; const px = s.quotes[String(m.params.instrument)].price; const up = px > Number(m.params.ref); return (up ? "hausse" : "baisse") === m.params.answer ? 1 : -1; } },
  { id: "recommandation", category: "analyse", xp: 80, rep: { professionnelle: 4 }, days: 20,
    make: (s, p) => { const id = String(p.instrument); return { title: `Suivi de recommandation : ${id}`, description: `Votre recommandation d'achat sur ${s.instruments[id].name} doit surperformer l'indice MONDE sur 20 jours.`, criteria: ["Performance relative > 0 à l'échéance"], params: { instrument: id, startPrice: Number(p.startPrice), startIndex: Number(p.startIndex) } }; },
    check: (s, m) => { const rel = (s.quotes[String(m.params.instrument)].price / Number(m.params.startPrice)) / (s.quotes["IDX-WD"].price / Number(m.params.startIndex)) - 1; m.params.rel = Math.round(rel * 1000) / 10; if (s.t < m.deadlineT - 60) return rel > 0 ? 0.6 : 0.3; return rel > 0 ? 1 : -1; } },
  { id: "strategie_options", category: "maths", xp: 80, rep: { professionnelle: 3 }, days: 15,
    make: () => ({ title: "Mettre en place une protection par options (protective put)", description: "Sur votre compte personnel, détenez un sous-jacent (action/ETF, ≥ 100 unités) et un put sur ce même sous-jacent (au moins 1 contrat).", criteria: ["Position longue ≥ 100 sur un sous-jacent", "Put acheté sur ce sous-jacent"], params: {} }),
    check: (s) => { const acc = s.accounts.perso; for (const p of Object.values(acc.positions)) { const d = s.instruments[p.instrumentId]; if (d.option?.type === "put" && p.qty > 0) { const u = acc.positions[d.option.underlying]; if (u && u.qty >= 100) return 1; return 0.5; } } return 0; } },
  { id: "formation", category: "analyse", xp: 40, rep: { professionnelle: 1 }, days: 14,
    make: (s, p) => { const n = Number(p.count ?? 3); return { title: `Valider ${n} modules du centre de formation`, description: `Complétez ${n} exercices du centre de formation.`, criteria: [`${n} modules validés`], params: { count: n }, baseline: { done: s.learning.completed.length } }; },
    check: (s, m) => Math.min(1, (s.learning.completed.length - (m.baseline?.done ?? 0)) / Number(m.params.count)) },
  { id: "watchlist", category: "trading", xp: 20, rep: {}, days: 5,
    make: (s) => ({ title: "Configurer votre terminal", description: "Ajoutez au moins 5 instruments à votre liste de surveillance et créez une alerte de prix.", criteria: ["≥ 5 instruments surveillés", "≥ 1 alerte de prix"], params: {}, baseline: { w: s.watchlist.length } }),
    check: (s) => ((s.watchlist.length >= 5 ? 0.5 : s.watchlist.length / 10) + (s.alerts.length >= 1 ? 0.5 : 0)) },
  { id: "concentration", category: "risque", xp: 40, rep: { risque: 2 }, days: 5,
    make: (s) => (Object.keys(s.accounts.desk?.positions ?? {}).length ? { title: "Identifier le principal risque de concentration du desk", description: "Quelle position représente la plus forte exposition notionnelle du book ?", criteria: ["Réponse exacte"], params: {} } : null),
    check: () => 0,
    choiceQuiz: (s) => { const v = positionViews(s, "desk").sort((a, b) => b.notionalEur - a.notionalEur).slice(0, 4); const opts = v.map((x) => x.instrumentId); const order = [...opts].sort(); return { question: "Quelle est la plus grosse exposition notionnelle du book ?", options: order, correct: order.indexOf(opts[0]), explain: `${opts[0]} : ${Math.round(v[0]?.notionalEur ?? 0).toLocaleString("fr-FR")} € de notionnel.` }; } },
  { id: "battre_benchmark", category: "analyse", xp: 70, rep: { professionnelle: 3 }, days: 20,
    make: (s) => ({ title: "Battre le benchmark sur 20 jours", description: "Votre portefeuille personnel doit surperformer l'ETF Monde (XWLD) sur 20 jours.", criteria: ["Performance relative > 0"], params: {}, baseline: { eq: accountEquity(s, "perso"), bm: s.quotes["XWLD"].price } }),
    check: (s, m) => { const rel = accountEquity(s, "perso") / (m.baseline?.eq ?? 1) - s.quotes["XWLD"].price / (m.baseline?.bm ?? 1); if (s.t < m.deadlineT - 60) return rel > 0 ? 0.6 : 0.3; return rel > 0 ? 1 : -1; } },
  { id: "creer_societe", category: "entrepreneuriat", xp: 150, rep: { leadership: 5 }, days: 365,
    make: () => ({ title: "Fonder votre société", description: "Réunissez le capital nécessaire et créez votre propre structure financière.", criteria: ["Société créée"], params: {} }),
    check: (s) => (s.company && !s.company.bankrupt ? 1 : 0) },
  { id: "encours_societe", category: "entrepreneuriat", xp: 200, rep: { commerciale: 5 }, days: 365,
    make: (s, p) => ({ title: `Atteindre ${Number(p.target ?? 50)} M€ d'encours`, description: "Développez les actifs sous gestion de votre société.", criteria: [`Encours ≥ ${Number(p.target ?? 50)} M€`], params: { target: Number(p.target ?? 50) } }),
    check: (s, m) => (s.company ? Math.min(1, s.company.aum / 100 / 1e6 / Number(m.params.target)) : 0) },
];
const BY_ID = Object.fromEntries(TEMPLATES.map((t) => [t.id, t]));
export function missionTemplate(id: string) { return BY_ID[id]; }

export function createMission(s: GameState, templateId: string, params: Record<string, number | string> = {}, giver?: string): Mission | null {
  const t = BY_ID[templateId];
  if (!t) return null;
  if (s.missions.some((m) => m.status === "active" && m.templateId === templateId && JSON.stringify(m.params) === JSON.stringify(params) && templateId !== "recommandation")) return null;
  const rng = new Rng(s.rng);
  const made = t.make(s, params, rng);
  if (!made) return null;
  const m: Mission = { id: nextId(s, "mis"), templateId, title: made.title, category: t.category, description: made.description, criteria: made.criteria, params: made.params, startT: s.t, deadlineT: s.t + t.days * MIN_PER_DAY, status: "active", reward: { xp: t.xp, rep: t.rep, trust: giver ? { npc: giver, delta: 5 } : undefined }, progress: 0, baseline: made.baseline, giver };
  s.missions.unshift(m);
  if (s.missions.length > 150) s.missions = s.missions.filter((x, i) => i < 120 || x.status === "active");
  notify(s, "info", `Nouvelle mission : ${m.title}`, m.description, "/play/missions");
  return m;
}

function branchOf(m: Mission): SkillBranch { const c = m.category as string; return (["analyse", "marches", "maths", "macro", "risque", "client", "management", "entrepreneuriat"].includes(c) ? c : c === "trading" ? "marches" : c === "conformite" ? "risque" : "analyse") as SkillBranch; }
export function completeMission(s: GameState, m: Mission, success: boolean) {
  if (m.status !== "active") return;
  m.status = success ? "reussie" : "echouee";
  m.progress = success ? 1 : m.progress;
  if (success) {
    gainXp(s, branchOf(m), m.reward.xp, `Mission : ${m.title}`);
    for (const [k, d] of Object.entries(m.reward.rep)) changeRep(s, k as RepKey, d!);
    if (m.reward.trust) changeTrust(s, m.reward.trust.npc, m.reward.trust.delta, `Mission réussie : ${m.title}`);
    s.career.missionsDone++;
    notify(s, "succes", `Mission réussie : ${m.title}`, `+${m.reward.xp} XP`, "/play/missions");
  } else {
    s.career.missionsFailed++;
    changeRep(s, "fiabilite", -2);
    if (m.giver) changeTrust(s, m.giver, -3, `Mission échouée : ${m.title}`);
    notify(s, "alerte", `Mission échouée : ${m.title}`, undefined, "/play/missions");
  }
  careerLog(s, `Mission ${success ? "réussie" : "échouée"} : ${m.title}`);
}

export function checkMissions(s: GameState) {
  for (const m of s.missions) {
    if (m.status !== "active") continue;
    const t = BY_ID[m.templateId];
    if (!t || t.quiz || t.choiceQuiz) { if (s.t > m.deadlineT) completeMission(s, m, false); continue; }
    const p = t.check(s, m);
    if (p < 0) { completeMission(s, m, false); continue; }
    m.progress = p;
    if (p >= 1) completeMission(s, m, true);
    else if (s.t > m.deadlineT) completeMission(s, m, false);
  }
}

/** Réponse aux missions-quiz et prévisions */
export function answerMission(s: GameState, missionId: string, input: { value?: number; choice?: number; forecast?: string }) {
  const m = s.missions.find((x) => x.id === missionId);
  if (!m || m.status !== "active") return { ok: false as const, error: "Mission inactive." };
  const t = BY_ID[m.templateId];
  if (input.forecast && (m.templateId === "prevision_bc" || m.templateId === "prevision_resultats")) {
    if (m.params.answer) return { ok: false as const, error: "Prévision déjà enregistrée." };
    m.params.answer = input.forecast; m.progress = 0.5;
    return { ok: true as const, message: "Prévision enregistrée. Résultat à la publication." };
  }
  if (t.quiz && input.value !== undefined) {
    const q = t.quiz(s, m);
    const ok = Math.abs(input.value - q.answer) <= q.tolerance;
    completeMission(s, m, ok);
    return { ok: true as const, message: `${ok ? "✔ Correct." : "✘ Incorrect."} ${q.explain}` };
  }
  if (t.choiceQuiz && input.choice !== undefined) {
    const q = t.choiceQuiz(s, m);
    const ok = input.choice === q.correct;
    completeMission(s, m, ok);
    return { ok: true as const, message: `${ok ? "✔ Correct." : "✘ Incorrect."} ${q.explain}` };
  }
  return { ok: false as const, error: "Réponse invalide." };
}
export function missionQuestion(s: GameState, m: Mission) {
  const t = BY_ID[m.templateId];
  if (t?.quiz) { const q = t.quiz(s, m); return { kind: "numeric" as const, question: q.question, unit: q.unit }; }
  if (t?.choiceQuiz) { const q = t.choiceQuiz(s, m); return { kind: "choice" as const, question: q.question, options: q.options }; }
  if (m.templateId === "prevision_bc") return { kind: "forecast" as const, question: "Votre prévision :", options: ["hausse", "statu_quo", "baisse"], answered: m.params.answer };
  if (m.templateId === "prevision_resultats") return { kind: "forecast" as const, question: "Direction du titre après publication :", options: ["hausse", "baisse"], answered: m.params.answer };
  return null;
}

/** Attribution hebdomadaire de missions par le responsable */
export function assignWeeklyMissions(s: GameState, rng: Rng) {
  if (!s.career.employed || s.mode !== "carriere") return;
  const active = s.missions.filter((m) => m.status === "active").length;
  if (active >= 6) return;
  const byTrack: Record<string, string[]> = {
    trader: ["pnl_semaine", "respect_var", "couvrir_change", "reduire_secteur", "concentration", "prevision_bc"],
    sales: ["satisfaction_client", "allocation_client", "prevision_bc", "rendement_obligation"],
    structurer: ["strategie_options", "duration_obligation", "rendement_obligation", "respect_var"],
    analyste: ["prevision_resultats", "analyse_actif", "battre_benchmark", "prevision_bc"],
    gerant: ["allocation_client", "satisfaction_client", "battre_benchmark", "diversifier"],
    risk: ["respect_var", "concentration", "reduire_secteur", "duration_obligation", "couvrir_change"],
    ib: ["analyse_actif", "prevision_resultats", "rendement_obligation"],
    entrepreneur: ["satisfaction_client", "battre_benchmark", "creer_societe", "diversifier"],
  };
  const pool = byTrack[s.career.track] ?? byTrack.trader;
  for (let i = 0; i < 2; i++) createMission(s, rng.pick(pool), {}, "boss");
  if (rng.chance(0.4)) createMission(s, "formation", { count: 2 }, "boss");
}
