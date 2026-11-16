"use client";
import { setSoundPrefs, useSoundPrefs, type SoundPrefs } from "@/lib/sound-prefs";

/** Tous les bruits du jeu, réglables un par un ou coupés d'un coup (réglages propres à cet appareil) */
export function SoundPrefsPanel() {
  const p = useSoundPrefs();
  const rows: [keyof Omit<SoundPrefs, "muted">, string, string][] = [
    ["notif", "Bruits de notification", "Un très court bruit à chaque alerte, réussite ou encaissement."],
    ["call", "Bip de début d'appel", "Un seul bip bref quand vous appelez un client ou un prospect."],
    ["voices", "Voix des personnages", "Les réunions sont parlées. Sans voix, seul le mode écrit est disponible."],
  ];
  return <div className="space-y-3 text-sm" data-testid="sound-prefs">
    <label className={`flex cursor-pointer items-start gap-3 rounded-md border p-3 ${p.muted ? "border-amber-500/60 bg-amber-500/10" : "border-ink-700 bg-ink-900"}`}>
      <input type="checkbox" className="mt-1" data-testid="sound-master" checked={p.muted} onChange={(e) => setSoundPrefs({ muted: e.target.checked })} />
      <span><span className="font-semibold text-white">Mode silencieux : couper tous les bruits</span><span className="block text-xs text-ink-300">Aucun bruit, aucune voix, aucun bip. Vous pouvez aussi le faire d'un geste avec le bouton 🔊 en haut de l'écran.</span></span>
    </label>
    <div className={`space-y-2 ${p.muted ? "opacity-50" : ""}`}>
      {rows.map(([k, label, hint]) => <label key={k} className="flex cursor-pointer items-start gap-3 rounded-md bg-ink-900 p-3">
        <input type="checkbox" className="mt-1" data-testid={`sound-${k}`} checked={p[k]} disabled={p.muted} onChange={(e) => setSoundPrefs({ [k]: e.target.checked })} />
        <span><span className="font-medium text-ink-100">{label}</span><span className="block text-xs text-ink-400">{hint}</span></span>
      </label>)}
    </div>
    <p className="text-[11px] text-ink-400">Ces réglages valent pour cet appareil et sont conservés d'une partie à l'autre. Il n'y a ni musique ni son de fond dans le jeu.</p>
  </div>;
}
