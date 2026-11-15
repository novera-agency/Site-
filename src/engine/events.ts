/** EventEngine (narratif) + NPCDecisionEngine (banques concurrentes, agents). */
import { lifeChoice } from "./life";
import type { GameState } from "./types";
import { Rng } from "./rng";
import { applyShock } from "./market";
import { changeRep, changeTrust, nextId, notify, pushNews, avgRep, gainXp, careerLog, logDecision, clamp } from "./core";
import { BANK_BY_ID, BANKS, OTHER_BANKS } from "./data/banks";
import { toCents, fromCents } from "./money";
import { onboardClient } from "./clients";
import { CLIENT_SEEDS } from "./people";
import { generateOffer, joinBank } from "./career";
import { addAgendaItem } from "./agenda";
import { REGIMES } from "./regimes";
import { cashAcc, post } from "./ledger";
import { dayIndex, MIN_PER_DAY } from "./time";

interface CareerEvent { id: string; weight: (s: GameState) => number; cooldownDays: number; fire: (s: GameState, rng: Rng) => void; }
const msg = (s: GameState, from: string, subject: string, body: string, actions?: { label: string; action: string; payload?: Record<string, string> }[]) => {
  s.messages.unshift({ id: nextId(s, "msg"), t: s.t, from, subject, body, read: false, actions });
  if (s.messages.length > 200) s.messages.length = 200;
  notify(s, "info", `✉ ${subject}`, from, "/play/messagerie");
};

