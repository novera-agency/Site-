"use client";
import { useEffect, useRef, useState, type ReactNode } from "react";
import type { Avatar } from "@/engine/avatar";
import type { Room } from "./OfficeScene";
import type { Focus, Stage } from "@/lib/three/stage";

let glOK: boolean | null = null;
/** Le navigateur sait-il afficher de la 3D (WebGL) ? Sinon on garde les décors 2D.
 *  Les navigateurs pilotés par des tests automatisés restent en 2D (sauf ?3d=1), pour garder les tests rapides. */
export function webglOK(): boolean {
  if (typeof window === "undefined") return false;
  let forced = false;
  try { forced = new URLSearchParams(window.location.search).get("3d") === "1" || localStorage.getItem("fe_3d") === "1"; } catch { /* */ }
  if (navigator.webdriver && !forced) return false;
  if (glOK !== null) return glOK;
  try { const c = document.createElement("canvas"); glOK = !!(c.getContext("webgl2") || c.getContext("webgl")); } catch { glOK = false; }
  return glOK;
}
const reducedMotion = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

/** Hall de la banque en 3D : on y voit l'avatar du joueur arriver, puis marcher jusqu'à la pièce touchée */
export function LobbyStage({ rooms, avatar, arrival, selected, onArrive, label, onFail, children }: {
  rooms: Room[]; avatar: Avatar; arrival: boolean; selected?: string | null; onArrive: (id: string) => void; label: string; onFail?: () => void; children?: ReactNode;
}) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const stage = useRef<Stage | null>(null);
  const btns = useRef<Record<string, HTMLButtonElement | null>>({});
  const [ready, setReady] = useState(!arrival);
  const [status, setStatus] = useState("");
  const cbs = useRef({ onArrive, onFail, rooms }); cbs.current = { onArrive, onFail, rooms };
  const avatarKey = JSON.stringify(avatar);

  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const { Stage } = await import("@/lib/three/stage");
        if (dead || !canvas.current) return;
        const st = new Stage({
          canvas: canvas.current, mode: "lobby", avatar, arrival, reduced: reducedMotion(),
          rooms: cbs.current.rooms.map((r) => ({ id: r.id, slot: r.slot, locked: r.locked })),
          onArrived: () => { setReady(true); setStatus(`${label} : vous êtes dans le hall de la banque.`); },
          onWalkEnd: (id) => { const r = cbs.current.rooms.find((x) => x.id === id); setStatus(`Vous êtes arrivé : ${r?.label ?? ""}.`); cbs.current.onArrive(id); },
          onLabels: (pts) => { for (const p of pts) { const b = btns.current[p.id]; if (!b) continue; b.style.display = p.visible ? "" : "none"; b.style.transform = `translate(${p.x}px, ${p.y}px) translate(-50%, -100%)`; } },
        });
        stage.current = st;
      } catch { cbs.current.onFail?.(); }
    })();
    const onResize = () => stage.current?.resize();
    window.addEventListener("resize", onResize);
    return () => { dead = true; window.removeEventListener("resize", onResize); stage.current?.dispose(); stage.current = null; };
    // la scène n'est créée qu'une fois : l'avatar est mis à jour séparément
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { stage.current?.setAvatar(avatar); }, [avatarKey]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { stage.current?.setRooms(rooms.map((r) => ({ id: r.id, slot: r.slot, locked: r.locked }))); }, [rooms]);

  const go = (r: Room) => { if (r.locked) return; setStatus(`${label} : vous marchez vers ${r.label}.`); stage.current?.walkTo(r.id); };
  return <div className="mx-auto w-full max-w-5xl select-none" data-testid="office-3d">
    <div className="relative overflow-hidden rounded-2xl border border-gold/40 bg-[#0a0f1d] shadow-[0_0_60px_-20px_rgba(201,162,74,0.45)]">
      <div className="relative aspect-[4/5] w-full sm:aspect-[16/9]">
        <canvas ref={canvas} data-testid="stage-canvas" className="absolute inset-0 h-full w-full" aria-hidden />
        {rooms.map((r) => <button key={r.id} ref={(el) => { btns.current[r.id] = el; }} type="button" data-testid={`zone-${r.id}`} disabled={r.locked || !ready} onClick={() => go(r)} aria-pressed={selected === r.id}
          aria-label={`${r.label}${r.sub ? `, ${r.sub}` : ""}${r.hint ? ` : ${r.hint}` : ""}`} style={{ display: "none", position: "absolute", left: 0, top: 0 }}
          className={`hidden whitespace-nowrap rounded-md border px-2 py-1 text-left text-[11px] font-semibold leading-tight text-white shadow-lg outline-none backdrop-blur transition focus-visible:ring-2 focus-visible:ring-gold sm:block sm:text-xs ${selected === r.id ? "border-gold bg-gold/25" : "border-gold/40 bg-[#070a12]/80"} ${r.locked ? "opacity-60" : "hover:border-gold hover:bg-[#12182b]"}`}>
          <span aria-hidden>{r.icon} </span>{r.label}{r.badge ? <span className="ml-1 rounded-full bg-gold px-1.5 text-[10px] font-bold text-black">{r.badge}</span> : null}
        </button>)}
        {!ready && <button type="button" data-testid="skip-arrival" onClick={() => stage.current?.skip()} className="absolute bottom-3 right-3 rounded-full border border-white/30 bg-black/55 px-3 py-1.5 text-xs text-white backdrop-blur hover:bg-black/75">Passer l&apos;arrivée ⏭</button>}
      </div>
    </div>
    {/* sur téléphone, les pièces sont listées sous la scène */}
    <div className="mt-2 flex flex-wrap justify-center gap-1.5 sm:hidden" role="group" aria-label={label}>
      {rooms.map((r) => <button key={r.id} type="button" data-testid={`chip-${r.id}`} disabled={r.locked || !ready} onClick={() => go(r)} aria-pressed={selected === r.id} className={`rounded-full border px-2.5 py-1 text-[11px] ${selected === r.id ? "border-gold bg-gold/20 text-white" : "border-ink-600 bg-ink-850 text-ink-200"} disabled:opacity-50`}><span aria-hidden>{r.icon} </span>{r.label}</button>)}
    </div>
    <p className="sr-only" role="status" aria-live="polite">{status}</p>
    {children}
  </div>;
}

