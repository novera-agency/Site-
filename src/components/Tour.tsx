"use client";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname } from "next/navigation";
import { useAction } from "@/lib/hooks";
import { useGame } from "@/lib/store";
import { tr } from "@/lib/i18n";

/** Visite guidée de l'interface : met en lumière chaque zone de l'écran, une à la fois. */
interface Step { target?: string; title: string; text: string }
const STEPS: Step[] = [
  { title: "Bienvenue dans votre banque 👋", text: "Cette visite rapide vous montre où trouver chaque chose. Elle dure une minute ; vous pouvez la passer à tout moment (touche Échap) et la relancer plus tard dans Options → Paramètres." },
  { target: "[data-testid=speed-controls]", title: "Le temps", text: "Le jeu avance tout seul. ▶ lance le temps, ❚❚ le met en pause, x1 à x100 règlent la vitesse et ⏭ saute jusqu'au prochain rendez-vous. Le jeu se met en pause de lui-même quand quelque chose d'important arrive." },
  { target: "[data-tour=tutorial]", title: "Votre première journée", text: "Ce guide vous dit quoi faire ensuite. Chaque étape est un lien : touchez-la pour aller au bon écran." },
  { target: "[data-tour=wealth]", title: "Votre patrimoine", text: "Tout ce que vous possédez : argent, placements, immobilier, moins les dettes. Le détail est dans Vie personnelle → Patrimoine." },
  { target: "[data-testid=life-chip]", title: "Votre équilibre", text: "🧠 santé mentale, 💪 forme, 🫂 vie sociale, 🎉 épanouissement. En dessous de 35, le stress monte et le travail en souffre. Prenez soin de vous dans Vie privée." },
  { target: "[data-tour=bell]", title: "Notifications et messages", text: "🔔 pour les alertes, ✉️ pour les messages qui demandent une décision (offres d'emploi, demandes de votre responsable…)." },
  { target: "[data-testid=cat-bureau]", title: "🏢 Bureau", text: "Votre journée : missions, agenda, réunions, messagerie, actualités, et votre parcours avec ses succès." },
  { target: "[data-testid=cat-pro]", title: "💼 Vie professionnelle", text: "Les marchés (cours, ordres, options), votre portefeuille, les risques, l'économie, et votre carrière : compétences, formation, promotion." },
  { target: "[data-testid=cat-perso]", title: "🏠 Vie personnelle", text: "Vie privée et loisirs, salaire, investissement immobilier dans 13 villes et patrimoine." },
  { target: "[data-testid=cat-relations]", title: "👥 Relations", text: "Collègues, clients à appeler et prospects à démarcher, réputation et ressources humaines." },
  { target: "[data-testid=cat-options]", title: "⚙️ Options", text: "Vitesse, aides, voix et son, sauvegardes. C'est ici que vous pourrez relancer cette visite." },
  { title: "À vous de jouer !", text: "Pour revenir en arrière dans un menu, touchez la croix ✕ en haut de la page. Commencez par appuyer sur ▶ : votre responsable vous attend à 7 h 15 pour votre accueil." },
];

const TOUR_KEY = "fe_tour";
export function startTour() { if (typeof window !== "undefined") window.dispatchEvent(new Event("fe-tour")); }

function visibleRect(sel?: string) {
  if (!sel) return null;
  const el = document.querySelector(sel) as HTMLElement | null;
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (r.width === 0 || r.height === 0) return null;
  return r;
}

