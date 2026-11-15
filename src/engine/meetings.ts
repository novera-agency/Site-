/** Contenu des réunions jouables. Chaque réunion lit l'état réel de la simulation et produit des conséquences durables. */
import type { Client, GameState } from "./types";
import { registerMeeting, setLabelResolver, type MeetingCtx, type Doc, type MeetingNode } from "./meetingEngine";
import { changeRep, changeTrust, gainXp, notify, toEur, multiplier, nextId, clamp, avgRep, ZONE_NAMES, logDecision } from "./core";
import { accountEquity, positionViews, valueAtRisk, exposures, performance } from "./portfolio";
import { bondStats, futureDv01, frontFuture, sectorExposureEur } from "./analytics";
import { placeOrder } from "./orders";
import { REGIMES } from "./regimes";
import { createMission } from "./missions";
import { equityWeight, suitableEquityBand, loseClient, rebalanceClient } from "./clients";
import { rankTitle, joinBank, salaryFor } from "./career";
import { payslip, priceLevel } from "./life";
import { REQUESTS, OBJECTIONS, REACTIONS, requestsFor, type ReqChoice } from "./clientRequests";
import { addProspect, convertProspect, RECALL_DAYS } from "./prospects";
import { BANK_BY_ID, TRACKS } from "./data/banks";
import { toCents, fromCents } from "./money";
import { dayIndex, fmtTime, MIN_PER_DAY } from "./time";
import { Rng } from "./rng";
import { salesFault } from "./meetingEngine";
import { cashAcc, post } from "./ledger";
import { addAgendaItem } from "./agenda";
import { minuteOfDay, isWeekend, tOfDay, nextBusinessDay } from "./time";


const eur = (v: number) => `${Math.round(v).toLocaleString("fr-FR")} €`;
const pct = (v: number, d = 1) => `${v.toFixed(d).replace(".", ",")} %`;
const sc = (c: MeetingCtx, k: keyof MeetingCtx["m"]["score"], d: number) => { c.m.score[k] += d; };
const npc = (c: MeetingCtx, id: string) => c.s.npcs[id]?.name ?? id;
const me = (c: MeetingCtx) => c.s.profile.firstName;
const cl = (c: MeetingCtx): Client | undefined => c.s.clients.find((x) => x.id === c.m.vars.client);
const total = (c: MeetingCtx) => c.m.score.finance + c.m.score.risque + c.m.score.communication + c.m.score.ethique;
const v = (c: MeetingCtx, k: string) => Number(c.m.vars[k] ?? 0);
function clientDocs(c: MeetingCtx): Doc[] {
  const x = cl(c); if (!x) return [];
  const acc = c.s.accounts[x.accountId];
  const p = performance(acc);
  const eqw = equityWeight(c.s, acc.id);
  const [lo, hi] = suitableEquityBand(x.riskTolerance);
  return [
    { title: `Fiche client — ${x.name}`, rows: [["Encours", eur(accountEquity(c.s, acc.id))], ["Objectif", x.objective], ["Horizon", `${x.horizonYears} ans`], ["Profil de risque", `${x.riskTolerance}/7`], ["Connaissances financières", `${x.knowledge}/7`], ["Satisfaction", `${Math.round(x.satisfaction)}/100`], ["Contraintes", x.constraints.join(" ; ") || "—"], ["Frais", `${x.feeBps} pb/an`]] },
    { title: "Portefeuille", rows: [["Performance depuis l'ouverture", pct(p.totalReturn * 100)], ["Drawdown maximal", pct(p.maxDrawdown * 100)], ["Volatilité annualisée", pct(p.vol * 100)], ["Exposition actions", pct(eqw * 100, 0)], ["Bande adaptée au profil", `${Math.round(lo * 100)} – ${Math.round(hi * 100)} %`]] },
  ];
}
function clientEffect(c: MeetingCtx, sat: number, trust: number, memo: string) {
  const x = cl(c); if (!x) return;
  x.satisfaction = clamp(x.satisfaction + sat, 0, 100);
  x.lastContactT = c.s.t;
  changeTrust(c.s, x.npcId, trust, memo);
  x.history.unshift({ t: c.s.t, text: memo });
}

/* ═════════════════ Accueil (tutoriel) ═════════════════ */
registerMeeting({
  id: "accueil", type: "Entretien avec un supérieur", location: "Bureau du directeur", title: () => "Premier jour : accueil par votre responsable",
  participants: () => ["boss", "senior", "analyst", "colleague"], agenda: ["Présentation de l'équipe", "Votre rôle et vos limites", "Objectifs de la semaine"],
  objectives: ["Faire bonne impression", "Comprendre vos objectifs"],
  docs: (c) => { const b = BANK_BY_ID[c.s.career.bankId]; return [{ title: b.name, rows: [["Siège", b.city], ["Culture", b.culture], ["Politique de risque", b.riskPolicy], ["Votre poste", rankTitle(c.s)], ["Capital du book du desk", eur((c.s.accounts.desk?.capitalAllocated ?? 0) / 100)], ["Limite de VaR 99 % 1 j", eur(c.s.career.deskLimitVaR / 100)], ["Concentration max par position", pct(c.s.career.deskMaxPosition * 100, 0)]] }]; },
  start: "n0",
  nodes: {
    n0: { speaker: "boss", text: (c) => `Bienvenue chez ${BANK_BY_ID[c.s.career.bankId].short}, ${me(c)}. Je suis ${npc(c, "boss")}, je dirige ce desk. À ma droite, ${npc(c, "senior")}, qui a survécu à plus de crises que vous n'avez lu de manuels. ${npc(c, "analyst")} couvre l'analyse fondamentale, et ${npc(c, "colleague")} est arrivé il y a six mois. Ici, une règle : on ne cache jamais une perte. Des questions ?`,
      choices: [
        { id: "a", label: "Quelles sont exactement mes limites de risque ?", apply: (c) => { sc(c, "risque", 2); changeTrust(c.s, "boss", 3, "A demandé ses limites de risque dès le premier jour"); changeTrust(c.s, "risk", 2); }, next: "n1" },
        { id: "b", label: "Je suis là pour générer le plus gros P&L du desk.", apply: (c) => { sc(c, "risque", -1); changeTrust(c.s, "boss", -2, "Arrogance le premier jour"); changeTrust(c.s, "senior", 2); }, next: "n1b" },
        { id: "c", label: "Comment puis-je être utile à l'équipe dès cette semaine ?", apply: (c) => { sc(c, "communication", 2); changeTrust(c.s, "boss", 2); changeTrust(c.s, "colleague", 2); }, next: "n1" },
      ] },
    n1b: { speaker: "senior", text: () => "Ha. Tout le monde dit ça le premier jour. Le marché se charge en général de corriger cette ambition. Commence par ne pas perdre d'argent.", choices: [{ id: "ok", label: "Compris. Quelles sont mes limites ?", next: "n1" }] },
    n1: { speaker: "boss", text: (c) => `Votre accès au terminal est limité pour l'instant : actions et ETF sur le book du desk, avec une limite de VaR de ${eur(c.s.career.deskLimitVaR / 100)} et ${pct(c.s.career.deskMaxPosition * 100, 0)} maximum du capital par position. Le book contient déjà un portefeuille obligataire supervisé. Vous avez aussi votre compte personnel : ne mélangez JAMAIS les deux.`,
      choices: [
        { id: "a", label: "Pourquoi distinguer si strictement les deux comptes ?", apply: (c) => { sc(c, "ethique", 2); gainXp(c.s, "risque", 10, "Séparation des fonds"); }, reply: (c) => `${npc(c, "boss")} : « Parce que les fonds de la banque et des clients ne sont pas les vôtres. Confusion des patrimoines = faute grave, licenciement et régulateur. »`, next: "n2" },
        { id: "b", label: "C'est noté.", next: "n2" },
      ] },
    n2: { speaker: "boss", text: (c) => `Vos objectifs cette semaine : prendre en main le terminal, analyser un actif, passer votre premier ordre proprement, et suivre nos deux clients : ${c.s.clients.slice(0, 2).map((x) => x.name).join(" et ")}. Réunion du desk à 8 h 30 demain. Allez-y.`,
      choices: [{ id: "go", label: "Je commence immédiatement.", apply: (c) => sc(c, "communication", 1), next: "end" }] },
    end: { speaker: "narrateur", text: () => "Vous rejoignez votre poste. Les écrans s'allument.", end: true },
  },
  conclude: (c) => { gainXp(c.s, "management", 10, "Intégration dans l'équipe"); c.s.tutorial.step = Math.max(c.s.tutorial.step, 2); return total(c) >= 3 ? "Bonne première impression auprès de l'équipe." : "Première impression mitigée : il faudra faire vos preuves."; },
});

/* ═════════════════ Réunion quotidienne du desk ═════════════════ */
registerMeeting({
  id: "desk_quotidien", type: "Réunion quotidienne du desk", location: "Salle des marchés", title: () => "Réunion quotidienne du desk",
  participants: () => ["boss", "senior", "analyst", "colleague"], agenda: ["Revue des nouvelles de la nuit", "Événements de la journée", "Positionnement du book"],
  objectives: ["Identifier l'information décisive", "Anticiper le calendrier", "Proposer un positionnement cohérent"],
  init: (c) => {
    const recent = c.s.news.filter((n) => n.t > c.s.t - 20 * 60 * 1).slice(0, 12);
    const rank = (n: typeof recent[number]) => (n.impact === "fort" ? 3 : n.impact === "moyen" ? 2 : 1) * 10 + Math.abs(n.sentiment);
    const sorted = [...recent].sort((a, b) => rank(b) - rank(a));
    c.m.vars.n0 = sorted[0]?.title ?? "Aucune nouvelle majeure";
    c.m.vars.n1 = sorted[1]?.title ?? "Les marchés asiatiques clôturent sans tendance";
    c.m.vars.n2 = sorted[2]?.title ?? "Le consensus des analystes reste inchangé";
    c.m.vars.order = new Rng(c.s.rng).int(0, 2);
    const today = c.s.calendar.filter((e) => e.day === dayIndex(c.s.t) && !e.done).sort((a, b) => b.importance - a.importance);
    c.m.vars.e0 = today[0] ? `${fmtTime(today[0].day * MIN_PER_DAY + today[0].minute)} — ${today[0].title}` : "Aucune publication majeure";
    c.m.vars.e1 = today[1] ? `${fmtTime(today[1].day * MIN_PER_DAY + today[1].minute)} — ${today[1].title}` : "Ouverture du marché américain à 15 h 30";
  },
  docs: (c) => [
    { title: "Marchés", rows: [["Régime", REGIMES[c.s.macro.regime].label], ["EUROPA 50", c.s.quotes["IDX-EU"].price.toFixed(0)], ["AMERICA 100", c.s.quotes["IDX-US"].price.toFixed(0)], ["Bund 10 ans", pct(c.s.macro.zones.EZ.y10, 2)], ["Trésor US 10 ans", pct(c.s.macro.zones.US.y10, 2)], ["EUR/USD", c.s.quotes["EURUSD"].price.toFixed(4)], ["Brent", c.s.quotes["BRENT"].price.toFixed(2) + " $"]] },
    { title: "Book du desk", rows: [["Valeur", eur(accountEquity(c.s, "desk"))], ["P&L depuis le début de la semaine", eur(accountEquity(c.s, "desk") - c.s.career.weekStartEquity)], ["VaR 99 % 1 j", eur(valueAtRisk(c.s, "desk").var)], ["Limite", eur(c.s.career.deskLimitVaR / 100)]] },
  ],
  start: "q1",
  nodes: {
    q1: { speaker: "boss", text: (c) => `Bonjour à tous. ${me(c)}, selon vous, quelle est l'information la plus importante depuis hier soir pour notre book ?`,
      choices: [0, 1, 2].map((i) => ({ id: `n${i}`, label: "", apply: (c: MeetingCtx) => { if (deskAnswerCorrect(c.m.vars, `n${i}`)) { sc(c, "finance", 3); gainXp(c.s, "macro", 8, "Lecture des actualités"); } else sc(c, "finance", -1); }, next: "q2" })) },
    q2: { speaker: "boss", text: () => "Et aujourd'hui, quel est l'événement du calendrier à surveiller en priorité ?", choices: [
      { id: "e0", label: "", apply: (c) => { sc(c, "finance", 2); gainXp(c.s, "macro", 8, "Lecture du calendrier économique"); }, next: "q3" },
      { id: "e1", label: "", apply: (c) => sc(c, "finance", 0), next: "q3" },
    ] },
    q3: { speaker: "senior", text: (c) => `Le régime de marché est « ${REGIMES[c.s.macro.regime].label.toLowerCase()} ». Tu proposes quoi pour le book aujourd'hui ?`, choices: [
      { id: "prudent", label: "Réduire le risque avant les publications, garder de la marge sous la limite de VaR.", apply: (c) => { sc(c, "risque", REGIMES[c.s.macro.regime].volMult > 1.2 ? 3 : 1); changeTrust(c.s, "risk", 1); }, next: "end" },
      { id: "agressif", label: "Augmenter l'exposition : la tendance est notre amie.", apply: (c) => { const r = REGIMES[c.s.macro.regime]; sc(c, "finance", r.drift > 0.05 ? 2 : -2); sc(c, "risque", r.volMult > 1.2 ? -3 : 0); changeTrust(c.s, "senior", 1); }, next: "end" },
      { id: "neutre", label: "Rester neutre et se tenir prêt à exécuter les flux clients.", apply: (c) => { sc(c, "communication", 1); }, next: "end" },
    ] },
    end: { speaker: "boss", text: (c) => total(c) >= 4 ? "Bien. Préparation sérieuse. Au travail." : total(c) >= 1 ? "Correct. Soyez plus affûté demain." : "Vous n'avez visiblement pas lu les nouvelles ce matin. Inacceptable.", end: true },
  },
  conclude: (c) => {
    const t = total(c);
    changeTrust(c.s, "boss", t >= 4 ? 2 : t < 1 ? -3 : 0, t >= 4 ? "Réunion du desk bien préparée" : t < 1 ? "Réunion du desk mal préparée" : undefined);
    changeRep(c.s, "interne", t >= 4 ? 1 : t < 1 ? -1 : 0);
    gainXp(c.s, "marches", 10, "Réunion du desk");
    if (c.s.tutorial.step < 4) c.s.tutorial.step = 4;
    return `Score de préparation : ${t}. ${t >= 4 ? "Votre lecture du marché est jugée pertinente." : t >= 1 ? "Préparation correcte." : "Préparation insuffisante."}`;
  },
});

