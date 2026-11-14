/**
 * Générateur pseudo-aléatoire déterministe (sfc32) dont l'état est sérialisable.
 * Toute la simulation tire ses aléas de cette source → reproductibilité par graine.
 */
export interface RngState { a: number; b: number; c: number; d: number; }

export function seedRng(seed: number | string): RngState {
  let h = 1779033703 ^ String(seed).length;
  const s = String(seed);
  for (let i = 0; i < s.length; i++) {
    h = Math.imul(h ^ s.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  const next = () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return (h ^= h >>> 16) >>> 0;
  };
  const st = { a: next(), b: next(), c: next(), d: next() };
  const r = new Rng(st);
  for (let i = 0; i < 15; i++) r.next();
  return r.state;
}

export class Rng {
  constructor(public state: RngState) {}
  /** Uniforme [0,1) */
  next(): number {
    let { a, b, c, d } = this.state;
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    this.state.a = a; this.state.b = b; this.state.c = c; this.state.d = d;
    return (t >>> 0) / 4294967296;
  }
  range(min: number, max: number) { return min + (max - min) * this.next(); }
  int(min: number, maxInclusive: number) { return Math.floor(this.range(min, maxInclusive + 1)); }
  chance(p: number) { return this.next() < p; }
  pick<T>(arr: readonly T[]): T { return arr[Math.floor(this.next() * arr.length)]; }
  /** Loi normale centrée réduite (Box-Muller) */
  normal(): number {
    let u = 0, v = 0;
    while (u === 0) u = this.next();
    while (v === 0) v = this.next();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }
  /** Loi de Student approchée (queues épaisses) */
  fatTail(df = 4): number {
    let chi = 0;
    for (let i = 0; i < df; i++) { const z = this.normal(); chi += z * z; }
    return this.normal() / Math.sqrt(chi / df) * Math.sqrt((df - 2) / df);
  }
  weighted<T>(items: readonly { item: T; w: number }[]): T {
    const tot = items.reduce((s, i) => s + i.w, 0);
    let x = this.next() * tot;
    for (const it of items) { x -= it.w; if (x <= 0) return it.item; }
    return items[items.length - 1].item;
  }
}
