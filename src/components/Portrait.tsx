/** Portrait dessiné, propre à chaque personnage (déterminé par son identifiant) : visage, coiffure, lunettes, tenue */
const SKIN = ["#f6d3b8", "#eac09b", "#d9a273", "#b97c4f", "#8d5a37", "#5e3b22"];
const HAIR = ["#1f1a17", "#3b2a20", "#6b4a2f", "#a87b4f", "#d7b46a", "#8c8c8c", "#e3e3e3", "#7a2e1d"];
const SUIT = ["#1e293b", "#0f172a", "#334155", "#1e3a8a", "#3f2a14", "#14532d", "#4c1d95", "#7f1d1d"];
const BG = ["#1e293b", "#172554", "#1c1917", "#042f2e", "#2e1065", "#3b0764", "#422006"];
function h(s: string) { let x = 2166136261; for (const c of s) x = Math.imul(x ^ c.charCodeAt(0), 16777619); return x >>> 0; }

export function Portrait({ id, size = 40, active = false, title }: { id: string; size?: number; active?: boolean; title?: string }) {
  const n = h(id);
  const pick = <T,>(a: T[], k: number) => a[(n >>> k) % a.length];
  const skin = pick(SKIN, 1), hair = pick(HAIR, 4), suit = pick(SUIT, 8), bg = pick(BG, 12);
  const style = (n >>> 16) % 6, glasses = (n >>> 20) % 4 === 0, tie = (n >>> 22) % 3 !== 0, beard = (n >>> 24) % 5 === 0;
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label={title ?? "Portrait"} className={`shrink-0 rounded-full ${active ? "ring-2 ring-gold" : ""}`}>
      <circle cx="32" cy="32" r="32" fill={bg} />
      {style === 4 && <path d="M14 34 Q12 54 20 60 L44 60 Q52 54 50 34 Z" fill={hair} />}
      <path d="M10 64 Q12 46 32 44 Q52 46 54 64 Z" fill={suit} />
      <path d="M27 44 L32 52 L37 44 Z" fill="#f8fafc" />
      {tie && <path d="M31 47 L33 47 L34 58 L32 61 L30 58 Z" fill={pick(["#b91c1c", "#1d4ed8", "#a16207", "#065f46"], 26)} />}
      <rect x="28" y="36" width="8" height="9" rx="3" fill={skin} />
      <ellipse cx="32" cy="28" rx="12" ry="14" fill={skin} />
      {style === 0 && <path d="M20 24 Q22 12 32 12 Q42 12 44 24 Q40 18 32 18 Q24 18 20 24 Z" fill={hair} />}
      {style === 1 && <path d="M19 28 Q18 11 32 11 Q46 11 45 28 Q43 17 32 17 Q22 17 19 28 Z" fill={hair} />}
      {style === 2 && <path d="M20 22 Q26 13 34 14 Q42 15 44 22 L44 18 Q40 10 30 11 Q21 13 20 22 Z" fill={hair} />}
      {style === 3 && <><path d="M19 30 Q17 10 32 10 Q47 10 45 30 Q44 18 32 17 Q20 18 19 30 Z" fill={hair} /><path d="M19 28 Q17 40 21 44 L22 30 Z M45 28 Q47 40 43 44 L42 30 Z" fill={hair} /></>}
      {style === 4 && <path d="M20 26 Q20 12 32 12 Q44 12 44 26 Q40 17 32 17 Q24 17 20 26 Z" fill={hair} />}
      {style === 5 && <path d="M21 21 Q32 15 43 21 Q42 16 32 15 Q22 16 21 21 Z" fill={hair} opacity="0.7" />}
      <circle cx="27" cy="28" r="1.4" fill="#1f2937" /><circle cx="37" cy="28" r="1.4" fill="#1f2937" />
      <path d="M28 35 Q32 37.5 36 35" stroke="#7c2d12" strokeWidth="1.2" fill="none" strokeLinecap="round" />
      {beard && <path d="M22 32 Q24 43 32 43 Q40 43 42 32 Q40 39 32 39 Q24 39 22 32 Z" fill={hair} opacity="0.85" />}
      {glasses && <g stroke="#111827" strokeWidth="1.1" fill="none"><circle cx="27" cy="28" r="3.6" /><circle cx="37" cy="28" r="3.6" /><path d="M30.6 28 L33.4 28" /></g>}
    </svg>
  );
}