/* ═════════════════ Pertes obligataires (choc de taux) ═════════════════ */
registerMeeting({
  id: "pertes_obligataires", type: "Entretien avec un supérieur", location: "Bureau du directeur", title: () => "Pertes sur le portefeuille obligataire",
  participants: () => ["boss", "risk"], agenda: ["Analyse de l'exposition", "Sensibilité aux taux", "Stratégie de couverture"], tension: "Le responsable du desk est sous pression de sa hiérarchie.",
  objectives: ["Mesurer la duration", "Estimer la sensibilité", "Proposer une couverture adaptée"],
  init: (c) => { const b = bondStats(c.s, "desk"); c.m.vars.loss = Math.round(b.change5Pct * 10) / 10; c.m.vars.dur = b.modDur; c.m.vars.mv = b.mv; c.m.vars.dv01 = b.dv01; const f = frontFuture(c.s, "FBD"); c.m.vars.fut = f ?? ""; c.m.vars.fdv01 = f ? futureDv01(c.s, f) : 0; },
  docs: (c) => { const b = bondStats(c.s, "desk"); return [{ title: "Portefeuille obligataire du desk", rows: b.rows.map((r) => [r.id, `${eur(r.mv)} — duration mod. ${r.dur.toFixed(2)} — TRA ${pct(r.ytm, 2)} — DV01 ${eur(r.dv01)}`] as [string, string]), note: `Valeur totale ${eur(b.mv)}. Variation sur 5 jours : ${pct(b.change5Pct, 2)}.` }, { title: "Instrument de couverture", rows: [["Contrat", String(c.m.vars.fut || "—")], ["DV01 par contrat", eur(v(c, "fdv01"))], ["Rendement Bund 10 ans", pct(c.s.macro.zones.EZ.y10, 2)]] }]; },
  start: "n0",
  nodes: {
    n0: { speaker: "boss", text: (c) => `Notre portefeuille obligataire vient de perdre ${pct(Math.abs(v(c, "loss")))} à la suite de la hausse brutale des taux. Expliquez-moi notre exposition et proposez une stratégie. D'abord : quelle est la duration modifiée moyenne du portefeuille ?`,
      numeric: { prompt: "Duration modifiée moyenne pondérée (années)", unit: "ans", answer: (c) => v(c, "dur"), tolerance: () => 1, hint: "Moyenne des durations modifiées pondérée par la valeur de marché (voir le document).", onCorrect: (c) => { sc(c, "finance", 3); gainXp(c.s, "maths", 20, "Calcul de duration"); }, onWrong: (c) => sc(c, "finance", -1), next: "n1", explain: (c) => `Duration modifiée ≈ ${v(c, "dur").toFixed(2)} ans : le prix varie d'environ −${v(c, "dur").toFixed(1)} % pour +1 point de taux.` } },
    n1: { speaker: "risk", text: () => "Bien. Estimez maintenant la perte approximative du portefeuille si les taux montent encore de 50 points de base.",
      numeric: { prompt: "Perte estimée pour +50 pb (€, valeur positive)", unit: "€", answer: (c) => v(c, "mv") * v(c, "dur") * 0.005, tolerance: (c) => Math.max(500, v(c, "mv") * v(c, "dur") * 0.005 * 0.2), hint: "Perte ≈ Valeur × Duration modifiée × Δtaux (0,005).", onCorrect: (c) => { sc(c, "risque", 3); gainXp(c.s, "risque", 20, "Sensibilité aux taux"); }, onWrong: (c) => sc(c, "risque", -1), next: "n2", explain: (c) => `Perte ≈ ${eur(v(c, "mv"))} × ${v(c, "dur").toFixed(2)} × 0,5 % ≈ ${eur(v(c, "mv") * v(c, "dur") * 0.005)} (hors convexité).` } },
    n2: { speaker: "boss", text: () => "Que proposez-vous ?", choices: [
      { id: "fut", label: "Couvrir la sensibilité en vendant des futures Bund (couverture en DV01).", detail: "Nombre de contrats ≈ DV01 du portefeuille / DV01 d'un contrat", requires: (c) => !!c.m.vars.fut, apply: (c) => {
        const n = Math.max(1, Math.round(v(c, "dv01") / Math.max(1, v(c, "fdv01"))));
        const r = placeOrder(c.s, { account: "desk", instrumentId: String(c.m.vars.fut), side: "sell", type: "market", qty: n, tag: "rebalance" });
        c.m.vars.hedged = n; sc(c, "finance", 3); sc(c, "risque", 4); gainXp(c.s, "risque", 30, "Couverture par futures");
        c.m.log.push({ who: "Exécution", text: r.ok ? `${npc(c, "boss")} valide : vente de ${n} contrats ${c.m.vars.fut}. ${r.message}` : `Échec : ${r.error}` });
      }, next: "n3" },
      { id: "sell", label: "Vendre la moitié des obligations les plus longues.", apply: (c) => {
        const views = positionViews(c.s, "desk").filter((p) => p.cls === "obligation").sort((a, b) => (c.s.instruments[b.instrumentId].bond!.maturityDay - c.s.instruments[a.instrumentId].bond!.maturityDay));
        for (const p of views.slice(0, 2)) placeOrder(c.s, { account: "desk", instrumentId: p.instrumentId, side: "sell", type: "market", qty: Math.floor(p.qty / 2), tag: "rebalance" });
        sc(c, "risque", 2); sc(c, "finance", 1);
      }, reply: (c) => `${npc(c, "risk")} : « Efficace mais coûteux : on cristallise les pertes et on paie le spread. Une couverture aurait été plus souple. »`, next: "n3" },
      { id: "wait", label: "Ne rien faire : les taux vont redescendre.", apply: (c) => { sc(c, "risque", -3); sc(c, "finance", -1); }, reply: (c) => `${npc(c, "boss")} : « C'est un pari, pas une stratégie. »`, next: "n3" },
      { id: "more", label: "Racheter des obligations longues : elles sont moins chères.", apply: (c) => { sc(c, "risque", -4); }, reply: (c) => `${npc(c, "risk")} : « Vous doublez la mise sur le risque qui vient de nous coûter de l'argent. »`, next: "n3" },
    ] },
    n3: { speaker: "boss", text: () => "Et si les taux baissent demain, votre couverture nous fait perdre le rebond. Pourquoi l'assumer ?", choices: [
      { id: "a", label: "Une couverture réduit la variance : on renonce au gain potentiel pour protéger le capital dans nos limites de risque.", apply: (c) => { sc(c, "communication", 3); sc(c, "risque", 1); }, next: "end" },
      { id: "b", label: "On peut couvrir partiellement, par exemple 50 % du DV01, pour garder une exposition résiduelle assumée.", apply: (c) => { sc(c, "communication", 3); sc(c, "finance", 1); }, next: "end" },
      { id: "c", label: "Je ne sais pas, c'est vous qui décidez.", apply: (c) => sc(c, "communication", -3), next: "end" },
    ] },
    end: { speaker: "boss", text: (c) => total(c) >= 10 ? "Analyse solide. Vous avez le niveau." : total(c) >= 4 ? "Raisonnable. Révisez vos sensibilités." : "Insuffisant. Revoyez les bases de la gestion de taux.", end: true },
  },
  conclude: (c) => { const t = total(c); changeTrust(c.s, "boss", t >= 10 ? 6 : t >= 4 ? 1 : -5, `Analyse des pertes obligataires (score ${t})`); changeRep(c.s, "professionnelle", t >= 10 ? 4 : t < 4 ? -3 : 0, "Analyse d'exposition aux taux"); changeRep(c.s, "risque", c.m.vars.hedged ? 3 : 0); return `Score ${t}. ${c.m.vars.hedged ? `Couverture mise en place : ${c.m.vars.hedged} contrats vendus.` : "Aucune couverture par futures."}`; },
});

/* ═════════════════ Comité des risques hebdomadaire ═════════════════ */
registerMeeting({
  id: "comite_risques", type: "Comité des risques", location: "Salle de gestion des risques", title: () => "Comité des risques",
  participants: () => ["risk", "boss", "compliance"], agenda: ["VaR et limites", "Stress tests", "Concentration"],
  objectives: ["Identifier le principal risque", "Justifier les positions", "Proposer des mesures"],
  init: (c) => { const r = valueAtRisk(c.s, "desk"); c.m.vars.var = r.var; const worst = [...r.stressed].sort((a, b) => a.pnl - b.pnl)[0]; c.m.vars.worst = worst?.name ?? "—"; c.m.vars.worstPnl = worst?.pnl ?? 0; c.m.vars.ratio = (r.var / Math.max(1, c.s.career.deskLimitVaR / 100)) * 100; const others = r.stressed.filter((x) => x.name !== worst?.name); c.m.vars.alt1 = others[0]?.name ?? ""; c.m.vars.alt2 = others[2]?.name ?? ""; },
  docs: (c) => { const r = valueAtRisk(c.s, "desk"); const ex = exposures(c.s, "desk"); const top = positionViews(c.s, "desk").sort((a, b) => b.notionalEur - a.notionalEur).slice(0, 5); return [
    { title: "Mesures de risque du desk", rows: [["VaR 99 % 1 jour", eur(r.var)], ["Expected shortfall", eur(r.es)], ["Limite VaR", eur(c.s.career.deskLimitVaR / 100)], ["Levier brut", ex.grossLeverage.toFixed(2) + "x"], ["Plus grande position", pct(ex.largestWeight)]] },
    { title: "Stress tests", rows: r.stressed.map((x) => [x.name, eur(x.pnl)] as [string, string]) },
    { title: "Principales positions", rows: top.map((p) => [p.instrumentId, `${eur(p.notionalEur)} (${pct(p.weight)})`] as [string, string]) },
  ]; },
  start: "n0",
  nodes: {
    n0: { speaker: "risk", text: () => "Commençons par les stress tests. Quel scénario serait le plus pénalisant pour le book ?", choices: [
      { id: "w", label: "", apply: (c) => { sc(c, "risque", 3); gainXp(c.s, "risque", 15, "Lecture des stress tests"); }, next: "n1" },
      { id: "a1", label: "", apply: (c) => sc(c, "risque", -1), next: "n1" },
      { id: "a2", label: "", apply: (c) => sc(c, "risque", -1), next: "n1" },
    ] },
    n1: { speaker: "risk", text: () => "Quel est le niveau de consommation de la limite de VaR, en pourcentage ?",
      numeric: { prompt: "VaR / limite (%)", unit: "%", answer: (c) => v(c, "ratio"), tolerance: () => 10, hint: "VaR du desk divisée par la limite, × 100.", onCorrect: (c) => sc(c, "risque", 2), onWrong: (c) => sc(c, "risque", -1), next: "n2", explain: (c) => `Consommation : ${v(c, "ratio").toFixed(0)} % de la limite.` } },
    n2: { speaker: "boss", text: (c) => v(c, "ratio") > 80 ? "Nous sommes proches de la limite. Que faites-vous ?" : "Nous avons de la marge. Comment comptez-vous l'utiliser ?", choices: [
      { id: "cut", label: "Réduire de 30 % la plus grande position.", apply: (c) => { const top = positionViews(c.s, "desk").sort((a, b) => b.notionalEur - a.notionalEur)[0]; if (top) { const q = Math.max(1, Math.floor(Math.abs(top.qty) * 0.3)); const r = placeOrder(c.s, { account: "desk", instrumentId: top.instrumentId, side: top.qty > 0 ? "sell" : "buy", type: "market", qty: q, tag: "rebalance" }); c.m.log.push({ who: "Exécution", text: r.ok ? r.message : r.error }); } sc(c, "risque", v(c, "ratio") > 80 ? 3 : 0); }, next: "end" },
      { id: "keep", label: "Conserver : les positions sont justifiées et diversifiées.", apply: (c) => sc(c, "risque", v(c, "ratio") > 100 ? -4 : v(c, "ratio") > 80 ? -1 : 1), next: "end" },
      { id: "add", label: "Utiliser la marge disponible pour prendre de nouvelles positions argumentées.", apply: (c) => sc(c, "finance", v(c, "ratio") < 60 ? 2 : -2), next: "end" },
    ] },
    end: { speaker: "compliance", text: (c) => v(c, "ratio") > 100 ? "Le dépassement de limite sera consigné. Il doit être résorbé sous 24 heures." : "Rien à signaler côté conformité.", end: true },
  },
  conclude: (c) => { const t = total(c); changeTrust(c.s, "risk", t >= 5 ? 4 : t < 1 ? -4 : 0, `Comité des risques (score ${t})`); changeRep(c.s, "risque", t >= 5 ? 3 : t < 1 ? -3 : 0); if (c.s.tutorial.step < 12 && c.s.tutorial.step >= 11) c.s.tutorial.step = 12; return `Score ${t}. Consommation de limite : ${v(c, "ratio").toFixed(0)} %.`; },
});

