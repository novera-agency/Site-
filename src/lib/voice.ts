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
let allVoices: SpeechSynthesisVoice[] = [];
const isFr = (v: SpeechSynthesisVoice) => v.lang.toLowerCase().replace("_", "-").startsWith("fr");
/** Qualité perçue d'une voix : les voix « Natural / Neural » (Edge), « Premium / Améliorée » (Apple) et Google passent devant */
export function voiceQuality(v: SpeechSynthesisVoice): { score: number; label: "naturelle" | "premium" | "bonne" | "standard" | "basique" } {
  const n = v.name.toLowerCase();
  if (/natural|neural|naturelle/.test(n)) return { score: 100, label: "naturelle" };
  if (/premium|enhanced|améliorée|amelioree|siri/.test(n)) return { score: 85, label: "premium" };
  if (/google/.test(n)) return { score: 60, label: "bonne" };
  if (/compact|eddy|flo|grandma|grandpa|reed|rocko|sandy|shelley|jacques|bad news|bells|bubbles|cellos|good news|jester|organ|superstar|trinoids|whisper|wobble|zarvox|albert|fred|junior|kathy|ralph/.test(n)) return { score: 5, label: "basique" };
  return { score: v.localService ? 40 : 30, label: "standard" };
}
const PREF_KEY = "fe_voices";
/** Voix choisies par le joueur dans les paramètres (identifiants, dans l'ordre) */
export function preferredVoices(): string[] { try { return JSON.parse(localStorage.getItem(PREF_KEY) ?? "[]"); } catch { return []; } }
export function setPreferredVoices(uris: string[]) { try { localStorage.setItem(PREF_KEY, JSON.stringify(uris)); } catch { /* */ } loadVoices(); }
/** Voix françaises classées de la plus naturelle à la plus robotique ; les choix du joueur passent en premier */
function loadVoices() {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  allVoices = window.speechSynthesis.getVoices();
  const fr = allVoices.filter(isFr).sort((x, y) => voiceQuality(y).score - voiceQuality(x).score || (x.lang === "fr-FR" ? -1 : 1));
  const pref = preferredVoices().map((u) => fr.find((v) => v.voiceURI === u)).filter(Boolean) as SpeechSynthesisVoice[];
  const good = fr.filter((v) => voiceQuality(v).score >= 30);
  voices = pref.length ? pref : good.length ? good : fr;
}
/** Liste des voix françaises disponibles, pour l'écran de choix */
export function frenchVoices() { loadVoices(); const pref = preferredVoices(); return allVoices.filter(isFr).sort((x, y) => voiceQuality(y).score - voiceQuality(x).score).map((v) => ({ uri: v.voiceURI, name: v.name, lang: v.lang, local: v.localService, quality: voiceQuality(v).label, chosen: pref.includes(v.voiceURI) })); }
export function voiceByUri(uri: string) { loadVoices(); return allVoices.find((v) => v.voiceURI === uri); }
/** Journal des événements de synthèse vocale (affiché dans le test du son) */
export const voiceDiag: string[] = [];
function diag(t: string) { voiceDiag.push(`${new Date().toLocaleTimeString("fr-FR")} ${t}`); if (voiceDiag.length > 40) voiceDiag.shift(); }
export function voiceInventory() { loadVoices(); return { total: allVoices.length, fr: allVoices.filter((v) => v.lang.toLowerCase().startsWith("fr")).map((v) => `${v.name} (${v.lang}${v.localService ? ", installée" : ", en ligne"})`), used: voices.map((v) => v.name) }; }
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
  if (id === "narrateur") return { voice: voices[0], pitch: 1, rate: 1 };
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
  const V = voices.length;
  const out = new Map<string, Cast>();
  const sorted = [...people].sort((a, b) => a.id.localeCompare(b.id));
  sorted.forEach((p, i) => {
    // Une voix différente par personne, des plus naturelles aux moins naturelles ; on ne joue sur la hauteur
    // et le débit que lorsqu'il faut réutiliser une voix (ou qu'il n'y en a aucune)
    const voice = V ? voices[i % V] : undefined;
    const round = V ? Math.floor(i / V) : i;
    const natural = !!voice && voiceQuality(voice).score >= 60;
    let [pitch, rate] = BANDS[round % BANDS.length];
    if (natural) { pitch = 1 + (pitch - 1) * 0.35; rate = 1 + (rate - 1) * 0.5; } // les voix naturelles se déforment vite : variations douces
    pitch = Math.round(pitch * 100) / 100; rate = Math.round(rate * 100) / 100;
    const tone = pitch < 0.8 ? "grave" : pitch > 1.2 ? "aiguë" : pitch < 0.95 ? "posée" : pitch > 1.05 ? "claire" : "naturelle";
    out.set(p.id, { profile: { voice, pitch, rate }, label: `${voice ? voice.name.replace(/^(Microsoft|Google)\s*/, "").replace(/\s*Online.*$/, "").split(/[-–(]/)[0].trim() + " · " : ""}${tone}` });
  });
  return out;
}

