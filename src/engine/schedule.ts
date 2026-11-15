/**
 * Planning de la journée : horaires de travail choisis par le joueur, heure de réveil, sommeil et heures supplémentaires.
 * - Les horaires déterminent la durée de la journée (déjeuner d'1 h déduit) : plus c'est long, plus la fatigue s'installe,
 *   plus c'est court, moins le responsable est satisfait.
 * - Dormir fait avancer l'horloge jusqu'à l'heure de réveil choisie ; la qualité dépend du nombre d'heures.
 * - Les heures supplémentaires se font après l'horaire de fin : avancer sur le lendemain, traiter des dossiers en retard ou se former.
 */
import type { GameState, SkillBranch } from "./types";
import { clamp, notify, changeTrust, changeRep, gainXp } from "./core";
import { dayIndex, isWeekend, MIN_PER_DAY, minuteOfDay, weekday } from "./time";

export const DEFAULT_PLAN = { start: 7 * 60 + 30, end: 18 * 60, wake: 6 * 60 + 30 };
export const LUNCH_MIN = 60;
/** Journée de référence en finance : 7 h 30 → 18 h, déjeuner d'1 h déduit (9,5 h de travail) */
export const STANDARD_NET_H = 9.5;
export const IDEAL_SLEEP_H = 7;
export const MAX_AHEAD_H = 4;

const on = (s: GameState) => !!s.life && s.mode === "carriere";
const vacation = (s: GameState) => !!s.flags["vacationUntil"] && s.t < (s.flags["vacationUntil"] as number);
export const hhmm = (m: number) => `${Math.floor(m / 60)} h ${String(Math.round(m % 60)).padStart(2, "0")}`;
export const getPlan = (s: GameState) => s.life?.plan ?? DEFAULT_PLAN;
export const plannedNetHours = (p: { start: number; end: number }) => (p.end - p.start - LUNCH_MIN) / 60;
/** Jour de travail : employé, en semaine, hors congés */
export const isWorkDay = (s: GameState) => on(s) && s.career.employed && !isWeekend(s.t) && !vacation(s);

/** Fenêtre de travail du jour (le départ peut être avancé grâce aux heures d'avance) */
export function workWindow(s: GameState) {
  const p = getPlan(s);
  const e = s.life?.early;
  const early = e && e.day === dayIndex(s.t) ? e.hours : 0;
  return { start: p.start, end: Math.max(p.start + 240, p.end - early * 60), early };
}

export function setPlan(s: GameState, n: { start: number; end: number; wake: number }) {
  if (!on(s)) return { ok: false as const, error: "Le planning n'existe qu'en mode carrière." };
  const ints = [n.start, n.end, n.wake].every((x) => Number.isInteger(x) && x % 15 === 0);
  if (!ints) return { ok: false as const, error: "Choisissez des heures rondes (par quart d'heure)." };
  if (n.start < 7 * 60 || n.start > 10 * 60) return { ok: false as const, error: "L'arrivée au bureau se situe entre 7 h et 10 h." };
  if (n.end < 15 * 60 + 30 || n.end > 21 * 60) return { ok: false as const, error: "Le départ du bureau se situe entre 15 h 30 et 21 h." };
  if (n.end - n.start < 6 * 60 + LUNCH_MIN) return { ok: false as const, error: "Une journée de travail dure au moins 6 h (hors déjeuner)." };
  if (n.end - n.start > 12 * 60) return { ok: false as const, error: "Une journée de travail ne peut pas dépasser 12 h sur place." };
  if (n.wake < 4 * 60 + 30) return { ok: false as const, error: "Le réveil ne peut pas être avant 4 h 30." };
  if (n.wake > n.start - 45) return { ok: false as const, error: `Il faut au moins 45 minutes pour vous préparer : réveillez-vous au plus tard à ${hhmm(n.start - 45)} pour arriver à ${hhmm(n.start)}.` };
  s.life!.plan = { ...n };
  return { ok: true as const, message: `Planning enregistré : bureau de ${hhmm(n.start)} à ${hhmm(n.end)}, réveil à ${hhmm(n.wake)}.` };
}

/** Effets quotidiens d'une journée plus longue ou plus courte que la référence */
export function planEffects(p: { start: number; end: number }) {
  const delta = plannedNetHours(p) - STANDARD_NET_H;
  return { net: plannedNetHours(p), delta };
}