/* ═════════════════ Comité d'investissement ═════════════════ */
registerMeeting({
  id: "comite_investissement", type: "Comité d'investissement", location: "Salle de réunion", title: () => "Comité d'investissement",
  participants: () => ["director", "analyst", "boss"], agenda: ["Présentation d'une idée d'investissement", "Valorisation", "Risques"],
  objectives: ["Choisir une idée défendable", "Argumenter avec les données", "Répondre aux objections"],
  init: (c) => {
    const rng = new Rng(c.s.rng);
    const pool = Object.values(c.s.instruments).filter((d) => d.cls === "action" && d.liquidity >= 0.7 && !c.s.quotes[d.id].defaulted);
    const picks: string[] = [];
    while (picks.length < 4) { const p = rng.pick(pool).id; if (!picks.includes(p)) picks.push(p); }
    picks.forEach((p, i) => { c.m.vars[`p${i}`] = p; });
  },
  docs: (c) => [{ title: "Dossiers préparés par l'analyse financière", rows: [0, 1, 2, 3].map((i) => { const id = String(c.m.vars[`p${i}`]); const d = c.s.instruments[id], q = c.s.quotes[id]; const per = q.price / (q.eps ?? 1); const mom = q.daily.length > 21 ? (q.price / q.daily[q.daily.length - 21].c - 1) * 100 : 0; return [`${id} — ${d.name}`, `Cours ${q.price.toFixed(2)} ${d.currency} · PER ${per.toFixed(1)} (normatif ${d.fairPE}) · Croissance ${pct((d.growth ?? 0) * 100)} · Dette nette/Rés. net ${(d.debt! / (d.revenue! * d.margin!)).toFixed(1)}x · Momentum 1 mois ${pct(mom)} · Valeur fondamentale estimée ${q.fair?.toFixed(2)}`] as [string, string]; }) }],
  start: "n0",
  nodes: {
    n0: { speaker: "director", text: (c) => `${me(c)}, quelle valeur recommandez-vous à l'achat parmi ces quatre dossiers ?`, choices: [0, 1, 2, 3].map((i) => ({ id: `p${i}`, label: "", apply: (c: MeetingCtx) => { const id = String(c.m.vars[`p${i}`]); c.m.vars.pick = id; const q = c.s.quotes[id]; const gap = (q.fair ?? q.price) / q.price - 1; c.m.vars.gap = gap; sc(c, "finance", gap > 0.08 ? 4 : gap > 0.02 ? 2 : gap > -0.03 ? 0 : -3); gainXp(c.s, "analyse", 20, "Analyse de valorisation"); }, next: "n1" })) },
    n1: { speaker: "director", text: () => "Votre argument principal ?", choices: [
      { id: "val", label: "La valorisation : le PER est inférieur à son niveau normatif et la décote sur la valeur fondamentale est significative.", apply: (c) => sc(c, "finance", v(c, "gap") > 0.03 ? 3 : -2), next: "n2" },
      { id: "mom", label: "La dynamique : le titre surperforme et le marché le confirme.", apply: (c) => { const q = c.s.quotes[String(c.m.vars.pick)]; const mom = q.daily.length > 21 ? q.price / q.daily[q.daily.length - 21].c - 1 : 0; sc(c, "finance", mom > 0.03 ? 2 : -2); }, next: "n2" },
      { id: "macro", label: "Le contexte macroéconomique favorise ce secteur.", apply: (c) => { const d = c.s.instruments[String(c.m.vars.pick)]; sc(c, "finance", (REGIMES[c.s.macro.regime].sectorTilt[d.sector!] ?? 0) > 0 ? 3 : -1); gainXp(c.s, "macro", 10, "Analyse macro sectorielle"); }, next: "n2" },
    ] },
    n2: { speaker: "analyst", text: (c) => { const d = c.s.instruments[String(c.m.vars.pick)]; return `Je conteste : ${d.risks?.[0] ?? "le risque spécifique"} n'est pas intégré. Et l'endettement ?`; }, choices: [
      { id: "a", label: "Le risque est réel : je propose une position limitée à 5 % du book avec un stop-loss à −8 %.", apply: (c) => { sc(c, "risque", 3); sc(c, "communication", 2); changeTrust(c.s, "analyst", 3, "A intégré ses objections"); }, next: "end" },
      { id: "b", label: "Ce risque est déjà dans le prix.", apply: (c) => { sc(c, "communication", v(c, "gap") > 0.08 ? 1 : -1); }, next: "end" },
      { id: "c", label: "Les analystes sont toujours trop prudents.", apply: (c) => { sc(c, "communication", -3); changeTrust(c.s, "analyst", -6, "A balayé ses objections avec mépris"); }, next: "end" },
    ] },
    end: { speaker: "director", text: (c) => total(c) >= 8 ? "Convaincant. Le comité valide. Nous suivrons la performance." : total(c) >= 3 ? "Le comité retient l'idée sous surveillance." : "Le comité rejette la proposition.", end: true },
  },
  conclude: (c) => {
    const t = total(c);
    const id = String(c.m.vars.pick);
    if (t >= 3) createMission(c.s, "recommandation", { instrument: id, startPrice: c.s.quotes[id].price, startIndex: c.s.quotes["IDX-WD"].price }, "director");
    changeTrust(c.s, "director", t >= 8 ? 5 : t < 3 ? -3 : 1, `Comité d'investissement : recommandation ${id}`);
    changeRep(c.s, "professionnelle", t >= 8 ? 3 : t < 3 ? -2 : 0);
    return `Recommandation ${id} — score ${t}. ${t >= 3 ? "Mission de suivi créée : la valeur doit surperformer l'indice MONDE." : "Idée rejetée."}`;
  },
});

/* ═════════════════ Réunion de crise : liquidité ═════════════════ */
registerMeeting({
  id: "crise_liquidite", type: "Réunion de crise", location: "Salle de gestion des risques", title: (c) => `Réunion de crise — ${c.s.instruments[String(c.m.vars.bank)]?.name ?? "banque"}`,
  participants: () => ["director", "boss", "risk", "compliance"], agenda: ["Examen des positions", "Identification des expositions", "Évaluation des pertes", "Mesures immédiates"], tension: "Le directeur exige des réponses immédiates. Les clients appellent.",
  objectives: ["Chiffrer l'exposition bancaire", "Limiter les pertes", "Communiquer"],
  init: (c) => { c.m.vars.exp = sectorExposureEur(c.s, "desk", "Banque"); const id = String(c.m.vars.bank); const p = c.s.accounts.desk?.positions[id]; c.m.vars.direct = p ? toEur(c.s, c.s.quotes[id].price * p.qty, c.s.instruments[id].currency) : 0; c.m.vars.var = valueAtRisk(c.s, "desk").var; },
  docs: (c) => { const id = String(c.m.vars.bank); const banks = positionViews(c.s, "desk").filter((p) => c.s.instruments[p.instrumentId].sector === "Banque" || c.s.instruments[p.instrumentId].bond?.issuerStock && c.s.instruments[c.s.instruments[p.instrumentId].bond!.issuerStock!].sector === "Banque" || p.instrumentId === "XBNK"); return [
    { title: "Situation de marché", rows: [[`Action ${id}`, `${c.s.quotes[id].price.toFixed(2)} (${pct((c.s.quotes[id].price / c.s.quotes[id].prevClose - 1) * 100)} aujourd'hui)`], ["ETF Banques européennes", pct((c.s.quotes["XBNK"].price / c.s.quotes["XBNK"].prevClose - 1) * 100)], ["Aversion au risque", (c.s.macro.riskAversion * 100).toFixed(0) + "/100"], ["Liquidité de marché", (c.s.macro.liquidity * 100).toFixed(0) + "/100"]] },
    { title: "Expositions bancaires du desk", rows: banks.length ? banks.map((p) => [p.instrumentId, eur(p.mvEur)] as [string, string]) : [["Aucune", "—"]], note: `VaR actuelle : ${eur(v(c, "var"))} / limite ${eur(c.s.career.deskLimitVaR / 100)}` },
  ]; },
  start: "n0",
  nodes: {
    n0: { speaker: "director", text: (c) => `Il est ${fmtTime(c.s.t)}. ${c.s.instruments[String(c.m.vars.bank)].name} ne trouve plus de financement. Je veux un chiffre : quelle est notre exposition totale au secteur bancaire, actions et obligations comprises ?`,
      numeric: { prompt: "Exposition bancaire totale du desk (€)", unit: "€", answer: (c) => v(c, "exp"), tolerance: (c) => Math.max(2000, Math.abs(v(c, "exp")) * 0.15), hint: "Additionnez les positions bancaires du document « Expositions bancaires ».", onCorrect: (c) => { sc(c, "risque", 4); gainXp(c.s, "risque", 30, "Identification des expositions en crise"); }, onWrong: (c) => { sc(c, "risque", -2); changeTrust(c.s, "director", -2); }, next: "n1", explain: (c) => `Exposition bancaire : ${eur(v(c, "exp"))}, dont ${eur(v(c, "direct"))} directement sur l'établissement en difficulté.` } },
    n1: { speaker: "risk", text: () => "Quelles mesures proposez-vous immédiatement ?", choices: [
      { id: "cut", label: "Réduire de moitié toutes les expositions bancaires, en commençant par l'émetteur en difficulté.", apply: (c) => { let n = 0; for (const p of positionViews(c.s, "desk")) { const d = c.s.instruments[p.instrumentId]; const isBank = d.sector === "Banque" || d.id === "XBNK" || (d.bond?.issuerStock && c.s.instruments[d.bond.issuerStock].sector === "Banque"); if (isBank && p.qty > 0) { const q = d.id === String(c.m.vars.bank) ? p.qty : Math.max(1, Math.floor(p.qty / 2)); const r = placeOrder(c.s, { account: "desk", instrumentId: d.id, side: "sell", type: "market", qty: q, tag: "rebalance" }); if (r.ok) n++; } } c.m.vars.actions = n; sc(c, "risque", v(c, "exp") > 0 ? 4 : 1); c.m.log.push({ who: "Exécution", text: `${n} ordre(s) de réduction transmis. Attention : la liquidité est dégradée, les spreads sont larges.` }); }, next: "n2" },
      { id: "hedge", label: "Couvrir le risque global en vendant des futures sur l'indice européen.", apply: (c) => { const f = frontFuture(c.s, "FEU"); if (f) { const notional = Math.max(0, v(c, "exp")); const n = Math.max(1, Math.round(notional / (c.s.quotes[f].price * multiplier(c.s.instruments[f])))); const r = placeOrder(c.s, { account: "desk", instrumentId: f, side: "sell", type: "market", qty: n, tag: "rebalance" }); c.m.log.push({ who: "Exécution", text: r.ok ? `Vente de ${n} futures ${f}. ${r.message}` : r.error }); } sc(c, "risque", 3); sc(c, "finance", 1); }, next: "n2" },
      { id: "buy", label: "Acheter l'action en difficulté : elle est bradée.", apply: (c) => { sc(c, "risque", -5); changeTrust(c.s, "risk", -5, "Proposition d'acheter en pleine crise de liquidité"); }, reply: (c) => `${npc(c, "risk")} : « On ne rattrape pas un couteau qui tombe. Refusé. »`, next: "n2" },
      { id: "none", label: "Attendre d'avoir plus d'informations.", apply: (c) => sc(c, "risque", v(c, "exp") > 0 ? -3 : 0), next: "n2" },
    ] },
    n2: { speaker: "director", text: () => "Nos clients vont appeler. Que leur dit-on ?", choices: [
      { id: "trans", label: "Les appeler de façon proactive : expliquer leur exposition réelle, les mesures prises et les risques.", apply: (c) => { sc(c, "communication", 4); sc(c, "ethique", 2); for (const x of c.s.clients.filter((y) => !y.lost)) { x.satisfaction = clamp(x.satisfaction + 4, 0, 100); x.lastContactT = c.s.t; } }, next: "n3" },
      { id: "calm", label: "Leur dire que tout est sous contrôle et qu'il n'y a aucun risque.", apply: (c) => { sc(c, "ethique", -4); changeTrust(c.s, "compliance", -5, "Communication trompeuse envisagée en crise"); }, reply: (c) => `${npc(c, "compliance")} : « Affirmer l'absence de risque est faux et engage notre responsabilité. »`, next: "n3" },
      { id: "nothing", label: "Ne rien dire tant qu'ils n'appellent pas.", apply: (c) => sc(c, "communication", -2), next: "n3" },
    ] },
    n3: { speaker: "director", text: () => "Dernière question : la banque centrale peut-elle nous sauver de cette crise ?", choices: [
      { id: "a", label: "Elle peut fournir de la liquidité aux banques solvables, mais pas résoudre un problème de solvabilité : nous devons gérer notre propre risque.", apply: (c) => { sc(c, "finance", 3); gainXp(c.s, "macro", 20, "Prêteur en dernier ressort"); }, next: "end" },
      { id: "b", label: "Oui, elle baissera ses taux et tout remontera.", apply: (c) => sc(c, "finance", -2), next: "end" },
    ] },
    end: { speaker: "director", text: (c) => total(c) >= 10 ? "Gestion de crise exemplaire. Je m'en souviendrai." : total(c) >= 4 ? "Correct, dans un contexte difficile." : "Vous avez perdu du temps et de la crédibilité.", end: true },
  },
  conclude: (c) => { const t = total(c); changeTrust(c.s, "director", t >= 10 ? 8 : t >= 4 ? 2 : -6, `Gestion de la crise de liquidité (score ${t})`); changeRep(c.s, "leadership", t >= 10 ? 6 : 0, t >= 10 ? "Gestion de crise remarquée par la direction" : undefined); changeRep(c.s, "risque", t >= 6 ? 4 : -4); const cr = c.s.crises.find((x) => x.id === c.m.vars.crisis); if (cr) cr.meetingDone = true; gainXp(c.s, "management", 25, "Gestion de crise"); return `Score de gestion de crise : ${t}. Les conséquences se matérialiseront dans les prochains jours selon l'évolution de la crise.`; },
});

