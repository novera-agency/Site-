"use client";
import { useState } from "react";
import { cloudConfigured, cloudFeedback, CloudError } from "@/lib/career-cloud";
import { Button } from "./ui";

const KINDS = [["comprehension", "Je n'ai pas compris"], ["bug", "Quelque chose bugge"], ["idee", "J'ai une idée"]] as const;
/** Formulaire de retour (anonyme) : n'apparaît que quand la base en ligne est branchée */
export function FeedbackBox() {
  const [kind, setKind] = useState<(typeof KINDS)[number][0]>("comprehension");
  const [text, setText] = useState(""); const [busy, setBusy] = useState(false); const [msg, setMsg] = useState<{ ok: boolean; t: string } | null>(null);
  if (!cloudConfigured()) return null;
  const send = async () => {
    setBusy(true); setMsg(null);
    try { await cloudFeedback(kind, text); setText(""); setMsg({ ok: true, t: "Merci ! Votre retour est bien arrivé." }); }
    catch (e) { setMsg({ ok: false, t: e instanceof CloudError ? e.message : "Envoi impossible pour le moment." }); }
    finally { setBusy(false); }
  };
  return <section aria-labelledby="fb-title" className="rounded-lg border border-ink-700 bg-ink-900/60 p-4" data-testid="feedback">
    <h2 id="fb-title" className="text-base font-semibold text-white">Donner mon avis</h2>
    <p className="mt-1 text-xs text-ink-400">Un point pas clair, une erreur, une idée ? Dites-le en quelques mots : votre message est anonyme (rien de votre partie n'est envoyé).</p>
    <div className="mt-2 flex flex-wrap gap-1.5" role="group" aria-label="Type de retour">{KINDS.map(([k, l]) => <button key={k} type="button" aria-pressed={kind === k} onClick={() => setKind(k)} className={`rounded-full border px-3 py-1 text-xs ${kind === k ? "border-gold bg-gold/15 text-white" : "border-ink-600 text-ink-300 hover:border-ink-400"}`}>{l}</button>)}</div>
    <textarea value={text} onChange={(e) => setText(e.target.value)} maxLength={1500} aria-label="Votre message" data-testid="feedback-text" placeholder="Par exemple : « Je n'ai pas compris la question sur la VaR… »" className="mt-2 h-24 w-full resize-y rounded-md border border-ink-700 bg-ink-950 p-2 text-sm text-ink-100" />
    <div className="mt-2 flex items-center gap-3"><Button data-testid="feedback-send" disabled={busy || text.trim().length < 5} onClick={send}>{busy ? "Envoi…" : "Envoyer"}</Button>{msg && <span role="status" className={`text-xs ${msg.ok ? "text-gain" : "text-loss"}`}>{msg.t}</span>}</div>
  </section>;
}