/** Sonnerie d'appel (tonalité française 425 Hz) — renvoie une promesse résolue à la fin */
export function ringTone(rings = 2): Promise<void> {
  return new Promise((resolve) => {
    try {
      const AC = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      const ctx = audioCtx && audioCtx.state !== "closed" ? audioCtx : new AC();
      void ctx.resume();
      const g = ctx.createGain(); g.gain.value = 0; g.connect(ctx.destination);
      const o = ctx.createOscillator(); o.frequency.value = 425; o.connect(g); o.start();
      for (let i = 0; i < rings; i++) { const t0 = ctx.currentTime + i * 1.4; g.gain.setValueAtTime(0.06, t0); g.gain.setValueAtTime(0, t0 + 0.9); }
      setTimeout(() => { o.stop(); o.disconnect(); g.disconnect(); if (ctx !== audioCtx) void ctx.close(); resolve(); }, rings * 1400);
    } catch { setTimeout(resolve, rings * 1400); }
  });
}

/**
 * Débloque le son : à appeler directement dans un clic / toucher (iOS et Android exigent un geste
 * de l'utilisateur avant toute synthèse vocale ou sonnerie).
 */
let unlocked = false;
export function unlockAudio() {
  if (typeof window === "undefined") return;
  try {
    const ss = window.speechSynthesis;
    if (ss) { ss.resume(); const u = new SpeechSynthesisUtterance("."); u.volume = 0.01; u.rate = 2; u.lang = "fr-FR"; ss.speak(u); }
    const AC = (window as unknown as { AudioContext?: typeof AudioContext; webkitAudioContext?: typeof AudioContext }).AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (AC) { audioCtx = audioCtx ?? new AC(); void audioCtx.resume(); }
    unlocked = true;
  } catch { /* */ }
}
export function audioUnlocked() { return unlocked; }
// premier toucher / clic n'importe où sur la page : on débloque le son une fois pour toutes
if (typeof window !== "undefined") {
  const once = () => { if (!unlocked) unlockAudio(); if (unlocked) { window.removeEventListener("pointerdown", once, true); window.removeEventListener("keydown", once, true); } };
  window.addEventListener("pointerdown", once, true); window.addEventListener("keydown", once, true);
}
let audioCtx: AudioContext | null = null;

