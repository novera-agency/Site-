"use client";
/**
 * Petits retours sonores d'interface (Web Audio), uniquement lors d'une notification : aucun son de fond, ni musique, ni mélodie, ni instrument.
 * Aucun fichier audio : tout est généré dans le navigateur.
 */
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let enabled = true;
import { notifOn } from "./sound-prefs";

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
/** Bruit blanc bouclé (base de tous les sons : aucun son tonal) */
let noiseBuf: AudioBuffer | null = null;
function noise(c: AudioContext) {
  if (!noiseBuf) { noiseBuf = c.createBuffer(1, c.sampleRate * 3, c.sampleRate); const d = noiseBuf.getChannelData(0); for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }
  const s = c.createBufferSource(); s.buffer = noiseBuf; s.loop = true; return s;
}
/** Petit bruit bref (tapotement) : filtre passe-bande sur du bruit, sans hauteur de note */
function tap(start: number, dur: number, vol: number, freq = 1800, q = 0.7) {
  const c = ac(); if (!c || !master) return;
  const s = noise(c), f = c.createBiquadFilter(), g = c.createGain();
  f.type = "bandpass"; f.frequency.value = freq; f.Q.value = q;
  g.gain.setValueAtTime(0, c.currentTime + start);
  g.gain.linearRampToValueAtTime(vol, c.currentTime + start + 0.006);
  g.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + start + dur);
  s.connect(f); f.connect(g); g.connect(master); s.start(c.currentTime + start); s.stop(c.currentTime + start + dur + 0.05);
}
export type Sfx = "succes" | "alerte" | "critique" | "cash" | "clic" | "info";
/** Retours sonores sans mélodie : un tapotement = information, deux = alerte, trois = urgence, un souffle doux = réussite */
export function sfx(kind: Sfx) {
  if (!enabled || !notifOn()) return;
  switch (kind) {
    case "succes": tap(0, 0.35, 0.09, 2600, 0.5); break;
    case "cash": tap(0, 0.07, 0.07, 3500, 1.2); tap(0.08, 0.07, 0.07, 3500, 1.2); tap(0.16, 0.1, 0.07, 3500, 1.2); break;
    case "alerte": tap(0, 0.12, 0.12, 900, 1); tap(0.22, 0.12, 0.12, 900, 1); break;
    case "critique": tap(0, 0.14, 0.16, 600, 1); tap(0.24, 0.14, 0.16, 600, 1); tap(0.48, 0.14, 0.16, 600, 1); break;
    case "clic": tap(0, 0.025, 0.05, 2200, 1.5); break;
    case "info": tap(0, 0.09, 0.07, 1500, 0.9); break;
  }
}
export function setSoundEnabled(on: boolean) { enabled = on; }
export function soundEnabled() { return enabled; }