export function Tour() {
  const path = usePathname();
  const snap = useGame((g) => g.snap);
  const act = useAction();
  const [open, setOpen] = useState(false);
  const [i, setI] = useState(0);
  const [rect, setRect] = useState<DOMRect | null>(null);
  const wasPaused = useRef<boolean | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const steps = useRef<Step[]>(STEPS);

  const begin = useCallback(() => {
    // On ne garde que les étapes dont la zone est visible sur cet écran (certaines sont masquées sur téléphone)
    steps.current = STEPS.filter((s) => !s.target || visibleRect(s.target));
    setI(0); setOpen(true);
    const p = useGame.getState().snap?.paused;
    wasPaused.current = p ?? null;
    if (p === false) act({ type: "pause", paused: true }, { silent: true });
  }, [act]);
  const close = useCallback(() => {
    setOpen(false);
    try { localStorage.setItem(TOUR_KEY, "1"); } catch { /* */ }
    if (wasPaused.current === false) act({ type: "pause", paused: false }, { silent: true });
  }, [act]);

  // Lancement automatique à la première partie (pas pendant les tests automatisés)
  useEffect(() => {
    if (!snap || snap.mode !== "carriere" || path !== "/play") return;
    let seen = "1";
    try { seen = localStorage.getItem(TOUR_KEY) ?? ""; } catch { /* */ }
    if (seen || (typeof navigator !== "undefined" && navigator.webdriver)) return;
    const t = setTimeout(begin, 600);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [!!snap, path]);
  useEffect(() => { const h = () => begin(); window.addEventListener("fe-tour", h); return () => window.removeEventListener("fe-tour", h); }, [begin]);

  const step = steps.current[i];
  useLayoutEffect(() => {
    if (!open || !step) return;
    const upd = () => setRect(visibleRect(step.target));
    upd();
    const el = step.target ? document.querySelector(step.target) : null;
    (el as HTMLElement | null)?.scrollIntoView?.({ block: "nearest" });
    window.addEventListener("resize", upd); window.addEventListener("scroll", upd, true);
    const t = setTimeout(upd, 200);
    box.current?.focus();
    return () => { window.removeEventListener("resize", upd); window.removeEventListener("scroll", upd, true); clearTimeout(t); };
  }, [open, i, step]);
  useEffect(() => {
    if (!open) return;
    const k = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
      else if (e.key === "ArrowRight") setI((x) => Math.min(x + 1, steps.current.length - 1));
      else if (e.key === "ArrowLeft") setI((x) => Math.max(0, x - 1));
    };
    window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k);
  }, [open, close]);

  if (!open || !step) return null;
  const last = i === steps.current.length - 1;
  const vw = typeof window !== "undefined" ? window.innerWidth : 400;
  const vh = typeof window !== "undefined" ? window.innerHeight : 800;
  const w = Math.min(340, vw - 32);
  let style: React.CSSProperties;
  if (rect) {
    const below = rect.bottom + 12 + 190 < vh || rect.top < vh / 2;
    const left = Math.max(16, Math.min(vw - w - 16, rect.left + rect.width / 2 - w / 2));
    style = below ? { top: Math.min(rect.bottom + 12, vh - 200), left, width: w } : { bottom: vh - rect.top + 12, left, width: w };
  } else style = { top: "50%", left: "50%", transform: "translate(-50%, -50%)", width: w };
  const pad = 6;
  return <div className="fixed inset-0 z-[150]" data-testid="tour">
    {rect
      ? <div aria-hidden className="pointer-events-none fixed rounded-lg border-2 border-gold transition-all duration-200" style={{ top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2, boxShadow: "0 0 0 9999px rgba(3,6,12,0.72)" }} />
      : <div aria-hidden className="fixed inset-0 bg-[rgba(3,6,12,0.72)]" />}
    <div ref={box} tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="tour-title" aria-describedby="tour-text" className="fixed rounded-xl border border-gold/60 bg-ink-850 p-4 shadow-2xl outline-none" style={style}>
      <div className="mb-1 flex items-center justify-between gap-2"><h2 id="tour-title" className="text-sm font-semibold text-gold">{tr(step.title)}</h2><span className="num text-[11px] text-ink-400">{i + 1}/{steps.current.length}</span></div>
      <p id="tour-text" className="text-sm leading-relaxed text-ink-100">{tr(step.text)}</p>
      <div className="mt-3 flex items-center justify-between gap-2">
        <button data-testid="tour-skip" onClick={close} className="text-xs text-ink-400 underline hover:text-white">{tr("Passer la visite")}</button>
        <div className="flex gap-2">
          {i > 0 && <button onClick={() => setI(i - 1)} className="rounded-md bg-ink-700 px-3 py-1.5 text-xs hover:bg-ink-600">{tr("← Retour")}</button>}
          <button data-testid="tour-next" onClick={() => (last ? close() : setI(i + 1))} className="rounded-md bg-gold px-3 py-1.5 text-xs font-semibold text-black hover:brightness-110">{tr(last ? "Commencer" : "Suivant →")}</button>
        </div>
      </div>
    </div>
  </div>;
}
