import { parseAvatar, lockedParts } from "@/engine/avatar";
/** Mutations validées (Zod) : toute modification de l'état passe par ici, côté serveur. */
import { z } from "zod";
import type { GameState } from "@/engine/types";
import { canCall, RECALL_DAYS } from "@/engine/prospects";
import { checkProgress, endingAvailable, endGame } from "@/engine/progression";
import { buyProperty, setRent, setSale, withdraw, renovate } from "@/engine/realestate";
import { doActivity, moveHousing, sellHousing, setTransport, setSub } from "@/engine/life";
import { SPEEDS, MIN_PER_DAY, tOfDay, dayIndex, nextBusinessDay, minuteOfDay, isWeekend, useEpoch, fmtDate } from "@/engine/time";
import { placeOrder, cancelOrder, convertCash } from "@/engine/orders";
import { startMeeting, answerMeeting, explainTerm } from "@/engine/meetingEngine";
import { answerMission, checkMissions } from "@/engine/missions";
import { rebalanceClient } from "@/engine/clients";
import { subscribe } from "@/engine/structured";
import { handleMessageAction } from "@/engine/events";
import { foundCompany, companyAction } from "@/engine/company";
import { takeVacation } from "@/engine/career";
import { completeLesson, advanceTo } from "@/engine/engine";
import { nextId, logDecision } from "@/engine/core";
import { toCents } from "@/engine/money";
import { closeTraining } from "@/engine/training";
import { answerReview } from "@/engine/revision";
import { setPlan, sleepCheck, finishSleep, doOvertime, workWindow, isWorkDay, hhmm, sleepLabel } from "@/engine/schedule";
import { answerQuiz, quizServed } from "@/engine/quiz";

