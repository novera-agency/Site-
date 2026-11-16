"use client";
import { useEffect, useState } from "react";

/**
 * Réglages du son, propres à cet appareil (mémorisés dans le navigateur) :
 * - muted : « mode silencieux », coupe tout d'un coup ;
 * - notif : petits bruits des notifications ;
 * - call : bip de début d'appel ;
 * - voices : voix des personnages en réunion (sans elles, seul le mode écrit est possible).
 */
export interface SoundPrefs { muted: boolean; notif: boolean; call: boolean; voices: boolean }
const KEY = "fe_sound";
const DEFAULT: SoundPrefs = { muted: false, notif: true, call: true, voices: true };
let cache: SoundPrefs | null = null;

function load(): SoundPrefs {
  try { const raw = typeof localStorage !== "undefined" ? localStorage.getItem(KEY) : null; return { ...DEFAULT, ...(raw ? JSON.parse(raw) : {}) }; } catch { return { ...DEFAULT }; }
}
export function getSoundPrefs(): SoundPrefs { return (cache ??= load()); }
export function hasStoredSoundPrefs() { try { return typeof localStorage !== "undefined" && localStorage.getItem(KEY) !== null; } catch { return false; } }
export function setSoundPrefs(patch: Partial<SoundPrefs>): SoundPrefs {
  cache = { ...getSoundPrefs(), ...patch };
  try { localStorage.setItem(KEY, JSON.stringify(cache)); } catch { /* stockage indisponible : le réglage vaut pour la session */ }
  if (typeof window !== "undefined") {
    // Une voix qui parle encore est coupée dès que les voix ou le son sont désactivés
    if ((cache.muted || !cache.voices) && "speechSynthesis" in window) { try { window.speechSynthesis.cancel(); } catch { /* */ } }
    window.dispatchEvent(new Event("fe-sound"));
  }
  return cache;
}
export const notifOn = () => { const p = getSoundPrefs(); return !p.muted && p.notif; };
export const callOn = () => { const p = getSoundPrefs(); return !p.muted && p.call; };
export const voicesOn = () => { const p = getSoundPrefs(); return !p.muted && p.voices; };

/** Réglages du son, à jour dans les composants */
export function useSoundPrefs() {
  const [p, setP] = useState<SoundPrefs>(DEFAULT);
  useEffect(() => { setP(getSoundPrefs()); const h = () => setP({ ...getSoundPrefs() }); window.addEventListener("fe-sound", h); return () => window.removeEventListener("fe-sound", h); }, []);
  return p;
}
