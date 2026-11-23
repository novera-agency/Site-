/** MissionEngine — modèles de missions paramétrables, critères explicites vérifiés par le moteur. */
import type { GameState, Mission, RepKey, SkillBranch } from "./types";
import { Rng } from "./rng";
import { accountEquity, exposures, valueAtRisk, positionViews } from "./portfolio";
import { bondPriceFromYield } from "./pricing";
import { bondYield } from "./market";
import { changeRep, changeTrust, gainXp, nextId, notify, careerLog } from "./core";
import { equityWeight, suitableEquityBand } from "./clients";
import { dayIndex, MIN_PER_DAY, fmtShortDate } from "./time";
import { quizState, quizById, QUIZ_BANK } from "./quiz";
import { BANK, BANK_CALC, BANK_ACTION, bankGiver } from "./missionBank";

interface Tpl {
  id: string; category: Mission["category"]; xp: number; rep: Partial<Record<RepKey, number>>; days: number;
  make: (s: GameState, p: Record<string, number | string>, rng: Rng) => { title: string; description: string; criteria: string[]; params: Record<string, number | string>; baseline?: Record<string, number> } | null;
  /** renvoie progression 0..1 ; 1 = réussite. -1 = échec immédiat */
  check: (s: GameState, m: Mission) => number;
  quiz?: (s: GameState, m: Mission) => { answer: number; tolerance: number; unit: string; question: string; explain: string };
  choiceQuiz?: (s: GameState, m: Mission) => { question: string; options: string[]; correct: number; explain: string };
  /** Mode d'emploi propre au modèle (banque de missions) */
  guide?: (s: GameState, m: Mission) => { steps: string[]; link: string; linkLabel: string; tip?: string };
}

