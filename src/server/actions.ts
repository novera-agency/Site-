/** Mutations validées (Zod) : toute modification de l'état passe par ici, côté serveur. */
import { z } from "zod";
import type { GameState } from "@/engine/types";
import { SPEEDS, MIN_PER_DAY, tOfDay, dayIndex, nextBusinessDay, minuteOfDay, isWeekend } from "@/engine/time";
import { placeOrder, cancelOrder, convertCash } from "@/engine/orders";
import { startMeeting, answerMeeting } from "@/engine/meetingEngine";
import { answerMission } from "@/engine/missions";
import { rebalanceClient } from "@/engine/clients";
import { subscribe } from "@/engine/structured";
import { handleMessageAction } from "@/engine/events";
import { foundCompany, companyAction } from "@/engine/company";
import { takeVacation } from "@/engine/career";
import { completeLesson, advanceTo } from "@/engine/engine";
import { nextId, logDecision } from "@/engine/core";
import { toCents } from "@/engine/money";

const num = z.coerce.number().finite();
export const ActionSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("speed"), speed: z.union(SPEEDS.map((x) => z.literal(x)) as unknown as [z.ZodLiteral<0>, z.ZodLiteral<1>, ...z.ZodLiteral<number>[]]) }),
  z.object({ type: z.literal("pause"), paused: z.boolean() }),
  z.object({ type: z.literal("skip"), to: z.enum(["next_hour", "market_open", "next_morning", "next_event"]) }),
  z.object({ type: z.literal("order"), account: z.string().max(64), instrumentId: z.string().max(80), side: z.enum(["buy", "sell"]), orderType: z.enum(["market", "limit", "stop", "stop_limit"]), qty: num.positive(), limit: num.positive().optional(), stop: num.positive().optional(), duration: z.enum(["jour", "gtc", "date"]).optional(), expiresDays: num.int().min(1).max(90).optional(), stopLoss: num.positive().optional(), takeProfit: num.positive().optional(), clientRef: z.string().max(64).optional() }),
  z.object({ type: z.literal("cancel"), orderId: z.string().max(64) }),
  z.object({ type: z.literal("convert"), account: z.string().max(64), from: z.enum(["EUR", "USD", "GBP", "CHF", "JPY", "CAD", "AUD", "CNY"]), to: z.enum(["EUR", "USD", "GBP", "CHF", "JPY", "CAD", "AUD", "CNY"]), amount: num.positive() }),
  z.object({ type: z.literal("watch"), instrumentId: z.string().max(80), on: z.boolean() }),
  z.object({ type: z.literal("alert"), instrumentId: z.string().max(80), level: num.positive(), above: z.boolean() }),
  z.object({ type: z.literal("alert_delete"), id: z.string().max(64) }),
  z.object({ type: z.literal("join_meeting") }),
  z.object({ type: z.literal("start_meeting"), template: z.string().max(64), params: z.record(z.string()).optional() }),
  z.object({ type: z.literal("answer_meeting"), meetingId: z.string().max(64), choiceId: z.string().max(32).optional(), value: num.optional() }),
  z.object({ type: z.literal("answer_mission"), missionId: z.string().max(64), value: num.optional(), choice: num.int().optional(), forecast: z.string().max(20).optional() }),
  z.object({ type: z.literal("rebalance"), clientId: z.string().max(64), target: z.record(num.min(0).max(1)) }),
  z.object({ type: z.literal("contact_client"), clientId: z.string().max(64) }),
  z.object({ type: z.literal("subscribe"), productId: z.string().max(64), nominal: num.positive() }),
  z.object({ type: z.literal("message_action"), messageId: z.string().max(64), action: z.string().max(40), payload: z.record(z.string()).optional() }),
  z.object({ type: z.literal("read"), what: z.enum(["notifications", "messages"]), id: z.string().max(64).optional() }),
  z.object({ type: z.literal("lesson"), lessonId: z.string().max(64), answer: num }),
  z.object({ type: z.literal("found_company"), name: z.string().min(2).max(60), kind: z.enum(["conseil", "gestion", "fonds", "hedge_fund", "fintech", "banque_affaires"]), capital: num.positive(), strategy: z.string().max(200) }),
  z.object({ type: z.literal("company"), action: z.string().max(30), params: z.record(z.union([z.string().max(100), z.number()])).optional() }),
  z.object({ type: z.literal("vacation"), days: num.int().min(1).max(15) }),
  z.object({ type: z.literal("lifestyle"), level: num.int().min(0).max(4) }),
  z.object({ type: z.literal("settings"), minutesPerSecond: num.min(0.25).max(60).optional(), autoPauseImportant: z.boolean().optional(), livingExpenses: z.boolean().optional(), aiEnabled: z.boolean().optional(), explanations: z.boolean().optional(), allowShort: z.boolean().optional(), name: z.string().min(1).max(60).optional() }),
  z.object({ type: z.literal("tutorial_visit"), page: z.string().max(40) }),
  z.object({ type: z.literal("leave_meeting") }),
]);
export type Action = z.infer<typeof ActionSchema>;
export type ActionResult = { ok: boolean; message?: string; error?: string; data?: unknown };

