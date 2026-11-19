import { type Avatar, SKINS, HAIR_COLORS, SUITS, SHIRTS, TIES, EYES, GLASSES } from "@/engine/avatar";

/** Portrait 2D de l'avatar du joueur (buste) : utilisé dans les menus, réunions et messages */
export function AvatarPortrait({ avatar, size = 40, title }: { avatar: Avatar; size?: number; title?: string }) {
  const skin = SKINS[avatar.skin].color!, hair = HAIR_COLORS[avatar.hairColor].color!, suit = SUITS[avatar.suit].color!, shirt = SHIRTS[avatar.shirt].color!, eye = EYES[avatar.eyes].color!;
  const tie = TIES[avatar.tie], gl = GLASSES[avatar.glasses];
  const rx = [11.5, 12.5, 10.5][avatar.face], ry = [14, 13, 15.5][avatar.face];
  const brow = [0.8, 1.3, 2][avatar.brows];
  return (
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label={title ?? "Votre avatar"} className="shrink-0 rounded-full ring-1 ring-gold/60">
      <circle cx="32" cy="32" r="32" fill="#1b2438" />
      <path d={avatar.build === 2 ? "M5 64 Q8 45 32 43 Q56 45 59 64 Z" : avatar.build === 0 ? "M12 64 Q14 46 32 44 Q50 46 52 64 Z" : "M8 64 Q11 46 32 44 Q53 46 56 64 Z"} fill={suit} />
      <path d="M26 44 L32 53 L38 44 Z" fill={shirt} />
      {avatar.tie > 0 && (avatar.tie === 6
        ? <path d="M27 47 L32 49 L27 51 Z M37 47 L32 49 L37 51 Z" fill={tie.color} />
        : <path d="M31 47 L33 47 L34.5 58 L32 62 L29.5 58 Z" fill={tie.color} />)}
      {avatar.pocket && <path d="M44 51 L49 50.5 L49 53 L44 53 Z" fill="#f6f3ec" />}
      <path d="M22 46 L27 44 L32 54 L26 58 Z M42 46 L37 44 L32 54 L38 58 Z" fill={suit} opacity="0.9" stroke="#ffffff22" strokeWidth="0.4" />
      <rect x="28" y="36" width="8" height="9" rx="3" fill={skin} />
      <ellipse cx="32" cy="28" rx={rx} ry={ry} fill={skin} />
      {avatar.hair === 1 && <path d="M19.5 27 Q18 11 32 11 Q46 11 44.5 27 Q43 18 32 17.5 Q21 18 19.5 27 Z" fill={hair} />}
      {avatar.hair === 2 && <path d="M19.5 27 Q18 10 31 10.5 Q45 11 44.5 27 Q43 18 34 16 Q24 17 19.5 27 Z M22 17 Q28 11 38 14 Q30 12 22 17 Z" fill={hair} />}
      {avatar.hair === 3 && <path d="M19 29 Q16 9 32 9 Q48 9 45 29 Q44 17 32 16 Q20 17 19 29 Z" fill={hair} />}
      {avatar.hair === 4 && <path d="M19.5 27 Q18 9 32 9 Q46 9 44.5 27 Q44 17 32 17 Q22 17 19.5 27 Z M25 13 Q32 5 40 12 Q33 11 25 13 Z" fill={hair} />}
      {avatar.hair === 5 && <path d="M18.5 31 Q16 9 32 9 Q48 9 45.5 31 Q47 42 43 46 L42 28 Q40 17 32 17 Q24 17 22 28 L21 46 Q17 42 18.5 31 Z" fill={hair} />}
      {avatar.hair === 6 && <path d="M20 26 Q19 18 22 14 Q20 24 23 30 Z M44 26 Q45 18 42 14 Q44 24 41 30 Z" fill={hair} />}
      {avatar.age === 2 && avatar.hair !== 0 && avatar.hair !== 6 && <path d="M20 26 Q19 22 21 20 Q21 24 22 28 Z M44 26 Q45 22 43 20 Q43 24 42 28 Z" fill="#c9ccd2" opacity="0.6" />}
      <circle cx="27" cy="28" r="1.5" fill="#fff" /><circle cx="37" cy="28" r="1.5" fill="#fff" />
      <circle cx="27" cy="28.1" r="1" fill={eye} /><circle cx="37" cy="28.1" r="1" fill={eye} />
      <path d="M24.5 24.2 L29.5 24" stroke={hair} strokeWidth={brow} strokeLinecap="round" /><path d="M34.5 24 L39.5 24.2" stroke={hair} strokeWidth={brow} strokeLinecap="round" />
      <path d="M32 29 L31 33 L33 33" stroke="#00000030" strokeWidth="0.8" fill="none" />
      <path d="M28.5 36 Q32 38 35.5 36" stroke="#7c2d12" strokeWidth="1.1" fill="none" strokeLinecap="round" />
      {avatar.beard === 1 && <path d="M21.5 32 Q24 44 32 44 Q40 44 42.5 32 Q40 40 32 40 Q24 40 21.5 32 Z" fill={hair} opacity="0.4" />}
      {avatar.beard === 2 && <path d="M29 40 Q32 46 35 40 Q32 42 29 40 Z M28 34.5 Q32 33 36 34.5 Q32 35.5 28 34.5 Z" fill={hair} />}
      {avatar.beard === 3 && <path d="M21.5 31 Q23 43 32 43.5 Q41 43 42.5 31 Q40 39 32 39 Q24 39 21.5 31 Z M28 34.5 Q32 33 36 34.5 Q32 36 28 34.5 Z" fill={hair} />}
      {avatar.beard === 4 && <path d="M20.5 30 Q21 47 32 47.5 Q43 47 43.5 30 Q40 40 32 40 Q24 40 20.5 30 Z M27.5 34.5 Q32 32.5 36.5 34.5 Q32 36.5 27.5 34.5 Z" fill={hair} />}
      {avatar.glasses === 2 ? <g stroke={gl.color} strokeWidth="1.1" fill="none"><rect x="22.5" y="25.5" width="9" height="6" rx="1.5" /><rect x="32.5" y="25.5" width="9" height="6" rx="1.5" /><path d="M31.5 28 L32.5 28" /></g>
        : avatar.glasses > 0 ? <g stroke={gl.color} strokeWidth="1" fill="none"><circle cx="27" cy="28" r="4.2" /><circle cx="37" cy="28" r="4.2" /><path d="M31.2 27.5 L32.8 27.5" /></g> : null}
    </svg>
  );
}
