/** Modèles de lecture envoyés au navigateur (le client n'a jamais accès à l'état complet ni au grand livre brut entier). */
import type { GameState } from "@/engine/types";
import { REGIMES } from "@/engine/regimes";
import { accountEquity, positionViews, exposures, valueAtRisk, performance, marginRequirement, cashEur, lockedMarginEur, structuredValueEur } from "@/engine/portfolio";
import { cashBalances, accountEntries, trialBalance, isBalanced } from "@/engine/ledger";
import { quoteBook, marketStatus, bondYield, optionIV, rateFor, dividendYield, baseVol, advNotionalEur } from "@/engine/market";
import { bondPriceFromYield, blackScholes } from "@/engine/pricing";
import { listExpiries, strikeGrid, optionId, optionable, buyingPower, canTradeOnDesk } from "@/engine/orders";
import { tutorialChecklist, wealth, CHALLENGES } from "@/engine/engine";
import { meetingView, allMeetingTemplates } from "@/engine/meetingEngine";
import { missionQuestion } from "@/engine/missions";
import { performanceScore, rankTitle } from "@/engine/career";
import { currentAllocation, equityWeight, suitableEquityBand, totalAum } from "@/engine/clients";
import { ALLOC_BUCKETS } from "@/engine/people";
import { companyStatements, hireCandidates, COMPANY_TYPES, OFFICES, TOOLS } from "@/engine/company";
import { structuredScenarios } from "@/engine/structured";
import { CRISIS_LABELS } from "@/engine/crisis";
import { vixLike } from "@/engine/macro";
import { BANKS, BANK_BY_ID, TRACKS, BASE_SALARY } from "@/engine/data/banks";
import { LESSONS } from "@/engine/data/learning";
import { skillLevel, SKILL_LEVELS, SKILL_NAMES, REP_NAMES, avgRep, toEur, multiplier } from "@/engine/core";
import { dayIndex, MIN_PER_DAY, fmtDate } from "@/engine/time";
import { aiAvailable } from "./ai";

const r2 = (x: number) => Math.round(x * 100) / 100;
const px = (x: number) => (Math.abs(x) >= 1000 ? Math.round(x * 100) / 100 : Number(x.toPrecision(6)));

function quoteLite(s: GameState, id: string) {
  const q = s.quotes[id], d = s.instruments[id];
  return { id, n: d.name, c: d.cls, cur: d.currency, p: px(q.price), ch: q.prevClose ? r2((q.price / q.prevClose - 1) * 100) : 0, s: d.sector, z: d.zone };
}

/** Instantané léger renvoyé à chaque tick */
export function snapshot(s: GameState) {
  const quotes: Record<string, [number, number]> = {};
  for (const [id, d] of Object.entries(s.instruments)) {
    if (d.option && !s.watchlist.includes(id) && !Object.values(s.accounts).some((a) => a.positions[id])) continue;
    const q = s.quotes[id];
    quotes[id] = [px(q.price), q.prevClose ? r2((q.price / q.prevClose - 1) * 100) : 0];
  }
  const pend = typeof s.flags["pendingMeeting"] === "string" ? JSON.parse(s.flags["pendingMeeting"] as string) as { template: string; title: string } : null;
  const nextAgenda = s.agenda.find((a) => a.status === "prevu" && a.t >= s.t);
  return {
    id: s.id, t: s.t, speed: s.speed, paused: s.paused, pauseReason: s.pauseReason, mode: s.mode, difficulty: s.difficulty, regime: s.macro.regime, regimeLabel: REGIMES[s.macro.regime].label,
    minutesPerSecond: s.settings.minutesPerSecond,
    quotes, sessions: marketStatus(s),
    wealth: r2(wealth(s)), perso: r2(accountEquity(s, "perso")), persoCash: r2(cashEur(s, "perso")), desk: s.accounts.desk && s.career.employed ? r2(accountEquity(s, "desk")) : null,
    deskPnlWeek: s.accounts.desk && s.career.employed ? r2(accountEquity(s, "desk") - s.career.weekStartEquity) : null,
    unread: s.notifications.filter((n) => !n.read).length, unreadMsgs: s.messages.filter((m) => !m.read).length,
    notifications: s.notifications.slice(0, 6),
    activeMeetingId: s.activeMeetingId ?? null, pendingMeeting: pend ? { template: pend.template, title: pend.title } : null,
    nextAgenda: nextAgenda ? { t: nextAgenda.t, title: nextAgenda.title } : null,
    tutorial: s.mode === "carriere" && !s.tutorial.done ? tutorialChecklist(s) : null,
    player: { name: `${s.profile.firstName} ${s.profile.lastName}`, title: s.career.employed ? rankTitle(s) : s.company ? `Fondateur — ${s.company.name}` : s.mode === "carriere" ? "Sans emploi" : "Investisseur", bank: s.career.employed ? BANK_BY_ID[s.career.bankId]?.short : null, bankColor: BANK_BY_ID[s.career.bankId]?.accent, stress: Math.round(s.career.stress) },
    vix: vixLike(s), crisisActive: s.crises.some((c) => !c.resolved && c.phase > 0),
    explanations: s.settings.explanations, aiAvailable: aiAvailable(),
  };
}
export type Snapshot = ReturnType<typeof snapshot>;

