/**
 * Avatar du joueur : un homme en costume parfaitement ajusté, entièrement personnalisable.
 * Les choix sont de simples indices (sérialisables, validés côté serveur)  ; le portrait 2D les interprète (AvatarPortrait).
 * Certains costumes et accessoires se débloquent avec le grade.
 */
export interface Avatar {
  /** Teint (0 très clair … 5 très foncé) */
  skin: number;
  /** Visage : forme (ovale, carré, allongé), nez, couleur des yeux, sourcils, âge apparent */
  face: number; nose: number; eyes: number; brows: number; age: number;
  /** Cheveux : coiffure et couleur ; barbe */
  hair: number; hairColor: number; beard: number;
  /** Silhouette */
  build: number; height: number;
  /** Tenue */
  suit: number; shirt: number; tie: number; pocket: boolean; glasses: number; watch: number; cufflinks: boolean;
}

export interface Opt { label: string; color?: string; unlock?: number }

export const SKINS: Opt[] = [
  { label: "Porcelaine", color: "#f1d3bd" }, { label: "Clair", color: "#e3b896" }, { label: "Hâlé", color: "#c9946b" },
  { label: "Mat", color: "#a8734a" }, { label: "Brun", color: "#7b4f33" }, { label: "Ébène", color: "#4b2e1f" },
];
export const FACES: Opt[] = [{ label: "Ovale" }, { label: "Carré" }, { label: "Allongé" }];
export const NOSES: Opt[] = [{ label: "Droit" }, { label: "Fin" }, { label: "Marqué" }];
export const EYES: Opt[] = [{ label: "Bruns", color: "#4a2d1a" }, { label: "Noisette", color: "#7a5a2a" }, { label: "Bleus", color: "#3b6ea8" }, { label: "Verts", color: "#3f7a55" }];
export const BROWS: Opt[] = [{ label: "Fins" }, { label: "Naturels" }, { label: "Épais" }];
export const AGES: Opt[] = [{ label: "Jeune" }, { label: "Adulte" }, { label: "Mûr" }];
export const HAIRS: Opt[] = [{ label: "Rasé" }, { label: "Court" }, { label: "Raie sur le côté" }, { label: "Gominé en arrière" }, { label: "Banane" }, { label: "Mi-long" }, { label: "Dégarni" }];
export const HAIR_COLORS: Opt[] = [
  { label: "Noir", color: "#15110e" }, { label: "Brun foncé", color: "#2d1d12" }, { label: "Châtain", color: "#5a3d26" }, { label: "Blond", color: "#b8924f" },
  { label: "Roux", color: "#8a3f1d" }, { label: "Poivre et sel", color: "#7d7d80" }, { label: "Argent", color: "#c9ccd2" },
];
export const BEARDS: Opt[] = [{ label: "Rasé de près" }, { label: "Barbe de trois jours" }, { label: "Bouc" }, { label: "Moustache" }, { label: "Barbe fournie" }];
export const BUILDS: Opt[] = [{ label: "Mince" }, { label: "Athlétique" }, { label: "Costaud" }];
export const HEIGHTS: Opt[] = [{ label: "Moyen" }, { label: "Grand" }, { label: "Très grand" }];
export const SUITS: Opt[] = [
  { label: "Bleu marine", color: "#1c2a4a" }, { label: "Anthracite", color: "#34383f" }, { label: "Gris perle", color: "#8d939c" },
  { label: "Bleu nuit", color: "#121c36", unlock: 1 }, { label: "Noir", color: "#0e0f12", unlock: 2 }, { label: "Craie rayé", color: "#2c3350", unlock: 3 },
  { label: "Bordeaux profond", color: "#3d1620", unlock: 4 }, { label: "Sable", color: "#b7a083", unlock: 5 },
];
export const SHIRTS: Opt[] = [{ label: "Blanche", color: "#f4f1ea" }, { label: "Bleu ciel", color: "#bcd3ea" }, { label: "Rose pâle", color: "#ecd2d0" }, { label: "Ivoire", color: "#e8dfc9", unlock: 2 }];
export const TIES: Opt[] = [
  { label: "Aucune" }, { label: "Bordeaux", color: "#7a1d2b" }, { label: "Bleu royal", color: "#1e4fa0" }, { label: "Or", color: "#c9a24a", unlock: 2 },
  { label: "Vert sapin", color: "#1f5a3d", unlock: 1 }, { label: "Noire", color: "#0b0b0e" }, { label: "Nœud papillon", color: "#7a1d2b", unlock: 3 },
];
export const GLASSES: Opt[] = [{ label: "Aucune" }, { label: "Rondes fines", color: "#c9a24a" }, { label: "Rectangulaires", color: "#1b1b1f" }, { label: "Écaille", color: "#6b3f1d", unlock: 1 }];
export const WATCHES: Opt[] = [{ label: "Aucune" }, { label: "Acier", color: "#b9bec8", unlock: 1 }, { label: "Or", color: "#e0b84a", unlock: 4 }];