// ───────── Sommeil ─────────
/** Score du sommeil : 1 = excellent (8 h), 0 = juste suffisant (6 h), négatif = manque de sommeil, légèrement décroissant au-delà de 9 h */
export function sleepScore(h: number) {
  if (h >= 9) return clamp(1 - (h - 9) * 0.2, 0, 1);
  return clamp((h - 6) / 2, -1, 1);
}
export function sleepLabel(h: number) {
  return h >= 7 && h <= 9 ? "excellent" : h >= 6 ? "correct" : h >= 5 ? "court" : "insuffisant";
}
/** Prochaine heure de réveil : aujourd'hui si elle n'est pas passée, sinon demain */
export function nextWake(s: GameState) {
  const p = getPlan(s);
  const today = dayIndex(s.t) * MIN_PER_DAY + p.wake;
  return today > s.t ? today : today + MIN_PER_DAY;
}
export function sleepCheck(s: GameState) {
  if (!on(s)) return { ok: false as const, error: "Le sommeil n'est simulé qu'en mode carrière." };
  if (s.activeMeetingId) return { ok: false as const, error: "Vous êtes en réunion." };
  const m = minuteOfDay(s.t);
  if (isWorkDay(s)) { const w = workWindow(s); if (m >= w.start && m < w.end) return { ok: false as const, error: `Vous êtes au travail jusqu'à ${hhmm(w.end)} : impossible de dormir maintenant.` }; }
  const target = nextWake(s);
  const hours = (target - s.t) / 60;
  const wake = hhmm(getPlan(s).wake);
  if (hours < 3) return { ok: false as const, error: `Il est trop tard pour dormir : votre réveil est à ${wake}, dans ${Math.round(hours * 10) / 10} h.`, target, hours };
  if (hours > 11.5) return { ok: false as const, error: `Trop tôt pour dormir : vous auriez ${Math.round(hours * 10) / 10} h de sommeil jusqu'à ${wake}. Couchez-vous plus tard.`, target, hours };
  return { ok: true as const, target, hours };
}
/** Applique les effets une fois la nuit passée (heures réellement dormies, si réveil anticipé par un événement) */
export function finishSleep(s: GameState, t0: number) {
  const l = s.life!;
  const hours = Math.max(0, Math.round(((s.t - t0) / 60) * 10) / 10);
  const g = sleepScore(hours);
  l.physique = clamp(l.physique + 3 * g, 0, 100);
  l.mental = clamp(l.mental + 1.5 * g, 0, 100);
  s.career.stress = clamp(s.career.stress - 2 * g, 0, 100);
  l.sleep = { startT: t0, endT: s.t, hours };
  return { hours, label: sleepLabel(hours), g };
}

// ───────── Heures supplémentaires ─────────
export type OvertimeFocus = "avance" | "dossiers" | "formation";
export const OVERTIME_FOCUS: Record<OvertimeFocus, { label: string; desc: string }> = {
  avance: { label: "Prendre de l'avance sur demain", desc: "Chaque heure faite ce soir vous permet de partir une heure plus tôt demain (jusqu'à 2 h d'avance par jour, 4 h en réserve)." },
  dossiers: { label: "Traiter des dossiers en retard", desc: "Vos missions en cours gagnent du temps : leur échéance est repoussée de 6 h par heure faite (maximum 24 h), et votre responsable apprécie." },
  formation: { label: "Me former en dehors des heures", desc: "Vous progressez dans votre compétence la plus faible : de l'expérience supplémentaire pour chaque heure." },
};
export function overtimeCheck(s: GameState, hours: number) {
  if (!on(s) || !s.career.employed) return { ok: false as const, error: "Les heures supplémentaires concernent les salariés en mode carrière." };
  if (!Number.isInteger(hours) || hours < 1 || hours > 4) return { ok: false as const, error: "Choisissez entre 1 et 4 heures supplémentaires." };
  if (s.activeMeetingId) return { ok: false as const, error: "Vous êtes en réunion." };
  if (vacation(s)) return { ok: false as const, error: "Vous êtes en congés : pas d'heures supplémentaires." };
  const m = minuteOfDay(s.t);
  if (isWorkDay(s)) { const w = workWindow(s); if (m < w.end) return { ok: false as const, error: `Les heures supplémentaires commencent après votre horaire de fin (${hhmm(w.end)}). Avancez jusqu'à la fin du travail.` }; }
  else if (m < 8 * 60) return { ok: false as const, error: "Trop tôt pour travailler un jour de repos (à partir de 8 h)." };
  if (m + hours * 60 > 23 * 60 + 30) return { ok: false as const, error: `Trop tard : ${hours} h de plus vous mèneraient après 23 h 30. Choisissez moins d'heures ou dormez.` };
  return { ok: true as const };
}
export function doOvertime(s: GameState, hours: number, focus: OvertimeFocus) {
  const chk = overtimeCheck(s, hours);
  if (!chk.ok) return chk;
  if (!OVERTIME_FOCUS[focus]) return { ok: false as const, error: "Choix inconnu." };
  const l = s.life!;
  const day = dayIndex(s.t);
  const week = day - ((weekday(s.t) + 6) % 7); // lundi de la semaine en cours
  const ot = l.ot && l.ot.week === week ? l.ot : { week, hours: 0, today: { day, hours: 0 } };
  if (ot.today.day !== day) ot.today = { day, hours: 0 };
  const weekend = !isWorkDay(s);
  // Le coût grandit avec la durée déjà faite aujourd'hui et sur la semaine
  let mult = weekend ? 1.3 : 1;
  const after = ot.today.hours + hours;
  if (after > 3) mult *= 1.4;
  if (ot.hours + hours > 12) mult *= 1.4;
  l.physique = clamp(l.physique - 1.2 * hours * mult, 0, 100);
  l.mental = clamp(l.mental - 0.8 * hours * mult, 0, 100);
  l.social = clamp(l.social - 0.5 * hours * mult, 0, 100);
  s.career.stress = clamp(s.career.stress + 2 * hours * mult, 0, 100);
  ot.hours += hours; ot.today.hours = after; l.ot = ot;
  let msg: string;
  if (focus === "avance") {
    const room = MAX_AHEAD_H - (l.ahead ?? 0);
    const gain = Math.max(0, Math.min(hours, room));
    l.ahead = (l.ahead ?? 0) + gain;
    changeTrust(s, "boss", 0.4 * hours);
    msg = gain < hours ? `Vous avez pris ${gain} h d'avance (réserve pleine : ${MAX_AHEAD_H} h maximum).` : `Vous avez pris ${hours} h d'avance : demain vous pourrez partir jusqu'à ${Math.min(2, l.ahead)} h plus tôt.`;
  } else if (focus === "dossiers") {
    let n = 0;
    for (const m of s.missions) if (m.status === "active" && !m.daily) { m.deadlineT += Math.min(24, 6 * hours) * 60; n++; }
    changeTrust(s, "boss", 0.8 * hours, "Heures passées sur les dossiers en retard");
    changeRep(s, "fiabilite", 0.5 * hours);
    msg = n ? `${n} mission${n > 1 ? "s" : ""} en cours gagne${n > 1 ? "nt" : ""} du temps (+${Math.min(24, 6 * hours)} h d'échéance).` : "Aucune mission en retard à traiter : votre responsable apprécie votre zèle.";
  } else {
    const entries = Object.entries(s.skills) as [SkillBranch, number][];
    entries.sort((a, b) => a[1] - b[1]);
    const branch = entries[0][0];
    gainXp(s, branch, 8 * hours, "Soirées de travail personnel");
    msg = `Vous progressez en « ${branch} » (+${8 * hours} XP environ).`;
  }
  if (ot.hours > 12) notify(s, "alerte", "Trop d'heures supplémentaires", `Vous cumulez ${ot.hours} h supplémentaires cette semaine : le risque d'épuisement augmente.`, "/play/planning");
  return { ok: true as const, hours, weekend, message: `⏱️ ${hours} h supplémentaire${hours > 1 ? "s" : ""}. ${msg}` };
}