const num = z.coerce.number().finite();
export const ActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("speed"), speed: z.union(SPEEDS.map((x) => z.literal(x)) as unknown as [z.ZodLiteral<0>, z.ZodLiteral<1>, ...z.ZodLiteral<number>[]]) }),
  z.object({ type: z.literal("pause"), paused: z.boolean() }),
  z.object({ type: z.literal("skip"), to: z.enum(["next_hour", "market_open", "next_morning", "next_event", "work_end"]) }),
  z.object({ type: z.literal("order"), account: z.string().max(64), instrumentId: z.string().max(80), side: z.enum(["buy", "sell"]), orderType: z.enum(["market", "limit", "stop", "stop_limit"]), qty: num.positive(), limit: num.positive().optional(), stop: num.positive().optional(), duration: z.enum(["jour", "gtc", "date"]).optional(), expiresDays: num.int().min(1).max(90).optional(), stopLoss: num.positive().optional(), takeProfit: num.positive().optional(), clientRef: z.string().max(64).optional() }),
  z.object({ type: z.literal("cancel"), orderId: z.string().max(64) }),
  z.object({ type: z.literal("convert"), account: z.string().max(64), from: z.enum(["EUR", "USD", "GBP", "CHF", "JPY", "CAD", "AUD", "CNY"]), to: z.enum(["EUR", "USD", "GBP", "CHF", "JPY", "CAD", "AUD", "CNY"]), amount: num.positive().max(1e9) }),
  z.object({ type: z.literal("watch"), instrumentId: z.string().max(80), on: z.boolean() }),
  z.object({ type: z.literal("alert"), instrumentId: z.string().max(80), level: num.positive(), above: z.boolean() }),
  z.object({ type: z.literal("alert_delete"), id: z.string().max(64) }),
  z.object({ type: z.literal("join_meeting") }),
  z.object({ type: z.literal("start_meeting"), template: z.string().max(64), params: z.record(z.string()).optional() }),
  z.object({ type: z.literal("answer_meeting"), meetingId: z.string().max(64), choiceId: z.string().max(32).optional(), value: num.optional(), spoken: z.string().max(500).optional(), timeout: z.boolean().optional(), offtopic: z.boolean().optional() }),
  z.object({ type: z.literal("ask_term"), meetingId: z.string().max(64), question: z.string().min(2).max(300) }),
  z.object({ type: z.literal("answer_mission"), missionId: z.string().max(64), value: num.optional(), choice: num.int().optional(), forecast: z.string().max(20).optional() }),
  z.object({ type: z.literal("rebalance"), clientId: z.string().max(64), target: z.record(num.min(0).max(1)) }),
  z.object({ type: z.literal("contact_client"), clientId: z.string().max(64) }),
  z.object({ type: z.literal("call_client"), clientId: z.string().max(64) }),
  z.object({ type: z.literal("subscribe"), productId: z.string().max(64), nominal: num.positive().max(1e9) }),
  z.object({ type: z.literal("message_action"), messageId: z.string().max(64), action: z.string().max(40), payload: z.record(z.string()).optional() }),
  z.object({ type: z.literal("read"), what: z.enum(["notifications", "messages"]), id: z.string().max(64).optional() }),
  z.object({ type: z.literal("lesson"), lessonId: z.string().max(64), answer: num }),
  z.object({ type: z.literal("found_company"), name: z.string().min(2).max(60), kind: z.enum(["conseil", "gestion", "fonds", "hedge_fund", "fintech", "banque_affaires"]), capital: num.positive(), strategy: z.string().max(200) }),
  z.object({ type: z.literal("company"), action: z.string().max(30), params: z.record(z.union([z.string().max(100), z.number()])).optional() }),
  z.object({ type: z.literal("vacation"), days: num.int().min(1).max(15) }),
  z.object({ type: z.literal("lifestyle"), level: num.int().min(0).max(4) }),
  z.object({ type: z.literal("life_activity"), id: z.string().max(30) }),
  z.object({ type: z.literal("life_move"), housing: z.string().max(30), buy: z.boolean() }),
  z.object({ type: z.literal("life_sell") }),
  z.object({ type: z.literal("life_transport"), mode: z.enum(["commun", "velo", "occasion", "neuve"]) }),
  z.object({ type: z.literal("life_sub"), key: z.enum(["mutuelle", "assurance", "sport", "streaming"]), on: z.boolean() }),
  z.object({ type: z.literal("ask_raise") }),
  z.object({ type: z.literal("end_game"), ending: z.enum(["retraite", "fortune"]) }),
  z.object({ type: z.literal("call_prospect"), id: z.string().max(40) }),
  z.object({ type: z.literal("re_buy"), listing: z.string().max(60), credit: z.boolean() }),
  z.object({ type: z.literal("re_rent"), id: z.string().max(40), rent: num.positive().max(100000) }),
  z.object({ type: z.literal("re_sell"), id: z.string().max(40), price: num.positive().max(1e8) }),
  z.object({ type: z.literal("re_withdraw"), id: z.string().max(40) }),
  z.object({ type: z.literal("re_renovate"), id: z.string().max(40) }),
  z.object({ type: z.literal("settings"), notifLevel: z.enum(["toutes", "importantes", "critiques"]).optional(), sound: z.boolean().optional(), minutesPerSecond: num.min(0.25).max(60).optional(), autoPauseImportant: z.boolean().optional(), livingExpenses: z.boolean().optional(), aiEnabled: z.boolean().optional(), explanations: z.boolean().optional(), allowShort: z.boolean().optional(), name: z.string().min(1).max(60).optional() }),
  z.object({ type: z.literal("tutorial_visit"), page: z.string().max(40) }),
  z.object({ type: z.literal("set_plan"), start: z.number().int(), end: z.number().int(), wake: z.number().int() }),
  z.object({ type: z.literal("sleep") }),
  z.object({ type: z.literal("set_avatar"), avatar: z.record(z.string().max(20), z.union([z.number(), z.boolean()])) }),
  z.object({ type: z.literal("overtime"), hours: z.number().int().min(1).max(4), focus: z.enum(["avance", "dossiers", "formation"]), subject: z.enum(["auto", "marches", "analyse", "maths", "macro", "risque", "erreurs"]).optional() }),
  z.object({ type: z.literal("review_answer"), key: z.string().max(80), choice: z.number().int().min(0).max(5) }),
  z.object({ type: z.literal("training_resume") }),
  z.object({ type: z.literal("training_close") }),
  z.object({ type: z.literal("quiz_answer"), id: z.string().max(40), choice: z.number().int().min(0).max(5) }),
  z.object({ type: z.literal("leave_meeting") }),
]);
export type Action = z.infer<typeof ActionSchema>;
export type ActionResult = { ok: boolean; message?: string; error?: string; data?: unknown };

