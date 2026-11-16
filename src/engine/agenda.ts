/** Agenda quotidien : cycle de journée professionnelle (horaires variables selon métier et lieu). */
import type { AgendaItem, GameState } from "./types";
import { Rng } from "./rng";
import { nextId, notify, pause, changeRep, changeTrust } from "./core";
import { dayIndex, isWeekend, MIN_PER_DAY, tOfDay, EPOCH_UTC } from "./time";
import { getPlan } from "./schedule";

export function addAgendaItem(s: GameState, item: Omit<AgendaItem, "id" | "status">) { return addAgendaItemRaw(s, item); }
function addAgendaItemRaw(s: GameState, item: Omit<AgendaItem, "id" | "status">) {
  const it: AgendaItem = { ...item, id: nextId(s, "ag"), status: "prevu" };
  s.agenda.push(it);
  s.agenda.sort((a, b) => a.t - b.t);
  return it;
}

/** Génère l'agenda d'une journée ouvrée (appelé à minuit) */
export function planDay(s: GameState, rng: Rng) {
  const day = dayIndex(s.t);
  if (isWeekend(s.t) || !s.career.employed || s.mode !== "carriere") return;
  const tr = s.career.track;
  const isFirst = day === s.flags["startDay"];
  if (isFirst) return; // le tutoriel planifie la première journée
  const jitter = () => rng.int(-1, 2) * 5;
  // Les rendez-vous sont replacés dans les horaires choisis par le joueur (le départ peut être avancé grâce aux heures d'avance)
  const plan = getPlan(s);
  const early = Math.min(2, s.life?.ahead ?? 0);
  const wStart = tOfDay(day, 0, plan.start), wEnd = tOfDay(day, 0, Math.max(plan.start + 240, plan.end - early * 60));
  const taken = new Set<number>();
  const addAgendaItem = (s2: GameState, it: Omit<AgendaItem, "id" | "status">) => {
    if (it.kind === "marche") return addAgendaItemRaw(s2, it);
    let at = Math.min(Math.max(it.t, wStart), Math.max(wStart, wEnd - Math.max(it.durationMin, 15)));
    while (taken.has(at) && at < wEnd - 15) at += 15;
    taken.add(at);
    return addAgendaItemRaw(s2, { ...it, t: at });
  };
  addAgendaItem(s, { t: tOfDay(day, 7, 30), durationMin: 30, title: "Revue des actualités et du calendrier", kind: "personnel" });
  if (tr !== "ib" && tr !== "entrepreneur") addAgendaItem(s, { t: tOfDay(day, 8, 30 + jitter()), durationMin: 30, title: "Réunion quotidienne du desk", kind: "reunion", meetingTemplate: "desk_quotidien" });
  // Chaque jour ouvré, le responsable vérifie vos bases : 2 à 5 questions de culture économique et financière
  addAgendaItem(s, { t: wStart + 45, durationMin: 15, title: "Point culture avec votre responsable", kind: "reunion", meetingTemplate: "culture_n1" });
  addAgendaItem(s, { t: tOfDay(day, 9, 0), durationMin: 0, title: "Ouverture des marchés européens", kind: "marche" });
  addAgendaItem(s, { t: tOfDay(day, 15, 30), durationMin: 0, title: "Ouverture du marché américain", kind: "marche" });
  // appels clients aléatoires
  const clients = s.clients.filter((c) => !c.lost);
  if (clients.length && rng.chance(0.35)) {
    const c = rng.pick(clients);
    const tpl = pickClientTemplate(s, c.id, rng);
    addAgendaItem(s, { t: tOfDay(day, rng.int(10, 16), rng.pick([0, 15, 30, 45])), durationMin: 20, title: `Appel client — ${c.name}`, kind: "appel", meetingTemplate: tpl, params: { client: c.id } });
  }
  const wd = new Date(EPOCH_UTC + day * 86400000).getUTCDay();
  if (wd === 5) addAgendaItem(s, { t: tOfDay(day, 17, 0), durationMin: 45, title: "Comité des risques hebdomadaire", kind: "reunion", meetingTemplate: "comite_risques" });
  if (wd === 3 && rng.chance(0.6)) addAgendaItem(s, { t: tOfDay(day, 11, 0), durationMin: 60, title: "Comité d'investissement", kind: "reunion", meetingTemplate: "comite_investissement" });
  addAgendaItemRaw(s, { t: wEnd, durationMin: 15, title: "Bilan de fin de journée", kind: "personnel" }); // le bilan clôt la journée de travail
  // purge
  s.agenda = s.agenda.filter((a) => a.t > s.t - 14 * MIN_PER_DAY);
}

export function pickClientTemplate(s: GameState, clientId: string, rng: Rng) {
  const c = s.clients.find((x) => x.id === clientId)!;
  const acc = s.accounts[c.accountId];
  const h = acc?.equityHistory ?? [];
  const start = h.length ? h[0].v : 0, now = h.length ? h[h.length - 1].v : 0;
  const perf = start > 0 ? now / start - 1 : 0;
  if (perf < -0.08) return "client_pertes";
  if (c.satisfaction < 35) return "client_retrait";
  return rng.weighted([
    { item: "client_produit_risque", w: c.riskTolerance >= 4 ? 2 : 1 }, { item: "client_frais", w: 1 }, { item: "client_rendement_irrealiste", w: 1 },
    { item: "client_conformite", w: 0.6 }, { item: "client_point_regulier", w: 2 },
  ]);
}

/** Déclenche les éléments d'agenda arrivés à échéance */
export function stepAgenda(s: GameState) {
  for (const a of s.agenda) {
    if (a.status !== "prevu" || a.t > s.t) continue;
    if (a.meetingTemplate) {
      if (s.activeMeetingId) {
        // une réunion est déjà en cours : l'élément attend au maximum 2 h
        if (s.t - a.t > 120) missItem(s, a);
        continue;
      }
      if (s.t - a.t > 60 && !a.important) { missItem(s, a); continue; }
      a.status = "fait";
      s.flags["pendingMeeting"] = JSON.stringify({ template: a.meetingTemplate, params: a.params ?? {}, agendaId: a.id, title: a.title });
      notify(s, a.important ? "critique" : "info", a.kind === "appel" ? `📞 ${a.title}` : `Réunion : ${a.title}`, "Cliquez pour rejoindre.", "/play/reunions");
      pause(s, a.title);
    } else {
      a.status = "fait";
    }
  }
}
function missItem(s: GameState, a: AgendaItem) {
  a.status = "manque";
  const col = s.npcs.colleague;
  if (col && col.trust >= 70 && s.t - ((s.flags["coverT"] as number) ?? -1e9) > 30 * 1440) {
    s.flags["coverT"] = s.t;
    notify(s, "succes", `${col.name} vous a couvert`, `Absent à « ${a.title} » : votre collègue a pris le relais, personne ne vous en tient rigueur.`, "/play/reseau");
    return;
  }
  notify(s, "alerte", `Rendez-vous manqué : ${a.title}`, "Votre absence a été remarquée.", "/play/agenda");
  changeRep(s, "interne", -2); changeRep(s, "fiabilite", -3);
  if (a.params?.client) { const c = s.clients.find((x) => x.id === a.params!.client); if (c) { c.satisfaction = Math.max(0, c.satisfaction - 8); changeTrust(s, c.npcId, -6, "Rendez-vous manqué"); } }
  else changeTrust(s, "boss", -2, `Absent à : ${a.title}`);
}
