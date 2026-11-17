"use client";
import { useRef, useState } from "react";
import { api } from "@/lib/api";
import { careerCodeSupported, makeCareerCode, readCareerCode, CareerCodeError } from "@/lib/career-code";
import { Button } from "./ui";

const fmtSize = (n: number) => (n > 1e6 ? `${(n / 1e6).toFixed(1).replace(".", ",")} Mo` : `${Math.round(n / 1e3)} Ko`);

/** Code de carrière : générer (partie en cours) et/ou reprendre sur cet appareil une partie jouée ailleurs */
export function CareerCode({ gameId, onImported, importOnly = false }: { gameId?: string | null; onImported: (gameId: string) => void; importOnly?: boolean }) {
  const [code, setCode] = useState(""); const [info, setInfo] = useState(""); const [busy, setBusy] = useState(false);
  const [input, setInput] = useState(""); const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const supported = careerCodeSupported();

  const generate = async () => {
    if (!gameId) return; setBusy(true); setMsg(null); setCode("");
    try {
      const r = await api<{ ok: boolean; data?: string; error?: string }>("/api/saves", { action: "export_code", gameId });
      if (!r.ok || !r.data) { setMsg({ ok: false, text: r.error ?? "Impossible de générer le code." }); return; }
      const c = await makeCareerCode(r.data);
      setCode(c); setInfo(`${c.length.toLocaleString("fr-FR")} caractères (${fmtSize(c.length)})`);
    } catch { setMsg({ ok: false, text: "Impossible de générer le code sur cet appareil." }); } finally { setBusy(false); }
  };
  const copy = async () => { try { await navigator.clipboard.writeText(code); setMsg({ ok: true, text: "Code copié. Collez-le sur l'autre appareil (message à soi-même, notes…)." }); } catch { setMsg({ ok: false, text: "Copie impossible : sélectionnez le texte et copiez-le à la main, ou téléchargez le fichier." }); } };
  const download = () => { const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([code], { type: "text/plain" })); a.download = `code-de-carriere-${new Date().toISOString().slice(0, 10)}.txt`; a.click(); };
  const restore = async (text: string) => {
    setBusy(true); setMsg(null);
    try {
      const json = await readCareerCode(text);
      await api("/api/auth", { action: "guest" });
      const r = await api<{ ok: boolean; gameId?: string; error?: string }>("/api/saves", { action: "import", data: json });
      if (!r.ok || !r.gameId) { setMsg({ ok: false, text: r.error ?? "Ce code n'a pas pu être chargé (version incompatible ?)." }); return; }
      setMsg({ ok: true, text: "Carrière retrouvée ! Ouverture…" }); onImported(r.gameId);
    } catch (e) { setMsg({ ok: false, text: e instanceof CareerCodeError ? e.message : "Ce code n'a pas pu être chargé : vérifiez qu'il est complet." }); } finally { setBusy(false); }
  };
  const readFile = async (f: File) => { const t = await f.text(); setInput(t); await restore(t); };

  if (!supported) return <p className="text-sm text-amber-300">Ce navigateur ne sait pas compresser les données : utilisez plutôt l&apos;export de sauvegarde (fichier) dans « Sauvegardes ».</p>;
  return <div className="space-y-5" data-testid="career-code">
    {!importOnly && <section aria-labelledby="cc-gen">
      <h3 id="cc-gen" className="text-sm font-semibold text-white">Passer sur un autre appareil</h3>
      <p className="mt-1 text-xs text-ink-400">Générez un code, collez-le sur l&apos;autre appareil : vous y retrouvez exactement la même carrière (positions, relations, planning, progression). Le code contient toute la partie, nom du personnage compris : ne le partagez avec personne. Seul l&apos;historique de cours très ancien est raccourci.</p>
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button data-testid="cc-generate" disabled={!gameId || busy} onClick={generate}>{busy && !code ? "Génération…" : "🔑 Générer mon code"}</Button>
        {code && <><Button size="sm" data-testid="cc-copy" onClick={copy}>📋 Copier</Button><Button size="sm" variant="outline" data-testid="cc-download" onClick={download}>⬇️ Télécharger (.txt)</Button><span className="text-xs text-ink-400">{info}</span></>}
      </div>
      {code && <textarea data-testid="cc-code" readOnly value={code} aria-label="Votre code de carrière" onFocus={(e) => e.currentTarget.select()} className="mt-2 h-24 w-full resize-y rounded-md border border-ink-700 bg-ink-950 p-2 font-mono text-[11px] text-ink-200" />}
      {code && <p className="mt-1 text-[11px] text-ink-500">Le code est long (il contient toute la partie) : il ne se tape pas à la main. Collez-le en entier, ou utilisez le fichier.</p>}
    </section>}
    <section aria-labelledby="cc-use">
      <h3 id="cc-use" className="text-sm font-semibold text-white">{importOnly ? "Reprendre une carrière avec un code" : "Reprendre une carrière jouée ailleurs"}</h3>
      <p className="mt-1 text-xs text-ink-400">Collez ici le code généré sur l&apos;autre appareil (ou choisissez le fichier .txt). Une nouvelle partie est créée ici : elle ne remplace aucune de vos parties.</p>
      <textarea data-testid="cc-input" value={input} onChange={(e) => setInput(e.target.value)} placeholder="FE1.xxxxxxxx.…" aria-label="Code de carrière à reprendre" className="mt-2 h-20 w-full resize-y rounded-md border border-ink-700 bg-ink-950 p-2 font-mono text-[11px] text-ink-200" />
      <div className="mt-2 flex flex-wrap items-center gap-2">
        <Button data-testid="cc-restore" disabled={busy || input.trim().length < 12} onClick={() => restore(input)}>{busy ? "Chargement…" : "Reprendre cette carrière"}</Button>
        <input ref={fileRef} type="file" accept=".txt,text/plain" aria-label="Choisir un fichier de code de carrière" className="hidden" onChange={(e) => e.target.files?.[0] && readFile(e.target.files[0])} />
        <Button size="sm" variant="outline" onClick={() => fileRef.current?.click()}>📄 Choisir un fichier</Button>
      </div>
    </section>
    {msg && <p role="status" data-testid="cc-msg" className={`text-xs ${msg.ok ? "text-gain" : "text-loss"}`}>{msg.text}</p>}
  </div>;
}
