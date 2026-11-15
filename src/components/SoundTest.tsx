"use client";
import { useEffect, useState } from "react";
import { speak, stopSpeaking, unlockAudio, voiceInventory, voiceDiag, voiceSupport, voiceCast, ringTone, frenchVoices, setPreferredVoices, preferredVoices, voiceByUri } from "@/lib/voice";
import { Button, Badge } from "./ui";

type FV = ReturnType<typeof frenchVoices>[number];
const QTONE: Record<string, "gain" | "gold" | "info" | "warn" | "loss"> = { naturelle: "gain", premium: "gold", bonne: "info", standard: "warn", basique: "loss" };

/** Conseils pour obtenir des voix plus naturelles, selon l'appareil */
function platformTip() {
  if (typeof navigator === "undefined") return "";
  const ua = navigator.userAgent;
  if (/Edg\//.test(ua)) return "Vous utilisez Edge : choisissez les voix « Microsoft … Online (Natural) » ci-dessous, ce sont les plus naturelles.";
  if (/iPhone|iPad|iPod/.test(ua)) return "Sur iPhone / iPad : Réglages → Accessibilité → Contenu énoncé → Voix → Français, puis téléchargez une voix « Premium » ou « Améliorée » (Audrey, Thomas…). Rechargez ensuite le jeu.";
  if (/Macintosh/.test(ua)) return "Sur Mac : Réglages Système → Accessibilité → Contenu énoncé → Voix du système → Gérer les voix, puis téléchargez une voix française « Premium ». Ou ouvrez le jeu dans Microsoft Edge pour ses voix naturelles.";
  if (/Android/.test(ua)) return "Sur Android : Paramètres → Synthèse vocale → moteur Google → installez les données vocales françaises « haute qualité ».";
  if (/Windows/.test(ua)) return "Sur Windows, ouvrez le jeu dans Microsoft Edge : il propose des voix françaises « Natural » très réalistes.";
  return "Pour des voix plus naturelles, essayez Microsoft Edge (voix « Natural »).";
}

/** Test du son et choix des voix : qualité de chaque voix, écoute, sélection des voix utilisées par le jeu */
export function SoundTest() {
  const [inv, setInv] = useState<ReturnType<typeof voiceInventory> | null>(null);
  const [list, setList] = useState<FV[]>([]);
  const [chosen, setChosen] = useState<string[]>([]);
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [tip, setTip] = useState("");
  const sup = typeof window !== "undefined" ? voiceSupport() : { tts: false, stt: false };
  useEffect(() => {
    const refresh = () => { setInv(voiceInventory()); setList(frenchVoices()); setChosen(preferredVoices()); };
    const t = setTimeout(refresh, 300); const t2 = setTimeout(refresh, 1500);
    if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.addEventListener?.("voiceschanged", refresh);
    const id = setInterval(() => setLog([...voiceDiag]), 500);
    setTip(platformTip());
    return () => { clearTimeout(t); clearTimeout(t2); clearInterval(id); if (typeof window !== "undefined" && "speechSynthesis" in window) window.speechSynthesis.removeEventListener?.("voiceschanged", refresh); };
  }, []);
  const run = async () => {
    unlockAudio(); // dans le clic
    setBusy(true);
    const cast = voiceCast([{ id: "a" }, { id: "b" }]);
    await speak("Bonjour, je suis votre responsable. Vous m'entendez ?", cast.get("a")!.profile);
    await speak("Et moi, je suis votre collègue, avec une autre voix.", cast.get("b")!.profile);
    setBusy(false); setInv(voiceInventory());
  };
  const listen = async (uri: string) => { unlockAudio(); stopSpeaking(); const v = voiceByUri(uri); await speak("Bonjour, je serai l'une des voix de votre équipe.", { voice: v, pitch: 1, rate: 1 }); };
  const toggle = (uri: string) => { const next = chosen.includes(uri) ? chosen.filter((x) => x !== uri) : [...chosen, uri]; setChosen(next); setPreferredVoices(next); setList(frenchVoices()); };
  const auto = () => { setChosen([]); setPreferredVoices([]); setList(frenchVoices()); };
  const best = list[0]?.quality;
  return <div data-testid="sound-test" className="space-y-3 text-sm">
    <div className="flex flex-wrap gap-2">
      <Button data-testid="sound-test-run" disabled={busy || !sup.tts} onClick={run}>{busy ? "Lecture…" : "🔊 Écouter deux voix du jeu"}</Button>
      <Button variant="ghost" onClick={() => { unlockAudio(); ringTone(1); }}>🔔 Tester un bip</Button>
      {busy && <Button variant="ghost" onClick={() => { stopSpeaking(); setBusy(false); }}>Arrêter</Button>}
    </div>
    <ul className="space-y-0.5 text-xs text-ink-300">
      <li>Synthèse vocale du navigateur : {sup.tts ? <b className="text-gain">disponible</b> : <b className="text-loss">absente</b>}</li>
      <li>Reconnaissance vocale (micro) : {sup.stt ? <b className="text-gain">disponible</b> : <b className="text-loss">absente — utilisez Chrome, Edge ou Safari</b>}</li>
      <li>Voix installées : {inv ? `${inv.total} au total, dont ${list.length} en français` : "…"}</li>
    </ul>
    {tip && <div className={`rounded-md border p-2 text-xs ${best === "naturelle" || best === "premium" ? "border-ink-700 bg-ink-900 text-ink-300" : "border-gold/40 bg-yellow-500/5 text-ink-200"}`} data-testid="voice-tip">💡 {best === "naturelle" || best === "premium" ? "Votre appareil a des voix de bonne qualité : le jeu les utilise en priorité. " : "Les voix de votre appareil sont assez robotiques. "}{tip}</div>}

    {list.length > 0 && <div data-testid="voice-list">
      <div className="mb-1 flex items-center justify-between text-xs"><span className="text-ink-400">Voix françaises de votre appareil (les plus naturelles en premier). Cochez celles que le jeu doit utiliser :</span>{chosen.length > 0 && <button onClick={auto} className="text-accent underline">Choix automatique</button>}</div>
      <div className="max-h-72 space-y-1 overflow-y-auto pr-1">{list.map((v) => <div key={v.uri} className={`flex items-center gap-2 rounded-md border px-2 py-1.5 ${v.chosen ? "border-gold/60 bg-yellow-500/5" : "border-ink-700 bg-ink-900"}`}>
        <input type="checkbox" checked={chosen.includes(v.uri)} onChange={() => toggle(v.uri)} aria-label={`Utiliser ${v.name}`} />
        <span className="min-w-0 flex-1 truncate text-xs">{v.name} <span className="text-ink-500">({v.lang}{v.local ? "" : ", en ligne"})</span></span>
        <Badge tone={QTONE[v.quality]}>{v.quality}</Badge>
        <button onClick={() => listen(v.uri)} className="rounded bg-ink-800 px-2 py-0.5 text-xs hover:bg-ink-700">▶ écouter</button>
      </div>)}</div>
      <p className="mt-1 text-[11px] text-ink-500">{chosen.length ? `${chosen.length} voix choisie${chosen.length > 1 ? "s" : ""} : chaque personnage reçoit l'une d'elles, dans cet ordre.` : "Choix automatique : le jeu prend les voix les plus naturelles et donne une voix différente à chaque personnage."}</p>
    </div>}

    <div className="rounded-md bg-ink-900 p-2 font-mono text-[11px] text-ink-300" data-testid="sound-log">{log.length ? log.slice(-10).map((l, i) => <div key={i}>{l}</div>) : "Journal vide : appuyez sur « Écouter deux voix du jeu »."}</div>
    <div className="text-[11px] text-ink-500">Si le journal affiche « ▶ lecture » mais que vous n'entendez rien : montez le volume des médias, coupez le mode silencieux, vérifiez la sortie audio (Bluetooth). Si une voix « en ligne » échoue, le jeu reprend automatiquement avec la voix par défaut.</div>
  </div>;
}
