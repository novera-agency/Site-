"use client";
/** Voix des personnages (synthèse vocale) et écoute du joueur (reconnaissance vocale), via les API du navigateur. */

type Rec = { lang: string; continuous: boolean; interimResults: boolean; maxAlternatives: number; start(): void; stop(): void; abort(): void; onresult: ((e: any) => void) | null; onerror: ((e: any) => void) | null; onend: (() => void) | null; };
function recCtor(): (new () => Rec) | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as { SpeechRecognition?: new () => Rec; webkitSpeechRecognition?: new () => Rec };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}
export function voiceSupport() {
  return { tts: typeof window !== "undefined" && "speechSynthesis" in window, stt: !!recCtor() };
}

let voices: SpeechSynthesisVoice[] = [];
function loadVoices() { if (typeof window === "undefined" || !("speechSynthesis" in window)) return; voices = window.speechSynthesis.getVoices().filter((v) => v.lang.toLowerCase().startsWith("fr")); }
if (typeof window !== "undefined" && "speechSynthesis" in window) { loadVoices(); window.speechSynthesis.onvoiceschanged = loadVoices; }

const hash = (s: string) => { let h = 2166136261; for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619); return Math.abs(h); };
export interface VoiceProfile { voice?: SpeechSynthesisVoice; pitch: number; rate: number; }
/** Profil vocal stable par personnage : voix française choisie par hachage, hauteur et débit selon le rôle */
export function voiceFor(id: string, role = ""): VoiceProfile {
  if (!voices.length) loadVoices();
  const h = hash(id || "narrateur");
  const r = role.toLowerCase();
  let pitch = 0.8 + (h % 45) / 100, rate = 0.98 + ((h >> 3) % 14) / 100;
  if (r.includes("managing") || r.includes("directeur")) { pitch -= 0.08; rate -= 0.06; }
  if (r.includes("responsable du desk")) rate += 0.05;
  if (r.includes("junior")) { pitch += 0.08; rate += 0.04; }
  if (id === "narrateur") { pitch = 1; rate = 1.02; }
  return { voice: voices.length ? voices[h % voices.length] : undefined, pitch: Math.max(0.5, Math.min(1.6, pitch)), rate: Math.max(0.8, Math.min(1.25, rate)) };
}
/** Combinaisons hauteur / débit bien séparées à l'oreille */
const BANDS: [number, number][] = [[1.0, 1.0], [0.7, 0.94], [1.32, 1.06], [0.86, 1.12], [1.16, 0.9], [0.6, 1.02], [1.45, 0.98]];
export interface Cast { profile: VoiceProfile; label: string; }
/**
 * Distribution des voix d'une réunion : chaque participant reçoit une combinaison unique
 * (voix française différente si l'appareil en propose plusieurs, sinon hauteur et débit nettement différents).
 * Stable d'une réunion à l'autre pour une même personne quand c'est possible.
 */
export function voiceCast(people: { id: string; role?: string }[]): Map<string, Cast> {
  if (!voices.length) loadVoices();
  const V = Math.max(1, voices.length), slots = V * BANDS.length;
  const used: number[] = [];
  const out = new Map<string, Cast>();
  for (const p of [...people].sort((a, b) => a.id.localeCompare(b.id))) {
    const start = hash(p.id) % slots;
    const ok = (sl: number, strict: boolean) => !used.some((u) => u === sl || (strict && u % V === sl % V && Math.abs(BANDS[Math.floor(u / V)][0] - BANDS[Math.floor(sl / V)][0]) < 0.2));
    // d'abord une voix bien séparée à l'oreille, sinon au moins un réglage unique
    let slot = start;
    for (const strict of [true, false]) {
      let found = -1;
      for (let k = 0; k < slots; k++) { const sl = (start + k) % slots; if (ok(sl, strict)) { found = sl; break; } }
      if (found >= 0) { slot = found; break; }
    }
    used.push(slot);
    const [pitch, rate] = BANDS[Math.floor(slot / V)];
    const voice = voices.length ? voices[slot % V] : undefined;
    const tone = pitch < 0.8 ? "grave" : pitch > 1.2 ? "aiguë" : pitch < 0.95 ? "posée" : pitch > 1.05 ? "claire" : "médium";
    out.set(p.id, { profile: { voice, pitch, rate }, label: `${voice ? voice.name.replace(/^(Microsoft|Google)\s*/, "").split(/[-–(]/)[0].trim() + " · " : ""}${tone}` });
  }
  return out;
}

/** Sonnerie d'appel (tonalité française 425 Hz) — renvoie une promesse résolue à la fin */
export function ringTone(rings = 2): Promise<void> {
  return new Promise((resolve) => {
    try {
      const AC = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = new AC();
      const g = ctx.createGain(); g.gain.value = 0; g.connect(ctx.destination);
      const o = ctx.createOscillator(); o.frequency.value = 425; o.connect(g); o.start();
      for (let i = 0; i < rings; i++) { const t0 = ctx.currentTime + i * 1.4; g.gain.setValueAtTime(0.06, t0); g.gain.setValueAtTime(0, t0 + 0.9); }
      setTimeout(() => { o.stop(); ctx.close(); resolve(); }, rings * 1400);
    } catch { setTimeout(resolve, rings * 1400); }
  });
}

/** Prononce un texte ; la promesse se résout à la fin (ou à l'annulation) */
export function speak(text: string, p: VoiceProfile, volume = 1): Promise<void> {
  return new Promise((resolve) => {
    if (!voiceSupport().tts) return resolve();
    const u = new SpeechSynthesisUtterance(text.replace(/[«»]/g, "").replace(/\s+/g, " "));
    u.lang = p.voice?.lang ?? "fr-FR"; if (p.voice) u.voice = p.voice;
    u.pitch = p.pitch; u.rate = p.rate; u.volume = volume;
    let done = false; const end = () => { if (!done) { done = true; resolve(); } };
    u.onend = end; u.onerror = end;
    // filet de sécurité : certains navigateurs n'émettent jamais « onend »
    setTimeout(end, Math.min(30000, 1500 + text.length * 85 / p.rate));
    window.speechSynthesis.speak(u);
  });
}
export function stopSpeaking() { if (voiceSupport().tts) window.speechSynthesis.cancel(); }

export interface Listener { stop(): void; }
/** Écoute le micro en français. onText reçoit le texte provisoire puis final ; relance automatiquement jusqu'à stop(). */
export function listen(h: { onInterim: (t: string) => void; onFinal: (t: string) => void; onError: (code: string) => void }): Listener {
  const C = recCtor();
  if (!C) { h.onError("unsupported"); return { stop() {} }; }
  let stopped = false, rec: Rec | null = null;
  const start = () => {
    if (stopped) return;
    rec = new C();
    rec.lang = "fr-FR"; rec.continuous = false; rec.interimResults = true; rec.maxAlternatives = 1;
    rec.onresult = (e: any) => {
      if (stopped) return;
      let interim = "", final = "";
      for (let i = e.resultIndex; i < e.results.length; i++) { const r = e.results[i]; if (r.isFinal) final += r[0].transcript; else interim += r[0].transcript; }
      if (interim) h.onInterim(interim);
      if (final.trim()) h.onFinal(final.trim());
    };
    rec.onerror = (e: any) => { if (e?.error && e.error !== "no-speech" && e.error !== "aborted") { stopped = true; h.onError(e.error); } };
    rec.onend = () => { if (!stopped) setTimeout(start, 150); };
    try { rec.start(); } catch { setTimeout(start, 300); }
  };
  start();
  return { stop() { stopped = true; try { rec?.abort(); } catch { /* */ } } };
}