/** Atelier du tailleur : l'avatar tourne sur un podium pendant qu'on le personnalise */
export function CreatorStage({ avatar, focus, onFail }: { avatar: Avatar; focus: Focus; onFail?: () => void }) {
  const canvas = useRef<HTMLCanvasElement>(null);
  const stage = useRef<Stage | null>(null);
  const fail = useRef(onFail); fail.current = onFail;
  const key = JSON.stringify(avatar);
  useEffect(() => {
    let dead = false;
    (async () => {
      try {
        const { Stage } = await import("@/lib/three/stage");
        if (dead || !canvas.current) return;
        stage.current = new Stage({ canvas: canvas.current, mode: "tailor", avatar, focus, reduced: reducedMotion() });
      } catch { fail.current?.(); }
    })();
    const onResize = () => stage.current?.resize();
    window.addEventListener("resize", onResize);
    return () => { dead = true; window.removeEventListener("resize", onResize); stage.current?.dispose(); stage.current = null; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => { stage.current?.setAvatar(avatar); }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { stage.current?.setFocus(focus); }, [focus]);
  return <div className="relative aspect-[4/5] w-full overflow-hidden rounded-xl border border-gold/40 bg-[#150f14] sm:aspect-[5/4]" data-testid="creator-3d" style={{ touchAction: "pan-y" }}>
    <canvas ref={canvas} data-testid="creator-canvas" className="absolute inset-0 h-full w-full" role="img" aria-label="Aperçu 3D de votre personnage, qui tourne sur un podium" />
    <span className="pointer-events-none absolute bottom-2 left-2 rounded bg-black/50 px-2 py-0.5 text-[10px] text-ink-200">Glissez pour tourner</span>
  </div>;
}
