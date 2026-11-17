import { parseAvatar, type Avatar } from "@/engine/avatar";

const KEY = "fe_avatar";
/** Mémorise l'apparence choisie sur cet appareil (affichée à l'accueil avant même de charger une partie) */
export function saveDeviceAvatar(a: Avatar) { try { localStorage.setItem(KEY, JSON.stringify(a)); } catch { /* stockage indisponible */ } }
export function loadDeviceAvatar(): Avatar | null {
  try { const raw = localStorage.getItem(KEY); return raw ? parseAvatar(JSON.parse(raw)) : null; } catch { return null; }
}
