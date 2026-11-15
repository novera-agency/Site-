/**
 * SimulationClock + orchestration. Ordre de traitement déterministe à chaque pas de 5 minutes :
 * 1. horloge → 2. traitements de début de journée → 3. calendrier (banques centrales, statistiques, résultats, échéances)
 * 4. taux → 5. marchés → 6. ordres → 7. crises → 8. marges/alertes → 9. missions → 10. clôtures → 11. agenda → 12. tutoriel.
 * Les vitesses x1…x100 ne changent que le nombre de pas exécutés par seconde réelle, jamais le résultat économique.
 */
import type { Currency, Difficulty, GameMode, GameSettings, GameState, Profile, Track } from "./types";
import { SAVE_VERSION } from "./types";
import { Rng, seedRng } from "./rng";
import { buildCatalog } from "./data/catalog";
import { BANK_BY_ID } from "./data/banks";
import { LESSON_BY_ID } from "./data/learning";
import { initMacro, dailyMacro, stepYields, centralBankDecision, releaseStatistic, scheduleCalendar, updateConsensus, setRegime } from "./macro";
import { newQuote, stepMarket, refreshDerived, realizedVol, applyShock, trackedSet } from "./market";
import { initFundamentals, releaseEarnings, payDividend, dailyBonds, dailyLiteCorporate } from "./corporate";
import { processOrders, checkMargins, processExpiries, dailyFuturesSettlement, listFutures, sweepNegativeCash } from "./orders";
import { issueProducts, observeProduct, dailyStructured } from "./structured";
import { maybeTriggerCrises, stepCrises, startCrisis } from "./crisis";
import { planDay, stepAgenda, addAgendaItem } from "./agenda";
import { createNpcs } from "./people";
import { newAccount, onboardClient, monthlyClients, seedPosition } from "./clients";
import { setupDesk, salaryFor, monthlyPayroll, weeklyReview, quarterlyReview, annualReview, dailyWellbeing, checkRiskLimits, generateOffer, performanceScore } from "./career";
import { assignWeeklyMissions, assignDailyMissions, checkMissions, createMission } from "./missions";
import { maybeCareerEvent, initCompetitors, dailyCompetitors } from "./events";
import { monthlyCompany } from "./company";
import { simulateHistory } from "./history";
import { accountEquity } from "./portfolio";
import { bondStats } from "./analytics";
import { cashAcc, post } from "./ledger";
import { toCents } from "./money";
import { changeRep, gainXp, notify, pushNews, nextId, fx, logDecision } from "./core";
import { assignProspects } from "./prospects";
import { checkProgress } from "./progression";
import { maybeWorldEvent } from "./worldEvents";
import { repairUnaffordablePurchases } from "./realestate";
import { initLife, dailyLife, housingEquity, priceLevel } from "./life";
import { histInitialPrices, initHistorical, histAdjust, histAfterHistory, histDaily, histActive, histScriptedCrisis, HIST_EPOCH } from "./historical";
import { dayIndex, minuteOfDay, MIN_PER_DAY, START_T, STEP_MIN, tOfDay, weekday, isWeekend, firstBusinessDayOfMonth, dateOf, nextBusinessDay, EPOCH_UTC, setEpochYear, startTForEpoch, useEpoch } from "./time";
import "./meetings";
import { isAlly, isHostile, mondayRelations, monthlyRelations, checkRelationChanges } from "./relations";

export interface NewGameOptions {
  ownerId: string; name?: string; mode: GameMode; difficulty: Difficulty; seed?: string; profile: Profile; bankId: string; track: Track;
  startingCapital: number; settings?: Partial<GameSettings>; challengeId?: string;
  /** Mode historique : départ le 3 janvier 2000, événements réels et trajectoires approchées */
  historical?: boolean;
}

export const CHALLENGES = [
  { id: "survivre_krach", name: "Survivre au krach", description: "100 000 € de capital. Un krach se prépare. Terminez les 30 jours avec une perte inférieure à 10 %.", capital: 100000, days: 30, target: -0.1, crisis: "krach" as const },
  { id: "objectif_10", name: "Objectif +10 %", description: "50 000 € de capital, 60 jours pour réaliser +10 % sans liquidation forcée.", capital: 50000, days: 60, target: 0.1, crisis: undefined },
  { id: "choc_petrolier", name: "Choc pétrolier", description: "75 000 € : une crise énergétique va éclater. Réalisez +5 % en 40 jours.", capital: 75000, days: 40, target: 0.05, crisis: "crise_energie" as const },
];