function accountSummary(s: GameState, id: string) {
  const a = s.accounts[id];
  if (!a) return null;
  const eq = accountEquity(s, id);
  return { id, label: a.label, kind: a.kind, equity: r2(eq), cash: r2(cashEur(s, id)), cashByCur: Object.fromEntries(Object.entries(cashBalances(s, id)).map(([k, v]) => [k, (v as number) / 100])), margin: r2(lockedMarginEur(s, id)), marginReq: r2(marginRequirement(s, id)), buyingPower: r2(buyingPower(s, id)), capital: (a.capitalAllocated ?? 0) / 100, realized: a.realizedTotal / 100, fees: a.feesTotal / 100, income: a.incomeTotal / 100, perf: performance(a), marginCall: a.marginCall ?? null, allowShort: a.allowShort && s.settings.allowShort };
}

export function buildView(s: GameState, name: string, p: Record<string, string>): unknown {
  switch (name) {
    case "dashboard": {
      const day = dayIndex(s.t);
      return {
        accounts: ["perso", "desk"].map((id) => accountSummary(s, id)).filter(Boolean),
        agenda: s.agenda.filter((a) => dayIndex(a.t) === day || (a.t > s.t && a.t < s.t + MIN_PER_DAY)).slice(0, 14),
        missions: s.missions.filter((m) => m.status === "active").slice(0, 5),
        news: s.news.slice(0, 6), messages: s.messages.slice(0, 4),
        calendar: s.calendar.filter((c) => c.day === day || c.day === day + 1).slice(0, 10),
        indices: ["IDX-EU", "IDX-US", "IDX-AS", "IDX-WD", "EURUSD", "BRENT", "GOLD", "AURC", "DE10Y", "US10Y"].filter((x) => s.instruments[x]).map((id) => quoteLite(s, id)),
        macro: Object.values(s.macro.zones).map((z) => ({ id: z.id, name: z.name, growth: r2(z.growth), inflation: r2(z.inflation), rate: z.policyRate, y10: r2(z.y10), unemployment: r2(z.unemployment) })),
        regime: { id: s.macro.regime, ...REGIMES[s.macro.regime], since: s.macro.regimeSinceDay }, riskAversion: r2(s.macro.riskAversion), liquidity: r2(s.macro.liquidity), vix: vixLike(s),
        crises: s.crises.filter((c) => !c.resolved).map((c) => ({ ...c, label: CRISIS_LABELS[c.kind] })),
        career: s.mode === "carriere" ? { employed: s.career.employed, title: rankTitle(s), bank: BANK_BY_ID[s.career.bankId], stress: s.career.stress, energy: s.career.energy, objectives: s.career.objectives, lastReview: s.career.reviews[0] ?? null, varLimit: s.career.deskLimitVaR / 100, var: s.accounts.desk ? valueAtRisk(s, "desk").var : 0 } : null,
        challenge: s.challenge ? { ...s.challenge, def: CHALLENGES.find((c) => c.id === s.challenge!.id), perf: accountEquity(s, "perso") / s.challenge.startEquity - 1 } : null,
        equityHistory: s.accounts.perso.equityHistory.slice(-120),
        deskHistory: s.accounts.desk?.equityHistory.slice(-120) ?? [],
      };
    }
    case "search": {
      const list = Object.values(s.instruments).filter((d) => !d.option).map((d) => ({ ...quoteLite(s, d.id), country: d.country, liq: d.liquidity, desk: s.mode === "carriere" ? canTradeOnDesk(s, d).ok : true }));
      return { list, watchlist: s.watchlist };
    }
    case "instrument": {
      const id = p.id;
      const d = s.instruments[id];
      if (!d) return { error: "Instrument introuvable" };
      const q = s.quotes[id];
      const book = quoteBook(s, id);
      const day = dayIndex(s.t);
      let analytics: Record<string, unknown> = {};
      if (d.cls === "action") {
        const ebitda = d.revenue! * d.margin! * 1.6;
        analytics = { marketCap: q.price * d.shares! * 1e6, shares: d.shares! * 1e6, revenue: d.revenue! * 1e6, netIncome: q.eps! * d.shares! * 1e6, eps: q.eps, per: q.price / (q.eps ?? 1), fairPE: d.fairPE, dividend: q.dividend, yield: (q.dividend ?? 0) / q.price, debt: d.debt! * 1e6, debtEbitda: d.debt! / ebitda, growth: d.growth, fair: q.fair, payout: d.payout, nextEarnings: q.nextEarningsDay, risks: d.risks, outlook: d.outlook, stress: q.stress };
      } else if (d.bond) {
        const y = bondYield(s, d, day);
        const a = bondPriceFromYield(d, day, y, s.macro.zones[d.zone].policyRate);
        analytics = { ...a, ytm: y * 100, issuer: d.bond.issuer, rating: d.bond.rating, gov: d.bond.gov, maturityDay: d.bond.maturityDay, freq: d.bond.freq, floating: d.bond.floating, nominal: d.bond.nominal, coupon: d.bond.couponRate, defaulted: q.defaulted, spreadBps: (y * 100 - 0) };
      } else if (d.option) {
        const o = d.option;
        const T = Math.max(0, (o.expiryDay * MIN_PER_DAY + 17.5 * 60 - s.t) / (365 * MIN_PER_DAY));
        const iv = optionIV(s, o.underlying, o.strike, T);
        analytics = { ...blackScholes(o.type, s.quotes[o.underlying].price, o.strike, T, rateFor(s, d.currency) / 100, iv, dividendYield(s, s.instruments[o.underlying])), iv, T, underlyingPrice: s.quotes[o.underlying].price, ...o };
      } else if (d.future) {
        analytics = { ...d.future, underlyingPrice: s.quotes[d.future.underlying].price, notional: q.price * d.future.multiplier, initialMargin: q.price * d.future.multiplier * d.future.marginPct, basis: q.price - s.quotes[d.future.underlying].price };
      } else if (d.basket) {
        analytics = { members: d.basket.map((m) => ({ id: m.id, name: s.instruments[m.id].name, weight: (m.w * s.quotes[m.id].price * multiplier(s.instruments[m.id]) * toEur(s, 1, s.instruments[m.id].currency)) / Math.max(1e-9, toEur(s, q.price, d.currency)) })).sort((a, b) => b.weight - a.weight).slice(0, 15) };
      }
      const pos = Object.values(s.accounts).map((a) => ({ account: a.id, label: a.label, pos: a.positions[id] ?? null })).filter((x) => x.pos);
      return {
        def: d, quote: { price: q.price, prevClose: q.prevClose, dayOpen: q.dayOpen, dayHigh: q.dayHigh, dayLow: q.dayLow, dayVolume: q.dayVolume, rv: q.rv, halted: q.halted, defaulted: q.defaulted, ivBump: q.ivBump, baseVol: baseVol(s, id) },
        book, daily: q.daily, intraday: q.intraday, analytics, positions: pos,
        news: s.news.filter((n) => n.tickers.includes(id) || (d.sector && n.tickers.some((t) => s.instruments[t]?.sector === d.sector))).slice(0, 12),
        orders: s.orders.filter((o) => o.instrumentId === id).slice(0, 20), watch: s.watchlist.includes(id), alerts: s.alerts.filter((a) => a.instrumentId === id),
        optionable: optionable(d), adv: advNotionalEur(s, d), deskAllowed: s.mode === "carriere" ? canTradeOnDesk(s, d) : { ok: false, reason: "" },
        accounts: ["perso", "desk"].map((a) => accountSummary(s, a)).filter((a) => a && (a.id !== "desk" || s.career.employed)),
      };
    }
    case "chain": {
      const und = p.id;
      const ud = s.instruments[und];
      if (!ud || !optionable(ud)) return { error: "Sous-jacent non optionnable" };
      const S = s.quotes[und].price;
      const expiries = listExpiries(s, 4);
      const exp = Number(p.expiry) || expiries[0];
      const strikes = strikeGrid(S, 6);
      const T = Math.max(0, (exp * MIN_PER_DAY + 17.5 * 60 - s.t) / (365 * MIN_PER_DAY));
      const r = rateFor(s, ud.currency) / 100, qd = dividendYield(s, ud);
      const rows = strikes.map((K) => {
        const iv = optionIV(s, und, K, T);
        const c = blackScholes("call", S, K, T, r, iv, qd), pu = blackScholes("put", S, K, T, r, iv, qd);
        return { K, iv, call: { id: optionId(und, "call", K, exp), ...c }, put: { id: optionId(und, "put", K, exp), ...pu } };
      });
      return { underlying: und, name: ud.name, spot: S, currency: ud.currency, expiries, expiry: exp, T, r, q: qd, rows, multiplier: ud.cls === "indice" ? 10 : 100, baseVol: baseVol(s, und) };
    }
    case "portfolio": {
      const id = p.account || "perso";
      const acc = accountSummary(s, id);
      if (!acc) return { error: "Compte introuvable" };
      return { account: acc, positions: positionViews(s, id), exposures: exposures(s, id), history: s.accounts[id].equityHistory, benchmark: s.quotes["XWLD"].daily.slice(-s.accounts[id].equityHistory.length - 1).map((b) => ({ t: b.t, v: b.c })), orders: s.orders.filter((o) => o.account === id && (o.status === "en_attente" || o.status === "partiel")), structured: s.structuredHoldings.filter((h) => h.account === id).map((h) => ({ ...h, product: s.structuredProducts.find((x) => x.id === h.productId), value: h.status === "actif" ? structuredValueEur(s, h.productId, h.nominal / 100) : 0 })), accounts: Object.values(s.accounts).map((a) => ({ id: a.id, label: a.label, kind: a.kind })) };
    }
    case "transactions": {
      const id = p.account || "perso";
      return { fills: s.fills.filter((f) => f.account === id).slice(0, 300), orders: s.orders.filter((o) => o.account === id).slice(0, 300), ledger: accountEntries(s, id, 400), trial: trialBalance(s), balanced: isBalanced(s), archived: s.ledgerArchive.count, accounts: Object.values(s.accounts).map((a) => ({ id: a.id, label: a.label })) };
    }
    case "risk": {
      const id = p.account || (s.career.employed ? "desk" : "perso");
      const v = valueAtRisk(s, id);
      return { account: accountSummary(s, id), var: v, exposures: exposures(s, id), limit: id === "desk" ? s.career.deskLimitVaR / 100 : null, maxPos: s.career.deskMaxPosition, breaches: s.career.breaches, warnings: s.career.warnings, positions: positionViews(s, id), banks: s.banks.map((b) => ({ ...b, aum: b.aum / 100, stockStress: b.stockId ? s.quotes[b.stockId]?.stress ?? 0 : 0 })), credit: Object.values(s.instruments).filter((d) => d.bond && !d.bond.gov).map((d) => ({ id: d.id, issuer: d.bond!.issuer, rating: d.bond!.rating, spread: Math.round((bondYield(s, d, dayIndex(s.t)) * 100 - (s.macro.zones[d.zone].y10)) * 100), stress: d.bond!.issuerStock ? s.quotes[d.bond!.issuerStock].stress : 0, defaulted: s.quotes[d.id].defaulted })), vix: vixLike(s), riskAversion: s.macro.riskAversion, liquidity: s.macro.liquidity, crises: s.crises.map((c) => ({ ...c, label: CRISIS_LABELS[c.kind] })), accounts: Object.values(s.accounts).map((a) => ({ id: a.id, label: a.label })) };
    }
    case "news": return { news: s.news.slice(0, 250), impulses: s.impulses.slice(0, 30), regimes: s.macro.regimeHistory.map((r) => ({ ...r, label: REGIMES[r.regime].label })) };
    case "macro": return { zones: s.macro.zones, regime: s.macro.regime, regimeLabel: REGIMES[s.macro.regime].label, riskAversion: s.macro.riskAversion, liquidity: s.macro.liquidity, geopolitics: s.macro.geopolitics, vix: vixLike(s) };
    case "calendar": { const day = dayIndex(s.t); return { events: s.calendar.filter((c) => c.day >= day - 7 && c.day <= day + 30), today: day }; }
    case "meetings": {
      const active = s.activeMeetingId ? s.meetings.find((m) => m.id === s.activeMeetingId) : null;
      const pend = typeof s.flags["pendingMeeting"] === "string" ? JSON.parse(s.flags["pendingMeeting"] as string) : null;
      return { active: active ? meetingView(s, active) : null, pending: pend, history: s.meetings.filter((m) => m.done).slice(0, 40).map((m) => ({ id: m.id, templateId: m.templateId, title: meetingView(s, m).title, startedT: m.startedT, outcome: m.outcome, score: m.score })), templates: allMeetingTemplates().map((t) => ({ id: t.id, type: t.type })) };
    }
    case "meeting": { const m = s.meetings.find((x) => x.id === p.id); return m ? meetingView(s, m) : { error: "Réunion introuvable" }; }
    case "agenda": return { agenda: s.agenda.slice(-80), t: s.t };
    case "messages": return { messages: s.messages.slice(0, 100) };
    case "notifications": return { notifications: s.notifications };
    case "clients": return {
      clients: s.clients.map((c) => ({ ...c, wealth: c.wealth / 100, aum: accountEquity(s, c.accountId), perf: performance(s.accounts[c.accountId]), equityWeight: equityWeight(s, c.accountId), band: suitableEquityBand(c.riskTolerance), allocation: currentAllocation(s, c), npc: s.npcs[c.npcId], history: c.history.slice(0, 15), equityHistory: s.accounts[c.accountId].equityHistory.slice(-120) })),
      buckets: ALLOC_BUCKETS.map((b) => ({ ...b, price: b.id === "CASH" ? 1 : s.quotes[b.id]?.price })), totalAum: totalAum(s), feesYtd: ((s.flags["feesYtd"] as number) ?? 0) / 100,
    };
    case "missions": return { missions: s.missions.slice(0, 80).map((m) => ({ ...m, question: m.status === "active" ? missionQuestion(s, m) : null })) };
    case "learning": return { lessons: LESSONS, completed: s.learning.completed, attempts: s.learning.attempts };
    case "skills": return { skills: Object.entries(s.skills).map(([k, xp]) => ({ id: k, name: SKILL_NAMES[k as keyof typeof SKILL_NAMES], xp, level: skillLevel(xp), next: SKILL_LEVELS[skillLevel(xp) + 1] ?? null, prev: SKILL_LEVELS[skillLevel(xp)] })), log: s.skillLog.slice(0, 60), reputation: Object.entries(s.reputation).map(([k, v]) => ({ id: k, name: REP_NAMES[k as keyof typeof REP_NAMES], value: v })), avgRep: avgRep(s), decisions: s.decisions.slice(0, 80) };
    case "network": return { npcs: Object.values(s.npcs).map((n) => ({ ...n, client: n.relation === "client" })) };
    case "hr": {
      const sc = s.career.employed ? performanceScore(s, "quarter") : null;
      return { career: { ...s.career, salaryAnnual: s.career.salaryAnnual / 100, ytdBonusPool: s.career.ytdBonusPool / 100, deskLimitVaR: s.career.deskLimitVaR / 100, title: rankTitle(s), offers: s.career.pendingOffers.map((o) => ({ ...o, salary: o.salary / 100, bank: BANK_BY_ID[o.bankId], title: TRACKS[o.track].ranks[o.rank], ready: !!s.flags[`offerReady_${o.id}`] })) }, track: TRACKS[s.career.track], bank: BANK_BY_ID[s.career.bankId], score: sc, banks: BANKS, tracks: TRACKS, baseSalary: BASE_SALARY, vacationLeft: 25 - ((s.flags["vacationDaysYear"] as number) ?? 0), mode: s.mode };
    }
    case "wealth": {
      const persoEq = accountEquity(s, "perso");
      const company = s.company && !s.company.bankrupt ? Math.max(0, accountEquity(s, s.company.accountId)) * (1 - ((s.flags["dilution"] as number) ?? 0)) : 0;
      const entries = accountEntries(s, "perso", 400);
      const sum = (f: (m: string) => boolean, sign: 1 | -1) => entries.filter((e) => f(e.memo) && (sign === 1 ? e.debit === "perso:cash" : e.credit === "perso:cash")).reduce((a, e) => a + toEur(s, e.amount / 100, e.cur), 0);
      return { perso: accountSummary(s, "perso"), persoEq, company, total: persoEq + company, lifestyle: (s.flags["lifestyle"] as number) ?? 1, livingExpenses: s.settings.livingExpenses, income: { salaires: sum((m) => m.startsWith("Salaire") || m.startsWith("Bonus"), 1), dividendes: sum((m) => m.startsWith("Dividende") || m.startsWith("Coupon") || m.startsWith("Intérêts"), 1), depenses: sum((m) => m.startsWith("Dépenses") || m.startsWith("Agios"), -1) }, history: s.accounts.perso.equityHistory, peak: s.stats.peakWealth, maxDrawdown: s.stats.maxDrawdown };
    }
    case "compensation": return { salary: s.career.salaryAnnual / 100, bonusPool: s.career.ytdBonusPool / 100, reviews: s.career.reviews.slice(0, 20).map((r) => ({ ...r, bonus: r.bonus ? r.bonus / 100 : undefined })), payslips: accountEntries(s, "perso", 400).filter((e) => e.memo.startsWith("Salaire") || e.memo.startsWith("Bonus")).slice(0, 24), grid: BASE_SALARY.map((b, i) => ({ rank: i, title: TRACKS[s.career.track].ranks[i], salary: Math.round(b * (BANK_BY_ID[s.career.bankId]?.salaryMult ?? 1)) })), bank: BANK_BY_ID[s.career.bankId], rank: s.career.rank, employed: s.career.employed };
    case "company": return { company: s.company ? { ...s.company, aum: s.company.aum / 100, debt: s.company.debt / 100, marketingBudget: s.company.marketingBudget / 100, equityRaised: s.company.equityRaised / 100, retainedEarnings: s.company.retainedEarnings / 100, employees: s.company.employees.map((e) => ({ ...e, salary: e.salary / 100 })) } : null, statements: companyStatements(s), types: COMPANY_TYPES, offices: OFFICES, tools: TOOLS, candidates: s.company ? hireCandidates(s) : [], persoCash: cashBalances(s, "perso").EUR ? (cashBalances(s, "perso").EUR as number) / 100 : 0, avgRep: avgRep(s), dilution: (s.flags["dilution"] as number) ?? 0 };
    case "structured": {
      const day = dayIndex(s.t);
      return { products: s.structuredProducts.map((pp) => ({ ...pp, open: day <= pp.subscriptionEndDay, perf: Math.min(...pp.underlyings.map((u) => s.quotes[u].price / pp.initial[u])), minTicket: pp.minTicket / 100, touched: !!s.flags[`barrier_${pp.id}`], issuerStress: pp.issuerStock ? s.quotes[pp.issuerStock]?.stress ?? 0 : 0 })), holdings: s.structuredHoldings.map((h) => ({ ...h, nominal: h.nominal / 100, couponsPaid: h.couponsPaid / 100, redemption: h.redemption ? h.redemption / 100 : undefined, value: h.status === "actif" ? structuredValueEur(s, h.productId, h.nominal / 100) : 0 })), cash: (cashBalances(s, "perso").EUR as number ?? 0) / 100 };
    }
    case "scenarios": return structuredScenarios(s, p.id) ?? { error: "Produit introuvable" };
    case "settings": return { settings: s.settings, difficulty: s.difficulty, mode: s.mode, seed: s.seed, version: s.version, name: s.name, profile: s.profile, created: s.createdAt, date: fmtDate(s.t) };
    case "banks": return { banks: s.banks.map((b) => ({ ...b, aum: b.aum / 100, tradingPnlYtd: b.tradingPnlYtd / 100, def: BANK_BY_ID[b.id] ?? null, price: b.stockId ? s.quotes[b.stockId].price : null })) };
    default: return { error: `Vue inconnue : ${name}` };
  }
}
