"use client";
import { useEffect, useRef, useState } from "react";
import type { Avatar } from "@/engine/avatar";
import type { IntroSequence } from "@/lib/three/intro";
import { INTRO_DURATION } from "@/lib/three/intro-timing";
import { getSoundPrefs } from "@/lib/sound-prefs";

const BAR = 11.5; // hauteur des bandes de cinéma (% de l'écran)
const clamp = (x: number) => Math.min(1, Math.max(0, x));
/** Apparition / disparition en douceur d'un texte entre deux instants */
const win = (t: number, a: number, b: number, f = 0.7) => clamp((t - a) / f) * clamp((b - t) / f);

/** Introduction cinématographique plein écran (nouvelle partie) : scène 3D temps réel, passable à tout moment */
export function IntroCinematic({ avatar, firstName, bankName, rankTitle, onDone, onFail }: { avatar: Avatar; firstName: string; bankName: string; rankTitle: string; onDone: () => void; onFail: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const seq = useRef<IntroSequence | null>(null);
  const cbs = useRef({ onDone, onFail }); cbs.current = { onDone, onFail };
  const [t, setT] = useState(0);
  const [ready, setReady] = useState(false);
  const [muted, setMuted] = useState(() => getSoundPrefs().muted);
  const [ending, setEnding] = useState(false);
  const lastSet = useRef(0);
  const mutedRef = useRef(muted); mutedRef.current = muted;

  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const { IntroSequence } = await import("@/lib/three/intro");
        if (dead || !canvas.current) return;
        const s = new IntroSequence({
          canvas: canvas.current, avatar, muted: mutedRef.current,
          onFrame: (tt) => { if (tt - lastSet.current > 0.05 || tt < lastSet.current) { lastSet.current = tt; setT(tt); } },
          onEnd: () => { setEnding(true); setTimeout(() => cbs.current.onDone(), 650); },
        });
        seq.current = s; s.preview();
        // on attend que le personnage soit chargé (8 s au plus) avant de lancer la séquence
        const t0 = performance.now();
        const wait = setInterval(() => { if (dead) { clearInterval(wait); return; } if (s.heroReady || performance.now() - t0 > 8000) { clearInterval(wait); setReady(true); s.start(); } }, 120);
      } catch { cbs.current.onFail(); }
    })();
    const onResize = () => seq.current?.resize();
    window.addEventListener("resize", onResize);
    return () => { dead = true; window.removeEventListener("resize", onResize); seq.current?.dispose(); seq.current = null; };
    // la séquence ne se crée qu'une fois
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { seq.current?.setMuted(muted); }, [muted]);
  useEffect(() => {
    const o = document.body.style.overflow; document.body.style.overflow = "hidden";
    const k = (e: KeyboardEvent) => { if (e.key === "Escape" || e.key === " " || e.key === "Enter") { e.preventDefault(); seq.current?.skip(); } };
    window.addEventListener("keydown", k);
    return () => { document.body.style.overflow = o; window.removeEventListener("keydown", k); };
  }, []);

  const fadeIn = ready ? 1 - clamp(1 - t / 1.4) * 0 : 0;
  const black = ending ? 1 : Math.max(clamp(1 - t / 1.4), clamp((t - (INTRO_DURATION - 1.4)) / 1.4));
  const bars = ready ? Math.min(clamp(t / 1.2), clamp((INTRO_DURATION - t) / 1.2)) * BAR : 0;
  const title = win(t, 2.6, 6.9), place = win(t, 8.6, 12.4), welcome = win(t, 35, 42.5);
  void fadeIn;
  return <div className="fixed inset-0 z-[110] select-none overflow-hidden bg-black" role="dialog" aria-modal="true" aria-label="Introduction : votre arrivée à la banque" data-testid="intro-cinematic">
    <canvas ref={canvas} data-testid="intro-canvas" className="absolute inset-0 h-full w-full" aria-hidden />
    {/* vignettage léger commun à tous les niveaux de qualité */}
    <div className="pointer-events-none absolute inset-0" style={{ background: "radial-gradient(ellipse at center, transparent 62%, rgba(0,0,0,.38) 100%)" }} />
    {/* bandes de cinéma */}
    <div className="pointer-events-none absolute inset-x-0 top-0 bg-black" style={{ height: `${bars}%` }} />
    <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-black" style={{ height: `${bars}%` }} />
    {/* titre d'établissement */}
    <div className="pointer-events-none absolute inset-x-0 top-[24%] text-center" style={{ opacity: title }} aria-hidden={title < 0.1}>
      <div className="mx-auto mb-3 h-px w-40 bg-gradient-to-r from-transparent via-[#d4a94f] to-transparent" style={{ transform: `scaleX(${title})` }} />
      <p className="font-serif text-[clamp(1.6rem,5.2vw,3.4rem)] tracking-[0.32em] text-white [text-shadow:0_2px_24px_rgba(0,0,0,.6)]">FINANCIAL EMPIRE</p>
      <p className="mt-2 text-[clamp(.6rem,1.6vw,.9rem)] uppercase tracking-[0.42em] text-[#e0c27a]">Banque d&apos;investissement · {bankName}</p>
    </div>
    {/* lieu */}
    <div className="pointer-events-none absolute left-[6%] text-left" style={{ bottom: `${BAR + 5}%`, opacity: place }}>
      <p className="text-[clamp(.55rem,1.4vw,.8rem)] uppercase tracking-[0.35em] text-[#e0c27a]">Quartier d&apos;affaires</p>
      <p className="font-serif text-[clamp(1rem,2.6vw,1.6rem)] text-white [text-shadow:0_2px_14px_rgba(0,0,0,.7)]">Lundi, 8 h 47</p>
    </div>
    {/* bienvenue */}
    <div className="pointer-events-none absolute left-[6%] text-left" style={{ bottom: `${BAR + 5}%`, opacity: welcome }}>
      <p className="font-serif text-[clamp(1.3rem,3.6vw,2.4rem)] text-white [text-shadow:0_2px_18px_rgba(0,0,0,.7)]">Bienvenue, {firstName}.</p>
      <p className="mt-1 text-[clamp(.6rem,1.5vw,.9rem)] uppercase tracking-[0.3em] text-[#e0c27a]">{rankTitle} · votre carrière commence ici</p>
    </div>
    {!ready && <p className="absolute inset-x-0 top-1/2 -translate-y-1/2 text-center text-sm tracking-[0.3em] text-[#e0c27a]" role="status">PRÉPARATION DE VOTRE ARRIVÉE…</p>}
    {/* commandes */}
    <div className="absolute right-3 top-3 z-20 flex gap-2">
      <button type="button" onClick={() => setMuted((m) => !m)} aria-pressed={muted} aria-label={muted ? "Activer le son" : "Couper le son"} data-testid="intro-mute" className="rounded-full border border-white/30 bg-black/55 px-3 py-1.5 text-xs text-white backdrop-blur hover:bg-black/75 focus-visible:ring-2 focus-visible:ring-gold">{muted ? "🔇 Son coupé" : "🔊 Son"}</button>
      <button type="button" onClick={() => seq.current ? seq.current.skip() : cbs.current.onDone()} data-testid="intro-skip" className="rounded-full border border-white/30 bg-black/55 px-3 py-1.5 text-xs text-white backdrop-blur hover:bg-black/75 focus-visible:ring-2 focus-visible:ring-gold">Passer ▸</button>
    </div>
    <div className="pointer-events-none absolute inset-0 bg-black transition-none" style={{ opacity: black }} />
    <p className="sr-only" role="status">Introduction cinématographique : vous arrivez devant la banque, vous entrez dans le hall. Touche Espace ou Échap pour passer.</p>
  </div>;
}