const EVENTS: CareerEvent[] = [
  { id: "demission_collegue", cooldownDays: 120, weight: (s) => (s.career.employed ? 1 : 0), fire: (s) => {
    const col = s.npcs.colleague;
    msg(s, s.npcs.boss.name, `${col.name} quitte le desk`, `${col.name} a démissionné pour rejoindre un fonds concurrent. Je cherche quelqu'un pour reprendre une partie de son activité, dont la relation avec un client. C'est plus de travail, mais aussi plus de visibilité.`, [{ label: "Reprendre son portefeuille client", action: "take_client" }, { label: "Décliner : je préfère me concentrer", action: "decline_extra" }]);
  } },
  { id: "chasseur", cooldownDays: 45, weight: (s) => (avgRep(s) > 55 ? 1.5 : 0.3), fire: (s, rng) => generateOffer(s, rng) },
  { id: "scandale_banque", cooldownDays: 200, weight: (s) => (s.career.employed ? 0.5 : 0), fire: (s) => {
    const b = BANK_BY_ID[s.career.bankId];
    if (b.stockId) applyShock(s, { kind: "instrument", id: b.stockId }, -0.07, 0.8, `Scandale chez ${b.short}`);
    pushNews(s, { category: "reglementation", title: `${b.name} visée par une enquête pour défaut de contrôle`, body: "Le régulateur enquête sur des manquements dans les procédures de lutte contre le blanchiment. La banque assure coopérer pleinement.", impact: "moyen", tickers: b.stockId ? [b.stockId] : [], zones: [], sentiment: -0.6 });
    changeRep(s, "interne", -2);
    msg(s, s.npcs.journalist.name + " (journaliste)", "Demande d'interview", `Je prépare un article sur l'enquête visant ${b.short}. Accepteriez-vous de répondre à quelques questions, même anonymement ?`, [{ label: "Refuser et prévenir la communication", action: "journalist_refuse" }, { label: "Répondre anonymement", action: "journalist_talk" }]);
  } },
  { id: "erreur_trading", cooldownDays: 150, weight: (s) => (s.career.employed && s.stats.tradesCount > 5 ? 0.8 : 0), fire: (s) => {
    msg(s, s.npcs.colleague.name, "Besoin d'aide… discrètement", `J'ai fait une erreur de saisie hier (un zéro de trop) sur un ordre client. La perte est d'environ 45 000 €. Si on rebooke l'opération sur ton compte d'erreur avant le contrôle de ce soir, personne ne verra rien. Tu m'aides ?`, [{ label: "Refuser et l'inciter à déclarer l'erreur", action: "error_report" }, { label: "Accepter de masquer l'erreur", action: "error_hide" }]);
  } },
  { id: "info_privilegiee", cooldownDays: 180, weight: () => 0.5, fire: (s) => {
    msg(s, "Un ancien camarade de promotion", "Tuyau en or 🤫", `Je bosse sur une acquisition : ${s.instruments["CURA"].name} va être rachetée avec 35 % de prime, annonce dans 10 jours. Achète des calls, tu me remercieras.`, [{ label: "Ignorer et signaler à la conformité", action: "insider_report" }, { label: "Ignorer sans signaler", action: "insider_ignore" }]);
  } },
  { id: "networking", cooldownDays: 30, weight: () => 1, fire: (s) => {
    msg(s, "Club des professionnels de la finance", "Invitation : conférence sur les marchés", "Vous êtes invité à une conférence suivie d'un cocktail. Plusieurs directeurs de banques et entrepreneurs seront présents.", [{ label: "Y aller (réseau +, fatigue +)", action: "network_go" }, { label: "Décliner", action: "network_skip" }]);
  } },
  { id: "partenariat", cooldownDays: 90, weight: (s) => (s.company ? 1.5 : avgRep(s) > 50 ? 0.5 : 0), fire: (s) => {
    msg(s, s.npcs.founder.name + " (fintech)", "Proposition de partenariat", `Notre fintech développe une plateforme d'investissement automatisée. Nous cherchons un partenaire financier crédible. ${s.company ? "Votre société pourrait distribuer notre solution : apport estimé de nouveaux clients." : "Seriez-vous intéressé quand vous lancerez votre structure ?"}`, s.company ? [{ label: "Signer le partenariat", action: "partner_sign" }, { label: "Décliner", action: "partner_decline" }] : [{ label: "Garder le contact", action: "partner_contact" }]);
  } },
  { id: "client_depart", cooldownDays: 90, weight: (s) => (s.clients.some((c) => !c.lost && c.satisfaction < 50) ? 1 : 0.2), fire: (s, rng) => {
    const c = rng.pick(s.clients.filter((x) => !x.lost));
    if (!c) return;
    addAgendaItem(s, { t: s.t + 90, durationMin: 30, title: `Rendez-vous urgent demandé par ${c.name}`, kind: "appel", meetingTemplate: "client_retrait", params: { client: c.id }, important: true });
    notify(s, "alerte", `${c.name} demande une réunion urgente`, "Il envisage de changer d'établissement.", "/play/agenda");
  } },
  { id: "nouveau_client", cooldownDays: 40, weight: (s) => (avgRep(s) > 50 && s.clients.filter((c) => !c.lost).length < 5 ? 1 : 0), fire: (s) => {
    const used = new Set(s.clients.map((c) => c.name));
    const idx = CLIENT_SEEDS.findIndex((c) => !used.has(c.name));
    if (idx < 0) return;
    msg(s, s.npcs.boss.name, `Nouveau prospect : ${CLIENT_SEEDS[idx].name}`, `Votre réputation commence à circuler. ${CLIENT_SEEDS[idx].name} souhaite nous confier ${fromCents(toCents(CLIENT_SEEDS[idx].aum)).toLocaleString("fr-FR")} €. Objectif : ${CLIENT_SEEDS[idx].objective}. Contraintes : ${CLIENT_SEEDS[idx].constraints.join(", ")}.`, [{ label: "Accepter le mandat", action: "accept_client", payload: { seed: String(idx) } }, { label: "Refuser (charge de travail)", action: "decline_extra" }]);
  } },
  { id: "rival", cooldownDays: 60, weight: () => 0.6, fire: (s, rng) => {
    msg(s, s.npcs.rival.name, "Petit classement amical", `Mon book fait +${2 + rng.int(0, 9)} % ce trimestre. Et toi ? 😏 On en reparle au prochain dîner de promo.`);
    changeTrust(s, "rival", 1);
  } },
  { id: "reorganisation", cooldownDays: 365, weight: (s) => (s.career.employed && dayIndex(s.t) - (s.flags["startDay"] as number) > 120 ? 0.4 : 0), fire: (s) => {
    const b = BANK_BY_ID[s.career.bankId];
    msg(s, s.npcs.director.name, "Réorganisation de la division", `${b.short} réorganise ses activités de marché. Deux options s'offrent à vous : rester sur votre périmètre actuel ou être muté sur un desk de taux à forte visibilité.`, [{ label: "Accepter la mutation (taux)", action: "mutation" }, { label: "Rester sur mon périmètre", action: "decline_extra" }]);
  } },
];

export function maybeCareerEvent(s: GameState, rng: Rng) {
  if (s.mode !== "carriere") return;
  if (!rng.chance(s.difficulty === "debutant" ? 0.08 : 0.12)) return;
  const day = dayIndex(s.t);
  const avail = EVENTS.filter((e) => day - (s.eventCooldowns[`ev:${e.id}`] ?? -999) >= e.cooldownDays).map((e) => ({ item: e, w: e.weight(s) })).filter((x) => x.w > 0);
  if (!avail.length) return;
  const ev = rng.weighted(avail);
  s.eventCooldowns[`ev:${ev.id}`] = day;
  ev.fire(s, rng);
}

