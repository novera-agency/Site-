"use client";
/**
 * Ambiance sonore synthétisée (Web Audio) : bruits de nature (pluie douce, vent) et petits bruits d'interface.
 * Ni musique, ni mélodie, ni instrument. Aucun fichier audio : tout est généré dans le navigateur.
 */
let ctx: AudioContext | null = null;
let master: GainNode | null = null;
let ambience: { gain: GainNode; stop: () => void } | null = null;
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
  if (!enabled) return;
  switch (kind) {
    case "succes": tap(0, 0.35, 0.09, 2600, 0.5); break;
    case "cash": tap(0, 0.07, 0.07, 3500, 1.2); tap(0.08, 0.07, 0.07, 3500, 1.2); tap(0.16, 0.1, 0.07, 3500, 1.2); break;
    case "alerte": tap(0, 0.12, 0.12, 900, 1); tap(0.22, 0.12, 0.12, 900, 1); break;
    case "critique": tap(0, 0.14, 0.16, 600, 1); tap(0.24, 0.14, 0.16, 600, 1); tap(0.48, 0.14, 0.16, 600, 1); break;
    case "clic": tap(0, 0.025, 0.05, 2200, 1.5); break;
    case "info": tap(0, 0.09, 0.07, 1500, 0.9); break;
  }
}
/** Ambiance de nature : pluie très douce et vent lent, en boucle, à bas volume (aucun instrument) */
export function startMusic() {
  if (!enabled || ambience) return;
  const c = ac(); if (!c || !master) return;
  const out = c.createGain(); out.gain.value = 0; out.connect(master);
  out.gain.linearRampToValueAtTime(1, c.currentTime + 4);
  // Pluie : bruit filtré, légèrement variable
  const rain = noise(c), rhp = c.createBiquadFilter(), rlp = c.createBiquadFilter(), rg = c.createGain();
  rhp.type = "highpass"; rhp.frequency.value = 1400; rlp.type = "lowpass"; rlp.frequency.value = 6500; rg.gain.value = 0.022;
  rain.connect(rhp); rhp.connect(rlp); rlp.connect(rg); rg.connect(out); rain.start();
  // Vent : bruit passe-bande dont la fréquence et le volume ondulent très lentement
  const wind = noise(c), wf = c.createBiquadFilter(), wg = c.createGain();
  wf.type = "bandpass"; wf.frequency.value = 420; wf.Q.value = 0.7; wg.gain.value = 0.03;
  const l1 = c.createOscillator(), l1g = c.createGain(); l1.frequency.value = 0.06; l1g.gain.value = 180; l1.connect(l1g); l1g.connect(wf.frequency);
  const l2 = c.createOscillator(), l2g = c.createGain(); l2.frequency.value = 0.09; l2g.gain.value = 0.015; l2.connect(l2g); l2g.connect(wg.gain);
  wind.connect(wf); wf.connect(wg); wg.connect(out); wind.start(); l1.start(); l2.start();
  ambience = { gain: out, stop: () => { try { rain.stop(); wind.stop(); l1.stop(); l2.stop(); } catch { /* déjà arrêté */ } out.disconnect(); } };
}
export function stopMusic() {
  if (!ambience) return;
  const a = ambience; ambience = null;
  const c = ctx; if (c) { a.gain.gain.cancelScheduledValues(c.currentTime); a.gain.gain.setValueAtTime(a.gain.gain.value, c.currentTime); a.gain.gain.linearRampToValueAtTime(0, c.currentTime + 0.6); setTimeout(a.stop, 700); } else a.stop();
}
export function setSoundEnabled(on: boolean) { enabled = on; if (!on) stopMusic(); }
export function soundEnabled() { return enabled; }
