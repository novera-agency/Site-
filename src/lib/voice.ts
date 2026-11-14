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