// ───────── Chaque jour (à minuit) ─────────
export function dailySchedule(s: GameState) {
  if (!on(s)) return;
  const l = s.life!;
  const day = dayIndex(s.t);
  const work = isWorkDay(s);
  // Départ anticipé grâce aux heures d'avance
  if (work && (l.ahead ?? 0) > 0) {
    const h = Math.min(2, l.ahead!);
    l.ahead = Math.round((l.ahead! - h) * 10) / 10;
    l.early = { day, hours: h };
    notify(s, "info", `Vous partez ${h} h plus tôt aujourd'hui`, `Grâce à vos heures d'avance, votre journée se termine à ${hhmm(Math.max(getPlan(s).start + 240, getPlan(s).end - h * 60))}.`, "/play/planning");
  }
  // Nuit non gérée par le joueur : sommeil automatique, qui ne pénalise qu'un réveil trop matinal (moins de 6 h 30 de sommeil)
  const slept = !!l.sleep && l.sleep.endT > s.t - 12 * 60;
  if (!slept) {
    const hours = getPlan(s).wake / 60;
    const deficit = Math.max(0, 6.5 - hours) / 2;
    if (deficit > 0) {
      l.physique = clamp(l.physique - 1.0 * deficit, 0, 100);
      l.mental = clamp(l.mental - 0.8 * deficit, 0, 100);
      s.career.stress = clamp(s.career.stress + 1.2 * deficit, 0, 100);
    }
  }
  // Journée plus longue ou plus courte que la référence
  if (work) {
    const { delta } = planEffects(getPlan(s));
    if (delta > 0.01) {
      s.career.stress = clamp(s.career.stress + 1.0 * delta, 0, 100);
      l.physique = clamp(l.physique - 0.6 * delta, 0, 100);
      l.mental = clamp(l.mental - 0.5 * delta, 0, 100);
      changeTrust(s, "boss", 0.12 * delta);
    } else if (delta < -0.01) {
      changeTrust(s, "boss", 0.3 * delta);
      s.career.stress = clamp(s.career.stress + 0.5 * delta, 0, 100);
      l.mental = clamp(l.mental - 0.3 * delta, 0, 100);
    }
  }
}
