"use client";
import { useEffect, useState } from "react";
import { getA11y, setA11y, type A11y } from "@/lib/prefs";
import { getLang, setLang, type Lang } from "@/lib/i18n";
import { startTour } from "./Tour";
import { Button } from "./ui";

/** Visite guidée, accessibilité et langue : réglages propres à cet appareil */
export function A11yPrefs() {
  const [a, setA] = useState<A11y>({ big: false, contrast: false, still: false });
  const [lang, setL] = useState<Lang>("fr");
  useEffect(() => { setA(getA11y()); setL(getLang()); }, []);
  const upd = (k: keyof A11y) => { const n = { ...a, [k]: !a[k] }; setA(n); setA11y(n); };
  const opts: [keyof A11y, string, string][] = [
    ["big", "Texte agrandi", "Tous les textes et boutons sont environ 12 % plus grands."],
    ["contrast", "Contraste renforcé", "Textes secondaires plus clairs et contour bien visible autour de l'élément sélectionné au clavier."],
    ["still", "Réduire les animations", "Supprime le défilement des cours, les fondus et les animations."],
  ];
  return <div className="space-y-3 text-sm" data-testid="a11y-prefs">
    <div className="flex flex-wrap items-center gap-2"><Button data-testid="tour-start" onClick={startTour}>🧭 Relancer la visite guidée</Button><span className="text-xs text-ink-400">Présente chaque zone de l'écran en une minute.</span></div>
    {opts.map(([k, label, hint]) => <label key={k} className="flex cursor-pointer items-start gap-2"><input type="checkbox" className="mt-1" checked={a[k]} onChange={() => upd(k)} data-testid={`a11y-${k}`} /><span><span className="font-medium text-ink-100">{label}</span><span className="block text-xs text-ink-400">{hint}</span></span></label>)}
    <label className="block"><span className="font-medium text-ink-100">Langue de l'interface / Interface language</span>
      <select data-testid="lang-select" value={lang} onChange={(e) => setLang(e.target.value as Lang)} className="mt-1 block w-full rounded-md border border-ink-600 bg-ink-900 px-2 py-1.5 text-sm sm:w-64"><option value="fr">Français</option><option value="en">English (menus et navigation)</option></select>
      <span className="mt-1 block text-xs text-ink-400">En anglais, les menus, la navigation, la visite guidée et l'accueil sont traduits ; les dialogues, missions et actualités restent en français.</span></label>
    <p className="text-xs text-ink-400">Au clavier : Tab pour se déplacer, Entrée pour valider, Échap pour fermer une fenêtre. Le lien « Aller au contenu » apparaît à la première tabulation.</p>
  </div>;
}