/* ═════════════════ Réunions clients ═════════════════ */
const clientMeeting = (id: string, title: string, opening: (c: MeetingCtx) => string, choices: { label: string; sat: number; trust: number; fin?: number; risk?: number; comm?: number; eth?: number; reply?: string; memo: string; act?: (c: MeetingCtx) => void }[], follow?: { text: (c: MeetingCtx) => string; choices: { label: string; sat: number; trust: number; comm?: number; eth?: number; memo: string; act?: (c: MeetingCtx) => void }[] }) => registerMeeting({
  id, type: "Réunion avec un client", location: "Espace de gestion patrimoniale", title: (c) => `${title} — ${cl(c)?.name ?? ""}`,
  participants: (c) => [cl(c)?.npcId ?? "", "compliance"].filter(Boolean), agenda: ["Écoute du client", "Explications", "Décision"], objectives: ["Défendre l'intérêt du client", "Respecter la conformité", "Préserver la relation"],
  docs: clientDocs, start: "n0",
  nodes: {
    n0: { speaker: (c) => cl(c)?.npcId ?? "narrateur", text: opening, choices: choices.map((ch, i) => ({ id: `c${i}`, label: ch.label, apply: (c: MeetingCtx) => { sc(c, "finance", ch.fin ?? 0); sc(c, "risque", ch.risk ?? 0); sc(c, "communication", ch.comm ?? 0); sc(c, "ethique", ch.eth ?? 0); clientEffect(c, ch.sat, ch.trust, ch.memo); ch.act?.(c); }, reply: ch.reply ? () => ch.reply! : undefined, next: follow ? "n1" : "end" })) },
    ...(follow ? { n1: { speaker: (c: MeetingCtx) => cl(c)?.npcId ?? "narrateur", text: follow.text, choices: follow.choices.map((ch, i) => ({ id: `f${i}`, label: ch.label, apply: (c: MeetingCtx) => { sc(c, "communication", ch.comm ?? 0); sc(c, "ethique", ch.eth ?? 0); clientEffect(c, ch.sat, ch.trust, ch.memo); ch.act?.(c); }, next: "end" })) } } : {}),
    end: { speaker: "narrateur", text: (c) => `L'entretien se termine. Satisfaction de ${cl(c)?.name} : ${Math.round(cl(c)?.satisfaction ?? 0)}/100.`, end: true },
  },
  conclude: (c) => { const t = total(c); gainXp(c.s, "client", 20, `Entretien client (${title})`); changeRep(c.s, "clients", t >= 4 ? 2 : t < 0 ? -3 : 0); changeRep(c.s, "conformite", c.m.score.ethique < 0 ? -6 : c.m.score.ethique > 2 ? 2 : 0, c.m.score.ethique < 0 ? "Manquement au devoir de conseil" : undefined); if (c.s.tutorial.step === 9) c.s.tutorial.step = 10; return `Score : ${t} (éthique ${c.m.score.ethique}, communication ${c.m.score.communication}).`; },
});

clientMeeting("client_pertes", "Client mécontent après des pertes", (c) => { const x = cl(c)!; const p = performance(c.s.accounts[x.accountId]); return `J'ai regardé mon relevé : ${pct(p.totalReturn * 100)} depuis que vous gérez mon argent ! On m'avait promis de la sécurité. Expliquez-moi ce qui se passe.`; }, [
  { label: "Je reconnais la baisse. Voici son origine précise (marché, allocation) et ce que représente cette perte au regard de votre horizon et de votre profil.", sat: 6, trust: 6, comm: 4, eth: 2, memo: "Explication transparente des pertes" },
  { label: "Ne vous inquiétez pas, nous allons tout récupérer d'ici quelques semaines.", sat: 3, trust: -4, comm: -1, eth: -3, memo: "Promesse de rendement non tenable", reply: "Promettre une récupération est contraire au devoir de conseil." },
  { label: "Proposons de réduire le risque si cette volatilité dépasse ce que vous pouvez supporter, quitte à ajuster votre profil.", sat: 4, trust: 4, risk: 3, comm: 2, eth: 2, memo: "Proposition d'adapter le risque" },
  { label: "Pour vous refaire, je vous propose un produit à effet de levier.", sat: 1, trust: -6, risk: -4, eth: -5, memo: "Proposition inadaptée d'un produit à levier" },
], { text: () => "Bon… et concrètement, qu'est-ce que vous changez ?", choices: [
  { label: "Je revois l'allocation aujourd'hui même pour la remettre dans la bande adaptée à votre profil, et je vous envoie un compte rendu écrit.", sat: 5, trust: 4, comm: 3, eth: 1, memo: "Engagement de suivi écrit", act: (c) => { const x = cl(c); if (x) createMission(c.s, "allocation_client", { client: x.id }, x.npcId); } },
  { label: "Rien pour l'instant : la stratégie de long terme reste valable, je vous rappelle dans un mois.", sat: -2, trust: 1, comm: 1, memo: "Maintien de la stratégie" },
] });
clientMeeting("client_produit_risque", "Demande d'un produit trop risqué", (c) => `J'ai lu qu'un jeton crypto, Helios Meme, a fait +300 %. Je veux y mettre 30 % de mon portefeuille. Faites-le aujourd'hui.`, [
  { label: "Ce produit n'est pas adapté à votre profil (risque " + "élevé, absence de fondamentaux). Je ne peux pas le recommander ; voici pourquoi et une alternative diversifiée.", sat: -3, trust: 5, comm: 3, eth: 4, memo: "Refus argumenté d'un investissement inadapté" },
  { label: "D'accord, c'est votre argent.", sat: 5, trust: -2, eth: -6, risk: -4, memo: "Acceptation d'un investissement inadapté sans mise en garde" },
  { label: "Je peux accepter une poche très limitée (≤ 2 %), après signature d'un avertissement écrit, si votre profil le permet.", sat: 2, trust: 3, comm: 2, eth: (1), risk: 1, memo: "Compromis encadré" },
]);
clientMeeting("client_retrait", "Menace de retrait des capitaux", (c) => `Franchement, ${me(c)}, la concurrence me propose mieux. Je pense transférer mes avoirs le mois prochain.`, [
  { label: "Je comprends. Faisons un bilan factuel : performance, risque pris, frais, comparés à leur offre. Je vous propose ensuite un plan d'action.", sat: 10, trust: 6, comm: 4, memo: "Bilan factuel face à la menace de départ" },
  { label: "Je vous offre une remise de 30 % sur les frais si vous restez.", sat: 8, trust: 0, comm: 1, memo: "Remise sur les frais", act: (c) => { const x = cl(c); if (x) x.feeBps = Math.round(x.feeBps * 0.7); } },
  { label: "Si vous partez, vous le regretterez : leurs gérants sont médiocres.", sat: -8, trust: -8, comm: -3, memo: "Dénigrement de la concurrence" },
  { label: "Partez si vous voulez.", sat: -15, trust: -10, comm: -4, memo: "Indifférence", act: (c) => { const x = cl(c); if (x && x.satisfaction < 20) loseClient(c.s, x, "le client a mis sa menace à exécution"); } },
]);
clientMeeting("client_frais", "Contestation des frais", (c) => `Vos frais de ${cl(c)?.feeBps} points de base par an sont trop élevés. Je veux les réduire de moitié.`, [
  { label: "Je justifie les frais par le service rendu (gestion, reporting, risque) et propose un geste limité de 10 %.", sat: 3, trust: 3, comm: 3, memo: "Négociation des frais", act: (c) => { const x = cl(c); if (x) x.feeBps = Math.round(x.feeBps * 0.9); } },
  { label: "J'accepte de réduire de moitié.", sat: 8, trust: 2, fin: -3, memo: "Frais divisés par deux", act: (c) => { const x = cl(c); if (x) x.feeBps = Math.round(x.feeBps * 0.5); changeTrust(c.s, "boss", -4, `Frais divisés par deux pour ${x?.name}`); } },
  { label: "Les frais ne sont pas négociables.", sat: -6, trust: -3, comm: -2, memo: "Refus de négocier" },
  { label: "Je propose une structure de frais indexée sur la performance (frais fixes réduits + commission de surperformance).", sat: 5, trust: 4, comm: 3, fin: 1, memo: "Frais liés à la performance", act: (c) => { const x = cl(c); if (x) x.feeBps = Math.round(x.feeBps * 0.75); } },
]);
clientMeeting("client_rendement_irrealiste", "Objectif de rendement irréaliste", (c) => `Mon objectif : 20 % par an, sans aucun risque de perte. Vous êtes des professionnels, non ?`, [
  { label: "Rendement et risque sont indissociables : sans risque, le rendement est proche du taux sans risque (" + "≈ taux directeur). Je vous montre des scénarios chiffrés.", sat: 1, trust: 6, comm: 4, eth: 3, memo: "Pédagogie sur le couple rendement/risque", act: (c) => gainXp(c.s, "client", 15, "Pédagogie client") },
  { label: "C'est possible avec nos produits structurés.", sat: 6, trust: -6, eth: -6, memo: "Promesse irréaliste" },
  { label: "Changez de banque, c'est impossible.", sat: -8, trust: -4, comm: -3, memo: "Réponse abrupte" },
]);
clientMeeting("client_conformite", "Demande contraire à la conformité", (c) => `Un ami au conseil d'administration de ${c.s.instruments["AERO"].name} m'a dit qu'une acquisition sera annoncée la semaine prochaine. Achetez massivement pour moi, et ne le mentionnez nulle part.`, [
  { label: "Je refuse : il s'agit d'une information privilégiée. Je suis tenu de signaler cette demande à la conformité.", sat: -10, trust: 2, eth: 6, comm: 1, memo: "Refus d'un délit d'initié et signalement", act: (c) => { changeTrust(c.s, "compliance", 8, "A signalé une tentative de délit d'initié"); changeRep(c.s, "conformite", 6, "Signalement exemplaire à la conformité"); } },
  { label: "J'exécute discrètement l'ordre.", sat: 8, trust: 3, eth: -12, memo: "Participation à un délit d'initié", act: (c) => { c.s.flags["insiderRisk"] = c.s.t; changeRep(c.s, "conformite", -25, "Délit d'initié"); c.s.career.warnings += 2; notify(c.s, "critique", "Infraction grave", "La conformité ouvre une enquête sur une opération suspecte.", "/play/reputation"); } },
  { label: "Je refuse poliment sans rien signaler.", sat: -6, trust: 0, eth: 1, memo: "Refus sans signalement", act: (c) => changeRep(c.s, "conformite", -2) },
]);
clientMeeting("client_point_regulier", "Point régulier", (c) => `Bonjour ${me(c)}. Où en est mon portefeuille et que pensez-vous des marchés en ce moment ?`, [
  { label: "Je présente la performance, l'allocation, les risques et le contexte macro actuel, puis propose d'éventuels ajustements.", sat: 5, trust: 4, comm: 3, memo: "Point de suivi complet", act: (c) => gainXp(c.s, "macro", 5, "Commentaire de marché client") },
  { label: "Tout va bien, rien à signaler.", sat: 0, trust: -1, comm: -1, memo: "Point de suivi superficiel" },
]);
clientMeeting("client_panique", "Appel paniqué en pleine crise", (c) => `J'ai vu les infos sur ${c.s.instruments[String(c.m.vars.bank ?? "PCBK")]?.name} ! Est-ce que mon argent est en danger ? Faut-il tout vendre ?`, [
  { label: "Vos avoirs sont ségrégués et ne sont pas exposés à la faillite de cette banque. Votre exposition indirecte est de tant ; je vous déconseille de vendre dans la panique.", sat: 8, trust: 7, comm: 4, eth: 2, memo: "Réassurance factuelle en crise" },
  { label: "Vendons tout immédiatement par précaution.", sat: 2, trust: -2, risk: -2, memo: "Vente panique", act: (c) => { const x = cl(c); if (!x) return; for (const p of Object.values(c.s.accounts[x.accountId].positions)) placeOrder(c.s, { account: x.accountId, instrumentId: p.instrumentId, side: "sell", type: "market", qty: p.qty, tag: "rebalance" }); } },
  { label: "Je n'ai pas le temps, je vous rappelle.", sat: -10, trust: -8, comm: -3, memo: "Client ignoré en pleine crise" },
]);