// Chrome libère parfois l'énoncé avant sa fin (onend jamais appelé) : on garde une référence
const alive = new Set<SpeechSynthesisUtterance>();
/** Découpe en phrases courtes : Chrome coupe les énoncés de plus de ~15 secondes */
function chunks(text: string): string[] {
  const parts = text.match(/[^.!?…;:]+[.!?…;:]*/g) ?? [text];
  const out: string[] = [];
  for (const raw of parts) { const t = raw.trim(); if (!t) continue; if (out.length && (out[out.length - 1].length + t.length) < 160) out[out.length - 1] += " " + t; else out.push(t); }
  return out.length ? out : [text];
}
/** Signalé quand le navigateur refuse de parler (son bloqué) */
export type SpeakResult = "ok" | "blocked" | "cancelled";
let cancelGen = 0;
let lastCancel = 0;
function speakOne(text: string, p: VoiceProfile, volume: number, gen: number, retry = false): Promise<SpeakResult> {
  return new Promise((resolve) => {
    const ss = window.speechSynthesis;
    const u = new SpeechSynthesisUtterance(text);
    const voice = retry ? undefined : p.voice;
    u.lang = voice?.lang ?? "fr-FR";
    if (voice) { try { u.voice = voice; } catch { diag("✖ voix refusée par le navigateur, voix par défaut"); } }
    u.pitch = p.pitch; u.rate = p.rate; u.volume = volume;
    let started = false, done = false;
    const finish = (r: SpeakResult) => { if (done) return; done = true; alive.delete(u); clearInterval(keep); clearTimeout(noStart); clearTimeout(cap); resolve(r); };
    u.onstart = () => { started = true; diag(`▶ lecture (${voice?.name ?? "voix par défaut"})`); };
    u.onend = () => { diag("■ fin"); finish(gen === cancelGen ? "ok" : "cancelled"); };
    u.onerror = (e) => {
      const code = (e as SpeechSynthesisErrorEvent).error;
      diag(`✖ erreur « ${code} » (${voice?.name ?? "voix par défaut"})`);
      if (code === "not-allowed") return finish("blocked");
      if (code === "interrupted" || code === "canceled" || gen !== cancelGen) return finish("cancelled");
      // Voix indisponible (souvent une voix « en ligne ») : on réessaie avec la voix par défaut du système
      if (!retry && voice) { done = true; alive.delete(u); clearInterval(keep); clearTimeout(noStart); clearTimeout(cap); speakOne(text, p, volume, gen, true).then(resolve); return; }
      finish("ok");
    };
    // la lecture n'a jamais commencé → son bloqué par le navigateur
    const noStart = setTimeout(() => {
      if (started || done) return;
      if (!retry && voice) { diag("… pas de démarrage : nouvel essai avec la voix par défaut"); ss.cancel(); done = true; alive.delete(u); clearInterval(keep); clearTimeout(cap); speakOne(text, p, volume, gen, true).then(resolve); return; }
      diag("✖ la lecture n'a jamais démarré (son bloqué ?)"); ss.cancel(); finish(gen === cancelGen ? "blocked" : "cancelled");
    }, 8000);
    // filet de sécurité si « onend » n'arrive jamais
    const cap = setTimeout(() => finish("ok"), 10000 + text.length * 110 / p.rate);
    // Chrome se met parfois en pause tout seul
    const keep = setInterval(() => { if (ss.paused) ss.resume(); }, 1000);
    alive.add(u);
    const go = () => { ss.resume(); ss.speak(u); diag(`… demande de lecture : « ${text.slice(0, 40)}${text.length > 40 ? "…" : ""} »`); };
    // Chrome ignore parfois une lecture demandée juste après une annulation
    const since = Date.now() - lastCancel;
    if (since < 150) setTimeout(go, 150 - since); else go();
  });
}
/** Prononce un texte ; la promesse se résout à la fin, à l'annulation ou si le son est bloqué */
export async function speak(text: string, p: VoiceProfile, volume = 1): Promise<SpeakResult> {
  if (!voiceSupport().tts) return "ok";
  if (!voices.length) loadVoices();
  const gen = cancelGen;
  const clean = text.replace(/[«»"]/g, "").replace(/\s+/g, " ").trim();
  if (!clean) return "ok";
  for (const c of chunks(clean)) {
    if (gen !== cancelGen) return "cancelled";
    const r = await speakOne(c, p, volume, gen);
    if (r !== "ok") return r;
  }
  return "ok";
}
export function stopSpeaking() { cancelGen++; lastCancel = Date.now(); if (voiceSupport().tts) window.speechSynthesis.cancel(); }

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
