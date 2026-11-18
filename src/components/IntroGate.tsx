"use client";
import { useEffect, useState } from "react";
import { useGame } from "@/lib/store";
import { webglOK } from "./Stage3D";
import { IntroCinematic } from "./IntroCinematic";

/** Clé posée à la création d'une partie : l'introduction ne se joue qu'une fois, pour cette partie, jamais pour une partie reprise */
export const INTRO_KEY = "fe_intro_new";
const read = () => { try { return localStorage.getItem(INTRO_KEY); } catch { return null; } };
const clear = () => { try { localStorage.removeItem(INTRO_KEY); } catch { /* */ } };

export function IntroGate() {
  const gameId = useGame((s) => s.gameId), snap = useGame((s) => s.snap);
  const [run, setRun] = useState<string | null>(null);
  const [checked, setChecked] = useState(false);
  useEffect(() => {
    if (checked || !gameId) return;
    const flag = read();
    if (!flag) { setChecked(true); return; }
    if (flag !== gameId) { setChecked(true); return; }
    // le jeu attend ses données ; sans 3D ou avec « réduire les animations », on passe l'introduction
    const reduced = !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (!webglOK() || reduced) { clear(); setChecked(true); return; }
    if (!snap) return;
    clear(); setChecked(true); setRun(gameId); // effacé dès le départ : un rechargement ne la rejoue pas
  }, [gameId, snap, checked]);
  if (!run || !snap) return null;
  return <IntroCinematic avatar={snap.player.avatar} firstName={snap.player.name.split(" ")[0]} bankName={snap.player.bank ?? "Marchés financiers"} rankTitle={snap.player.title} onDone={() => setRun(null)} onFail={() => setRun(null)} />;
}