export function createGame(o: NewGameOptions): GameState {
  const seed = o.seed || `${Date.now()}-${o.ownerId}`.slice(0, 40);
  const rngState = seedRng(seed);
  const rng = new Rng(rngState);
  const hist = !!o.historical && o.mode !== "defi";
  setEpochYear(hist ? HIST_EPOCH : 2027);
  const T0 = hist ? startTForEpoch() : START_T;
  const cat = buildCatalog();
  if (hist) histInitialPrices(T0, cat.initialPrices, cat.fxInit);
  const bank = BANK_BY_ID[o.bankId] ?? BANK_BY_ID["lutece"];
  const startDay = dayIndex(T0);
  const difficulty = o.difficulty;
  const s: GameState = {
    version: SAVE_VERSION, ...(hist ? { epochYear: HIST_EPOCH, historical: true } : {}), id: "", ownerId: o.ownerId, name: o.name || `${o.profile.firstName} ${o.profile.lastName}`, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(),
    mode: o.mode, difficulty, challengeId: o.challengeId, seed, rng: rngState, t: T0, speed: 1, paused: true, pauseReason: "Bienvenue",
    settings: { minutesPerSecond: 1, autoPauseImportant: true, livingExpenses: o.mode === "carriere", allowShort: difficulty !== "debutant", aiEnabled: true, explanations: difficulty === "debutant" || difficulty === "normal", ...o.settings },
    profile: o.profile,
    career: { track: o.track, bankId: bank.id, rank: 1, salaryAnnual: toCents(salaryFor(bank.id, 1)), hiredT: T0, employed: o.mode === "carriere", deskLimitVaR: 0, deskMaxPosition: 0.25, objectives: [], reviews: [], warnings: 0, stress: 15, energy: 90, missionsDone: 0, missionsFailed: 0, breaches: 0, pendingOffers: [], history: [], ytdBonusPool: 0, weekStartEquity: 0, quarterStartEquity: 0, yearStartEquity: 0 },
    skills: { analyse: 0, marches: 0, maths: 0, macro: 0, risque: 0, client: 0, management: 0, entrepreneuriat: 0 },
    skillLog: [],
    reputation: { professionnelle: 40, commerciale: 40, clients: 45, interne: 45, fiabilite: 50, risque: 50, conformite: 60, leadership: 30 },
    macro: initMacro(startDay), instruments: {}, quotes: {}, impulses: [], accounts: {}, ledger: [], ledgerArchive: { count: 0, checksum: {} }, balances: {}, orders: [], fills: [],
    structuredProducts: [], structuredHoldings: [], npcs: {}, clients: [], banks: [], meetings: [], agenda: [], missions: [], notifications: [], messages: [], news: [], calendar: [], crises: [], decisions: [],
    learning: { completed: [], attempts: {} }, watchlist: ["XWLD", "IDX-EU", "MAIS", "EURUSD", "GOLD", "DE10Y"], alerts: [], eventCooldowns: {}, seq: 0, flags: { startDay, lifestyle: 1 }, tutorial: { step: 1, done: o.mode !== "carriere" },
    stats: { tradesCount: 0, meetingsCount: 0, daysPlayed: 0, maxDrawdown: 0, peakWealth: 0 }, lastDay: startDay,
  };
  // Profil de connaissances → compétences initiales (l'expérience reste à acquérir)
  const k: Record<Profile["knowledge"], number> = { debutant: 0, etudiant: 120, analyste: 300, trader: 300, entrepreneur: 200, expert: 600 };
  for (const b of Object.keys(s.skills) as (keyof typeof s.skills)[]) s.skills[b] = Math.round(k[o.profile.knowledge] * (o.profile.knowledge === "trader" && (b === "marches" || b === "risque") ? 1.4 : o.profile.knowledge === "entrepreneur" && b === "entrepreneuriat" ? 2 : o.profile.knowledge === "analyste" && b === "analyse" ? 1.4 : 0.6));
  // Instruments
  for (const d of cat.defs) { s.instruments[d.id] = d; s.quotes[d.id] = newQuote(cat.initialPrices[d.id] ?? 100); }
  if (hist) initHistorical(s);
  for (const [cur, v] of Object.entries(cat.fxInit)) s.macro.fxLog[cur as Currency] = Math.log(v);
  for (const d of cat.defs) if (d.cls === "devise") s.quotes[d.id].price = Math.exp(s.macro.fxLog[d.id.slice(0, 3) as Currency] - s.macro.fxLog[d.id.slice(3) as Currency]);
  for (const z of Object.values(s.macro.zones)) s.macro.factors[`y10_0_${z.id}`] = z.y10;
  for (const d of cat.defs) if (d.cls === "matiere") s.macro.factors[`anchor_${d.id}`] = cat.initialPrices[d.id];
  refreshDerived(s, null); // prix des obligations
  // Paniers : unités fixées pour que chaque ETF/indice vaille sa valeur initiale
  for (const d of cat.defs) {
    if (!d.basket) continue;
    const target = cat.initialPrices[d.id];
    if (d.cls === "indice" || d.basket.every((m) => s.instruments[m.id].cls === "action")) {
      const caps = d.basket.map((m) => { const md = s.instruments[m.id]; return fx(s, s.quotes[m.id].price * (md.shares ?? 1) * 1e6, md.currency, "USD"); });
      const tot = caps.reduce((a, b) => a + b, 0);
      d.basket.forEach((m, i) => { m.w = caps[i] / tot; });
    }
    for (const m of d.basket) { const md = s.instruments[m.id]; m.w = (m.w * target) / (s.quotes[m.id].price * (md.bond ? md.bond.nominal / 100 : 1) * fx(s, 1, md.currency, d.currency)); }
  }
  refreshDerived(s, null);
  initFundamentals(s, rng);
  simulateHistory(s, rng, startDay, 260, hist ? histAdjust(s) : undefined);
  if (hist) histAfterHistory(s);
  refreshDerived(s, null);
  for (const q of Object.values(s.quotes)) { q.prevClose = q.daily.length ? q.daily[q.daily.length - 1].c : q.price; q.dayOpen = q.dayHigh = q.dayLow = q.price; }
  listFutures(s);
  scheduleCalendar(s, startDay + 30);
  updateConsensus(s);
  issueProducts(s, rng, 4);
  initCompetitors(s);
  // Comptes
  s.accounts.perso = newAccount("perso", "personnel", "Compte personnel", s.settings.allowShort);
  const capital = o.mode === "defi" ? CHALLENGES.find((c) => c.id === o.challengeId)?.capital ?? o.startingCapital : o.startingCapital;
  post(s, cashAcc("perso"), "ext:apport_initial", toCents(capital), "EUR", "Capital personnel initial (monnaie virtuelle)");
  s.accounts.perso.capitalAllocated = toCents(capital);
  s.accounts.perso.equityHistory.push({ t: s.t, v: capital });
  createNpcs(s, rng);
  if (o.mode === "carriere") {
    s.flags["rankSinceT"] = s.t;
    s.career.rank = o.profile.knowledge === "expert" ? 2 : 1;
    s.career.salaryAnnual = toCents(salaryFor(bank.id, s.career.rank) * priceLevel(s));
    s.life = initLife(s);
    assignProspects(s, rng, true); // premiers contacts confiés par le N+1
    s.messages.unshift({ id: nextId(s, "msg"), t: s.t, from: "Vie privée", subject: "Votre nouvelle vie commence", body: "Vous emménagez dans un studio en centre-ville. Chaque mois, votre salaire est versé puis l'impôt, le loyer et les factures sont prélevés : gardez un œil sur le reste à vivre.\n\nEn dehors du bureau, entretenez votre santé mentale, votre forme, votre vie sociale et votre épanouissement (onglet Vie privée) : si vous les négligez, le stress monte et vos performances baissent. Et si vous estimez mériter mieux, demandez un rendez-vous à votre responsable pour négocier.", read: false });
    setupDesk(s);
    // Portefeuille obligataire professionnel supervisé
    const cap = (s.accounts.desk.capitalAllocated ?? 0) / 100;
    seedPosition(s, "desk", "DE10Y", cap * 0.14); seedPosition(s, "desk", "FR10Y", cap * 0.12); seedPosition(s, "desk", "IT10Y", cap * 0.08); seedPosition(s, "desk", "LUTB30", cap * 0.06);
    if (bank.id === "lutece" || bank.id === "ubc" || bank.id === "cassini") seedPosition(s, "desk", "UBCFRN", cap * 0.04);
    else seedPosition(s, "desk", "US10Y", cap * 0.04);
    seedPosition(s, "desk", "XBNK", cap * 0.05);
    s.career.weekStartEquity = s.career.quarterStartEquity = s.career.yearStartEquity = accountEquity(s, "desk");
    s.accounts.desk.equityHistory = [{ t: s.t, v: s.career.weekStartEquity }];
    onboardClient(s, 0); onboardClient(s, 1);
    if (o.track === "gerant" || o.track === "sales" || bank.id === "lindqvist") onboardClient(s, 2);
    s.flags["scriptedCrisisDay"] = startDay + 25 + rng.int(0, 25);
    planTutorialDay(s);
    s.career.history.unshift({ t: s.t, text: `Premier jour chez ${bank.name} — ${o.track}` });
  } else if (o.mode === "defi") {
    const ch = CHALLENGES.find((c) => c.id === o.challengeId) ?? CHALLENGES[0];
    s.challenge = { id: ch.id, target: ch.target, deadlineT: s.t + ch.days * MIN_PER_DAY, status: "en_cours", startEquity: capital };
    if (ch.crisis) s.flags["challengeCrisisDay"] = startDay + 4;
    s.settings.livingExpenses = false;
  } else {
    s.settings.livingExpenses = false; s.settings.allowShort = true; s.accounts.perso.allowShort = true;
  }
  if (o.mode !== "carriere") { s.paused = false; s.pauseReason = undefined; }
  if (hist) pushNews(s, { category: "marches", title: "3 janvier 2000 : les marchés ouvrent le nouveau millénaire au sommet", body: "Mode historique : vous vivez les marchés de 2000 à 2025 avec les événements réels (bulle Internet, 11 septembre, crise de 2008, crise de l'euro, Brexit, Covid, inflation 2022…). Les grandes trajectoires de marché sont reconstituées de façon approchée ; les sociétés cotées et les banques du jeu restent fictives. Monnaie virtuelle.", impact: "moyen", tickers: [], zones: ["US", "EZ"], sentiment: 0.3 });
  else pushNews(s, { category: "marches", title: "Ouverture d'une nouvelle année boursière", body: `Les stratégistes anticipent une année de ${s.macro.regime === "expansion" ? "croissance modérée" : "transition"}. Inflation américaine à ${s.macro.zones.US.inflation.toFixed(1)} %, taux directeur à ${s.macro.zones.US.policyRate.toFixed(2)} %. Simulation — données fictives.`, impact: "faible", tickers: [], zones: ["US", "EZ"], sentiment: 0.1 });
  return s;
}

