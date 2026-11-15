"use client";
import { useEffect, useState } from "react";
import { EN } from "./i18n-en";

/** Langue de l'interface. Le français est la langue de référence ; l'anglais couvre les menus, la navigation, la visite guidée et l'accueil. */
export type Lang = "fr" | "en";
let cached: Lang | null = null;
export function getLang(): Lang {
  if (cached) return cached;
  try { cached = localStorage.getItem("fe_lang") === "en" ? "en" : "fr"; } catch { cached = "fr"; }
  return cached;
}
export function setLang(l: Lang) { try { localStorage.setItem("fe_lang", l); } catch { /* */ } cached = l; if (typeof location !== "undefined") location.reload(); }
/** Traduit une chaîne française de l'interface (renvoie le français s'il n'existe pas de traduction) */
export function tr(fr: string, l: Lang = getLang()): string { return l === "en" ? EN[fr] ?? fr : fr; }
/** Pour les pages pré-rendues : français au premier rendu, puis la langue choisie (évite les écarts d'hydratation) */
export function useT() {
  const [l, setL] = useState<Lang>("fr");
  useEffect(() => { setL(getLang()); }, []);
  return (fr: string) => tr(fr, l);
}