/** Actions des messages (décisions narratives) */
export function handleMessageAction(s: GameState, messageId: string, action: string, payload: Record<string, string> = {}) {
  const m = s.messages.find((x) => x.id === messageId);
  if (!m) return { ok: false as const, error: "Message introuvable." };
  if (m.handled) return { ok: false as const, error: "Déjà traité." };
  let result = "";
  switch (action) {
    case "take_client": { const used = new Set(s.clients.map((c) => c.name)); const idx = CLIENT_SEEDS.findIndex((c) => !used.has(c.name)); if (idx >= 0) { const c = onboardClient(s, idx); result = `Vous reprenez la relation avec ${c.name}.`; } s.career.stress += 8; changeTrust(s, "boss", 4, "A repris le portefeuille d'un collègue"); changeRep(s, "interne", 3); break; }
    case "accept_client": { const c = onboardClient(s, Number(payload.seed)); result = `Mandat accepté : ${c.name}.`; changeRep(s, "commerciale", 3); break; }
    case "decline_extra": result = "Vous déclinez."; changeTrust(s, "boss", -1); break;
    case "journalist_refuse": result = "Vous refusez et prévenez le service communication."; changeRep(s, "conformite", 3); changeTrust(s, "compliance", 3); changeTrust(s, "journalist", -3); break;
    case "journalist_talk": result = "L'article paraît. Votre anonymat ne tient pas longtemps."; changeRep(s, "interne", -10, "Fuite dans la presse"); changeRep(s, "conformite", -8); changeTrust(s, "journalist", 8); s.career.warnings++; break;
    case "error_report": result = "Votre collègue déclare l'erreur. La perte est absorbée, la procédure renforcée."; changeRep(s, "fiabilite", 5, "Intégrité face à une erreur de trading"); changeRep(s, "conformite", 4); changeTrust(s, "colleague", -5, "A refusé de masquer son erreur"); changeTrust(s, "boss", 4); break;
    case "error_hide": result = "L'audit interne découvre la manipulation trois semaines plus tard."; changeRep(s, "conformite", -25, "Dissimulation d'une erreur de trading"); changeRep(s, "fiabilite", -15); s.career.warnings += 2; changeTrust(s, "colleague", 6); notify(s, "critique", "Audit interne : dissimulation découverte", "Avertissement grave inscrit à votre dossier."); break;
    case "insider_report": result = "Signalement enregistré par la conformité."; changeRep(s, "conformite", 5, "Signalement d'information privilégiée"); changeTrust(s, "compliance", 6); gainXp(s, "risque", 20, "Conformité : abus de marché"); break;
    case "insider_ignore": result = "Vous ignorez le message."; break;
    case "network_go": result = "Belle soirée : vous élargissez votre réseau."; changeTrust(s, "recruiter", 6, "Rencontre lors d'une conférence"); changeTrust(s, "founder", 5); changeTrust(s, "director", 2); changeRep(s, "commerciale", 2); s.career.stress += 4; gainXp(s, "client", 15, "Networking"); break;
    case "network_skip": result = "Vous restez travailler."; break;
    case "partner_sign": if (s.company) { s.company.reputation = clamp(s.company.reputation + 8, 0, 100); s.company.clientsCount += 15; s.company.aum += toCents(8e6); result = "Partenariat signé : +15 clients, +8 M€ d'encours."; changeTrust(s, "founder", 8); } break;
    case "partner_decline": result = "Partenariat décliné."; break;
    case "life_choice": result = lifeChoice(s, payload.ev, payload.choice); break;
    case "partner_contact": result = "Vous gardez le contact."; changeTrust(s, "founder", 4); break;
    case "mutation": result = "Vous êtes muté sur le desk de taux : nouvelles responsabilités."; changeRep(s, "interne", 3); gainXp(s, "macro", 30, "Mutation desk de taux"); careerLog(s, "Mutation sur le desk de taux"); break;
    case "interview": { const o = s.career.pendingOffers.find((x) => x.id === payload.offer); if (!o) return { ok: false as const, error: "Offre expirée." }; s.flags["pendingMeeting"] = JSON.stringify({ template: "entretien_embauche", params: { offer: o.id }, title: "Entretien de recrutement" }); result = "Entretien programmé : rendez-vous dans la salle de réunion."; break; }
    case "decline_offer": s.career.pendingOffers = s.career.pendingOffers.filter((x) => x.id !== payload.offer); result = "Offre déclinée."; break;
    case "negotiate_offer": { const o = s.career.pendingOffers.find((x) => x.id === payload.offer); if (!o) return { ok: false as const, error: "Offre expirée." }; const ok = new Rng(s.rng).chance(0.5 + (avgRep(s) - 50) / 100); if (ok) { o.salary = Math.round(o.salary * 1.08); result = `Négociation réussie : ${fromCents(o.salary).toLocaleString("fr-FR")} €.`; m.handled = false; m.actions = [{ label: "Accepter et démissionner", action: "accept_offer", payload: { offer: o.id } }, { label: "Refuser", action: "decline_offer", payload: { offer: o.id } }]; m.body += `\n\nMise à jour : salaire révisé à ${fromCents(o.salary).toLocaleString("fr-FR")} €.`; return { ok: true as const, message: result }; } else { result = "Le recruteur maintient son offre initiale."; m.handled = false; m.actions = m.actions?.filter((a) => a.action !== "negotiate_offer"); return { ok: true as const, message: result }; } }
    case "accept_offer": { const o = s.career.pendingOffers.find((x) => x.id === payload.offer); if (!o || !s.flags[`offerReady_${o.id}`]) return { ok: false as const, error: "Offre non disponible." }; joinBank(s, o.bankId, o.track, o.rank, o.salary); s.career.pendingOffers = []; result = `Vous rejoignez ${BANK_BY_ID[o.bankId].name}.`; break; }
    default: return { ok: false as const, error: "Action inconnue." };
  }
  m.handled = true; m.read = true;
  m.body += `\n\n→ ${result}`;
  logDecision(s, "message", result);
  return { ok: true as const, message: result };
}