/** Agenda scénarisé de la première journée (tutoriel complet mais non bloquant) */
function planTutorialDay(s: GameState) {
  const d = dayIndex(s.t);
  const cl0 = s.clients[0];
  addAgendaItem(s, { t: tOfDay(d, 7, 15), durationMin: 30, title: "Accueil par votre responsable", kind: "reunion", meetingTemplate: "accueil", important: true });
  addAgendaItem(s, { t: tOfDay(d, 7, 45), durationMin: 30, title: "Revue des actualités et découverte du terminal", kind: "personnel" });
  addAgendaItem(s, { t: tOfDay(d, 8, 30), durationMin: 30, title: "Réunion quotidienne du desk", kind: "reunion", meetingTemplate: "desk_quotidien", important: true });
  addAgendaItem(s, { t: tOfDay(d, 9, 0), durationMin: 0, title: "Ouverture des marchés européens", kind: "marche" });
  addAgendaItem(s, { t: tOfDay(d, 11, 0), durationMin: 0, title: "Publication : indicateur avancé de la zone euro", kind: "publication" });
  addAgendaItem(s, { t: tOfDay(d, 14, 0), durationMin: 20, title: `Appel d'un client mécontent — ${cl0?.name ?? "client"}`, kind: "appel", meetingTemplate: "client_retrait", params: { client: cl0?.id ?? "" }, important: true });
  addAgendaItem(s, { t: tOfDay(d, 15, 30), durationMin: 0, title: "Ouverture du marché américain", kind: "marche" });
  addAgendaItem(s, { t: tOfDay(d, 16, 15), durationMin: 15, title: "Question technique du responsable", kind: "reunion", meetingTemplate: "question_technique", important: true });
  addAgendaItem(s, { t: tOfDay(d, 18, 0), durationMin: 15, title: "Évaluation de votre première journée", kind: "personnel", important: true });
  createMission(s, "watchlist", {}, "boss");
  createMission(s, "analyse_actif", { instrument: "MAIS" }, "boss");
  createMission(s, "premier_ordre", {}, "boss");
  notify(s, "info", "Bienvenue ! Votre première journée commence.", "Suivez votre agenda : l'accueil par votre responsable est à 7 h 15. Le temps est en pause : appuyez sur ▶ pour démarrer.", "/play");
}