/* ═════════════════ Question technique (tutoriel) ═════════════════ */
registerMeeting({
  id: "question_technique", type: "Entretien avec un supérieur", location: "Salle des marchés", title: () => "Question technique du responsable",
  participants: () => ["boss"], agenda: ["Vérification des connaissances"], objectives: ["Répondre juste"],
  start: "n0",
  nodes: {
    n0: { speaker: "boss", text: () => "Petite vérification. Une obligation de duration modifiée 8 est détenue pour 1 000 000 €. Les taux montent de 50 points de base. Quelle perte approximative ?",
      numeric: { prompt: "Perte approximative (€)", unit: "€", answer: () => 40000, tolerance: () => 2000, hint: "Perte ≈ Valeur × Duration modifiée × Δtaux.", onCorrect: (c) => { sc(c, "finance", 4); gainXp(c.s, "maths", 25, "Question technique"); }, onWrong: (c) => sc(c, "finance", -2), next: "n1", explain: () => "1 000 000 × 8 × 0,5 % = 40 000 € (approximation au premier ordre, hors convexité)." } },
    n1: { speaker: "boss", text: () => "Et un call à la monnaie a un delta d'environ… ?", choices: [
      { id: "a", label: "0,5 : il gagne environ 0,5 € par euro de hausse du sous-jacent.", apply: (c) => { sc(c, "finance", 3); gainXp(c.s, "maths", 10, "Delta d'option"); }, next: "end" },
      { id: "b", label: "1 : il suit parfaitement le sous-jacent.", apply: (c) => sc(c, "finance", -1), next: "end" },
      { id: "c", label: "0 : il n'a pas de valeur intrinsèque.", apply: (c) => sc(c, "finance", -1), next: "end" },
    ] },
    end: { speaker: "boss", text: (c) => total(c) >= 6 ? "Parfait." : total(c) >= 2 ? "À moitié. Révisez au centre de formation." : "Révisez les bases, sérieusement.", end: true },
  },
  conclude: (c) => { changeTrust(c.s, "boss", total(c) >= 6 ? 4 : total(c) < 2 ? -3 : 0, "Question technique"); if (c.s.tutorial.step < 11) c.s.tutorial.step = 11; return `Score ${total(c)}.`; },
});

/* ═════════════════ Entretien annuel et négociation salariale ═════════════════ */
registerMeeting({
  id: "entretien_annuel", type: "Entretien avec un supérieur", location: "Bureau du directeur", title: () => "Entretien annuel et négociation salariale",
  participants: () => ["boss", "director"], agenda: ["Bilan de l'année", "Objectifs", "Rémunération"], objectives: ["Obtenir une augmentation justifiée", "Préserver la relation"],
  docs: (c) => { const r = c.s.career.reviews.slice(0, 4); return [{ title: "Dossier d'évaluation", rows: [["Poste", rankTitle(c.s)], ["Salaire actuel", eur(c.s.career.salaryAnnual / 100)], ["Confiance du responsable", `${Math.round(c.s.npcs.boss.trust)}/100`], ["Réputation moyenne", `${Math.round(avgRep(c.s))}/100`], ["Offres concurrentes", String(c.s.career.pendingOffers.length)], ...r.map((x) => [`Revue ${x.kind}`, `${x.score}/100`] as [string, string])] }]; },
  start: "n0",
  nodes: {
    n0: { speaker: "boss", text: (c) => `${me(c)}, faisons le point sur l'année. ${c.s.career.reviews[0] ? `Votre score : ${c.s.career.reviews[0].score}/100.` : ""} Qu'attendez-vous ?`, choices: [
      { id: "small", label: "Une augmentation de 4 %, justifiée par mes résultats et le respect des limites.", apply: (c) => { const ok = c.s.npcs.boss.trust >= 45; if (ok) { c.s.career.salaryAnnual = Math.round(c.s.career.salaryAnnual * 1.04); c.m.vars.res = "Augmentation de 4 % accordée."; } else c.m.vars.res = "Refusé : la confiance n'est pas suffisante."; sc(c, "communication", 2); }, next: "end" },
      { id: "big", label: "15 % : je suis l'un des meilleurs éléments du desk.", apply: (c) => { const score = c.s.career.reviews[0]?.score ?? 50; const ok = score >= 72 && c.s.npcs.boss.trust >= 65; if (ok) { c.s.career.salaryAnnual = Math.round(c.s.career.salaryAnnual * 1.15); c.m.vars.res = "Accordé. Vos chiffres parlent pour vous."; } else { c.m.vars.res = "Refusé : vos résultats ne justifient pas une telle demande."; changeTrust(c.s, "boss", -3, "Demande salariale excessive"); } }, next: "end" },
      { id: "offer", label: "J'ai une offre d'un concurrent. Alignez-vous ou je pars.", requires: (c) => c.s.career.pendingOffers.length > 0, apply: (c) => { const o = c.s.career.pendingOffers[0]; const ok = c.s.npcs.director.trust >= 50; if (ok) { c.s.career.salaryAnnual = Math.max(c.s.career.salaryAnnual, Math.round(o.salary * 0.97)); c.m.vars.res = "La direction s'aligne presque sur l'offre concurrente."; } else { c.m.vars.res = "La direction refuse de surenchérir. La relation se tend."; changeTrust(c.s, "director", -6, "Chantage à la démission"); } }, next: "end" },
      { id: "train", label: "Plutôt qu'une augmentation : une formation certifiante et plus de responsabilités.", apply: (c) => { gainXp(c.s, "management", 40, "Formation certifiante"); gainXp(c.s, "analyse", 30, "Formation certifiante"); changeTrust(c.s, "boss", 4, "Ambition constructive"); c.m.vars.res = "Accordé : formation financée et responsabilités élargies."; }, next: "end" },
    ] },
    end: { speaker: "boss", text: (c) => String(c.m.vars.res ?? ""), end: true },
  },
  conclude: (c) => `${c.m.vars.res} Nouveau salaire : ${eur(c.s.career.salaryAnnual / 100)}.`,
});

/* ═════════════════ Prospection téléphonique ═════════════════ */
const pr = (c: MeetingCtx) => c.s.prospects?.find((x) => x.id === c.m.vars.pros);
const prNpc = (c: MeetingCtx) => `npc_${String(c.m.vars.pros)}`;
const pts = (c: MeetingCtx, d: number) => { c.m.vars.pts = v(c, "pts") + d; if (d > 0) sc(c, "communication", d); };
const PROSPECT_OBJ: { text: string; choices: { label: string; d: number; recall?: boolean; ethics?: boolean }[] }[] = [
  { text: "Écoutez, je n'ai vraiment pas le temps, là.", choices: [{ label: "Je comprends. Quand puis-je vous rappeler ? Deux minutes suffiront.", d: 2, recall: true }, { label: "Ça ne prendra que vingt minutes, promis !", d: -2 }] },
  { text: "J'ai déjà un banquier, merci.", choices: [{ label: "Très bien. Beaucoup de mes clients en avaient un aussi : je vous propose simplement un second avis, gratuit, sur votre situation.", d: 2 }, { label: "Votre banquier ne vous fait sûrement pas gagner grand-chose.", d: -3 }] },
  { text: "Je n'aime pas beaucoup le démarchage téléphonique…", choices: [{ label: "Je le comprends. Je ne vous vendrai rien au téléphone : seulement, si vous le souhaitez, un rendez-vous pour faire le point.", d: 2 }, { label: "C'est mon travail, il faut bien que j'appelle des gens.", d: -2 }] },
  { text: "Envoyez-moi plutôt un mail, je regarderai.", choices: [{ label: "Avec plaisir. Pour qu'il vous soit utile : quel est votre principal projet en ce moment ?", d: 2 }, { label: "Entendu, je vous envoie notre plaquette.", d: 0, recall: true }] },
  { text: "Et vous prenez combien, en frais ?", choices: [{ label: "Je vous donne la fourchette exacte, et tout sera écrit noir sur blanc avant toute décision.", d: 2 }, { label: "Ne vous inquiétez pas pour les frais, c'est le rendement qui compte.", d: -2 }] },
];
registerMeeting({
  id: "prospection", type: "Appel téléphonique", location: "Au téléphone", title: (c) => `Prospection : ${pr(c)?.name ?? "un prospect"}`,
  participants: (c) => [prNpc(c)],
  agenda: ["Accroche", "Objection", "Découverte", "Proposition de rendez-vous"], objectives: ["Se présenter clairement", "Lever l'objection sans insister", "Comprendre le besoin", "Obtenir un rendez-vous"],
  tension: "Un prospect ne vous doit rien : soyez clair, honnête et bref. Trop insistant, il raccroche.",
  init: (c) => {
    const p = pr(c); if (!p) return;
    const rng = new Rng(c.s.rng);
    if (!c.s.npcs[prNpc(c)]) c.s.npcs[prNpc(c)] = { id: prNpc(c), name: p.name, role: `Prospect — ${p.desc}`, personality: p.desc, avatar: p.avatar, trust: p.warm ? 55 : 40, riskTolerance: p.risk / 7, mood: 0.5, goals: [p.objective], opinion: "Ne vous connaît pas encore", memory: [], relation: "client" } as never;
    const m = minuteOfDay(c.s.t);
    const open = !isWeekend(c.s.t) && m >= 8 * 60 + 30 && m < 19 * 60 + 30;
    const pickup = open && rng.chance(p.warm ? 0.8 : p.status === "rappel" ? 0.65 : 0.45) ? 1 : 0;
    p.attempts++; p.lastCallT = c.s.t;
    c.m.vars.pickup = pickup; c.m.vars.pts = 0; c.m.vars.o = rng.int(0, PROSPECT_OBJ.length - 1); c.m.vars.g = rng.int(0, 2);
    if (!pickup) c.m.nodeId = "repondeur";
  },
  docs: (c) => { const p = pr(c); return p ? [{ title: `Fiche prospect — ${p.name}`, rows: [["Profil", p.desc], ["Source", p.source], ["Patrimoine estimé", eur(p.wealth)], ["Potentiel à confier", eur(p.potential)], ["Objectif probable", p.objective], ["Tentatives d'appel", String(p.attempts)], ["Statut", p.status === "rappel" ? "À rappeler (déjà intéressé)" : "Premier contact"]] }] : []; },
  start: "accroche",
  nodes: {
    accroche: { speaker: (c) => prNpc(c), text: (c) => [`Allô ? Oui… c'est à quel sujet ?`, `${pr(c)?.name}, j'écoute. Vous êtes qui ?`, "Oui ? Faites vite, je suis entre deux rendez-vous."][v(c, "g")], choices: [
      { id: "a", label: "Bonjour, je me présente, et je vous explique en une phrase pourquoi je vous appelle.", apply: (c) => pts(c, 2), reply: (c) => { const p = pr(c)!; const b = BANK_BY_ID[c.s.career.bankId]; return p.warm ? `(Vous : « ${me(c)}, de ${b?.name}. ${p.source.replace("Recommandé par", "")} m'a parlé de vous et m'a dit que vous cherchiez un conseiller. »)` : `(Vous : « ${me(c)}, conseiller chez ${b?.name}. J'accompagne des personnes dans votre situation pour organiser leur patrimoine. Avez-vous deux minutes ? »)`; }, next: (c) => `pobj_${v(c, "o")}` },
      { id: "b", label: "J'ai un placement exceptionnel à 10 % par an sans aucun risque, ça vous intéresse ?", apply: (c) => { pts(c, -4); sc(c, "ethique", -3); changeRep(c.s, "conformite", -2, "Démarchage avec une promesse trompeuse"); }, next: (c) => `pobj_${v(c, "o")}` },
      { id: "c", label: "Bonjour, je suis de la banque. Vous avez deux minutes ?", apply: (c) => pts(c, 0), next: (c) => `pobj_${v(c, "o")}` },
    ] },
    ...Object.fromEntries(PROSPECT_OBJ.map((o, k) => [`pobj_${k}`, { speaker: (c: MeetingCtx) => prNpc(c), text: () => o.text, choices: o.choices.map((ch, i) => ({ id: `o${i}`, label: ch.label, apply: (c: MeetingCtx) => { pts(c, ch.d); if (ch.recall) c.m.vars.recall = 1; }, next: "decouverte" })) } as MeetingNode])),
    decouverte: { speaker: (c) => prNpc(c), text: (c) => { const p = pr(c)!; return v(c, "pts") < 0 ? "Bon… Vous voulez savoir quoi, au juste ?" : `D'accord. En deux mots : ${p.objective.toLowerCase()}. Mon patrimoine, c'est de l'ordre de ${eur(roundNice(p.wealth))}.`; }, choices: [
      { id: "a", label: "Qu'est-ce qui compte le plus pour vous : la sécurité, le rendement ou la disponibilité de l'argent ?", apply: (c) => { pts(c, 2); gainXp(c.s, "client", 8, "Découverte d'un prospect"); }, next: "close" },
      { id: "b", label: "Notre fonds phare est parfait pour vous, je vous l'envoie ?", apply: (c) => pts(c, -2), next: "close" },
      { id: "c", label: "Je vois, c'est très classique.", apply: (c) => pts(c, 0), next: "close" },
    ] },
    close: { speaker: (c) => prNpc(c), text: (c) => (v(c, "pts") >= 4 ? "C'est intéressant. Concrètement, vous me proposez quoi ?" : "Hmm. Et donc, vous me proposez quoi ?"), choices: [
      { id: "a", label: "Un rendez-vous de trente minutes, sans engagement, pour étudier votre situation : mardi ou jeudi ?", apply: (c) => { pts(c, 2); c.m.vars.rdv = 1; }, next: "fin" },
      { id: "b", label: "Je vous envoie une documentation et je vous rappelle dans quelques jours.", apply: (c) => { pts(c, 0); c.m.vars.recall = 1; }, next: "fin" },
      { id: "c", label: "Signez aujourd'hui, je vous envoie le contrat par mail.", apply: (c) => pts(c, -3), next: "fin" },
    ] },
    fin: { speaker: "narrateur", text: () => "L'appel se termine.", end: true },
    repondeur: { speaker: "narrateur", text: (c) => `Pas de réponse : messagerie de ${pr(c)?.name}.`, choices: [
      { id: "a", label: "Laisser un message court : qui vous êtes, pourquoi vous appelez, comment vous joindre.", apply: (c) => { c.m.vars.message = 1; }, next: "fin" },
      { id: "b", label: "Raccrocher sans laisser de message.", next: "fin" },
    ] },
  },
  conclude: (c) => {
    const p = pr(c); if (!p) return "Appel terminé.";
    if (!v(c, "pickup")) {
      if (p.attempts >= 4) { p.status = "refus"; p.note = "Injoignable"; return `${p.name} reste injoignable après ${p.attempts} tentatives : contact abandonné.`; }
      p.note = v(c, "message") ? "Message laissé" : "Pas de réponse";
      return `${p.name} n'a pas décroché.${v(c, "message") ? " Votre message est enregistré ; rappelez dans quelques jours." : ""}`;
    }
    const score = v(c, "pts") + (p.status === "rappel" ? 2 : 0) + (p.warm ? 1 : 0);
    if (v(c, "rdv") && score >= 6) {
      const r = convertProspect(c.s, p, 0.55 + (score - 6) * 0.08);
      changeRep(c.s, "commerciale", 3, "Nouveau client gagné par prospection"); changeTrust(c.s, "boss", 3, "Prospection réussie");
      gainXp(c.s, "client", 40, "Prospection réussie");
      notify(c.s, "succes", `Nouveau client : ${p.name}`, `Rendez-vous concluant : ${eur(r.aum)} confiés.`, "/play/clients");
      return `Rendez-vous obtenu et concluant : ${p.name} devient client et vous confie ${eur(r.aum)}.`;
    }
    if (score >= 2 || v(c, "recall")) { p.status = "rappel"; p.note = "Intéressé, à rappeler"; gainXp(c.s, "client", 10, "Prospection"); return `${p.name} est intéressé mais pas encore décidé : rappelez dans ${RECALL_DAYS} jours.`; }
    p.status = "refus"; p.note = "Pas intéressé"; changeRep(c.s, "commerciale", -1);
    return `${p.name} n'est pas intéressé${score <= -3 ? " et a mal pris votre approche" : ""}.`;
  },
});

