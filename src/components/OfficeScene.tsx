"use client";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";

/**
 * Bureau d'une banque d'investissement très fortunée, vu de dessus.
 * Un personnage marche jusqu'à la pièce touchée (par le couloir), puis `onArrive` est appelé.
 * Chaque pièce est aussi un vrai bouton (clavier, lecteur d'écran) ; l'animation est coupée si l'utilisateur demande moins de mouvement.
 */
export type RoomKind = "directeur" | "marches" | "conseil" | "archives" | "openspace" | "honneur" | "conciergerie";
export interface Room { id: string; label: string; sub?: string; icon: string; slot: number; kind: RoomKind; badge?: string | number; locked?: boolean; hint?: string }

// Plan en unités (viewBox 100 × 64) : 3 pièces en haut, un couloir, 4 pièces en bas
const SLOTS = [
  { x: 2, y: 3, w: 30, h: 22 }, { x: 34, y: 3, w: 32, h: 22 }, { x: 68, y: 3, w: 30, h: 22 },
  { x: 2, y: 39, w: 22, h: 22 }, { x: 26, y: 39, w: 22, h: 22 }, { x: 50, y: 39, w: 22, h: 22 }, { x: 74, y: 39, w: 24, h: 22 },
];
const LANE = 32;
const ENTRANCE = { x: 3, y: LANE };
const SPEED = 34; // unités par seconde
const doorOf = (slot: number) => { const r = SLOTS[slot]; return { x: r.x + r.w / 2, y: r.y < LANE ? 27.4 : 36.6 }; };

type P = { x: number; y: number };

function Walker({ x, y, a, ph, moving }: { x: number; y: number; a: number; ph: number; moving: boolean }) {
  const sw = moving ? Math.sin(ph) * 1.1 : 0;
  return <g data-testid="walker" transform={`translate(${x.toFixed(2)},${y.toFixed(2)}) rotate(${a.toFixed(0)}) scale(1.3)`}>
    <ellipse cx="0.3" cy="0.4" rx="3" ry="2.2" fill="#000" opacity="0.28" />
    {/* pieds */}
    <ellipse cx="-0.9" cy={-sw - 0.2} rx="0.75" ry="1.25" fill="#0d0d12" />
    <ellipse cx="0.9" cy={sw - 0.2} rx="0.75" ry="1.25" fill="#0d0d12" />
    {/* bras */}
    <ellipse cx="-2.35" cy={sw * 0.8} rx="0.6" ry="1.35" fill="#1a2744" />
    <ellipse cx="2.35" cy={-sw * 0.8} rx="0.6" ry="1.35" fill="#1a2744" />
    {/* costume */}
    <ellipse cx="0" cy="0" rx="2.2" ry="1.35" fill="#22325a" stroke="#0f1a33" strokeWidth="0.18" />
    <path d="M-0.5 -1.1 L0 0.2 L0.5 -1.1 Z" fill="#f2efe8" opacity="0.9" />
    <rect x="-0.14" y="-0.9" width="0.28" height="1.3" fill="#9c1f2e" />
    {/* tête */}
    <circle cx="0" cy="-0.15" r="1.15" fill="#d9a77c" />
    <path d="M-1.15 -0.15 A1.15 1.15 0 0 1 1.15 -0.15 Q0 -0.9 -1.15 -0.15 Z" fill="#2b1d14" transform="translate(0 0.35)" />
    <circle cx="0" cy="-0.1" r="1.15" fill="none" stroke="#2b1d14" strokeWidth="0.12" opacity="0.5" />
  </g>;
}