export function tutorialChecklist(s: GameState) {
  const f = s.flags;
  const mdone = (tpl: string) => s.meetings.some((m) => m.templateId === tpl && m.done);
  const mis = (tpl: string) => s.missions.some((m) => m.templateId === tpl && m.status === "reussie");
  const d0 = f["startDay"] as number;
  return [
    { id: 1, label: "Arrivée dans la banque", done: true },
    { id: 2, label: "Présentation du responsable", done: mdone("accueil") },
    { id: 3, label: "Découverte du terminal", done: !!f["visitedTerminal"] },
    { id: 4, label: "Première réunion du desk", done: mdone("desk_quotidien") },
    { id: 5, label: "Analyse d'un actif", done: mis("analyse_actif") },
    { id: 6, label: "Premier ordre de trading", done: mis("premier_ordre") },
    { id: 7, label: "Publication d'une nouvelle économique", done: !!f["tutNews"] },
    { id: 8, label: "Variation du marché observée", done: !!f["tutMove"] },
    { id: 9, label: "Appel d'un client mécontent", done: s.meetings.some((m) => m.templateId === "client_retrait" && m.done) },
    { id: 10, label: "Réponse à une question technique", done: mdone("question_technique") },
    { id: 11, label: "Fin de journée", done: s.t >= tOfDay(d0, 17, 30) },
    { id: 12, label: "Évaluation des performances", done: !!f["tutReview"] },
  ];
}

