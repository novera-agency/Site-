"use client";
/** Préférences d'affichage propres à l'appareil (accessibilité, langue de l'interface). */
export interface A11y { big: boolean; contrast: boolean; still: boolean }
const KEY = "fe_a11y";
export function getA11y(): A11y {
  try { return { big: false, contrast: false, still: false, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") }; } catch { return { big: false, contrast: false, still: false }; }
}
export function applyA11y(a: A11y = getA11y()) {
  if (typeof document === "undefined") return;
  const c = document.documentElement.classList;
  c.toggle("a11y-big", a.big); c.toggle("a11y-contrast", a.contrast); c.toggle("a11y-still", a.still);
}
export function setA11y(a: A11y) { try { localStorage.setItem(KEY, JSON.stringify(a)); } catch { /* */ } applyA11y(a); }