/* ═════════════════ Négociation salariale à l'initiative du joueur ═════════════════ */
const lastScore = (c: MeetingCtx) => c.s.career.reviews[0]?.score ?? 50;
const marketPay = (c: MeetingCtx) => Math.max(...Object.keys(BANK_BY_ID).map((b) => salaryFor(b, c.s.career.rank))) * priceLevel(c.s);
/** Force du dossier : résultats, confiance du responsable, réputation, ancienneté dans le poste, argument choisi */
function caseStrength(c: MeetingCtx) {
  const s = c.s;
  const tenureY = (s.t - ((s.flags["rankSinceT"] as number) ?? s.career.hiredT)) / (365 * MIN_PER_DAY);
  return (lastScore(c) - 55) * 0.8 + (s.npcs.boss.trust - 50) * 0.5 + (avgRep(s) - 50) * 0.3 + Math.min(10, tenureY * 6) + v(c, "arg") - s.career.warnings * 6 - (s.life ? Math.max(0, 40 - s.life.mental) * 0.2 : 0);
}
/** Décision du responsable (appelée une seule fois, après l'argument) */
function decideRaise(c: MeetingCtx) {
  const st = caseStrength(c), ask = v(c, "ask");
  const need = ask <= 5 ? 0 : ask <= 10 ? 8 : 14;
  const weak = c.m.vars.weak ? "Le coût de la vie n'est pas un argument de performance. " : "";
  if (st >= need) { grantRaise(c, ask); changeTrust(c.s, "boss", 2, "Négociation salariale réussie"); c.m.vars.res = `D'accord pour ${ask} %. Vous l'avez mérité.`; c.m.vars.done = 1; c.m.vars.say = c.m.vars.res; return; }
  const counter = Math.max(0, Math.min(ask - 1, Math.round((st + 10) / 4)));
  c.m.vars.counter = counter;
  c.m.vars.say = counter >= 2 ? `${weak}${ask} %, ce n'est pas possible. Je peux aller jusqu'à ${counter} %.` : `${weak}Honnêtement, ce n'est pas le moment : vos résultats ne le justifient pas encore.`;
}
function grantRaise(c: MeetingCtx, pct: number) {
  c.s.career.salaryAnnual = Math.round(c.s.career.salaryAnnual * (1 + pct / 100));
  c.m.vars.granted = pct;
  logDecision(c.s, "carriere", `Augmentation négociée : +${pct} % (nouveau salaire ${eur(c.s.career.salaryAnnual / 100)})`);
}
registerMeeting({
  id: "negociation_salaire", type: "Entretien avec un supérieur", location: "Bureau de votre responsable", title: () => "Négociation de votre rémunération",
  participants: () => ["boss"], agenda: ["Votre demande", "Vos arguments", "Décision"], objectives: ["Obtenir une augmentation ou des avantages", "Ne pas abîmer la relation"],
  tension: "Une demande mal argumentée ou excessive peut vexer votre responsable.",
  docs: (c) => {
    const s = c.s; const pay = payslip(s); const mk = marketPay(c);
    return [
      { title: "Votre fiche de paie", rows: [["Salaire brut annuel", eur(s.career.salaryAnnual / 100)], ["Brut mensuel", eur(pay.gross)], ["Cotisations sociales", `−${eur(pay.social)}`], ["Net avant impôt", eur(pay.net)], ["Impôt prélevé à la source", `−${eur(pay.tax)}`], ["Net versé chaque mois", eur(pay.netAfterTax)]] },
      { title: "Éléments de négociation", rows: [["Dernière évaluation", `${lastScore(c)}/100`], ["Confiance de votre responsable", `${Math.round(s.npcs.boss.trust)}/100`], ["Réputation moyenne", `${Math.round(avgRep(s))}/100`], ["Meilleur salaire du marché pour votre poste", eur(mk)], ["Offres concurrentes en cours", String(s.career.pendingOffers.length)], ["Avertissements au dossier", String(s.career.warnings)]] },
    ];
  },
  init: (c) => { c.m.vars.arg = 0; },
  start: "n0",
  nodes: {
    n0: { speaker: "boss", text: (c) => `Entrez, ${me(c)}. Vous avez demandé à me voir : qu'est-ce que je peux faire pour vous ?`, choices: [
      { id: "p5", label: "J'aimerais parler de mon salaire : je pense mériter une augmentation de 5 %.", apply: (c) => { c.m.vars.ask = 5; }, next: "arg" },
      { id: "p10", label: "Je demande 10 % : mon travail dépasse largement ce qu'on attend de mon poste.", apply: (c) => { c.m.vars.ask = 10; c.m.vars.arg = -6; }, next: "arg" },
      { id: "mk", label: "Je voudrais être payé au niveau du marché pour mon poste.", apply: (c) => { const gap = Math.round((marketPay(c) / (c.s.career.salaryAnnual / 100) - 1) * 100); c.m.vars.ask = Math.max(3, Math.min(20, gap)); c.m.vars.arg = gap > 3 ? 4 : -4; }, next: "arg" },
      { id: "tt", label: "Plutôt qu'une augmentation : deux jours de télétravail par semaine.", requires: (c) => !c.s.life?.perks.teletravail, apply: (c) => { const ok = c.s.npcs.boss.trust >= 48 && c.s.career.warnings < 2; if (ok && c.s.life) { c.s.life.perks.teletravail = true; c.m.vars.res = "Accordé : deux jours de télétravail par semaine. Moins de trajets, plus de temps pour vous."; } else c.m.vars.res = "Pas pour l'instant : je dois d'abord avoir pleinement confiance en votre autonomie."; }, next: "end" },
      { id: "cp", label: "Cinq jours de congés supplémentaires par an.", requires: (c) => (c.s.life?.perks.extraLeave ?? 0) < 5, apply: (c) => { const ok = caseStrength(c) > 2; if (ok && c.s.life) { c.s.life.perks.extraLeave = 5; c.m.vars.res = "Accordé : 30 jours de congés par an."; } else { c.m.vars.res = "Refusé : la charge de travail ne le permet pas."; changeTrust(c.s, "boss", -1); } }, next: "end" },
      { id: "of", label: "J'ai reçu une offre d'un concurrent. Je préfère rester, si vous vous alignez.", requires: (c) => c.s.career.pendingOffers.length > 0, apply: (c) => { const o = c.s.career.pendingOffers[0]; c.m.vars.ask = Math.max(3, Math.round((o.salary / c.s.career.salaryAnnual - 1) * 100)); c.m.vars.arg = 12;  decideRaise(c); }, next: "dec" },
    ] },
    arg: { speaker: "boss", text: (c) => `${v(c, "ask")} %… Sur quoi vous appuyez-vous ?`, choices: [
      { id: "res", label: "Sur mes résultats : mes évaluations, mon P&L et le respect de mes limites.", apply: (c) => { c.m.vars.arg = v(c, "arg") + (lastScore(c) >= 65 ? 8 : lastScore(c) >= 50 ? 2 : -6); sc(c, "communication", 2);  decideRaise(c); }, next: "dec" },
      { id: "resp", label: "Sur les responsabilités que j'ai prises : clients, missions, gestion de crise.", apply: (c) => { c.m.vars.arg = v(c, "arg") + Math.min(8, c.s.career.missionsDone * 0.8 + c.s.clients.filter((x) => !x.lost).length); sc(c, "communication", 1);  decideRaise(c); }, next: "dec" },
      { id: "vie", label: "Mon loyer et le coût de la vie ont augmenté.", apply: (c) => { c.m.vars.arg = v(c, "arg") - 5; c.m.vars.weak = 1;  decideRaise(c); }, next: "dec" },
      { id: "anc", label: "Cela fait un moment que je suis dans l'équipe sans évolution.", apply: (c) => { const y = (c.s.t - ((c.s.flags["rankSinceT"] as number) ?? c.s.career.hiredT)) / (365 * MIN_PER_DAY); c.m.vars.arg = v(c, "arg") + (y >= 1 ? 5 : -4);  decideRaise(c); }, next: "dec" },
    ] },
    dec: { speaker: "boss", text: (c) => String(c.m.vars.say ?? ""), choices: [
      { id: "acc", label: "J'accepte votre proposition.", requires: (c) => !c.m.vars.done && v(c, "counter") >= 2, apply: (c) => { grantRaise(c, v(c, "counter")); c.m.vars.res = `Augmentation de ${v(c, "counter")} % accordée.`; }, next: "end" },
      { id: "ins", label: "J'insiste : c'est mon chiffre, sinon je regarderai ailleurs.", requires: (c) => !c.m.vars.done, apply: (c) => { const ok = caseStrength(c) + 6 >= (v(c, "ask") <= 10 ? 8 : 14) && c.s.career.pendingOffers.length > 0; if (ok) { grantRaise(c, v(c, "ask")); c.m.vars.res = `Bon… ${v(c, "ask")} %. Mais j'attends beaucoup de vous.`; } else { changeTrust(c.s, "boss", -6, "Ultimatum salarial"); c.s.career.stress = clamp(c.s.career.stress + 6, 0, 100); c.m.vars.res = "Je n'apprécie pas les ultimatums. La réponse est non."; } }, next: "end" },
      { id: "ren", label: "Je comprends. Revoyons-en dans six mois, avec des objectifs précis.", requires: (c) => !c.m.vars.done, apply: (c) => { changeTrust(c.s, "boss", 3, "Négociation constructive"); c.m.vars.res = "Entendu : objectifs fixés, on en reparle dans six mois."; }, next: "end" },
      { id: "ok", label: "Merci, je ne vous décevrai pas.", requires: (c) => !!c.m.vars.done, next: "end" },
    ] },
    end: { speaker: "boss", text: (c) => String(c.m.vars.res ?? "Bien. Au travail."), end: true },
  },
  conclude: (c) => { if (c.s.life) c.s.life.lastRaiseAskT = c.s.t; return `${c.m.vars.res ?? ""} Salaire brut annuel : ${eur(c.s.career.salaryAnnual / 100)} (net mensuel après impôt : ${eur(payslip(c.s).netAfterTax)}).`; },
});