function tutorialStep(s: GameState) {
  if (s.mode !== "carriere" || s.tutorial.done) return;
  const d0 = s.flags["startDay"] as number;
  const m = minuteOfDay(s.t);
  if (dayIndex(s.t) === d0 && m === 11 * 60 && !s.flags["tutNews"]) {
    s.flags["tutNews"] = s.t;
    const z = s.macro.zones.EZ;
    const positive = z.growth >= 1;
    applyShock(s, { kind: "instrument", id: "MAIS" }, positive ? 0.035 : -0.035, 0.5, "Commandes du luxe");
    applyShock(s, { kind: "zone", id: "EZ" }, positive ? 0.008 : -0.008, 0.2, "Indicateur avancé zone euro");
    pushNews(s, { category: "macro", title: `Zone euro : l'indicateur avancé ${positive ? "surprend à la hausse" : "déçoit"} — le luxe ${positive ? "bondit" : "recule"}`, body: `L'indicateur de confiance des directeurs d'achat ressort ${positive ? "au-dessus" : "en dessous"} des attentes. ${s.instruments["MAIS"].name} ${positive ? "profite de commandes record en Asie" : "pâtit d'un ralentissement des ventes"}. Observez l'impact sur l'EUROPA 50 et sur MAIS dans le terminal.`, impact: "moyen", tickers: ["MAIS", "IDX-EU"], zones: ["EZ"], sentiment: positive ? 0.6 : -0.6 });
    notify(s, "alerte", "Publication économique", "Une nouvelle vient de tomber : observez la réaction du marché.", "/play/actualites");
    s.flags["tutNewsPrice"] = s.quotes["MAIS"].price;
  }
  if (s.flags["tutNews"] && !s.flags["tutMove"] && s.t - (s.flags["tutNews"] as number) >= 30) {
    s.flags["tutMove"] = true;
    const ch = (s.quotes["MAIS"].price / (s.flags["tutNewsPrice"] as number) - 1) * 100;
    notify(s, "info", "Variation du marché", `MAIS a varié de ${ch.toFixed(2)} % depuis la publication. Les nouvelles sont intégrées progressivement dans les prix.`, "/play/actif?id=MAIS");
  }
  if (dayIndex(s.t) === d0 && m === 18 * 60 && !s.flags["tutReview"]) {
    s.flags["tutReview"] = true;
    const done = tutorialChecklist(s).filter((x) => x.done).length;
    const sc = performanceScore(s, "week");
    const score = Math.round(done / 12 * 60 + sc.total * 0.4);
    s.career.reviews.unshift({ t: s.t, kind: "hebdo", score, details: { ...sc.details, tutoriel: Math.round(done / 12 * 100) }, outcome: score >= 65 ? "Très bonne première journée." : score >= 45 ? "Première journée correcte." : "Première journée difficile.", comment: `Étapes accomplies : ${done}/12. P&L desk du jour : ${Math.round(sc.pnl).toLocaleString("fr-FR")} €.` });
    notify(s, "succes", `Évaluation de la première journée : ${score}/100`, `${s.npcs.boss.name} : « ${score >= 65 ? "Bon début. Demain, on accélère." : score >= 45 ? "Correct pour un premier jour." : "Il va falloir vous mettre au niveau rapidement."} »`, "/play/carriere");
    s.tutorial.done = true;
    s.paused = true; s.pauseReason = "Fin de votre première journée";
    gainXp(s, "management", 20, "Première journée");
  }
}