const N = (l: Opt[]) => l.length;
const RANGES: Record<string, number> = {
  skin: N(SKINS), face: N(FACES), nose: N(NOSES), eyes: N(EYES), brows: N(BROWS), age: N(AGES), hair: N(HAIRS), hairColor: N(HAIR_COLORS), beard: N(BEARDS),
  build: N(BUILDS), height: N(HEIGHTS), suit: N(SUITS), shirt: N(SHIRTS), tie: N(TIES), glasses: N(GLASSES), watch: N(WATCHES),
};
/** Grade minimal pour boutons de manchette et pochette */
export const POCKET_UNLOCK = 1, CUFFLINKS_UNLOCK = 2;

export const defaultAvatar = (): Avatar => ({
  skin: 1, face: 0, nose: 0, eyes: 0, brows: 1, age: 1, hair: 3, hairColor: 1, beard: 0, build: 1, height: 1,
  suit: 0, shirt: 0, tie: 1, pocket: false, glasses: 0, watch: 0, cufflinks: false,
});

/** Table des listes par clé d'indice (utilisée par l'interface de personnalisation) */
export const AVATAR_LISTS: Record<string, Opt[]> = {
  skin: SKINS, face: FACES, nose: NOSES, eyes: EYES, brows: BROWS, age: AGES, hair: HAIRS, hairColor: HAIR_COLORS, beard: BEARDS,
  build: BUILDS, height: HEIGHTS, suit: SUITS, shirt: SHIRTS, tie: TIES, glasses: GLASSES, watch: WATCHES,
};

/** Valide une apparence (indices entiers dans les bornes, booléens) ; renvoie null si invalide */
export function parseAvatar(a: unknown): Avatar | null {
  if (!a || typeof a !== "object") return null;
  const o = a as Record<string, unknown>, out: Record<string, unknown> = {};
  for (const [k, n] of Object.entries(RANGES)) { const v = o[k]; if (typeof v !== "number" || !Number.isInteger(v) || v < 0 || v >= n) return null; out[k] = v; }
  for (const k of ["pocket", "cufflinks"]) { if (typeof o[k] !== "boolean") return null; out[k] = o[k]; }
  return out as unknown as Avatar;
}

/** Éléments que le grade ne permet pas encore de porter (liste de messages ; vide = tout est autorisé) */
export function lockedParts(a: Avatar, rank: number): string[] {
  const out: string[] = [];
  const chk = (key: string, list: Opt[], v: number) => { const u = list[v]?.unlock ?? 0; if (u > rank) out.push(`${list[v].label} (grade ${u})`); };
  chk("suit", SUITS, a.suit); chk("shirt", SHIRTS, a.shirt); chk("tie", TIES, a.tie); chk("glasses", GLASSES, a.glasses); chk("watch", WATCHES, a.watch);
  if (a.pocket && rank < POCKET_UNLOCK) out.push(`Pochette (grade ${POCKET_UNLOCK})`);
  if (a.cufflinks && rank < CUFFLINKS_UNLOCK) out.push(`Boutons de manchette (grade ${CUFFLINKS_UNLOCK})`);
  return out;
}
/** Remet à une valeur de départ ce que le grade ne permet pas encore */
export function clampToRank(a: Avatar, rank: number): Avatar {
  const d = defaultAvatar(), r = { ...a };
  for (const [k, l] of [["suit", SUITS], ["shirt", SHIRTS], ["tie", TIES], ["glasses", GLASSES], ["watch", WATCHES]] as const) if ((l[r[k]]?.unlock ?? 0) > rank) r[k] = d[k];
  if (rank < POCKET_UNLOCK) r.pocket = false;
  if (rank < CUFFLINKS_UNLOCK) r.cufflinks = false;
  return r;
}