/* ═════════════════ Entretien d'embauche ═════════════════ */
const INTERVIEW_QS: { q: string; a: string[]; ok: number; branch: "maths" | "marches" | "analyse" | "macro" | "risque" | "client" }[] = [
  { q: "Une obligation a une duration modifiée de 6. Les taux baissent de 1 %. Que fait son prix ?", a: ["Il monte d'environ 6 %", "Il baisse d'environ 6 %", "Il ne bouge pas"], ok: 0, branch: "maths" },
  { q: "Que mesure le ratio de Sharpe ?", a: ["Le rendement excédentaire par unité de volatilité", "La perte maximale", "Le rendement total"], ok: 0, branch: "risque" },
  { q: "Un PER de 10 signifie…", a: ["Le cours vaut 10 fois le bénéfice par action", "Le dividende est de 10 %", "La dette vaut 10 fois l'EBITDA"], ok: 0, branch: "analyse" },
  { q: "Une hausse surprise des taux directeurs américains tend à…", a: ["Renforcer le dollar", "Affaiblir le dollar", "N'avoir aucun effet sur le change"], ok: 0, branch: "macro" },
  { q: "Le theta d'une option achetée est généralement…", a: ["Négatif : elle perd de la valeur avec le temps", "Positif", "Toujours nul"], ok: 0, branch: "maths" },
  { q: "Un client prudent demande 50 % de cryptoactifs. Vous…", a: ["Expliquez l'inadéquation et refusez de le recommander", "Exécutez sans commentaire", "Doublez la mise"], ok: 0, branch: "client" },
  { q: "La VaR 99 % à 1 jour de 1 M€ signifie…", a: ["1 % de chances de perdre plus de 1 M€ en un jour", "La perte maximale possible est 1 M€", "On perd 1 M€ par jour"], ok: 0, branch: "risque" },
  { q: "Un spread bid-ask qui s'élargit fortement signale…", a: ["Une baisse de liquidité", "Une hausse des dividendes", "Une baisse de volatilité"], ok: 0, branch: "marches" },
];
registerMeeting({
  id: "entretien_embauche", type: "Entretien de recrutement", location: "Siège du recruteur", title: (c) => `Entretien de recrutement — ${BANK_BY_ID[c.s.career.pendingOffers.find((o) => o.id === c.m.vars.offer)?.bankId ?? "lutece"]?.name}`,
  participants: () => ["recruiter"], agenda: ["Questions techniques", "Motivation"], objectives: ["Réussir au moins 2 questions sur 3"],
  init: (c) => { const rng = new Rng(c.s.rng); const idx = [0, 1, 2, 3, 4, 5, 6, 7].sort(() => rng.next() - 0.5).slice(0, 3); idx.forEach((k, i) => { c.m.vars[`q${i}`] = k; }); c.m.vars.good = 0; },
  start: "q0",
  nodes: Object.fromEntries(([0, 1, 2].map((i) => [`q${i}`, { speaker: "recruiter", text: (c: MeetingCtx) => INTERVIEW_QS[v(c, `q${i}`)].q, choices: [0, 1, 2].map((k) => ({ id: `a${k}`, label: "", apply: (c: MeetingCtx) => { const q = INTERVIEW_QS[v(c, `q${i}`)]; if (k === q.ok) { c.m.vars.good = v(c, "good") + 1; sc(c, "finance", 2); gainXp(c.s, q.branch, 10, "Entretien technique"); } }, next: i < 2 ? `q${i + 1}` : "mot" })) }]) as [string, MeetingNode][]).concat([["mot", { speaker: "recruiter", text: () => "Pourquoi nous rejoindre ?", choices: [
    { id: "a", label: "Pour la culture et les spécialités de la maison, qui correspondent à mon projet professionnel.", apply: (c: MeetingCtx) => sc(c, "communication", 2), next: "end" },
    { id: "b", label: "Pour le salaire.", apply: (c: MeetingCtx) => sc(c, "communication", -1), next: "end" },
  ] }], ["end", { speaker: "recruiter", text: (c: MeetingCtx) => v(c, "good") >= 2 ? "Très bien. Nous vous faisons une offre ferme." : "Merci, nous reviendrons vers vous.", end: true }]] as [string, MeetingNode][])),
  conclude: (c) => {
    const o = c.s.career.pendingOffers.find((x) => x.id === c.m.vars.offer);
    if (!o) return "Offre expirée.";
    const b = BANK_BY_ID[o.bankId];
    const pass = v(c, "good") >= 2 && avgRep(c.s) + v(c, "good") * 5 >= b.difficulty * 10;
    if (pass) { c.s.flags[`offerReady_${o.id}`] = true; c.s.messages.unshift({ id: nextId(c.s, "msg"), t: c.s.t, from: b.name, subject: "Offre ferme", body: `Nous avons le plaisir de vous proposer le poste de ${TRACKS[o.track].ranks[o.rank]} pour ${fromCents(o.salary).toLocaleString("fr-FR")} € par an.`, read: false, actions: [{ label: "Accepter et démissionner", action: "accept_offer", payload: { offer: o.id } }, { label: "Négocier +8 %", action: "negotiate_offer", payload: { offer: o.id } }, { label: "Refuser", action: "decline_offer", payload: { offer: o.id } }] }); }
    else c.s.career.pendingOffers = c.s.career.pendingOffers.filter((x) => x.id !== o.id);
    return pass ? `Entretien réussi (${v(c, "good")}/3). Offre ferme reçue dans la messagerie.` : `Entretien échoué (${v(c, "good")}/3).`;
  },
});

/* ═════════════════ Régulateur ═════════════════ */
registerMeeting({
  id: "regulateur", type: "Réunion avec un régulateur", location: "Salle de réunion", title: () => "Entretien avec l'inspecteur du régulateur",
  participants: () => ["regulator", "compliance"], agenda: ["Incidents de risque", "Procédures", "Mesures correctrices"], tension: "Une sanction est possible.",
  objectives: ["Être transparent", "Démontrer la maîtrise des risques"],
  docs: (c) => [{ title: "Dossier d'inspection", rows: [["Dépassements de limites", String(c.s.career.breaches)], ["Avertissements", String(c.s.career.warnings)], ["Score conformité", `${Math.round(c.s.reputation.conformite)}/100`]] }],
  start: "n0",
  nodes: {
    n0: { speaker: "regulator", text: (c) => `Nous avons relevé ${c.s.career.breaches} dépassement(s) de limites sur votre book. Expliquez-vous.`, choices: [
      { id: "a", label: "Je présente chronologiquement chaque incident, sa cause, et les mesures prises pour éviter qu'il se reproduise.", apply: (c) => { sc(c, "ethique", 4); sc(c, "communication", 3); }, next: "end" },
      { id: "b", label: "Ces dépassements étaient mineurs et techniques.", apply: (c) => sc(c, "ethique", -1), next: "end" },
      { id: "c", label: "Je n'étais pas au courant.", apply: (c) => { sc(c, "ethique", -3); }, next: "end" },
    ] },
    end: { speaker: "regulator", text: (c) => c.m.score.ethique >= 3 ? "Votre transparence est notée. Pas de sanction individuelle." : "Une lettre d'observation sera adressée à votre établissement.", end: true },
  },
  conclude: (c) => { const ok = c.m.score.ethique >= 3; changeRep(c.s, "conformite", ok ? 6 : -8, ok ? "Transparence face au régulateur" : "Observations du régulateur"); if (ok) c.s.career.breaches = Math.max(0, c.s.career.breaches - 1); else c.s.career.warnings++; return ok ? "Aucune sanction." : "Lettre d'observation : avertissement inscrit au dossier."; },
});

/** Libellés dynamiques : certaines réunions construisent leurs choix à partir des variables */
export function dynamicLabels(s: GameState, templateId: string, nodeId: string, vars: Record<string, number | string>, id: string, fallback: string): string {
  if (templateId === "desk_quotidien" && nodeId === "q1") { const order = Number(vars.order ?? 0); const keys = ["n0", "n1", "n2"]; const k = keys[(keys.indexOf(id) + order) % 3]; return String(vars[k]); }
  if (templateId === "desk_quotidien" && nodeId === "q2") return String(vars[id]);
  if (templateId === "comite_risques" && nodeId === "n0") return String(id === "w" ? vars.worst : id === "a1" ? vars.alt1 : vars.alt2);
  if (templateId === "comite_investissement" && nodeId === "n0") { const iid = String(vars[id]); return `${iid} — ${s.instruments[iid]?.name ?? ""}`; }
  if (templateId === "entretien_embauche" && nodeId.startsWith("q")) { const q = INTERVIEW_QS[Number(vars[nodeId])]; return q.a[Number(id.slice(1))]; }
  return fallback;
}
/** Correction : dans la réunion du desk, la bonne réponse q1 est n0 (information la plus importante) */
export function deskAnswerCorrect(vars: Record<string, number | string>, choiceId: string) { const order = Number(vars.order ?? 0); const keys = ["n0", "n1", "n2"]; return keys[(keys.indexOf(choiceId) + order) % 3] === "n0"; }
setLabelResolver(dynamicLabels);
export { ZONE_NAMES, salaryFor, joinBank };

/* ═════════════════ Appel téléphonique commercial ═════════════════ */