function processCalendar(s: GameState, rng: Rng) {
  const day = dayIndex(s.t), m = minuteOfDay(s.t);
  for (const ev of s.calendar) {
    if (ev.done || ev.day !== day || ev.minute > m) continue;
    if (ev.minute <= m - 60 * 24) { ev.done = true; continue; }
    ev.done = true;
    switch (ev.kind) {
      case "banque_centrale": {
        const z = s.macro.zones[ev.ref as keyof typeof s.macro.zones];
        if (!z || z.nextCbDay !== day) break;
        const r = centralBankDecision(s, z.id, rng, parseFloat(ev.consensus || "0"));
        ev.actual = `${r.move >= 0 ? "+" : ""}${Math.round(r.move * 100)} pb`;
        gainXp(s, "macro", 5, "Suivi des banques centrales");
        break;
      }
      case "statistique": releaseStatistic(s, ev, rng); break;
      case "resultats": releaseEarnings(s, ev.ref!, rng); break;
      case "dividende": payDividend(s, ev.ref!); break;
      case "observation": observeProduct(s, ev.ref!); break;
    }
  }
  // Nouvelle réunion BC planifiée si la date a changé (réunion d'urgence)
  for (const z of Object.values(s.macro.zones)) if (z.nextCbDay > day && !s.calendar.some((e) => e.kind === "banque_centrale" && e.ref === z.id && e.day === z.nextCbDay)) {
    if (z.nextCbDay <= ((s.flags["calendarUntil"] as number) ?? day)) s.calendar.push({ id: nextId(s, "cal"), day: z.nextCbDay, minute: z.id === "US" ? 20 * 60 : 14 * 60 + 15, title: `Décision de politique monétaire — ${z.cbName.replace(" (simulée)", "")}`, zone: z.id, kind: "banque_centrale", ref: z.id, importance: 3, consensus: "" });
  }
}

function newDay(s: GameState, rng: Rng) {
  const day = dayIndex(s.t);
  const weekend = isWeekend(s.t);
  s.stats.daysPlayed++;
  if (s.historical) histDaily(s, setRegime);
  if (!weekend) {
    dailyMacro(s, rng);
    dailyBonds(s, rng);
    dailyLiteCorporate(s, rng, trackedSet(s));
    dailyCompetitors(s, rng);
    if (!histActive(s)) maybeWorldEvent(s, rng);
    if (s.historical && histActive(s)) { const hc = histScriptedCrisis(s); if (hc) startCrisis(s, hc[1], rng, hc[2]); }
    else maybeTriggerCrises(s, rng);
    if (!s.flags["vacationUntil"] || s.t >= (s.flags["vacationUntil"] as number)) { delete s.flags["vacationUntil"]; maybeCareerEvent(s, rng); planDay(s, rng); }
    if (weekday(s.t) === 1) { assignWeeklyMissions(s, rng); mondayRelations(s); }
    assignDailyMissions(s, rng);
    assignProspects(s, rng);
    checkRelationChanges(s);
  }
  scheduleCalendar(s, day + 30);
  updateConsensus(s);
  dailyStructured(s);
  dailyWellbeing(s, weekend);
  dailyLife(s, rng);
  checkProgress(s, true);
  sweepNegativeCash(s);
  // Mensuel
  if (!weekend && day === firstBusinessDayOfMonth(s.t)) {
    monthlyPayroll(s);
    monthlyClients(s, rng);
    monthlyCompany(s, rng);
    const mo = dateOf(s.t).getUTCMonth();
    if ([0, 3, 6, 9].includes(mo) && day > (s.flags["startDay"] as number) + 20) quarterlyReview(s);
    if (mo === 0) { s.flags["vacationDaysYear"] = 0; s.flags["feesYtd"] = 0; }
    if (s.mode === "carriere" && rng.chance(0.25 * (isAlly(s, "recruiter") ? 2 : isHostile(s, "recruiter") ? 0.5 : 1))) generateOffer(s, rng);
    monthlyRelations(s);
  }
  const date = dateOf(s.t);
  if (!weekend && date.getUTCMonth() === 11 && day === nextBusinessDay(Math.floor((Date.UTC(date.getUTCFullYear(), 11, 15) - EPOCH_UTC) / 86400000))) annualReview(s);
  s.career.pendingOffers = s.career.pendingOffers.filter((o) => o.expiresT > s.t);
  s.lastDay = day;
}

