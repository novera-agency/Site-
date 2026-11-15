"use client";
import { useEffect, useState } from "react";
import { speak, stopSpeaking, unlockAudio, voiceInventory, voiceDiag, voiceSupport, voiceCast, ringTone } from "@/lib/voice";
import { Button } from "./ui";

/** Test du son : lit une phrase avec plusieurs voix et affiche ce que fait réellement le navigateur */
export function SoundTest() {
  const [inv, setInv] = useState<ReturnType<typeof voiceInventory> | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const sup = typeof window !== "undefined" ? voiceSupport() : { tts: false, stt: false };
  useEffect(() => { const t = setTimeout(() => setInv(voiceInventory()), 300); const id = setInterval(() => setLog([...voiceDiag]), 500); return () => { clearTimeout(t); clearInterval(id); }; }, []);
  const run = async () => {
    unlockAudio(); // dans le clic
    setBusy(true);
    const cast = voiceCast([{ id: "a" }, { id: "b" }]);
    await speak("Bonjour, je suis votre responsable. Vous m'entendez ?", cast.get("a")!.profile);
    await speak("Et moi, je suis votre collègue, avec une autre voix.", cast.get("b")!.profile);
    setBusy(false); setInv(voiceInventory());
  };
  return <div data-testid="sound-test" className="space-y-3 text-sm">
    <div className="flex flex-wrap gap-2">
      <Button data-testid="sound-test-run" disabled={busy || !sup.tts} onClick={run}>{busy ? "Lecture…" : "🔊 Lire deux phrases de test"}</Button>
      <Button variant="ghost" onClick={() => { unlockAudio(); ringTone(1); }}>🔔 Tester un bip</Button>
      {busy && <Button variant="ghost" onClick={() => { stopSpeaking(); setBusy(false); }}>Arrêter</Button>}
    </div>
    <ul className="space-y-0.5 text-xs text-ink-300">
      <li>Synthèse vocale du navigateur : {sup.tts ? <b className="text-gain">disponible</b> : <b className="text-loss">absente</b>}</li>
      <li>Reconnaissance vocale (micro) : {sup.stt ? <b className="text-gain">disponible</b> : <b className="text-loss">absente — utilisez Chrome, Edge ou Safari</b>}</li>
      <li>Voix installées : {inv ? `${inv.total} au total, dont ${inv.fr.length} en français` : "…"}{inv && inv.fr.length === 0 && <span className="text-amber-300"> — aucune voix française : le navigateur lira avec sa voix par défaut</span>}</li>
      {inv && inv.fr.length > 0 && <li className="text-ink-400">{inv.fr.slice(0, 8).join(" · ")}</li>}
    </ul>
    <div className="rounded-md bg-ink-900 p-2 font-mono text-[11px] text-ink-300" data-testid="sound-log">{log.length ? log.slice(-12).map((l, i) => <div key={i}>{l}</div>) : "Journal vide : appuyez sur « Lire deux phrases de test »."}</div>
    <div className="text-[11px] text-ink-500">Si le journal affiche « ▶ lecture » mais que vous n'entendez rien : montez le volume des médias, coupez le mode silencieux (iPhone : bouton sur le côté), vérifiez la sortie audio (Bluetooth). Si rien ne démarre : autorisez le son pour ce site ou essayez un autre navigateur.</div>
  </div>;
}