/* ───────────── Agents : banques concurrentes ───────────── */
export function initCompetitors(s: GameState) {
  s.banks = [...BANKS.map((b) => ({ id: b.id, name: b.name, aum: toCents(b.aumBn * 1e9), capitalRatio: b.capitalRatio, health: 0.8, riskAppetite: 1 / b.riskStrictness * 0.6, strategy: b.specialties.join(", "), reputation: b.prestige * 18, stockId: b.stockId, tradingPnlYtd: 0, bondLosses: 0, deposits: 1 })), ...OTHER_BANKS.map((b) => ({ id: b.id, name: b.name, aum: toCents(40e9), capitalRatio: 0.11, health: 0.65, riskAppetite: b.riskAppetite, strategy: b.strategy, reputation: 40, stockId: b.stockId, tradingPnlYtd: 0, bondLosses: 0, deposits: 1 }))];
}
export function dailyCompetitors(s: GameState, rng: Rng) {
  const reg = REGIMES[s.macro.regime];
  const dy = s.macro.zones.US.y10 - ((s.macro.factors["y10_0_US"] as number) ?? 4.1);
  for (const b of s.banks) {
    const stress = b.stockId ? s.quotes[b.stockId]?.stress ?? 0 : 0;
    b.aum = Math.max(0, Math.round(b.aum * (1 + (reg.drift * 0.5 + rng.normal() * 0.01) / 252 * (1 + b.riskAppetite))));
    b.tradingPnlYtd += toCents((reg.drift * b.riskAppetite + rng.normal() * 0.3) * 1e6 * (b.reputation / 50));
    b.bondLosses = Math.max(0, dy) * (b.id === "pacific" ? 0.08 : 0.02);
    b.deposits = clamp(b.deposits - stress * 0.01 + 0.001, 0.2, 1.2);
    b.health = clamp(0.85 - stress * 0.7 - b.bondLosses * 2 + (b.capitalRatio - 0.12) * 2, 0, 1);
    b.reputation = clamp(b.reputation + (b.health - 0.7) * 0.2, 5, 100);
    // Les agents ajustent leur appétit pour le risque selon le régime (et influencent la liquidité de marché)
    b.riskAppetite = clamp(b.riskAppetite + (0.6 - s.macro.riskAversion) * 0.01, 0.1, 1.2);
    if (b.stockId && b.health < 0.35 && !s.quotes[b.stockId].defaulted) s.quotes[b.stockId].stress = Math.max(s.quotes[b.stockId].stress, (0.4 - b.health));
  }
  // Impact agrégé simplifié des agents sur la liquidité de marché
  const appetite = s.banks.reduce((a, b) => a + b.riskAppetite, 0) / s.banks.length;
  s.macro.liquidity = clamp(s.macro.liquidity + (appetite - 0.55) * 0.003, 0.25, 1.2);
}
export { post, cashAcc, MIN_PER_DAY };
