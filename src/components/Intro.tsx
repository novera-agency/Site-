"use client";
import { useEffect, useState } from "react";

const LINES = ["Paris, 7 h 02.", "Les marchés asiatiques viennent de fermer en hausse.", "Votre badge vous attend à l'accueil de la banque."];
const DURATION = 5200;

/** Petit accueil à l'arrivée sur le site (une fois par session de navigation) */
export function Intro() {
  const [show, setShow] = useState(false);
  const [leaving, setLeaving] = useState(false);
  const [step, setStep] = useState(0);
  useEffect(() => {
    let seen = false;
    try { seen = sessionStorage.getItem("fe_intro") === "1"; } catch { /* stockage indisponible */ }
    if (seen) return;
    setShow(true);
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    const total = reduce ? 1500 : DURATION;
    const timers = [setTimeout(() => setStep(1), total * 0.25), setTimeout(() => setStep(2), total * 0.45), setTimeout(() => setStep(3), total * 0.65), setTimeout(() => close(), total)];
    return () => timers.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    if (!show) return;
    const k = (e: KeyboardEvent) => { if (e.key === "Enter" || e.key === "Escape" || e.key === " ") close(); };
    window.addEventListener("keydown", k);
    return () => window.removeEventListener("keydown", k);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [show]);
  function close() {
    try { sessionStorage.setItem("fe_intro", "1"); } catch { /* */ }
    setLeaving(true);
    setTimeout(() => setShow(false), 600);
  }
  if (!show) return null;
  return (
    <div data-testid="intro" onClick={close} className={`fixed inset-0 z-[100] flex cursor-pointer flex-col items-center justify-center overflow-hidden bg-[#05070d] px-6 text-center transition-opacity duration-500 ${leaving ? "opacity-0" : "opacity-100"}`}>
      {/* courbe de cours qui se dessine */}
      <svg className="pointer-events-none absolute inset-x-0 top-1/2 h-48 w-full -translate-y-1/2 opacity-40" viewBox="0 0 1200 200" preserveAspectRatio="none" aria-hidden>
        <polyline className="intro-line" points="0,170 80,160 140,175 220,130 280,145 360,100 430,118 500,80 580,95 650,60 730,78 800,45 880,62 950,30 1030,48 1100,15 1200,22" fill="none" stroke="#d4a94f" strokeWidth="2.5" />
      </svg>
      <div className="relative">
        <div className="intro-fade text-[11px] font-semibold uppercase tracking-[0.5em] text-gold/80" style={{ animationDelay: "0.2s" }}>Simulation de carrière en finance</div>
        <h1 className="intro-fade mt-4 text-4xl font-bold tracking-[0.22em] text-white sm:text-6xl" style={{ animationDelay: "0.5s" }}>FINANCIAL<span className="text-gold"> EMPIRE</span></h1>
        <p className="intro-fade mt-3 text-base text-ink-300 sm:text-lg" style={{ animationDelay: "1s" }}>De stagiaire à patron de banque.</p>
        <div className="mt-8 min-h-[4.5rem] space-y-1 font-mono text-xs text-ink-400 sm:text-sm">{LINES.slice(0, step).map((l) => <div key={l} className="intro-fade">{l}</div>)}</div>
        <button data-testid="intro-enter" onClick={(e) => { e.stopPropagation(); close(); }} className="intro-fade mt-6 rounded-full border border-gold/60 bg-gold/10 px-8 py-2.5 text-sm font-semibold text-gold transition hover:bg-gold hover:text-black" style={{ animationDelay: "1.4s" }}>Entrer dans la banque →</button>
        <div className="mx-auto mt-6 h-0.5 w-48 overflow-hidden rounded bg-ink-800"><div className="intro-bar h-full bg-gold" style={{ animationDuration: `${DURATION}ms` }} /></div>
        <div className="mt-2 text-[10px] text-ink-500">Touchez l'écran ou appuyez sur Entrée pour passer</div>
      </div>
    </div>
  );
}