const pctTxt = (x: number) => `${(x * 100).toFixed(0)} %`;
const TEMPLATES: Tpl[] = [
  { id: "premier_ordre", category: "trading", xp: 30, rep: { fiabilite: 2 }, days: 3,
    make: () => ({ title: "Passer votre premier ordre", description: "Achetez un instrument (action ou ETF) sur votre compte personnel ou sur le book du desk.", criteria: ["Au moins un ordre d'achat exécuté"], params: {} }),
    check: (s, m) => (s.fills.some((f) => f.side === "buy" && f.t >= m.startT && (f.account === "perso" || f.account === "desk") && !s.orders.find((o) => o.id === f.orderId)?.tag) ? 1 : 0) }, // les ordres automatiques (book initial, stops…) ne comptent pas
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
/* ═════════════════ Missions du jour : courtes, renouvelées chaque jour ouvré ═════════════════ */
const K = (p: Record<string, number | string>) => Number(p.k ?? 1);
const pickN = <T,>(rng: Rng, arr: T[], n: number) => { const a = [...arr]; const out: T[] = []; while (a.length && out.length < n) out.push(a.splice(rng.int(0, a.length - 1), 1)[0]); return out; };
const lastChange = (s: GameState, id: string) => { const d = s.quotes[id]?.daily ?? []; const n = d.length; return n >= 2 ? d[n - 1].c / d[n - 2].c - 1 : 0; };
const weekChange = (s: GameState, id: string) => { const d = s.quotes[id]?.daily ?? []; const n = d.length; return n >= 6 ? d[n - 1].c / d[n - 6].c - 1 : 0; };
const bigStocks = (s: GameState) => Object.values(s.instruments).filter((d) => d.cls === "action" && !d.lite && !s.quotes[d.id].halted && !s.quotes[d.id].defaulted);
const COMPLIANCE_QS: [string, string[], number, string][] = [
  ["Un ami vous demande s'il doit acheter le titre d'une société dont vous préparez l'introduction en bourse. Vous…", ["Refusez d'en parler : c'est une information privilégiée", "Lui conseillez d'acheter discrètement", "Lui dites d'attendre une semaine"], 0, "Toute information non publique susceptible d'influencer un cours est privilégiée : la transmettre est un délit d'initié."],
  ["Un client âgé et prudent veut placer toute son épargne sur un produit à effet de levier. Vous…", ["Exécutez : c'est son argent", "Lui expliquez l'inadéquation et le déconseillez par écrit", "Le lui vendez avec une remise"], 1, "Le devoir de conseil impose de vérifier l'adéquation du produit au profil du client et de le tracer."],
  ["Un collègue vous propose d'acheter juste avant les ordres d'un gros client. Vous…", ["Refusez et le signalez à la conformité", "Acceptez pour de petits montants", "Ne dites rien"], 0, "Passer devant les ordres d'un client (front running) est un abus de marché."],
  ["Un cadeau d'un fournisseur d'une valeur de 800 € arrive au bureau. Vous…", ["Le gardez", "Le déclarez à la conformité selon la politique cadeaux", "L'offrez à un collègue"], 1, "Les cadeaux au-delà d'un seuil doivent être déclarés : ils peuvent créer un conflit d'intérêts."],
  ["Vous découvrez une erreur de saisie qui vous fait gagner 20 000 €. Vous…", ["La signalez immédiatement", "Attendez de voir si quelqu'un la remarque", "Clôturez vite la position"], 0, "Toute erreur opérationnelle doit être déclarée sans délai, même favorable."],
  ["Un client demande à fractionner ses dépôts en espèces pour rester sous le seuil de déclaration. Vous…", ["Acceptez", "Refusez et faites une déclaration de soupçon", "Lui conseillez une autre banque"], 1, "Le fractionnement pour échapper aux seuils est un signal de blanchiment : déclaration de soupçon obligatoire."],
];
const DAILY: Tpl[] = [
  { id: "d_revue", category: "marches", xp: 20, rep: { professionnelle: 1 }, days: 1,
    make: (s, _p, rng) => { const ids = pickN(rng, ["IDX-US5", "IDX-FR", "IDX-DE", "IDX-UK", "IDX-JP", "IDX-EU", "IDX-AS"].filter((x) => s.instruments[x]), 4); const ch = ids.map((x) => lastChange(s, x)); const best = ch.indexOf(Math.max(...ch)); return { title: "Revue de marché du matin", description: "Votre responsable veut savoir quelle place financière a le mieux terminé la dernière séance. Regardez les indices dans la salle des marchés.", criteria: ["Bonne réponse avant ce soir"], params: { o: ids.join(","), c: best, e: ids.map((x, i) => `${x} ${(ch[i] * 100).toFixed(2)} %`).join(" · ") } }; },
    check: () => 0, choiceQuiz: (s, m) => ({ question: "Quel indice a le plus progressé lors de la dernière séance ?", options: String(m.params.o).split(",").map((x) => `${x} — ${s.instruments[x]?.name ?? x}`), correct: Number(m.params.c), explain: String(m.params.e) }) },
  { id: "d_dividende", category: "analyse", xp: 25, rep: { professionnelle: 1 }, days: 1,
    make: (s, _p, rng) => { const pool = bigStocks(s).filter((d) => (s.quotes[d.id].dividend ?? 0) > 0); if (!pool.length) return null; const d = rng.pick(pool); const y = (s.quotes[d.id].dividend! / s.quotes[d.id].price) * 100; return { title: `Rendement du dividende de ${d.name}`, description: `Un client demande le rendement du dividende de ${d.name} (${d.id}). Dividende annuel ÷ cours × 100 : consultez la fiche de l'action.`, criteria: ["Réponse à 0,15 point près"], params: { instrument: d.id, a: Math.round(y * 100) / 100, div: Math.round(s.quotes[d.id].dividend! * 100) / 100, px: Math.round(s.quotes[d.id].price * 100) / 100 } }; },
    check: () => 0, quiz: (s, m) => ({ answer: Number(m.params.a), tolerance: 0.15, unit: "%", question: `Rendement du dividende de ${s.instruments[String(m.params.instrument)]?.name} (dividende ${m.params.div}, cours ${m.params.px}) ?`, explain: `${m.params.div} ÷ ${m.params.px} × 100 = ${m.params.a} %.` }) },
  { id: "d_change", category: "macro", xp: 20, rep: { professionnelle: 1 }, days: 1,
    make: (s, p, rng) => { const amt = Math.round(rng.range(20, 400) * K(p)) * 1000; const r = s.quotes["EURUSD"].price; return { title: "Conversion pour un client", description: `Un client veut savoir combien de dollars il obtiendra pour ${amt.toLocaleString("fr-FR")} € au cours actuel de l'EURUSD (${r.toFixed(4)}).`, criteria: ["Réponse à 0,5 % près"], params: { amt, r: Math.round(r * 10000) / 10000 } }; },
    check: () => 0, quiz: (_s, m) => { const a = Number(m.params.amt) * Number(m.params.r); return { answer: Math.round(a), tolerance: a * 0.005, unit: "$", question: `${Number(m.params.amt).toLocaleString("fr-FR")} € en dollars au cours de ${m.params.r} ?`, explain: `${Number(m.params.amt).toLocaleString("fr-FR")} × ${m.params.r} = ${Math.round(a).toLocaleString("fr-FR")} $ (EURUSD = prix d'un euro en dollars).` }; } },
  { id: "d_per", category: "analyse", xp: 25, rep: { professionnelle: 1 }, days: 1,
    make: (s, _p, rng) => { const sec = rng.pick(["Banque", "Technologie", "Santé", "Énergie", "Industrie", "Luxe", "Automobile"]); const pool = Object.values(s.instruments).filter((d) => d.cls === "action" && d.sector === sec && !s.quotes[d.id].halted && (s.quotes[d.id].eps ?? 0) > 0); if (pool.length < 4) return null; const ids = pickN(rng, pool, 4).map((d) => d.id); const pe = ids.map((x) => s.quotes[x].price / s.quotes[x].eps!); return { title: `Valorisation du secteur ${sec.toLowerCase()}`, description: `Parmi quatre valeurs du secteur ${sec.toLowerCase()}, laquelle a le PER le plus bas ? Le PER figure sur chaque fiche.`, criteria: ["Bonne réponse avant ce soir"], params: { o: ids.join(","), c: pe.indexOf(Math.min(...pe)), e: ids.map((x, i) => `${x} : PER ${pe[i].toFixed(1)}`).join(" · ") } }; },
    check: () => 0, choiceQuiz: (s, m) => ({ question: "Quel titre a le PER le plus bas ?", options: String(m.params.o).split(",").map((x) => `${x} — ${s.instruments[x]?.name ?? x}`), correct: Number(m.params.c), explain: String(m.params.e) }) },
  { id: "d_secteur", category: "marches", xp: 25, rep: { professionnelle: 1 }, days: 1,
    make: (s, _p, rng) => { const secs = pickN(rng, ["Banque", "Technologie", "Santé", "Énergie", "Industrie", "Luxe", "Automobile", "Immobilier", "Télécoms", "Distribution"], 4); const perf = secs.map((sec) => { const l = bigStocks(s).filter((d) => d.sector === sec); return l.length ? l.reduce((a, d) => a + weekChange(s, d.id), 0) / l.length : 0; }); return { title: "Note sectorielle de la semaine", description: "Le directeur prépare le comité d'allocation : quel secteur a le mieux résisté sur les cinq dernières séances ?", criteria: ["Bonne réponse avant ce soir"], params: { o: secs.join(","), c: perf.indexOf(Math.max(...perf)), e: secs.map((x, i) => `${x} ${(perf[i] * 100).toFixed(1)} %`).join(" · ") } }; },
    check: () => 0, choiceQuiz: (_s, m) => ({ question: "Quel secteur a le mieux performé sur cinq séances (grandes valeurs) ?", options: String(m.params.o).split(","), correct: Number(m.params.c), explain: String(m.params.e) }) },
  { id: "d_conformite", category: "conformite", xp: 20, rep: { conformite: 2 }, days: 1,
    make: (_s, _p, rng) => { const i = rng.int(0, COMPLIANCE_QS.length - 1); return { title: "Quiz de conformité obligatoire", description: "La conformité vérifie que chacun connaît les règles. Une seule question, mais elle compte.", criteria: ["Bonne réponse"], params: { q: i } }; },
    check: () => 0, choiceQuiz: (_s, m) => { const q = COMPLIANCE_QS[Number(m.params.q)]; return { question: q[0], options: q[1], correct: q[2], explain: q[3] }; } },
  { id: "d_ordre", category: "trading", xp: 25, rep: { fiabilite: 1 }, days: 1,
    make: (s, p, rng) => { if (!s.accounts.desk) return null; const id = rng.pick(["XWLD", "XUSA", "XEUR", "XFRA", "XGLD", "XTEC"].filter((x) => s.instruments[x])); const qty = Math.max(10, Math.round(rng.range(50, 300) * K(p) / 10) * 10); return { title: `Exécuter l'ordre du gérant : ${qty} ${id}`, description: `Un gérant vous transmet un ordre : achetez ${qty} parts de ${s.instruments[id].name} sur le book du desk avant la clôture.`, criteria: [`${qty} ${id} achetés sur le compte du desk`], params: { instrument: id, qty } }; },
    check: (s, m) => { const q = s.fills.filter((f) => f.account === "desk" && f.instrumentId === m.params.instrument && f.side === "buy" && f.t >= m.startT).reduce((a, f) => a + f.qty, 0); return Math.min(1, q / Number(m.params.qty)); } },
  { id: "d_pnl", category: "trading", xp: 35, rep: { professionnelle: 2 }, days: 1,
    make: (s, p) => { if (!s.accounts.desk) return null; const cap = (s.accounts.desk.capitalAllocated ?? 0) / 100; const target = Math.round(cap * 0.0004 * K(p) / 100) * 100 || 1000; return { title: `Objectif du jour : +${target.toLocaleString("fr-FR")} € sur le desk`, description: `Votre responsable attend un P&L positif d'au moins ${target.toLocaleString("fr-FR")} € aujourd'hui sur le book du desk, sans dépasser la limite de VaR.`, criteria: [`P&L du jour ≥ ${target.toLocaleString("fr-FR")} €`, "VaR sous la limite"], params: { target }, baseline: { eq: accountEquity(s, "desk") } }; },
    check: (s, m) => { const pnl = accountEquity(s, "desk") - (m.baseline?.eq ?? 0); if (valueAtRisk(s, "desk").var > s.career.deskLimitVaR / 100) return -1; return pnl >= Number(m.params.target) ? 1 : Math.max(0, Math.min(0.9, pnl / Number(m.params.target))); } },
  { id: "d_var", category: "risque", xp: 30, rep: { risque: 2 }, days: 1,
    make: (s, p) => { if (!s.accounts.desk) return null; const thr = K(p) >= 3 ? 0.6 : K(p) >= 2 ? 0.8 : 0.95; return { title: `Risque sous contrôle : VaR ≤ ${Math.round(thr * 100)} % de la limite`, description: `Le risk manager veut voir la VaR du desk sous ${Math.round(thr * 100)} % de la limite à la fin de la journée (vérification à partir de 17 h).`, criteria: [`VaR ≤ ${Math.round(thr * 100)} % de la limite en fin de journée`], params: { thr } }; },
    check: (s, m) => { const ok = valueAtRisk(s, "desk").var <= Number(m.params.thr) * s.career.deskLimitVaR / 100; if (s.t >= m.deadlineT - 90) return ok ? 1 : 0.4; return ok ? 0.8 : 0.3; } },
  { id: "d_client", category: "client", xp: 35, rep: { commerciale: 2, clients: 1 }, days: 1,
    make: (s, p, rng) => { const cl = s.clients.filter((c) => !c.lost); if (!cl.length) return null; const c = rng.pick(cl); const target = Math.round(15000 * K(p) / 1000) * 1000; return { title: `Collecte : appeler ${c.name}`, description: `Appelez ${c.name} aujourd'hui (onglet Clients) et obtenez au moins ${target.toLocaleString("fr-FR")} € de nouveaux versements. Chaque maladresse au téléphone réduit l'objectif.`, criteria: [`Collecte ≥ ${target.toLocaleString("fr-FR")} € aujourd'hui`], params: { client: c.id, target }, baseline: { sales: Number(s.flags["salesYtd"] ?? 0) } }; },
    check: (s, m) => { const got = Number(s.flags["salesYtd"] ?? 0) - (m.baseline?.sales ?? 0); return got >= Number(m.params.target) ? 1 : Math.max(0, Math.min(0.9, got / Number(m.params.target))); } },
  { id: "d_varchiffre", category: "risque", xp: 40, rep: { risque: 2, professionnelle: 1 }, days: 1,
    make: (s) => { if (!s.accounts.desk) return null; return { title: "Chiffre demandé par le comité : la VaR du book", description: "Le directeur présente le risque du desk au comité exécutif. Il vous demande la VaR 99 % à 1 jour du book (page Risques).", criteria: ["Réponse à 10 % près"], params: {} }; },
    check: () => 0, quiz: (s) => { const v = valueAtRisk(s, "desk").var; return { answer: Math.round(v), tolerance: Math.max(500, v * 0.1), unit: "€", question: "VaR 99 % à 1 jour du book du desk ?", explain: `VaR actuelle : ${Math.round(v).toLocaleString("fr-FR")} €.` }; } },
  { id: "d_culture", category: "analyse", xp: 25, rep: { professionnelle: 1 }, days: 1,
    make: (s, _p, rng) => { const st = quizState(s); const pool = QUIZ_BANK.filter((q) => st.done[q.id] !== 1); const q = rng.pick(pool.length ? pool : QUIZ_BANK); return { title: q.cat === "macro" ? "Culture macro du jour" : "Culture micro du jour", description: "Le directeur aime que ses équipes maîtrisent les bases de l'économie. Une question pour la machine à café.", criteria: ["Bonne réponse avant ce soir"], params: { q: q.id } }; },
    check: () => 0, choiceQuiz: (_s, m) => { const q = quizById(String(m.params.q))!; return { question: q.q, options: q.options, correct: q.correct, explain: q.explain }; } },
  { id: "d_or_eur", category: "macro", xp: 20, rep: { professionnelle: 1 }, days: 1,
    make: (s) => { if (!s.quotes["GOLD"] || !s.quotes["EURUSD"]) return null; const g = s.quotes["GOLD"].price, r = s.quotes["EURUSD"].price; return { title: "Le prix de l'or en euros", description: `Une cliente veut connaître le prix d'une once d'or en euros. L'or cote ${g.toFixed(2)} $ et l'EURUSD ${r.toFixed(4)}.`, criteria: ["Réponse à 1 % près"], params: { g: Math.round(g * 100) / 100, r: Math.round(r * 10000) / 10000 } }; },
    check: () => 0, quiz: (_s, m) => { const a = Number(m.params.g) / Number(m.params.r); return { answer: Math.round(a * 100) / 100, tolerance: a * 0.01, unit: "€", question: `Une once d'or à ${m.params.g} $, EURUSD à ${m.params.r} : combien en euros ?`, explain: `${m.params.g} ÷ ${m.params.r} = ${a.toFixed(2)} € (on divise par l'EURUSD pour passer des dollars aux euros).` }; } },
  { id: "d_capi", category: "analyse", xp: 25, rep: { professionnelle: 1 }, days: 1,
    make: (s, _p, rng) => { const pool = bigStocks(s).filter((d) => (d.shares ?? 0) > 0); if (!pool.length) return null; const d = rng.pick(pool); const cap = s.quotes[d.id].price * (d.shares ?? 0) / 1e9; return { title: `Capitalisation de ${d.name}`, description: `Un journaliste demande la capitalisation boursière de ${d.name} (${d.id}), en milliards. Capitalisation = cours × nombre d'actions (sur la fiche).`, criteria: ["Réponse à 3 % près"], params: { instrument: d.id, a: Math.round(cap * 100) / 100, px: Math.round(s.quotes[d.id].price * 100) / 100, n: Math.round((d.shares ?? 0) / 1e6) } }; },
    check: () => 0, quiz: (s, m) => ({ answer: Number(m.params.a), tolerance: Number(m.params.a) * 0.03, unit: "Md", question: `Capitalisation de ${s.instruments[String(m.params.instrument)]?.name} (cours ${m.params.px}, ${m.params.n} millions d'actions), en milliards ?`, explain: `${m.params.px} × ${m.params.n} millions = ${m.params.a} milliards (dans la devise de cotation).` }) },
  { id: "d_semaine", category: "marches", xp: 25, rep: { professionnelle: 1 }, days: 1,
    make: (s, _p, rng) => { const pool = bigStocks(s); if (pool.length < 4) return null; const ids = pickN(rng, pool, 4).map((d) => d.id); const w = ids.map((x) => weekChange(s, x)); return { title: "Le titre de la semaine", description: "Pour la lettre d'information des clients, votre responsable veut savoir laquelle de ces quatre actions a le plus progressé sur cinq séances (graphique 1 semaine sur chaque fiche).", criteria: ["Bonne réponse avant ce soir"], params: { o: ids.join(","), c: w.indexOf(Math.max(...w)), e: ids.map((x, i) => `${x} ${(w[i] * 100).toFixed(1)} %`).join(" · ") } }; },
    check: () => 0, choiceQuiz: (s, m) => ({ question: "Quelle action a le plus progressé sur cinq séances ?", options: String(m.params.o).split(",").map((x) => `${x} — ${s.instruments[x]?.name ?? x}`), correct: Number(m.params.c), explain: String(m.params.e) }) },
  { id: "d_interets", category: "macro", xp: 20, rep: { professionnelle: 1 }, days: 1,
    make: (_s, p, rng) => { const cap = Math.round(rng.range(10, 200) * K(p)) * 1000; const rate = rng.pick([2, 2.5, 3, 3.5, 4, 5]); const years = rng.pick([5, 8, 10, 15]); return { title: "Le calcul des intérêts composés", description: `Un client place ${cap.toLocaleString("fr-FR")} € à ${rate} % par an pendant ${years} ans, intérêts réinvestis. Quel capital aura-t-il à la fin ?`, criteria: ["Réponse à 1 % près"], params: { cap, rate, years } }; },
    check: () => 0, quiz: (_s, m) => { const a = Number(m.params.cap) * Math.pow(1 + Number(m.params.rate) / 100, Number(m.params.years)); return { answer: Math.round(a), tolerance: a * 0.01, unit: "€", question: `${Number(m.params.cap).toLocaleString("fr-FR")} € à ${m.params.rate} % pendant ${m.params.years} ans (intérêts composés) ?`, explain: `${Number(m.params.cap).toLocaleString("fr-FR")} × (1 + ${m.params.rate} %)^${m.params.years} = ${Math.round(a).toLocaleString("fr-FR")} €.` }; } },
];
for (const t of DAILY) TEMPLATES.push(t);
for (const t of BANK) TEMPLATES.push(t);
const BY_ID = Object.fromEntries(TEMPLATES.map((t) => [t.id, t]));
export const DAILY_IDS = DAILY.map((t) => t.id);
export function missionTemplate(id: string) { return BY_ID[id]; }


/** Mode d'emploi de chaque mission : étapes concrètes + écran où agir */
export interface MissionGuide { steps: string[]; link: string; linkLabel: string; tip?: string; }
const TIPS: Record<string, string> = {
  premier_ordre: "Commencez petit : un ETF diversifié comme XWLD limite le risque pendant que vous apprenez le terminal.",
  analyse_actif: "Un PER bas ne veut pas forcément dire « bonne affaire » : regardez aussi la croissance et la dette.",
  vendre_position: "Le P&L réalisé n'apparaît qu'une fois la position vendue ; avant, c'est un P&L latent.",
  diversifier: "Combinez un ETF actions, une obligation et un peu d'or : trois classes d'un coup, poids faciles à équilibrer.",
  reduire_secteur: "Vendez d'abord les lignes les plus volatiles du secteur : la VaR baisse plus vite.",
  couvrir_change: "Vendre EURUSD = acheter des euros contre des dollars : votre exposition au dollar diminue d'autant.",
  rendement_obligation: "Si le prix est sous 100, le taux actuariel est au-dessus du coupon (et inversement).",
  duration_obligation: "Ordre de grandeur : une obligation à 10 ans a une duration modifiée d'environ 8 à 9.",
  pnl_semaine: "Mieux vaut plusieurs petites positions disciplinées (avec stop-loss) qu'un gros pari qui fait exploser la VaR.",
  respect_var: "Gardez une marge de sécurité : visez 60–70 % de la limite plutôt que 89 %.",
  satisfaction_client: "Un client apprécie surtout d'être appelé et d'avoir une allocation conforme à son profil.",
  allocation_client: "La page Clients calcule pour vous l'exposition actions cible : restez dans la bande verte.",
  prevision_bc: "Inflation au-dessus de 2 % et chômage bas → hausse probable ; croissance faible → statu quo ou baisse.",
  prevision_resultats: "Une entreprise dont la zone a une croissance forte surprend plus souvent à la hausse.",
  recommandation: "Patience : la mission se juge à l'échéance, pas sur les mouvements d'un jour.",
  strategie_options: "Un put proche du cours (ATM) protège mieux mais coûte plus cher qu'un put lointain.",
  formation: "Lisez l'exemple chiffré avant de répondre : l'exercice reprend presque toujours le même calcul.",
  watchlist: "Mettez une alerte un peu au-dessus et un peu en dessous du cours pour être prévenu des mouvements.",
  concentration: "Le graphique « Concentration » de la gestion des risques donne directement la réponse.",
  battre_benchmark: "Battre l'indice passe souvent par éviter les grosses pertes plutôt que par chercher le gros gain.",
  creer_societe: "Commencez par une société de conseil : le capital minimum est le plus faible.",
  encours_societe: "Le marketing et un commercial de plus font grimper l'encours, mais surveillez la trésorerie.",
};
export function missionGuide(s: GameState, m: Mission): MissionGuide {
  const own = BY_ID[m.templateId]?.guide;
  if (own) return own(s, m);
  return { ...guideSteps(s, m), tip: TIPS[m.templateId] };
}
function guideSteps(s: GameState, m: Mission): MissionGuide {
  const p = m.params;
  const inst = (id: unknown) => s.instruments[String(id)]?.name ?? String(id);
  const client = s.clients.find((c) => c.id === p.client);
  switch (m.templateId) {
    case "premier_ordre": return { steps: ["Ouvrez le terminal (menu Marchés → Salle des marchés).", "Choisissez un instrument, par exemple l'ETF Monde « XWLD ».", "Dans le cadre « Passer un ordre », laissez « Acheter », indiquez une quantité (ex. 10) puis validez.", "Si le marché est fermé, l'ordre s'exécutera à l'ouverture (9 h pour l'Europe)."], link: "/play/actif?id=XWLD", linkLabel: "Ouvrir XWLD et acheter" };
    case "analyse_actif": return { steps: [`Ouvrez la fiche de ${inst(p.instrument)}.`, "Repérez dans « Données fondamentales » le PER actuel et le PER normatif.", "Revenez ici et répondez à la question ci-dessous."], link: `/play/actif?id=${p.instrument}`, linkLabel: `Ouvrir la fiche ${p.instrument}` };
    case "vendre_position": return { steps: ["Ouvrez votre portefeuille et choisissez une ligne.", "Cliquez « Trader », sélectionnez « Vendre » et la quantité détenue.", "Consultez ensuite le P&L réalisé dans Transactions."], link: "/play/portefeuille", linkLabel: "Voir mon portefeuille" };
    case "diversifier": return { steps: ["Achetez au moins 5 instruments différents sur votre compte personnel.", "Mélangez au moins 3 secteurs ou classes (actions, ETF, obligations, or…).", "Aucune ligne ne doit dépasser 30 % du portefeuille (colonne « Poids »)."], link: "/play/recherche", linkLabel: "Chercher des instruments" };
    case "reduire_secteur": return { steps: [`Allez dans Portefeuille → compte « Book du desk ».`, `Vendez une partie des positions du secteur ${p.sector}.`, `Vérifiez dans « Expositions » que le secteur est sous ${p.target} %.`], link: "/play/portefeuille", linkLabel: "Ouvrir le book du desk" };
    case "couvrir_change": return { steps: ["Le book détient trop d'actifs en dollars.", "Vendez la paire EURUSD sur le compte du desk : cela revient à vendre des dollars contre des euros.", "Vérifiez l'exposition « Devise » USD dans le portefeuille du desk (objectif < 5 %)."], link: "/play/actif?id=EURUSD", linkLabel: "Ouvrir EURUSD" };
    case "rendement_obligation": case "duration_obligation": return { steps: [`Ouvrez la fiche de ${inst(p.instrument)}.`, "La section « Données fondamentales » donne prix, coupon, échéance (et le résultat, si vous voulez vérifier votre calcul).", "Saisissez votre réponse ci-dessous."], link: `/play/actif?id=${p.instrument}`, linkLabel: `Ouvrir ${p.instrument}` };
    case "pnl_semaine": return { steps: ["Passez des ordres sur le compte « Book du desk » (pas sur votre compte personnel).", `Objectif : +${Number(p.target).toLocaleString("fr-FR")} € de gain cette semaine.`, "Surveillez la VaR dans « Gestion des risques » : un dépassement fait échouer la mission."], link: "/play/terminal", linkLabel: "Ouvrir le terminal" };
    case "respect_var": return { steps: ["Gardez au moins 3 positions sur le book du desk.", "Chaque jour, la VaR doit rester sous 90 % de la limite (jauge dans « Gestion des risques »).", "Si elle monte trop, réduisez la plus grosse position."], link: "/play/risques", linkLabel: "Voir la VaR du desk" };
    case "satisfaction_client": case "allocation_client": return { steps: [`Ouvrez la fiche du client ${client?.name ?? ""}.`, "Adaptez l'allocation à son profil de risque (la page indique si vous êtes dans la bonne bande).", "Appelez-le régulièrement (bouton « Appeler le client »)."], link: "/play/clients", linkLabel: "Ouvrir mes clients" };
    case "prevision_bc": return { steps: ["Consultez la page Macroéconomie : inflation, croissance, chômage de la zone.", "Inflation au-dessus de la cible → plutôt hausse ; économie faible → plutôt baisse.", "Choisissez votre prévision ci-dessous avant la date de réunion."], link: "/play/macro", linkLabel: "Voir la macroéconomie" };
    case "prevision_resultats": return { steps: [`Étudiez ${inst(p.instrument)} : valorisation, perspectives, actualités.`, "Choisissez ci-dessous si l'action montera ou baissera après la publication."], link: `/play/actif?id=${p.instrument}`, linkLabel: `Ouvrir ${p.instrument}` };
    case "recommandation": return { steps: [`Votre recommandation sur ${inst(p.instrument)} a été validée en comité.`, "Rien à faire : la mission réussit si l'action fait mieux que l'indice MONDE dans 20 jours.", "Vous pouvez suivre son évolution sur sa fiche."], link: `/play/actif?id=${p.instrument}`, linkLabel: "Suivre l'action" };
    case "strategie_options": return { steps: ["Achetez au moins 100 unités d'un ETF ou d'une action (compte personnel).", "Dans Options, choisissez ce même sous-jacent et la stratégie « Protective put ».", "Exécutez la stratégie."], link: "/play/options", linkLabel: "Ouvrir les options" };
    case "formation": return { steps: ["Ouvrez le centre de formation.", `Lisez un module puis réussissez son exercice — ${p.count} fois.`], link: "/play/formation", linkLabel: "Centre de formation" };
    case "watchlist": return { steps: ["Sur la fiche d'un instrument, cliquez « ☆ Surveiller » (5 instruments au total).", "Sur une fiche, saisissez un prix dans « Alerte à… » puis cliquez 🔔."], link: "/play/actif?id=MAIS", linkLabel: "Ouvrir une fiche" };
    case "concentration": return { steps: ["Ouvrez « Gestion des risques » : le graphique « Concentration » classe les positions du desk.", "Répondez ci-dessous."], link: "/play/risques", linkLabel: "Voir la concentration" };
    case "battre_benchmark": return { steps: ["Gérez votre compte personnel pour faire mieux que l'ETF Monde (XWLD) sur 20 jours.", "Le graphique « Évolution vs benchmark » du portefeuille montre l'écart."], link: "/play/portefeuille", linkLabel: "Voir mon portefeuille" };
    case "creer_societe": case "encours_societe": return { steps: ["Accumulez le capital requis et la réputation.", "Créez puis développez votre société."], link: "/play/entreprise", linkLabel: "Entrepreneuriat" };
    case "d_revue": return { steps: ["Ouvrez la salle des marchés ou le bureau : la variation du jour de chaque indice y est affichée.", "Comparez les variations de la dernière séance et répondez ici."], link: "/play/terminal", linkLabel: "Voir les indices" };
    case "d_dividende": return { steps: [`Ouvrez la fiche de ${inst(p.instrument)} : le dividende annuel par action y figure.`, "Divisez le dividende par le cours, multipliez par 100."], link: `/play/actif?id=${p.instrument}`, linkLabel: "Ouvrir la fiche" };
    case "d_change": return { steps: ["EURUSD = nombre de dollars pour un euro.", "Multipliez le montant en euros par le cours indiqué."], link: "/play/actif?id=EURUSD", linkLabel: "Voir l'EURUSD" };
    case "d_per": return { steps: ["Ouvrez la fiche de chacune des quatre valeurs (Rechercher un titre).", "Comparez le PER (cours ÷ bénéfice par action) et choisissez le plus bas."], link: "/play/recherche", linkLabel: "Rechercher" };
    case "d_secteur": return { steps: ["Dans Rechercher un titre, filtrez par secteur et triez par variation.", "Regardez les grandes valeurs sur la semaine (graphique de chaque fiche)."], link: "/play/recherche", linkLabel: "Rechercher" };
    case "d_conformite": return { steps: ["Lisez la question et choisissez la réponse conforme à la réglementation.", "En cas de doute, la réponse prudente et transparente est presque toujours la bonne."], link: "/play/missions", linkLabel: "Missions" };
    case "d_ordre": return { steps: [`Ouvrez ${inst(p.instrument)}.`, "Dans « Passer un ordre », choisissez le compte « Book du desk », Acheter, la quantité demandée, puis validez.", "Le marché doit être ouvert pour l'exécution."], link: `/play/actif?id=${p.instrument}`, linkLabel: "Ouvrir et acheter" };
    case "d_pnl": return { steps: ["Prenez des positions sur le book du desk pendant les heures de marché.", "Utilisez des stop-loss et surveillez la VaR : un dépassement fait échouer la mission."], link: "/play/terminal", linkLabel: "Salle des marchés" };
    case "d_var": return { steps: ["Ouvrez la page Risques : la VaR et la limite y sont affichées.", "Réduisez les positions les plus volatiles du book si besoin.", "La vérification se fait en fin de journée."], link: "/play/risques", linkLabel: "Voir les risques" };
    case "d_client": return { steps: [`Ouvrez Clients et appelez ${client?.name ?? "le client"}.`, "Écoutez ses besoins, proposez un produit adapté à son profil, évitez les maladresses."], link: "/play/clients", linkLabel: "Appeler" };
    case "d_varchiffre": return { steps: ["Ouvrez la page Risques et relevez la VaR 99 % à 1 jour du book du desk.", "Répondez ici (10 % de tolérance)."], link: "/play/risques", linkLabel: "Voir la VaR" };
    default: return { steps: [m.description], link: "/play/missions", linkLabel: "Missions" };
  }
}

export function createMission(s: GameState, templateId: string, params: Record<string, number | string> = {}, giver?: string, opts: { daily?: boolean; stakes?: 1 | 2 | 3; deadlineT?: number; quiet?: boolean } = {}): Mission | null {
  const t = BY_ID[templateId];
  if (!t) return null;
  if (s.missions.some((m) => m.status === "active" && m.templateId === templateId && JSON.stringify(m.params) === JSON.stringify(params) && templateId !== "recommandation")) return null;
  const rng = new Rng(s.rng);
  const made = t.make(s, params, rng);
  if (!made) return null;
  const st = opts.stakes ?? 1;
  const mult = opts.daily ? [1, 1, 2, 3.5][st] : 1;
  const rep = opts.daily ? Object.fromEntries(Object.entries(t.rep).map(([k, v]) => [k, Math.round(v! * st)])) : t.rep;
  const m: Mission = { id: nextId(s, "mis"), templateId, title: made.title, category: t.category, description: made.description, criteria: made.criteria, params: made.params, startT: s.t, deadlineT: opts.deadlineT ?? s.t + t.days * MIN_PER_DAY, status: "active", reward: { xp: Math.round(t.xp * mult), rep, trust: giver ? { npc: giver, delta: opts.daily ? 2 * st : 5 } : undefined }, progress: 0, baseline: made.baseline, giver, ...(opts.daily ? { daily: true, stakes: st } : {}) };
  s.missions.unshift(m);
  if (s.missions.length > 150) s.missions = s.missions.filter((x, i) => i < 120 || x.status === "active");
  const g = giver ? s.npcs[giver] : undefined;
  if (!opts.quiet) notify(s, "info", g ? `${g.name} vous confie une mission` : `Nouvelle mission : ${m.title}`, g ? `« ${m.title} » — ${g.role}` : m.description, "/play/missions");
  if (g && g.relation !== "client" && !opts.quiet) {
    s.messages.unshift({ id: nextId(s, "msg"), t: s.t, from: `${g.name} — ${g.role}`, subject: `Mission : ${m.title}`, body: `${s.profile.firstName},\n\n${m.description}\n\nÉchéance : ${fmtShortDate(m.deadlineT)}.\n\n${g.name}\n\n(Besoin d'aide ? Dans l'onglet Missions, cliquez « 💡 Activer l'aide » sur cette mission.)`, read: false });
  }
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
    if (m.daily && m.stakes === 3) { const b = Math.round(1000 * Math.max(1, s.career.rank)); s.career.ytdBonusPool += b * 100; notify(s, "succes", "Mission à fort enjeu réussie", `La direction le note : +${b.toLocaleString("fr-FR")} € provisionnés sur votre bonus.`, "/play/remuneration"); }
    const col = s.npcs.colleague;
    if (col && col.trust <= 25 && m.giver && s.mode === "carriere") { s.reputation.interne = Math.max(0, s.reputation.interne - 1); notify(s, "alerte", `${col.name} s'attribue une part du mérite`, `Votre collègue laisse entendre qu'il a beaucoup contribué à « ${m.title} ».`, "/play/reseau"); }
    notify(s, "succes", `Mission réussie : ${m.title}`, `+${m.reward.xp} XP`, "/play/missions");
  } else {
    s.career.missionsFailed++;
    const st = m.daily ? m.stakes ?? 1 : 2;
    changeRep(s, "fiabilite", -st);
    if (m.giver) changeTrust(s, m.giver, -[0, 1, 3, 8][st], `Mission échouée : ${m.title}`);
    if (m.daily && st === 3) { changeRep(s, "professionnelle", -3, "Échec d'une mission à fort enjeu"); s.career.stress = Math.min(100, s.career.stress + 6); }
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

/** Appréciation globale (0-100) : confiance de la hiérarchie, réputation, dernière évaluation */
export function appreciation(s: GameState) {
  const n = s.npcs;
  return 0.35 * (n.boss?.trust ?? 50) + 0.15 * (n.director?.trust ?? 50) + 0.3 * avgRepM(s) + 0.2 * (s.career.reviews[0]?.score ?? 50);
}
function avgRepM(s: GameState) { const v = Object.values(s.reputation); return v.reduce((a, b) => a + b, 0) / v.length; }
/** Enjeu d'une mission : plus vous êtes apprécié et gradé, plus on vous confie des dossiers risqués (et inversement) */
export function drawStakes(s: GameState, rng: Rng): 1 | 2 | 3 {
  const a = appreciation(s) + (s.career.rank - 1) * 4;
  const pHigh = Math.max(0, Math.min(0.8, (a - 52) / 30)), pLow = Math.max(0, Math.min(0.85, (55 - a) / 25));
  const u = rng.next();
  return u < pHigh ? 3 : u < pHigh + pLow ? 1 : 2;
}
/** Chaque jour ouvré : au moins deux nouvelles missions, différentes de la veille */
const QUICK_FAM = new Set((["classe_achat", "ordre", "taille", "veille", "alertes", "secteur", "zone"]));
export function assignDailyMissions(s: GameState, rng: Rng) {
  if (!s.career.employed || s.mode !== "carriere") return;
  const day = dayIndex(s.t);
  if (day <= (s.flags["startDay"] as number)) return;
  if ((s.flags["vacationUntil"] && s.t < (s.flags["vacationUntil"] as number)) || s.flags["burnoutUntil"]) return; // pas de missions en congés ou en arrêt
  const yesterday = String(s.flags["dailyLast"] ?? "").split(",");
  const n = 2 + (s.career.rank >= 3 || appreciation(s) >= 70 ? 1 : 0);
  const deadlineT = day * MIN_PER_DAY + 18 * 60 + 30;
  const made: string[] = [];
  const recent = String(s.flags["recentTpl"] ?? "").split(",").filter(Boolean), recentFam = String(s.flags["recentFam"] ?? "").split(",").filter(Boolean);
  const famToday = new Set<string>();
  for (let slot = 0; slot < n * 4 && made.length < n; slot++) {
    // la pratique d'abord : 88 % de missions tirées d'une banque de plus de 500 modèles (calculs chiffrés, actions à mener sur la partie)
    const u = rng.next();
    let t: Tpl | undefined;
    if (u < 0.12) t = rng.pick(DAILY.filter((x) => !yesterday.includes(x.id)));
    else {
      const pool = (u < 0.8 ? BANK_CALC : BANK_ACTION.filter((x) => QUICK_FAM.has(x.family))).filter((x) => !recent.includes(x.id) && !recentFam.slice(-12).includes(x.family) && !famToday.has(x.family));
      t = pool.length ? rng.pick(pool) : undefined;
    }
    if (!t) continue;
    const st = drawStakes(s, rng);
    const bank = BANK.find((x) => x.id === t!.id);
    const giver = st === 3 ? "director" : st === 2 ? "boss" : (bank && bankGiver(bank) && st > 1 ? bankGiver(bank)! : rng.pick(["senior", "risk", "boss"]));
    const m = createMission(s, t.id, { k: st }, s.npcs[giver] ? giver : "boss", { daily: true, stakes: st, deadlineT, quiet: true });
    if (m) { made.push(t.id); if (bank) { famToday.add(bank.family); recent.push(t.id); recentFam.push(bank.family); } }
  }
  s.flags["recentTpl"] = recent.slice(-150).join(",");
  s.flags["recentFam"] = recentFam.slice(-30).join(",");
  s.flags["dailyLast"] = made.join(",");
  if (made.length) notify(s, "info", `${made.length} missions pour aujourd'hui`, "Elles sont à terminer avant 18 h 30. Les missions à fort enjeu rapportent beaucoup… et coûtent cher en cas d'échec.", "/play/missions");
}

/** Attribution hebdomadaire de missions par le responsable */
export function assignWeeklyMissions(s: GameState, rng: Rng) {
  if (!s.career.employed || s.mode !== "carriere") return;
  const active = s.missions.filter((m) => m.status === "active" && !m.daily).length;
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
  createMission(s, rng.pick(pool), {}, "boss");
  // + deux missions de pratique tirées de la banque (un calcul, une action sur la partie), différentes des dernières attribuées
  const recent = String(s.flags["recentTpl"] ?? "").split(",").filter(Boolean);
  for (const src of [BANK_CALC, BANK_ACTION]) {
    const p2 = src.filter((x) => !recent.includes(x.id));
    const t = p2.length ? rng.pick(p2) : undefined;
    if (t && createMission(s, t.id, { k: 1 }, "boss")) recent.push(t.id);
  }
  s.flags["recentTpl"] = recent.slice(-150).join(",");
  if (rng.chance(0.4)) createMission(s, "formation", { count: 2 }, "boss");
}
