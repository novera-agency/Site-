"use client";
/**
 * Ambiance sonore synthétisée (Web Audio) : nappe musicale discrète et effets d'interface.
 * Aucun fichier audio : tout est généré dans le navigateur, sans droits d'auteur.
 */
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let musicTimer: ReturnType<typeof setInterval> | null = null;
let enabled = true;

function ac() {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const AC = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AC) return null;
    ctx = new AC(); master = ctx.createGain(); master.gain.value = 0.5; master.connect(ctx.destination);
  }
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}
function tone(freq: number, start: number, dur: number, vol: number, type: OscillatorType = "sine") {
  const c = ac(); if (!c || !master) return;
  const o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0, c.currentTime + start);
  g.gain.linearRampToValueAtTime(vol, c.currentTime + start + Math.min(0.03, dur / 4));
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + dur);
  o.connect(g); g.connect(master); o.start(c.currentTime + start); o.stop(c.currentTime + start + dur + 0.05);
}
export type Sfx = "succes" | "alerte" | "critique" | "cash" | "clic" | "info";
export function sfx(kind: Sfx) {
  if (!enabled) return;
  switch (kind) {
    case "succes": tone(659, 0, 0.18, 0.08); tone(880, 0.12, 0.3, 0.08); break;
    case "cash": for (let i = 0; i < 3; i++) tone(1568 + i * 220, i * 0.06, 0.12, 0.05, "triangle"); break;
    case "alerte": tone(440, 0, 0.18, 0.07, "triangle"); tone(370, 0.2, 0.25, 0.07, "triangle"); break;
    case "critique": tone(330, 0, 0.25, 0.09, "square"); tone(330, 0.32, 0.25, 0.09, "square"); break;
    case "clic": tone(1200, 0, 0.04, 0.03); break;
    case "info": tone(784, 0, 0.12, 0.04); break;
  }
}
/** Nappe d'ambiance : accords lents et doux (progression jazz feutrée), très bas volume */
const CHORDS = [[220, 277.2, 329.6, 415.3], [196, 246.9, 293.7, 370], [174.6, 220, 261.6, 329.6], [196, 246.9, 311.1, 392]];
export function startMusic() {
  if (!enabled || musicTimer) return;
  let i = 0;
  const play = () => { const ch = CHORDS[i++ % CHORDS.length]; ch.forEach((f, k) => tone(f, k * 0.04, 7.5, 0.012, "sine")); tone(ch[0] / 2, 0, 7.5, 0.016, "sine"); };
  play();
  musicTimer = setInterval(play, 7000);
}
export function stopMusic() { if (musicTimer) { clearInterval(musicTimer); musicTimer = null; } }
export function setSoundEnabled(on: boolean) { enabled = on; if (!on) stopMusic(); }
export function soundEnabled() { return enabled; }