function endOfDay(s: GameState) {
  for (const q of Object.values(s.quotes)) q.rv = realizedVol(q);
  for (const acc of Object.values(s.accounts)) {
    acc.equityHistory.push({ t: s.t, v: Math.round(accountEquity(s, acc.id) * 100) / 100 });
    if (acc.equityHistory.length > 800) acc.equityHistory.splice(0, acc.equityHistory.length - 800);
  }
  const w = wealth(s);
  s.stats.peakWealth = Math.max(s.stats.peakWealth, w);
  if (s.stats.peakWealth > 0) s.stats.maxDrawdown = Math.max(s.stats.maxDrawdown, 1 - w / s.stats.peakWealth);
  checkRiskLimits(s);
  // Réunion « pertes obligataires » après un choc de taux haussier
  const shockT = s.flags["lastRateShockT"] as number | undefined;
  if (shockT && s.flags["rateMeetingFor"] !== shockT && (s.flags["lastRateShockBp"] as number) > 0 && s.career.employed && s.mode === "carriere") {
    const b = bondStats(s, "desk");
    if (b.mv > 0) { s.flags["rateMeetingFor"] = shockT; addAgendaItem(s, { t: tOfDay(nextBusinessDay(dayIndex(s.t) + 1), 8, 0), durationMin: 30, title: "Pertes sur le portefeuille obligataire — convocation", kind: "reunion", meetingTemplate: "pertes_obligataires", important: true }); }
  }
  // Régulateur après incidents répétés
  if (s.career.breaches >= 3 && s.mode === "carriere" && s.career.employed && (s.t - ((s.flags["regulatorT"] as number) ?? -1e9)) > 90 * MIN_PER_DAY) { s.flags["regulatorT"] = s.t; addAgendaItem(s, { t: tOfDay(nextBusinessDay(dayIndex(s.t) + 2), 10, 0), durationMin: 60, title: "Inspection du régulateur", kind: "reunion", meetingTemplate: "regulateur", important: true }); }
  if (s.challenge && s.challenge.status === "en_cours") {
    const perf = accountEquity(s, "perso") / s.challenge.startEquity - 1;
    if (s.t >= s.challenge.deadlineT) { s.challenge.status = (s.challenge.target < 0 ? perf > s.challenge.target : perf >= s.challenge.target) ? "reussi" : "echoue"; notify(s, s.challenge.status === "reussi" ? "succes" : "critique", `Défi ${s.challenge.status === "reussi" ? "réussi" : "échoué"}`, `Performance finale : ${(perf * 100).toFixed(2)} %`); s.paused = true; s.pauseReason = "Fin du défi"; }
  }
}

export function wealth(s: GameState) {
  let w = accountEquity(s, "perso") + housingEquity(s);
  if (s.company && !s.company.bankrupt) w += Math.max(0, accountEquity(s, s.company.accountId)) * (1 - ((s.flags["dilution"] as number) ?? 0));
  return w;
}

function checkAlerts(s: GameState) {
  for (const a of s.alerts) {
    if (a.triggered) continue;
    const q = s.quotes[a.instrumentId];
    if (!q) continue;
    if ((a.above && q.price >= a.level) || (!a.above && q.price <= a.level)) { a.triggered = true; notify(s, "alerte", `Alerte de prix : ${a.instrumentId} ${a.above ? "≥" : "≤"} ${a.level}`, `Cours actuel ${q.price.toFixed(4)}`, `/play/actif?id=${a.instrumentId}`); }
  }
}