export function applyAction(s: GameState, a: Action): ActionResult {
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
      else if (a.to === "next_morning") target = tOfDay(nextBusinessDay(day + 1), 7, 30);
      else { const nx = s.agenda.find((x) => x.status === "prevu" && x.t > s.t); target = nx ? nx.t : s.t + 60; }
      const n = advanceTo(s, Math.min(target, s.t + 4 * MIN_PER_DAY));
      return { ok: true, message: s.paused && s.pauseReason ? `Avance interrompue : ${s.pauseReason}` : `Temps avancé (${n * 5} min simulées).` };
    }
    case "order": {
      const r = placeOrder(s, { account: a.account, instrumentId: a.instrumentId, side: a.side, type: a.orderType, qty: a.qty, limit: a.limit, stop: a.stop, duration: a.duration ?? (a.orderType === "market" ? "jour" : "gtc"), expiresT: a.expiresDays ? s.t + a.expiresDays * MIN_PER_DAY : undefined, stopLoss: a.stopLoss, takeProfit: a.takeProfit, clientRef: a.clientRef });
      return r.ok ? { ok: true, message: r.message, data: r.order } : { ok: false, error: r.error };
    }
    case "cancel": { const r = cancelOrder(s, a.orderId); return r.ok ? { ok: true, message: r.message } : { ok: false, error: r.error }; }
    case "convert": {
      const acc = s.accounts[a.account];
      if (!acc || (acc.kind !== "personnel" && acc.kind !== "desk")) return { ok: false, error: "Compte non convertible." };
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
      const allowed = ["comite_investissement", "comite_risques", "client_point_regulier", "desk_quotidien"];
      if (!allowed.includes(a.template)) return { ok: false, error: "Cette réunion ne peut pas être provoquée." };
      if (!s.career.employed && a.template !== "client_point_regulier") return { ok: false, error: "Vous n'êtes pas en poste." };
      const key = `manualMeeting:${a.template}:${dayIndex(s.t)}`;
      if (s.eventCooldowns[key]) return { ok: false, error: "Cette réunion a déjà eu lieu aujourd'hui." };
      s.eventCooldowns[key] = 1;
      const m = startMeeting(s, a.template, a.params ?? {});
      return m ? { ok: true, data: { meetingId: m.id } } : { ok: false, error: "Réunion indisponible." };
    }
    case "answer_meeting": { const r = answerMeeting(s, a.meetingId, { choiceId: a.choiceId, value: a.value }); return r.ok ? { ok: true } : { ok: false, error: r.error }; }
    case "leave_meeting": { if (!s.activeMeetingId) return { ok: false, error: "Aucune réunion." }; const m = s.meetings.find((x) => x.id === s.activeMeetingId); if (m) { m.done = true; m.outcome = "Vous avez quitté la réunion avant la fin."; } s.activeMeetingId = undefined; s.reputation.interne = Math.max(0, s.reputation.interne - 4); s.reputation.fiabilite = Math.max(0, s.reputation.fiabilite - 3); return { ok: true, message: "Vous quittez la réunion. Votre départ est mal perçu." }; }
    case "answer_mission": { const r = answerMission(s, a.missionId, { value: a.value, choice: a.choice, forecast: a.forecast }); return r.ok ? { ok: true, message: r.message } : { ok: false, error: r.error }; }
    case "rebalance": { const r = rebalanceClient(s, a.clientId, a.target); return r.ok ? { ok: true, message: `Rééquilibrage transmis (${r.orders.length} ordres).${r.warnings.length ? " ⚠ " + r.warnings.join(" ") : ""}`, data: r } : { ok: false, error: r.error }; }
    case "contact_client": {
      const c = s.clients.find((x) => x.id === a.clientId);
      if (!c || c.lost) return { ok: false, error: "Client introuvable." };
      if (s.t - c.lastContactT < MIN_PER_DAY) return { ok: false, error: "Vous avez déjà contacté ce client aujourd'hui." };
      const m = startMeeting(s, "client_point_regulier", { client: c.id });
      return m ? { ok: true, data: { meetingId: m.id } } : { ok: false, error: "Réunion indisponible." };
    }
    case "subscribe": { const r = subscribe(s, "perso", a.productId, a.nominal); return r.ok ? { ok: true, message: "Souscription enregistrée." } : { ok: false, error: r.error }; }
    case "message_action": { const r = handleMessageAction(s, a.messageId, a.action, a.payload ?? {}); return r.ok ? { ok: true, message: r.message } : { ok: false, error: r.error }; }
    case "read": if (a.what === "notifications") { for (const n of s.notifications) if (!a.id || n.id === a.id) n.read = true; } else { for (const m of s.messages) if (!a.id || m.id === a.id) m.read = true; } return { ok: true };
    case "lesson": { const r = completeLesson(s, a.lessonId, a.answer); return r.ok ? { ok: true, data: r } : { ok: false, error: r.error }; }
    case "found_company": { const r = foundCompany(s, a.name, a.kind, a.capital, a.strategy); return r.ok ? { ok: true, message: "Société créée." } : { ok: false, error: r.error }; }
    case "company": { const r = companyAction(s, a.action, a.params ?? {}); return r.ok ? { ok: true, message: r.message } : { ok: false, error: r.error }; }
    case "vacation": { const r = takeVacation(s, a.days); if (!r.ok) return { ok: false, error: r.error }; const n = advanceTo(s, r.until, 6000); return { ok: true, message: `Congés terminés (${Math.round(n * 5 / 1440)} jours simulés).` }; }
    case "lifestyle": s.flags["lifestyle"] = a.level; logDecision(s, "patrimoine", `Train de vie réglé au niveau ${a.level}`); return { ok: true, message: "Train de vie mis à jour." };
    case "settings": {
      if (a.minutesPerSecond !== undefined) s.settings.minutesPerSecond = a.minutesPerSecond;
      if (a.autoPauseImportant !== undefined) s.settings.autoPauseImportant = a.autoPauseImportant;
      if (a.livingExpenses !== undefined && s.mode === "carriere") s.settings.livingExpenses = a.livingExpenses;
      if (a.aiEnabled !== undefined) s.settings.aiEnabled = a.aiEnabled;
      if (a.explanations !== undefined) s.settings.explanations = a.explanations;
      if (a.allowShort !== undefined && s.difficulty !== "debutant") { s.settings.allowShort = a.allowShort; s.accounts.perso.allowShort = a.allowShort; }
      if (a.name) s.name = a.name;
      return { ok: true, message: "Paramètres enregistrés." };
    }
    case "tutorial_visit": if (a.page === "terminal") s.flags["visitedTerminal"] = true; return { ok: true };
  }
}