/* ───────── Mobilier des pièces (coordonnées relatives à la pièce) ───────── */
const Plant = ({ x, y, r = 1.1 }: { x: number; y: number; r?: number }) => <g><circle cx={x} cy={y} r={r + 0.25} fill="#3a2a1c" /><circle cx={x} cy={y} r={r} fill="#2f7d4f" /><circle cx={x - 0.3} cy={y - 0.3} r={r * 0.55} fill="#47a36d" /></g>;
const Desk = ({ x, y, w = 5, h = 2.4, screen = "#3b82f6", wood = "#5b3a22" }: { x: number; y: number; w?: number; h?: number; screen?: string; wood?: string }) => <g>
  <rect x={x} y={y} width={w} height={h} rx="0.3" fill={wood} stroke="#2a1a0e" strokeWidth="0.15" />
  <rect x={x + w * 0.3} y={y + 0.2} width={w * 0.4} height="0.6" rx="0.1" fill={screen} opacity="0.95" />
  <circle cx={x + w / 2} cy={y + h + 1.1} r="0.95" fill="#1b1f2b" stroke="#4a5370" strokeWidth="0.15" />
</g>;

function Furniture({ kind, w, h }: { kind: RoomKind; w: number; h: number }) {
  switch (kind) {
    case "directeur": return <g>
      <rect x={w * 0.12} y={h * 0.22} width={w * 0.76} height={h * 0.6} rx="0.6" fill="#5a1f2b" opacity="0.9" />
      <rect x={w * 0.2} y={h * 0.3} width={w * 0.6} height={h * 0.2} rx="0.5" fill="#4a2c18" stroke="#c9a24a" strokeWidth="0.2" />
      <rect x={w * 0.4} y={h * 0.33} width={w * 0.2} height="0.8" rx="0.15" fill="#3b82f6" />
      <circle cx={w * 0.5} cy={h * 0.62} r="1.5" fill="#1a1612" stroke="#c9a24a" strokeWidth="0.2" />
      <circle cx={w * 0.85} cy={h * 0.2} r="1.6" fill="#1c4a7a" stroke="#c9a24a" strokeWidth="0.3" />
      {[0, 1, 2, 3].map((i) => <rect key={i} x={0.8} y={2.2 + i * 3.6} width="1.8" height="3" fill="#3a2a1d" stroke="#c9a24a" strokeWidth="0.1" />)}
      <Plant x={w - 1.8} y={h - 1.8} />
    </g>;
    case "marches": return <g>
      <rect x={w * 0.12} y={0.7} width={w * 0.76} height="2.4" rx="0.3" fill="#0b1630" stroke="#3b82f6" strokeWidth="0.2" />
      <polyline points={Array.from({ length: 12 }, (_, i) => `${w * 0.15 + i * (w * 0.7) / 11},${2.9 - (Math.sin(i * 1.1) + i * 0.12) * 0.55}`).join(" ")} fill="none" stroke="#22c55e" strokeWidth="0.25" />
      {[0, 1, 2].map((r) => [0, 1, 2, 3].map((c) => <Desk key={`${r}${c}`} x={w * 0.1 + c * (w * 0.22)} y={5 + r * 5.4} w={w * 0.17} h={2} screen={(r + c) % 3 === 0 ? "#22c55e" : "#3b82f6"} wood="#2a3550" />))}
    </g>;
    case "conseil": return <g>
      <circle cx={w / 2} cy={h / 2} r="1.8" fill="none" stroke="#c9a24a" strokeWidth="0.3" />
      <rect x={w * 0.2} y={h * 0.32} width={w * 0.6} height={h * 0.36} rx={h * 0.18} fill="#4a2f1c" stroke="#c9a24a" strokeWidth="0.25" />
      {Array.from({ length: 5 }, (_, i) => w * 0.28 + i * (w * 0.11)).map((cx, i) => <g key={i}><circle cx={cx} cy={h * 0.25} r="0.9" fill="#1b1f2b" stroke="#6b7390" strokeWidth="0.12" /><circle cx={cx} cy={h * 0.75} r="0.9" fill="#1b1f2b" stroke="#6b7390" strokeWidth="0.12" /></g>)}
      <rect x={w * 0.2} y={0.6} width={w * 0.6} height="0.9" fill="#0b1630" stroke="#c9a24a" strokeWidth="0.15" />
    </g>;
    case "archives": return <g>
      {[0, 1, 2].map((i) => <g key={i}><rect x={0.8} y={2 + i * 6.4} width={w - 1.6} height="2.2" fill="#3a2c1f" stroke="#1f160e" strokeWidth="0.15" />
        {Array.from({ length: 12 }, (_, k) => <rect key={k} x={1.2 + k * ((w - 2.8) / 12)} y={2.3 + i * 6.4} width="0.7" height="1.6" fill={["#9c1f2e", "#c9a24a", "#2f5d8a", "#2f7d4f"][(k + i) % 4]} />)}</g>)}
      <circle cx={w - 3.2} cy={h - 3.2} r="2.3" fill="#8a8f99" stroke="#d4d8e0" strokeWidth="0.25" /><circle cx={w - 3.2} cy={h - 3.2} r="1" fill="#c9a24a" />
    </g>;
    case "openspace": return <g>
      {[0, 1].map((r) => [0, 1].map((c) => <g key={`${r}${c}`}><Desk x={1.8 + c * (w * 0.46)} y={2.4 + r * 8} w={w * 0.36} h={2.2} wood="#e8e2d3" /><Desk x={1.8 + c * (w * 0.46)} y={4.9 + r * 8} w={w * 0.36} h={0.01} wood="transparent" screen="transparent" /></g>))}
      <Plant x={w - 1.8} y={1.8} /><Plant x={1.6} y={h - 1.8} />
      <rect x={w - 3.5} y={h - 4} width="2" height="2.8" rx="0.4" fill="#7fb4d9" stroke="#3b6b8f" strokeWidth="0.15" />
    </g>;
    case "honneur": return <g>
      <rect x={w * 0.38} y={0.6} width={w * 0.24} height={h - 1.2} fill="#7a1d2b" opacity="0.9" />
      {[0, 1].map((i) => <g key={i}><rect x={1.2} y={3 + i * 8} width="3.6" height="4.4" rx="0.3" fill="#9fc6e0" opacity="0.35" stroke="#c9a24a" strokeWidth="0.2" /><path d={`M${3} ${4 + i * 8} h1.2 l-0.2 1.6 a0.9 0.9 0 0 1 -0.8 0.8 a0.9 0.9 0 0 1 -0.8 -0.8 l-0.2 -1.6 z`} transform="translate(-0.6 0)" fill="#e8c35a" /></g>)}
      {[0, 1].map((i) => <g key={i}><rect x={w - 4.8} y={3 + i * 8} width="3.6" height="4.4" rx="0.3" fill="#9fc6e0" opacity="0.35" stroke="#c9a24a" strokeWidth="0.2" /><circle cx={w - 3} cy={5.2 + i * 8} r="1" fill="#e8c35a" /></g>)}
      {[0, 1, 2].map((i) => <rect key={i} x={w * 0.2 + i * (w * 0.22)} y="0.5" width={w * 0.14} height="0.8" fill="#c9a24a" />)}
    </g>;
    case "conciergerie": return <g>
      <path d={`M1.5 ${h - 3.5} H${w - 1.5} V${h - 1.5} H1.5 Z`} fill="#4a2f1c" stroke="#c9a24a" strokeWidth="0.25" />
      <circle cx={w * 0.3} cy={h - 4.4} r="0.7" fill="#c9a24a" />
      <g transform={`translate(${w / 2} ${h * 0.34})`}><circle r="3" fill="none" stroke="#c9a24a" strokeWidth="0.5" strokeDasharray="1.2 0.8" /><circle r="1.2" fill="none" stroke="#c9a24a" strokeWidth="0.4" /></g>
      {[0, 1, 2, 3].map((i) => <circle key={i} cx={w - 2.4} cy={2 + i * 1.5} r="0.45" fill="#c9a24a" />)}
    </g>;
  }
}