const roundNice = (x: number) => { const step = x > 1e6 ? 50000 : x > 2e5 ? 10000 : 5000; return Math.max(step, Math.round(x / step) * step); };
const EVENT: Record<string, string[]> = {
  particulier: ["la vente d'un appartement", "une succession", "une prime exceptionnelle"],
  institutionnel: ["les cotisations encaissées ce trimestre", "le remboursement d'une obligation arrivée à échéance"],
  entreprise: ["une trésorerie excédentaire ce trimestre", "la cession d'une filiale"],
};
/** Réponse à une demande spéciale ou à une objection : effets selon la qualité, réaction variée du client */
function answerRequest(c: MeetingCtx, ch: ReqChoice, objection = false) {
  const x = cl(c); if (!x) return;
  const rng = new Rng(c.s.rng);
  const collect = !!v(c, "collect");
  if (ch.q === "bon") { sc(c, "communication", 2); sc(c, "finance", 1); gainXp(c.s, "client", 6, "Bonne réponse à un client"); }
  if (ch.q === "faute" || ch.ethics) { sc(c, "ethique", -3); changeRep(c.s, "conformite", -3, `Au téléphone : ${ch.why}`); }
  if (collect) {
    if (ch.q === "moyen") salesFault(c, 0.05, ch.why);
    if (ch.q === "mauvais") salesFault(c, objection ? 0.15 : 0.2, ch.why);
    if (ch.q === "faute") salesFault(c, 0.3, ch.why);
  } else {
    c.m.vars.sat = v(c, "sat") + (ch.sat ?? (ch.q === "bon" ? 5 : ch.q === "moyen" ? 0 : -6));
    if (ch.fees) x.feeBps = Math.round(x.feeBps * ch.fees);
    if (ch.prospect) c.m.vars.newProspect = addProspect(c.s, rng, { source: `Recommandé par ${x.name}`, warm: true, kind: x.kind === "institutionnel" ? "entreprise" : x.kind })?.name ?? "";
    const rq = REQUESTS.find((r) => r.id === c.m.vars.rq); c.m.vars.rqLabel = rq ? { retrait: "demande de retrait", frais: "négociation des frais", panique: "client inquiet", fiscalite: "question fiscale", recommandation: "recommandation d'un proche" }[rq.id] ?? rq.id : "";
  }
  if (!objection) c.m.vars.react = rng.pick(REACTIONS[ch.q]);
  if (ch.q !== "bon") c.m.vars.lastWhy = ch.why;
}
registerMeeting({
  id: "appel_client", type: "Appel téléphonique", location: "Au téléphone", title: (c) => `Appel à ${cl(c)?.name ?? "un client"}`,
  participants: (c) => [cl(c)?.npcId ?? ""].filter(Boolean),
  agenda: ["Prise de contact", "Besoins du client", "Proposition", "Objection", "Conclusion"],
  objectives: ["Comprendre le besoin avant de proposer", "Proposer une solution adaptée au profil", "Obtenir un versement sans faute"],
  tension: "Chaque maladresse fait baisser l'objectif de vente. Sous 30 % de l'objectif, le client raccroche.",
  init: (c) => {
    const x = cl(c); if (!x) return;
    const rng = new Rng(c.s.rng);
    const aum = accountEquity(c.s, x.accountId);
    const free = Math.max(0, x.wealth / 100 - aum);
    const obj = roundNice(Math.max(10000, Math.min(aum * 0.18, free * 0.4 || aum * 0.18)));
    c.m.vars.event = rng.pick(EVENT[x.kind] ?? EVENT.particulier);
    // Demande spéciale du jour (imposable pour les tests via params.rq)
    const pool = requestsFor(x.kind);
    const rq = REQUESTS.find((r) => r.id === c.m.vars.rq) ?? rng.pick(pool);
    c.m.vars.rq = rq.id; c.m.vars.rqv = rng.int(0, rq.intro.length - 1); c.m.vars.collect = rq.collect ? 1 : 0;
    c.m.vars.obj = c.m.vars.obj !== undefined ? Number(c.m.vars.obj) : rng.int(0, OBJECTIONS.length); c.m.vars.objv = rng.int(0, 1);
    c.m.vars.greet = rng.int(0, 3);
    const m = minuteOfDay(c.s.t);
    const open = !isWeekend(c.s.t) && m >= 8 * 60 && m < 20 * 60;
    const p = 0.45 + x.satisfaction / 200 + (c.s.npcs[x.npcId]?.trust ?? 50) / 400;
    const pickup = c.m.vars.callback ? 1 : open && rng.chance(Math.min(0.95, p)) ? 1 : 0;
    c.m.vars.pickup = pickup;
    if (!pickup) c.m.nodeId = "repondeur";
    else if (rq.collect) { c.m.vars.objInit = obj; c.m.vars.objective = obj; c.m.vars.faults = 0; } // pas d'objectif de vente sur une messagerie ni pour une demande de service
    x.lastContactT = c.s.t;
  },
  docs: (c) => { const x = cl(c); if (!x) return []; return [...clientDocs(c), ...(v(c, "pickup") ? [{ title: "Objectif de l'appel", rows: [["Montant visé", eur(v(c, "objInit"))], ["Origine probable des fonds", String(c.m.vars.event)], ["Règle", "Chaque faute réduit l'objectif ; sous 30 %, le client raccroche."]] as [string, string][] }] : [])]; },
  start: "decroche",
  nodes: {
    decroche: { speaker: (c) => cl(c)?.npcId ?? "narrateur", text: (c) => c.m.vars.callback ? `Allô, ${me(c)} ? Vous m'aviez laissé un message, je vous rappelle. Je vous écoute.` : [`Allô ? ${cl(c)?.name}, j'écoute.`, "Oui, allô ? Ah, c'est vous ! Justement, je voulais vous parler.", "Allô… Oui, j'ai deux minutes, je vous écoute.", "Bonjour ! Ça tombe bien que vous appeliez."][v(c, "greet")], choices: [
      { id: "a", label: "Bonjour, je vous appelle pour faire le point sur votre situation et vos projets.", apply: (c) => { sc(c, "communication", 2); }, next: (c) => `rq_${c.m.vars.rq}` },
      { id: "b", label: "J'ai un produit exceptionnel qui rapporte énormément, vous allez adorer !", apply: (c) => { sc(c, "communication", -2); if (v(c, "collect")) salesFault(c, 0.15, "démarchage trop agressif"); else c.m.vars.sat = v(c, "sat") - 4; }, next: (c) => `rq_${c.m.vars.rq}` },
      { id: "c", label: "Euh… je voulais juste prendre des nouvelles.", apply: (c) => { if (v(c, "collect")) salesFault(c, 0.05, "appel sans objet clair"); }, next: (c) => `rq_${c.m.vars.rq}` },
    ] },
    ...Object.fromEntries(REQUESTS.map((rq) => [`rq_${rq.id}`, {
      speaker: (c: MeetingCtx) => cl(c)?.npcId ?? "narrateur",
      text: (c: MeetingCtx) => rq.intro[v(c, "rqv") % rq.intro.length].replace("{amount}", eur(v(c, "objInit") || roundNice((cl(c)?.wealth ?? 0) / 100 * 0.03))),
      choices: rq.choices.map((ch, i) => ({ id: `r${i}`, label: ch.label, apply: (c: MeetingCtx) => answerRequest(c, ch), next: () => (rq.collect ? "react_c" : "react_s") })),
    } as MeetingNode])),
    react_c: { speaker: (c) => cl(c)?.npcId ?? "narrateur", text: (c) => String(c.m.vars.react ?? ""), choices: [
      { id: "a", label: "Concrètement, voici comment je vous propose d'investir cette somme.", next: "proposition" },
    ] },
    react_s: { speaker: (c) => cl(c)?.npcId ?? "narrateur", text: (c) => String(c.m.vars.react ?? ""), choices: [
      { id: "a", label: "Y a-t-il autre chose que je puisse faire pour vous ?", apply: (c) => { sc(c, "communication", 1); }, next: "fin" },
    ] },
    ...Object.fromEntries(OBJECTIONS.map((ob, k) => [`obj_${k}`, {
      speaker: (c: MeetingCtx) => cl(c)?.npcId ?? "narrateur",
      text: (c: MeetingCtx) => ob.text[v(c, "objv") % ob.text.length],
      choices: ob.choices.map((ch, i) => ({ id: `o${i}`, label: ch.label, apply: (c: MeetingCtx) => answerRequest(c, ch, true), next: "closing" })),
    } as MeetingNode])),
    proposition: { speaker: (c) => cl(c)?.npcId ?? "narrateur", text: (c) => `Concrètement, que feriez-vous de ces ${eur(v(c, "objective"))} ?`, choices: [
      { id: "a", label: "Les investir progressivement selon votre allocation actuelle, qui est adaptée à votre profil.", apply: (c) => { sc(c, "finance", 2); sc(c, "ethique", 1); }, next: (c) => (v(c, "obj") >= OBJECTIONS.length ? "objection" : `obj_${v(c, "obj")}`) },
      { id: "b", label: "Tout placer sur les valeurs technologiques : c'est là que se fait la performance.", apply: (c) => { const r = cl(c)!.riskTolerance; if (r >= 6) sc(c, "finance", 1); else { sc(c, "ethique", -2); salesFault(c, r <= 3 ? 0.3 : 0.2, "proposition inadaptée au profil de risque"); } }, next: (c) => (v(c, "obj") >= OBJECTIONS.length ? "objection" : `obj_${v(c, "obj")}`) },
      { id: "c", label: "Souscrire un produit structuré à capital protégé à 95 % à l'échéance.", apply: (c) => { const r = cl(c)!.riskTolerance; if (r >= 2 && r <= 4) sc(c, "finance", 2); else salesFault(c, 0.1, "produit peu adapté"); }, next: (c) => (v(c, "obj") >= OBJECTIONS.length ? "objection" : `obj_${v(c, "obj")}`) },
      { id: "d", label: "Les laisser sur un compte rémunéré en attendant d'y voir plus clair.", apply: (c) => { const x = cl(c)!; if (x.riskTolerance <= 2 || x.liquidityNeed >= 0.3) sc(c, "finance", 1); else salesFault(c, 0.1, "proposition sans valeur ajoutée"); }, next: (c) => (v(c, "obj") >= OBJECTIONS.length ? "objection" : `obj_${v(c, "obj")}`) },
    ] },
    objection: { speaker: (c) => cl(c)?.npcId ?? "narrateur", text: (c) => { const x = cl(c)!; const p = performance(c.s.accounts[x.accountId]); return p.totalReturn < -0.03 ? `Hum. Mon portefeuille a perdu ${pct(Math.abs(p.totalReturn * 100))} depuis l'ouverture. Pourquoi vous confierais-je davantage ?` : x.feeBps >= 80 ? `Vos frais de ${x.feeBps} points de base par an me paraissent élevés. Pourquoi payer ça ?` : "Et si les marchés baissent juste après ? J'ai peur de mal tomber."; }, choices: [
      { id: "a", label: "Je comprends. Voici les chiffres honnêtes : les risques, ce que vous pouvez perdre, et pourquoi c'est cohérent avec votre horizon.", apply: (c) => { sc(c, "communication", 2); sc(c, "ethique", 2); }, next: "closing" },
      { id: "b", label: "Je vous garantis que vous ne perdrez rien.", apply: (c) => { sc(c, "ethique", -3); changeRep(c.s, "conformite", -3, "Promesse de garantie interdite au téléphone"); salesFault(c, 0.25, "promesse de garantie trompeuse"); }, next: "closing" },
      { id: "c", label: "Je peux vous accorder une remise de 20 % sur les frais.", apply: (c) => { const x = cl(c)!; x.feeBps = Math.round(x.feeBps * 0.8); sc(c, "communication", 1); }, next: "closing" },
      { id: "d", label: "Si vous ne décidez pas aujourd'hui, l'occasion sera passée.", apply: (c) => { sc(c, "communication", -2); salesFault(c, 0.15, "pression commerciale"); }, next: "closing" },
    ] },
    closing: { speaker: (c) => cl(c)?.npcId ?? "narrateur", text: () => "Bon… Et maintenant, comment on procède ?", choices: [
      { id: "a", label: "Je vous envoie le bulletin de versement par écrit et je m'occupe de l'investissement dès réception.", apply: (c) => { c.m.vars.closeMult = 1; sc(c, "communication", 1); }, next: "fin" },
      { id: "b", label: "Prenez le temps d'y réfléchir, je vous rappelle la semaine prochaine.", apply: (c) => { c.m.vars.closeMult = 0.6; }, next: "fin" },
    ] },
    fin: { speaker: "narrateur", text: () => "L'appel se termine.", end: true },
    repondeur: { speaker: "narrateur", text: (c) => `Ça sonne… Pas de réponse. Vous tombez sur la messagerie de ${cl(c)?.name}.`, choices: [
      { id: "a", label: "Laisser un message clair : motif de l'appel et proposition de rappel.", apply: (c) => { c.m.vars.message = 1; sc(c, "communication", 1); }, next: "fin_rep" },
      { id: "b", label: "Raccrocher sans laisser de message.", next: "fin_rep" },
    ] },
    fin_rep: { speaker: "narrateur", text: () => "Vous raccrochez.", end: true },
  },
  conclude: (c) => {
    const x = cl(c); if (!x) return "Appel terminé.";
    if (!v(c, "pickup")) {
      if (v(c, "message")) {
        const d = nextBusinessDay(dayIndex(c.s.t) + 1);
        addAgendaItem(c.s, { t: tOfDay(d, 10, 30), durationMin: 20, title: `Rappel de ${x.name}`, kind: "appel", meetingTemplate: "appel_client", params: { client: x.id, callback: "1" } });
        return `Message laissé. ${x.name} vous rappellera demain matin.`;
      }
      return `${x.name} n'a pas décroché. Vous pourrez rappeler un autre jour.`;
    }
    if (!v(c, "collect")) {
      const sat = v(c, "sat");
      clientEffect(c, sat, Math.round(sat / 2), `Appel : ${String(c.m.vars.rqLabel ?? "demande du client")} (${sat >= 4 ? "bien géré" : sat >= 0 ? "géré" : "mal géré"})`);
      gainXp(c.s, "client", sat >= 4 ? 20 : 8, "Service client au téléphone");
      if (c.m.score.ethique < 0) changeRep(c.s, "conformite", -4, "Propos inappropriés au téléphone");
      return `${x.name} : ${sat >= 4 ? "demande traitée avec professionnalisme, client satisfait" : sat >= 0 ? "demande traitée, sans plus" : "le client raccroche mécontent"}.${c.m.vars.newProspect ? ` Nouveau prospect recommandé : ${c.m.vars.newProspect}.` : ""}`;
    }
    const ini = v(c, "objInit"), cur = v(c, "objective");
    const amount = roundNice(cur * (Number(c.m.vars.closeMult ?? 1))) * (cur > 0 ? 1 : 0);
    const ratio = ini ? amount / ini : 0;
    const acc = c.s.accounts[x.accountId];
    if (amount > 0 && ratio >= SALES_MIN) {
      post(c.s, cashAcc(acc.id), "ext:depots_clients", toCents(amount), "EUR", `Versement complémentaire de ${x.name} (appel commercial)`);
      acc.capitalAllocated = (acc.capitalAllocated ?? 0) + toCents(amount);
      rebalanceClient(c.s, x.id, x.targetAllocation);
      c.m.vars.obtained = amount;
      c.s.flags["salesYtd"] = ((c.s.flags["salesYtd"] as number) ?? 0) + amount;
      x.history.unshift({ t: c.s.t, text: `Versement de ${eur(amount)} obtenu par téléphone (${Math.round(ratio * 100)} % de l'objectif)` });
      clientEffect(c, ratio > 0.9 ? 6 : 2, ratio > 0.9 ? 5 : 2, `Appel commercial réussi : ${eur(amount)} confiés`);
      changeRep(c.s, "commerciale", ratio > 0.9 ? 3 : 1);
      gainXp(c.s, "client", 30, "Appel commercial");
      return `${x.name} vous confie ${eur(amount)}, soit ${Math.round(ratio * 100)} % de l'objectif (${eur(ini)}) — ${v(c, "faults")} faute(s). Les fonds sont investis selon son mandat.`;
    }
    c.m.vars.obtained = 0;
    clientEffect(c, -3, -2, "Appel commercial sans suite");
    return `${x.name} ne donne pas suite (objectif ${eur(ini)}, ${v(c, "faults")} faute(s)).`;
  },
});
const SALES_MIN = 0.3;