/** Applique une action puis met à jour tout de suite la progression des missions (même en pause) */
export function applyAction(s: GameState, a: Action): ActionResult {
  useEpoch(s);
  const r = applyActionInner(s, a);
  if (r.ok) { checkMissions(s); checkProgress(s); }
  return r;
}

/** Fait avancer l'horloge jusqu'à `target` en respectant l'état de pause d'avant (une interruption par un événement reste une pause) */
function runClock(s: GameState, target: number) {
  const wasPaused = s.paused, why = s.pauseReason;
  advanceTo(s, target);
  if (!s.paused || !s.pauseReason || s.pauseReason === why) { s.paused = wasPaused; s.pauseReason = why; }
}
function doSleep(s: GameState): ActionResult {
  const c = sleepCheck(s);
  if (!c.ok) return { ok: false, error: c.error };
  const t0 = s.t;
  s.life!.sleep = { startT: t0, endT: c.target, hours: c.hours }; // la nuit est reconnue dès le coucher (sinon « nuit blanche » au réveil)
  runClock(s, c.target);
  const r = finishSleep(s, t0);
  const interrupted = s.t < c.target - 5;
  return { ok: true, message: `😴 Vous avez dormi ${r.hours} h (sommeil ${sleepLabel(r.hours)}).${interrupted ? ` Réveil anticipé : ${s.pauseReason ?? "événement"}.` : ` Réveil à ${hhmm(s.t % MIN_PER_DAY)}.`}` };
}
function applyActionInner(s: GameState, a: Action): ActionResult {
  switch (a.type) {
    case "speed": s.speed = a.speed as GameState["speed"]; if (a.speed === 0) { s.paused = true; s.pauseReason = "Pause"; } else if (!s.activeMeetingId) { s.paused = false; s.pauseReason = undefined; } return { ok: true };
    case "pause":
      if (!a.paused && s.activeMeetingId) return { ok: false, error: "Terminez la réunion en cours avant de reprendre le temps." };
      s.paused = a.paused; s.pauseReason = a.paused ? "Pause" : undefined; if (!a.paused && s.speed === 0) s.speed = 1; return { ok: true };
    case "skip": {
      if (s.activeMeetingId) return { ok: false, error: "Réunion en cours." };
      const day = dayIndex(s.t), m = minuteOfDay(s.t);
      let target: number;
      if (a.to === "next_hour") target = s.t + 60;
      else if (a.to === "market_open") target = m < 9 * 60 && !isWeekend(s.t) ? tOfDay(day, 9, 0) : tOfDay(nextBusinessDay(day + 1), 9, 0);
      else if (a.to === "work_end") { if (!isWorkDay(s)) return { ok: false, error: "Pas de journée de travail aujourd'hui." }; const w = workWindow(s); if (m >= w.end) return { ok: false, error: "Le travail est déjà fini pour aujourd'hui." }; target = tOfDay(day, 0, w.end); }
      else if (a.to === "next_morning") {
        // Le soir, « jusqu'à demain » = aller dormir jusqu'à l'heure de réveil choisie
        const sl = sleepCheck(s);
        if (sl.ok) return doSleep(s);
        target = tOfDay(nextBusinessDay(day + 1), 7, 30);
      }
      else { const nx = s.agenda.find((x) => x.status === "prevu" && x.t > s.t); target = nx ? nx.t : s.t + 60; }
      const t0 = s.t;
      runClock(s, Math.min(target, s.t + 4 * MIN_PER_DAY));
      const n = Math.round((s.t - t0) / 5);
      return { ok: true, message: s.paused && s.pauseReason && s.pauseReason !== "Pause" ? `Avance interrompue : ${s.pauseReason}` : `Temps avancé (${n * 5} min simulées).` };
    }
    case "order": {
      const r = placeOrder(s, { account: a.account, instrumentId: a.instrumentId, side: a.side, type: a.orderType, qty: a.qty, limit: a.limit, stop: a.stop, duration: a.duration ?? (a.orderType === "market" ? "jour" : "gtc"), expiresT: a.expiresDays ? s.t + a.expiresDays * MIN_PER_DAY : undefined, stopLoss: a.stopLoss, takeProfit: a.takeProfit, clientRef: a.clientRef });
      return r.ok ? { ok: true, message: r.message, data: r.order } : { ok: false, error: r.error };
    }
    case "cancel": { const r = cancelOrder(s, a.orderId); return r.ok ? { ok: true, message: r.message } : { ok: false, error: r.error }; }
    case "convert": {
      const acc = s.accounts[a.account];
      if (!acc || (acc.kind !== "personnel" && acc.kind !== "desk")) return { ok: false, error: "Compte non convertible." };
      if (a.from === a.to) return { ok: false, error: "Choisissez deux devises différentes." };
      const c = toCents(a.amount);
      const bal = s.balances[`${a.account}:cash|${a.from}`] ?? 0;
      if (c > bal) return { ok: false, error: "Solde insuffisant dans la devise source." };
      const got = convertCash(s, a.account, a.from, a.to, c);
      return { ok: true, message: `Converti : ${a.amount.toLocaleString("fr-FR")} ${a.from} → ${(got / 100).toLocaleString("fr-FR")} ${a.to}` };
    }
    case "watch": if (!s.instruments[a.instrumentId]) return { ok: false, error: "Instrument inconnu." }; s.watchlist = a.on ? [...new Set([...s.watchlist, a.instrumentId])].slice(0, 40) : s.watchlist.filter((x) => x !== a.instrumentId); return { ok: true };
    case "alert": if (!s.instruments[a.instrumentId]) return { ok: false, error: "Instrument inconnu." }; if (s.alerts.length >= 30) return { ok: false, error: "30 alertes maximum." }; s.alerts.push({ id: nextId(s, "al"), instrumentId: a.instrumentId, level: a.level, above: a.above, triggered: false }); return { ok: true, message: "Alerte créée." };
    case "alert_delete": s.alerts = s.alerts.filter((x) => x.id !== a.id); return { ok: true };
    case "join_meeting": {
      const pend = s.flags["pendingMeeting"];
      if (typeof pend !== "string") return { ok: false, error: "Aucune réunion en attente." };
      const p = JSON.parse(pend) as { template: string; params: Record<string, string> };
      delete s.flags["pendingMeeting"];
      const m = startMeeting(s, p.template, p.params);
      return m ? { ok: true, data: { meetingId: m.id } } : { ok: false, error: "Réunion indisponible." };
    }
    case "start_meeting": {
      const allowed = ["comite_investissement", "comite_risques", "client_point_regulier", "desk_quotidien", ...(process.env.E2E_HOOKS === "1" ? ["formation_n1", "culture_n1"] : [])];
      if (!allowed.includes(a.template)) return { ok: false, error: "Cette réunion ne peut pas être provoquée." };
      if (!s.career.employed && a.template !== "client_point_regulier") return { ok: false, error: "Vous n'êtes pas en poste." };
      const key = `manualMeeting:${a.template}:${dayIndex(s.t)}`;
      if (s.eventCooldowns[key]) return { ok: false, error: "Cette réunion a déjà eu lieu aujourd'hui." };
      s.eventCooldowns[key] = 1;
      const m = startMeeting(s, a.template, a.params ?? {});
      return m ? { ok: true, data: { meetingId: m.id } } : { ok: false, error: "Réunion indisponible." };
    }
    case "answer_meeting": { const r = answerMeeting(s, a.meetingId, { choiceId: a.choiceId, value: a.value, spoken: a.spoken, timeout: a.timeout, offtopic: a.offtopic }); return r.ok ? { ok: true } : { ok: false, error: r.error }; }
    case "ask_term": { const r = explainTerm(s, a.meetingId, a.question); return r.ok ? { ok: true, data: r } : { ok: false, error: r.error }; }
    case "leave_meeting": { if (!s.activeMeetingId) return { ok: false, error: "Aucune réunion." }; const m = s.meetings.find((x) => x.id === s.activeMeetingId); if (m) { m.done = true; m.outcome = "Vous avez quitté la réunion avant la fin."; } s.activeMeetingId = undefined; if (m && (m.templateId === "formation_n1" || m.templateId === "culture_n1")) return { ok: true, message: "Vous quittez la réunion : votre responsable vous reprendra plus tard (page Planning)." }; s.reputation.interne = Math.max(0, s.reputation.interne - 4); s.reputation.fiabilite = Math.max(0, s.reputation.fiabilite - 3); return { ok: true, message: "Vous quittez la réunion. Votre départ est mal perçu." }; }
    case "answer_mission": { const r = answerMission(s, a.missionId, { value: a.value, choice: a.choice, forecast: a.forecast }); return r.ok ? { ok: true, message: r.message } : { ok: false, error: r.error }; }
    case "rebalance": { const r = rebalanceClient(s, a.clientId, a.target); return r.ok ? { ok: true, message: `Rééquilibrage transmis (${r.orders.length} ordres).${r.warnings.length ? " ⚠ " + r.warnings.join(" ") : ""}`, data: r } : { ok: false, error: r.error }; }
    case "contact_client": {
      const c = s.clients.find((x) => x.id === a.clientId);
      if (!c || c.lost) return { ok: false, error: "Client introuvable." };
      if (s.t - c.lastContactT < MIN_PER_DAY) return { ok: false, error: "Vous avez déjà contacté ce client aujourd'hui." };
      const m = startMeeting(s, "client_point_regulier", { client: c.id });
      return m ? { ok: true, data: { meetingId: m.id } } : { ok: false, error: "Réunion indisponible." };
    }
    case "call_client": {
      const c = s.clients.find((x) => x.id === a.clientId);
      if (!c || c.lost) return { ok: false, error: "Client introuvable." };
      if (s.activeMeetingId) return { ok: false, error: "Vous êtes déjà en réunion." };
      const lastCall = (s.flags[`call_${c.id}`] as number | undefined) ?? -1e9;
      if (dayIndex(s.t) === dayIndex(lastCall)) return { ok: false, error: `Vous avez déjà appelé ${c.name} aujourd'hui. Rappelez demain.` };
      s.flags[`call_${c.id}`] = s.t;
      const m = startMeeting(s, "appel_client", { client: c.id });
      return m ? { ok: true, data: { meetingId: m.id } } : { ok: false, error: "Appel impossible." };
    }
    case "subscribe": { const r = subscribe(s, "perso", a.productId, a.nominal); return r.ok ? { ok: true, message: "Souscription enregistrée." } : { ok: false, error: r.error }; }
    case "message_action": { const r = handleMessageAction(s, a.messageId, a.action, a.payload ?? {}); return r.ok ? { ok: true, message: r.message } : { ok: false, error: r.error }; }
    case "read": if (a.what === "notifications") { for (const n of s.notifications) if (!a.id || n.id === a.id) n.read = true; } else { for (const m of s.messages) if (!a.id || m.id === a.id) m.read = true; } return { ok: true };
    case "lesson": { const r = completeLesson(s, a.lessonId, a.answer); return r.ok ? { ok: true, data: r } : { ok: false, error: r.error }; }
    case "found_company": { const r = foundCompany(s, a.name, a.kind, a.capital, a.strategy); return r.ok ? { ok: true, message: "Société créée." } : { ok: false, error: r.error }; }
    case "company": { const r = companyAction(s, a.action, a.params ?? {}); return r.ok ? { ok: true, message: r.message } : { ok: false, error: r.error }; }
    case "vacation": { const r = takeVacation(s, a.days); if (!r.ok) return { ok: false, error: r.error }; const n = advanceTo(s, r.until, 6000); return { ok: true, message: `Congés terminés (${Math.round(n * 5 / 1440)} jours simulés).` }; }
    case "life_activity": {
      const r = doActivity(s, a.id);
      if (!r.ok) return { ok: false, error: r.error };
      // L'activité prend du temps réel de jeu : l'horloge avance de sa durée (s'arrête si un événement important survient)
      const t0 = s.t;
      runClock(s, t0 + r.hours * 60);
      const done = Math.round((s.t - t0) / 60 * 10) / 10;
      return { ok: true, message: done < r.hours ? `${r.message} Interrompue après ${done} h : ${s.pauseReason ?? "événement"}.` : r.message };
    }
    case "life_move": { const r = moveHousing(s, a.housing, a.buy); return r.ok ? { ok: true, message: r.message } : { ok: false, error: r.error }; }
    case "life_sell": { if (!s.life) return { ok: false, error: "Mode carrière uniquement." }; const r = sellHousing(s); return r.ok ? { ok: true, message: r.message } : { ok: false, error: r.error }; }
    case "life_transport": { const r = setTransport(s, a.mode); return r.ok ? { ok: true, message: r.message } : { ok: false, error: r.error }; }
    case "life_sub": { const r = setSub(s, a.key, a.on); return r.ok ? { ok: true, message: r.message } : { ok: false, error: r.error }; }
    case "re_buy": case "re_rent": case "re_sell": case "re_withdraw": case "re_renovate": {
      if (!s.life) return { ok: false, error: "L'investissement immobilier est disponible en mode carrière." };
      const r = a.type === "re_buy" ? buyProperty(s, a.listing, a.credit) : a.type === "re_rent" ? setRent(s, a.id, a.rent) : a.type === "re_sell" ? setSale(s, a.id, a.price) : a.type === "re_withdraw" ? withdraw(s, a.id) : renovate(s, a.id);
      return r.ok ? { ok: true, message: r.message } : { ok: false, error: r.error };
    }
    case "call_prospect": {
      const p = s.prospects?.find((x) => x.id === a.id);
      if (!p || p.status === "refus" || p.status === "converti") return { ok: false, error: "Ce prospect n'est plus à démarcher." };
      if (s.activeMeetingId) return { ok: false, error: "Vous êtes déjà en réunion." };
      if (!canCall(s, p)) return { ok: false, error: p.status === "rappel" ? `Laissez-lui un peu de temps : rappelez au moins ${RECALL_DAYS} jours après le dernier appel.` : "Vous l'avez déjà appelé aujourd'hui." };
      const m = startMeeting(s, "prospection", { pros: p.id });
      return m ? { ok: true, data: { meetingId: m.id } } : { ok: false, error: "Appel impossible." };
    }
    case "end_game": {
      if (!endingAvailable(s).includes(a.ending)) return { ok: false, error: a.ending === "retraite" ? "La retraite est possible à 55 ans ou avec 2 millions d'euros de patrimoine." : "Il faut 50 millions d'euros de patrimoine." };
      const r = endGame(s, a.ending); return r.ok ? { ok: true, message: r.message } : { ok: false, error: r.error };
    }
    case "ask_raise": {
      if (s.mode !== "carriere" || !s.career.employed) return { ok: false, error: "Vous n'êtes pas en poste." };
      if (s.activeMeetingId) return { ok: false, error: "Vous êtes déjà en réunion." };
      const last = s.life?.lastRaiseAskT;
      if (last !== undefined && s.t - last < 180 * MIN_PER_DAY) return { ok: false, error: `Vous avez déjà négocié il y a moins de six mois. Prochaine demande possible le ${fmtDate(last + 180 * MIN_PER_DAY, false)}.` };
      const m = startMeeting(s, "negociation_salaire");
      return m ? { ok: true, data: { meetingId: m.id } } : { ok: false, error: "Rendez-vous impossible." };
    }
    case "lifestyle": s.flags["lifestyle"] = a.level; logDecision(s, "patrimoine", `Train de vie réglé au niveau ${a.level}`); return { ok: true, message: "Train de vie mis à jour." };
    case "settings": {
      if (a.minutesPerSecond !== undefined) s.settings.minutesPerSecond = a.minutesPerSecond;
      if (a.notifLevel) s.settings.notifLevel = a.notifLevel;
      if (a.sound !== undefined) s.settings.sound = a.sound;
      if (a.autoPauseImportant !== undefined) s.settings.autoPauseImportant = a.autoPauseImportant;
      if (a.livingExpenses !== undefined && s.mode === "carriere") s.settings.livingExpenses = a.livingExpenses;
      if (a.aiEnabled !== undefined) s.settings.aiEnabled = a.aiEnabled;
      if (a.explanations !== undefined) s.settings.explanations = a.explanations;
      if (a.allowShort !== undefined && s.difficulty !== "debutant") { s.settings.allowShort = a.allowShort; s.accounts.perso.allowShort = a.allowShort; }
      if (a.name) s.name = a.name;
      return { ok: true, message: "Paramètres enregistrés." };
    }
    case "review_answer": { const r = answerReview(s, a.key, a.choice); return r.ok ? { ok: true, data: r.data } : { ok: false, error: r.error }; }
    case "training_resume": {
      const tr = s.life?.training;
      if (!tr || tr.done) return { ok: false, error: "Aucune séance de formation à reprendre." };
      if (s.activeMeetingId) return { ok: false, error: "Vous êtes déjà en réunion." };
      const m = startMeeting(s, "formation_n1", { resume: "1" });
      return m ? { ok: true, data: { meetingId: m.id } } : { ok: false, error: "Votre responsable n'est pas disponible." };
    }
    case "training_close": {
      const act = s.activeMeetingId ? s.meetings.find((x) => x.id === s.activeMeetingId) : undefined;
      if (act?.templateId === "formation_n1") return { ok: false, error: "Votre responsable vous interroge : terminez ou quittez d'abord la réunion." };
      const r = closeTraining(s); return r.ok ? { ok: true } : { ok: false, error: r.error }; }
    case "set_plan": { const r = setPlan(s, { start: a.start, end: a.end, wake: a.wake }); return r.ok ? { ok: true, message: r.message } : { ok: false, error: r.error }; }
    case "sleep": return doSleep(s);
    case "set_avatar": {
      const av = parseAvatar(a.avatar);
      if (!av) return { ok: false, error: "Apparence invalide." };
      const rank = s.career.employed ? s.career.rank : 0, locked = lockedParts(av, rank);
      if (locked.length) return { ok: false, error: `Pas encore débloqué : ${locked.join(", ")}.` };
      s.profile.avatar = av;
      return { ok: true, message: "👔 Nouvelle apparence enregistrée." };
    }
    case "overtime": {
      const r = doOvertime(s, a.hours, a.focus, a.subject ?? "auto");
      if (!r.ok) return { ok: false, error: r.error };
      const t0 = s.t;
      runClock(s, t0 + a.hours * 60);
      const done = Math.round(((s.t - t0) / 60) * 10) / 10;
      // « Me former » : votre responsable pose lui-même les questions, en réunion
      if (a.focus === "formation") {
        const m = startMeeting(s, "formation_n1", { hours: String(a.hours), subject: a.subject ?? "auto" });
        if (m && m.templateId === "formation_n1") return { ok: true, message: `${r.message} Votre responsable vous reçoit pour la séance.`, data: { meetingId: m.id } };
        return { ok: true, message: `${r.message} Votre responsable est pris par une autre réunion : reprenez la séance ensuite depuis cette page.` };
      }
      return { ok: true, message: done < a.hours ? `${r.message} Interrompu après ${done} h : ${s.pauseReason ?? "événement"}.` : r.message };
    }
    case "quiz_answer": {
      if (a.id.startsWith("g:") && !quizServed(s, a.id)) return { ok: false, error: "Question non proposée." }; const r = answerQuiz(s, a.id, a.choice); return r.ok ? { ok: true, data: r.data } : { ok: false, error: r.error }; }
    case "tutorial_visit": if (a.page === "terminal") s.flags["visitedTerminal"] = true; return { ok: true };
  }
}
