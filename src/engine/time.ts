/**
 * Temps simulé : minutes écoulées depuis le 1er janvier 2027 00:00 (heure de Paris, sans DST).
 * Le calendrier est entièrement dérivé de ce compteur → aucune dépendance à l'horloge réelle.
 */
export const EPOCH_UTC = Date.UTC(2027, 0, 1, 0, 0, 0);
export const STEP_MIN = 5; // pas de simulation fixe (minutes simulées)
export const MIN_PER_DAY = 1440;
export const START_T = 3 * MIN_PER_DAY + 7 * 60; // lundi 4 janvier 2027, 07:00

export const SPEEDS = [0, 1, 2, 5, 10, 25, 50, 100] as const;
export type Speed = (typeof SPEEDS)[number];

export function dateOf(t: number): Date { return new Date(EPOCH_UTC + t * 60000); }
export function dayIndex(t: number) { return Math.floor(t / MIN_PER_DAY); }
export function minuteOfDay(t: number) { return ((t % MIN_PER_DAY) + MIN_PER_DAY) % MIN_PER_DAY; }
/** 0 = dimanche … 6 = samedi */
export function weekday(t: number) { return dateOf(t).getUTCDay(); }
export function isWeekend(t: number) { const w = weekday(t); return w === 0 || w === 6; }
export function dayOfMonth(t: number) { return dateOf(t).getUTCDate(); }
export function monthIndex(t: number) { const d = dateOf(t); return (d.getUTCFullYear() - 2027) * 12 + d.getUTCMonth(); }
export function tOfDay(day: number, hour = 0, minute = 0) { return day * MIN_PER_DAY + hour * 60 + minute; }
export function startOfDay(t: number) { return dayIndex(t) * MIN_PER_DAY; }
export function yearsBetween(t1: number, t2: number) { return (t2 - t1) / (365 * MIN_PER_DAY); }

const JOURS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const MOIS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
export function fmtDate(t: number, withDay = true) {
  const d = dateOf(t);
  return `${withDay ? JOURS[d.getUTCDay()] + " " : ""}${d.getUTCDate()} ${MOIS[d.getUTCMonth()]} ${d.getUTCFullYear()}`;
}
export function fmtShortDate(t: number) {
  const d = dateOf(t);
  return `${String(d.getUTCDate()).padStart(2, "0")}/${String(d.getUTCMonth() + 1).padStart(2, "0")}/${d.getUTCFullYear()}`;
}
export function fmtTime(t: number) {
  const m = minuteOfDay(t);
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}
export function fmtDateTime(t: number) { return `${fmtShortDate(t)} ${fmtTime(t)}`; }

/** Prochain jour ouvré (index de jour) à partir de `day` inclus */
export function nextBusinessDay(day: number) {
  let d = day;
  while (isWeekend(d * MIN_PER_DAY)) d++;
  return d;
}
/** Premier jour ouvré du mois contenant t */
export function firstBusinessDayOfMonth(t: number) {
  const d = dateOf(t);
  const first = Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), 1) - EPOCH_UTC) / 86400000);
  return nextBusinessDay(first);
}
/** Troisième vendredi du mois (échéances d'options/futures) — index de jour */
export function thirdFriday(year: number, month: number) {
  const first = Math.floor((Date.UTC(year, month, 1) - EPOCH_UTC) / 86400000);
  let d = first, count = 0;
  for (;;) { if (weekday(d * MIN_PER_DAY) === 5) { count++; if (count === 3) return d; } d++; }
}
export function addMonthsDay(day: number, months: number) {
  const d = dateOf(day * MIN_PER_DAY);
  return Math.floor((Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + months, d.getUTCDate()) - EPOCH_UTC) / 86400000);
}

/** Sessions de marché (heure de Paris) */
export type SessionId = "EU" | "US" | "ASIA" | "FX" | "CRYPTO" | "COMMO";
export const SESSIONS: Record<SessionId, { open: number; close: number; label: string; weekdaysOnly: boolean }> = {
  EU: { open: 9 * 60, close: 17 * 60 + 30, label: "Europe 09:00–17:30", weekdaysOnly: true },
  US: { open: 15 * 60 + 30, close: 22 * 60, label: "États-Unis 15:30–22:00", weekdaysOnly: true },
  ASIA: { open: 1 * 60, close: 7 * 60 + 30, label: "Asie 01:00–07:30", weekdaysOnly: true },
  FX: { open: 0, close: MIN_PER_DAY, label: "Forex 24h/5j", weekdaysOnly: true },
  CRYPTO: { open: 0, close: MIN_PER_DAY, label: "Crypto 24h/7j", weekdaysOnly: false },
  COMMO: { open: 8 * 60, close: 22 * 60, label: "Matières premières 08:00–22:00", weekdaysOnly: true },
};
export function isSessionOpen(s: SessionId, t: number) {
  const ses = SESSIONS[s];
  if (ses.weekdaysOnly && isWeekend(t)) return false;
  const m = minuteOfDay(t);
  return m >= ses.open && m < ses.close;
}
/** Fraction d'année de trading représentée par un pas de 5 minutes pour la session */
export function stepYearFraction(s: SessionId) {
  const ses = SESSIONS[s];
  const minutesPerDay = ses.close - ses.open;
  const days = ses.weekdaysOnly ? 252 : 365;
  return STEP_MIN / (minutesPerDay * days);
}