export function OfficeScene({ rooms, onArrive, selected, label, children }: { rooms: Room[]; onArrive: (id: string) => void; selected?: string | null; label: string; children?: ReactNode }) {
  const [pos, setPos] = useState({ x: ENTRANCE.x, y: ENTRANCE.y, a: 90, ph: 0 });
  const [moving, setMoving] = useState(false);
  const [status, setStatus] = useState("");
  const raf = useRef<number | null>(null);
  const cur = useRef({ x: ENTRANCE.x, y: ENTRANCE.y, a: 90, ph: 0 });
  const token = useRef(0);
  const arrive = useRef(onArrive); arrive.current = onArrive;
  const reduce = useRef(false);

  const walk = useCallback((path: P[], then?: () => void) => {
    const my = ++token.current;
    if (raf.current) cancelAnimationFrame(raf.current);
    if (reduce.current || !path.length) {
      const last = path[path.length - 1];
      if (last) { cur.current = { ...cur.current, x: last.x, y: last.y }; setPos({ ...cur.current }); }
      setMoving(false); then?.(); return;
    }
    let i = 0, last = performance.now();
    setMoving(true);
    const tick = (now: number) => {
      if (token.current !== my) return;
      let budget = Math.min(0.05, (now - last) / 1000) * SPEED; last = now;
      const c = cur.current;
      while (budget > 0 && i < path.length) {
        const dx = path[i].x - c.x, dy = path[i].y - c.y, d = Math.hypot(dx, dy);
        if (d < 0.001) { i++; continue; }
        const st = Math.min(d, budget);
        c.x += (dx / d) * st; c.y += (dy / d) * st; c.a = (Math.atan2(dx, -dy) * 180) / Math.PI; c.ph += st * 1.9; budget -= st;
        if (st === d) i++;
      }
      setPos({ ...c });
      if (i >= path.length) { setMoving(false); raf.current = null; then?.(); return; }
      raf.current = requestAnimationFrame(tick);
    };
    raf.current = requestAnimationFrame(tick);
  }, []);

  useEffect(() => {
    reduce.current = !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    // Arrivée : le personnage entre par la porte et s'avance dans le couloir
    walk([{ x: 50, y: LANE }]);
    return () => { token.current++; if (raf.current) cancelAnimationFrame(raf.current); };
  }, [walk]);

  const go = (r: Room) => {
    if (r.locked) return;
    const d = doorOf(r.slot), c = cur.current;
    const path: P[] = [];
    if (Math.abs(c.y - LANE) > 0.2) path.push({ x: c.x, y: LANE });
    path.push({ x: d.x, y: LANE }, { x: d.x, y: d.y });
    setStatus(`${label} : vous marchez vers ${r.label}.`);
    walk(path, () => { setStatus(`Vous êtes arrivé : ${r.label}.`); arrive.current(r.id); });
  };

  return <div className="relative mx-auto w-full max-w-4xl select-none" data-testid="office-scene">
    <div className="relative overflow-hidden rounded-2xl border border-gold/40 bg-[#0a0f1d] shadow-[0_0_60px_-20px_rgba(201,162,74,0.45)]">
      <svg viewBox="0 0 100 64" className="block h-auto w-full" aria-hidden role="presentation">
        <defs>
          <pattern id="fe-marble" width="6" height="6" patternUnits="userSpaceOnUse"><rect width="6" height="6" fill="#e9e4d8" /><path d="M0 0H6V6" fill="none" stroke="#c9c1ae" strokeWidth="0.15" /><path d="M1 5 Q3 2 5 4" fill="none" stroke="#d6cfbe" strokeWidth="0.2" /></pattern>
          <pattern id="fe-dark" width="8" height="8" patternUnits="userSpaceOnUse"><rect width="8" height="8" fill="#141d36" /><path d="M0 0H8V8" fill="none" stroke="#1f2b4d" strokeWidth="0.15" /><path d="M0 8 L8 0" stroke="#1b2644" strokeWidth="0.1" /></pattern>
          <linearGradient id="fe-gold" x1="0" x2="1"><stop offset="0" stopColor="#8a6a28" /><stop offset=".5" stopColor="#e8c77a" /><stop offset="1" stopColor="#8a6a28" /></linearGradient>
        </defs>
        {/* sol du couloir en marbre sombre et filet doré */}
        <rect x="0" y="0" width="100" height="64" fill="#070a12" />
        <rect x="0.5" y="25" width="99" height="14" fill="url(#fe-dark)" />
        <line x1="0.5" x2="99.5" y1={LANE} y2={LANE} stroke="url(#fe-gold)" strokeWidth="0.35" strokeDasharray="2.2 1.2" opacity="0.8" />
        <rect x="0.5" y="29.2" width="3.2" height="5.6" fill="#7a1d2b" /><rect x="0.5" y="29.2" width="3.2" height="5.6" fill="none" stroke="#c9a24a" strokeWidth="0.2" />
        {[14, 86].map((x) => <g key={x}><Plant x={x} y={26.6} r={1.2} /><Plant x={x} y={37.4} r={1.2} /></g>)}
        <g transform="translate(50 26.2)" opacity="0.95"><rect x="-4.5" y="-0.6" width="9" height="1.2" rx="0.3" fill="#0b1630" stroke="#c9a24a" strokeWidth="0.15" /><polyline points="-4,0.3 -2,0 0,0.25 2,-0.2 4,-0.4" fill="none" stroke="#22c55e" strokeWidth="0.18" /></g>
        {/* pièces */}
        {SLOTS.map((s, slot) => {
          const room = rooms.find((r) => r.slot === slot);
          const kind = room?.kind ?? "archives";
          const door = doorOf(slot);
          return <g key={slot} opacity={room?.locked ? 0.45 : 1}>
            <rect x={s.x} y={s.y} width={s.w} height={s.h} rx="0.8" fill="url(#fe-marble)" stroke="url(#fe-gold)" strokeWidth="0.45" />
            <g transform={`translate(${s.x} ${s.y})`}><Furniture kind={kind} w={s.w} h={s.h} /></g>
            <rect x={door.x - 3} y={s.y < LANE ? s.y + s.h - 0.3 : s.y - 0.1} width="6" height="0.5" fill="#0a0f1d" />
            <rect x={door.x - 3} y={s.y < LANE ? s.y + s.h - 0.15 : s.y} width="6" height="0.2" fill="url(#fe-gold)" />
            {selected && room?.id === selected && <rect x={s.x} y={s.y} width={s.w} height={s.h} rx="0.8" fill="none" stroke="#e8c77a" strokeWidth="0.6" />}
          </g>;
        })}
        <Walker x={pos.x} y={pos.y} a={pos.a} ph={pos.ph} moving={moving} />
      </svg>
      {/* Zones cliquables : de vrais boutons (clavier et lecteurs d'écran) posés sur chaque pièce */}
      {rooms.map((r) => {
        const s = SLOTS[r.slot];
        const style = { left: `${s.x}%`, top: `${(s.y / 64) * 100}%`, width: `${s.w}%`, height: `${(s.h / 64) * 100}%` };
        return <button key={r.id} type="button" data-testid={`zone-${r.id}`} style={style} disabled={r.locked} onClick={() => go(r)} aria-pressed={selected === r.id} aria-label={`${r.label}${r.sub ? `, ${r.sub}` : ""}${r.hint ? ` : ${r.hint}` : ""}`}
          className="group absolute rounded-md outline-none transition focus-visible:ring-2 focus-visible:ring-gold enabled:hover:bg-gold/10 disabled:cursor-not-allowed">
          <span className="pointer-events-none absolute bottom-1 left-1 right-1 flex items-end justify-between gap-1">
            <span className={`max-w-full break-words rounded bg-[#070a12]/85 px-1.5 py-0.5 text-left text-[10px] font-semibold leading-tight text-white shadow sm:text-xs ${r.locked ? "opacity-70" : ""}`}>
              <span aria-hidden>{r.icon} </span>{r.label}{r.sub && <span className="hidden truncate text-[10px] font-normal text-gold sm:block">{r.sub}</span>}
            </span>
            {r.badge ? <span className="rounded-full bg-gold px-1.5 text-[10px] font-bold text-black">{r.badge}</span> : null}
          </span>
        </button>;
      })}
      <span data-testid="walker-state" data-moving={moving ? "1" : "0"} data-x={pos.x.toFixed(1)} data-y={pos.y.toFixed(1)} className="sr-only" />
    </div>
    <p className="sr-only" role="status" aria-live="polite">{status}</p>
    {children}
  </div>;
}
