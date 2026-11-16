"use client";
import { useEffect } from "react";

/**
 * Évite le zoom automatique des navigateurs mobiles quand on touche un champ ou un menu déroulant,
 * et remet l'échelle à 100 % dès qu'on le quitte (le zoom manuel par pincement reste possible le reste du temps).
 */
export function ZoomReset() {
  useEffect(() => {
    // La balise est relue à chaque fois : Next peut la recréer lors d'un changement de page
    const get = () => document.querySelector('meta[name="viewport"]') as HTMLMetaElement | null;
    const base = get()?.content?.replace(/,?\s*maximum-scale=[^,]*/g, "") || "width=device-width, initial-scale=1";
    // Seuls les champs où l'on saisit du texte ou un menu déroulant déclenchent le zoom automatique ; pas les cases à cocher ni les boutons
    const isField = (t: EventTarget | null) => t instanceof HTMLElement && (t.tagName === "SELECT" || t.tagName === "TEXTAREA" || (t instanceof HTMLInputElement && !["checkbox", "radio", "range", "button", "submit", "file", "color"].includes(t.type)));
    let timer: ReturnType<typeof setTimeout> | null = null;
    const lock = () => { if (timer) { clearTimeout(timer); timer = null; } const m = get(); if (m) m.content = `${base}, maximum-scale=1`; };
    const release = () => {
      // Le verrouillage force le retour à 100 % ; on rend ensuite le zoom manuel
      lock();
      timer = setTimeout(() => { const m = get(); if (m) m.content = base; timer = null; }, 350);
    };
    const onIn = (e: Event) => { if (isField(e.target)) lock(); };
    const onOut = (e: Event) => { if (isField(e.target)) release(); };
    document.addEventListener("focusin", onIn);
    document.addEventListener("focusout", onOut);
    return () => { document.removeEventListener("focusin", onIn); document.removeEventListener("focusout", onOut); if (timer) clearTimeout(timer); const m = get(); if (m) m.content = base; };
  }, []);
  return null;
}