/** Un pas de simulation */
export function step(s: GameState) {
  if (s.ended) { s.paused = true; return; }
  const rng = new Rng(s.rng);
  const prevDay = dayIndex(s.t);
  s.t += STEP_MIN;
  const day = dayIndex(s.t);
  const m = minuteOfDay(s.t);
  if (day !== prevDay) newDay(s, rng);
  // défi : déclenchement de la crise scénarisée
  if (s.flags["challengeCrisisDay"] === day && m === 9 * 60 && !s.flags["challengeCrisisFired"]) {
    s.flags["challengeCrisisFired"] = true;
    const ch = CHALLENGES.find((c) => c.id === s.challengeId);
    if (ch?.crisis) startCrisis(s, ch.crisis, rng);
  }
  processCalendar(s, rng);
  const dy = stepYields(s, rng);
  stepMarket(s, rng, dy);
  processOrders(s);
  stepCrises(s, rng);
  checkAlerts(s);
  if (m % 30 === 0) checkMargins(s);
  if (m % 60 === 0) checkMissions(s);
  if (m === 17 * 60 + 30 && !isWeekend(s.t)) { dailyFuturesSettlement(s); processExpiries(s); }
  if (m === 22 * 60 + 5 && !isWeekend(s.t)) endOfDay(s);
  if (m === 18 * 60 && weekday(s.t) === 5 && day !== s.flags["startDay"]) weeklyReview(s);
  const pend = s.flags["pendingMeeting"];
  if (typeof pend === "string" && !s.activeMeetingId) {
    const p = JSON.parse(pend) as { t?: number };
    if (p.t === undefined) { s.flags["pendingMeeting"] = JSON.stringify({ ...p, t: s.t }); }
    else if (s.t - p.t > 120) { delete s.flags["pendingMeeting"]; notify(s, "alerte", "Réunion manquée", "Vous ne vous êtes pas présenté.", "/play/agenda"); changeRep(s, "fiabilite", -3); }
  }
  stepAgenda(s);
  tutorialStep(s);
}

/** Avance la simulation de `minutes` minutes simulées (s'arrête si une pause automatique survient) */
export function advance(s: GameState, minutes: number) {
  useEpoch(s);
  const steps = Math.floor(minutes / STEP_MIN);
  let n = 0;
  for (; n < steps; n++) {
    if (s.paused) break;
    step(s);
  }
  s.updatedAt = new Date().toISOString();
  return n;
}
/** Avance jusqu'à une heure donnée (ex. « passer au lendemain 7 h 30 ») en respectant les pauses */
export function advanceTo(s: GameState, targetT: number, maxSteps = 4000) {
  useEpoch(s);
  let n = 0;
  const wasPaused = s.paused;
  s.paused = false;
  while (s.t + STEP_MIN <= targetT && n < maxSteps) { step(s); n++; if (s.paused) break; }
  if (!s.paused && wasPaused) s.paused = false;
  return n;
}

export function completeLesson(s: GameState, lessonId: string, answer: number) {
  const l = LESSON_BY_ID[lessonId];
  if (!l) return { ok: false as const, error: "Leçon inconnue." };
  s.learning.attempts[lessonId] = (s.learning.attempts[lessonId] ?? 0) + 1;
  const correct = l.exercise.kind === "qcm" ? answer === l.exercise.answer : Math.abs(answer - l.exercise.answer) <= l.exercise.tolerance;
  const first = !s.learning.completed.includes(lessonId);
  if (correct && first) {
    s.learning.completed.push(lessonId);
    gainXp(s, l.branch, 30 * l.level, `Formation : ${l.term}`);
    logDecision(s, "formation", `Module validé : ${l.term}`);
  }
  return { ok: true as const, correct, correction: l.exercise.correction, firstTime: correct && first };
}

/** Migration des sauvegardes entre versions */
export function migrate(raw: GameState): GameState {
  const s = raw as GameState & { version: number };
  useEpoch(s);
  if (s.version < 2) {
    for (const q of Object.values(s.quotes)) { q.pending ??= 0; q.rv ??= 0; q.lastBarDay ??= q.daily.length ? Math.floor(q.daily[q.daily.length - 1].t / MIN_PER_DAY) : -1; }
    s.alerts ??= []; s.impulses ??= []; s.ledgerArchive ??= { count: 0, checksum: {} };
    s.version = 2;
  }
  if (s.mode === "carriere" && !s.life) s.life = initLife(s);
  repairUnaffordablePurchases(s);
  if (s.version > SAVE_VERSION) throw new Error("Sauvegarde issue d'une version plus récente du jeu.");
  return s;
}
export { SAVE_VERSION, changeRep };
