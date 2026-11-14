/**
 * Arithmétique monétaire en unités mineures entières (centimes).
 * Les écritures comptables n'utilisent JAMAIS de flottants : montants = entiers « safe ».
 * Limite : ±9e15 centimes (≈ 90 000 milliards €), largement suffisant pour le jeu.
 */
export type Cents = number;
export const toCents = (amount: number): Cents => {
  const c = Math.round(amount * 100 + (amount >= 0 ? 1e-9 : -1e-9));
  if (!Number.isSafeInteger(c)) throw new Error("Montant hors limites");
  return c;
};
export const fromCents = (c: Cents) => c / 100;
export const addC = (...xs: Cents[]) => xs.reduce((s, x) => s + x, 0);
/** Multiplication prix × quantité arrondie au centime (arrondi bancaire demi-pair). */
export function mulToCents(price: number, qty: number): Cents {
  const raw = price * qty * 100;
  const fl = Math.floor(raw);
  const diff = raw - fl;
  let r: number;
  if (Math.abs(diff - 0.5) < 1e-7) r = fl % 2 === 0 ? fl : fl + 1;
  else r = Math.round(raw);
  return r;
}
export function fmtMoney(c: Cents, cur = "EUR", compact = false): string {
  const v = c / 100;
  return new Intl.NumberFormat("fr-FR", {
    style: "currency", currency: cur, notation: compact ? "compact" : "standard",
    maximumFractionDigits: compact ? 1 : 2,
  }).format(v);
}
