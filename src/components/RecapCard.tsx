"use client";
import { useState } from "react";
import type { Recap } from "@/engine/recap";
import { recapPng, recapText } from "@/lib/recap-image";
import { Badge, Button } from "./ui";

const slug = (t: string) => t.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 40);

/** Fiche « à retenir » de fin d'entretien : à photographier, télécharger en image ou copier */
export function RecapCard({ recap }: { recap: Recap }) {
  const [showSol, setShowSol] = useState(true);
  const [state, setState] = useState<"" | "png" | "copy" | "err">("");
  const download = async () => {
    try {
      const blob = await recapPng(recap);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url; a.download = `fiche-${slug(recap.title) || "entretien"}.png`;
      document.body.appendChild(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      setState("png");
    } catch { setState("err"); }
  };
  const copy = async () => { try { await navigator.clipboard.writeText(recapText(recap)); setState("copy"); } catch { setState("err"); } };
  const Section = ({ title, children }: { title: string; children: React.ReactNode }) => <div className="mt-4"><div className="mb-1 border-t border-ink-700 pt-3 text-[11px] font-bold uppercase tracking-[0.18em] text-gold">{title}</div>{children}</div>;
  return <section data-testid="recap-card" aria-label="Fiche à retenir" className="mx-auto mt-6 w-full max-w-2xl rounded-xl border-2 border-gold/70 bg-ink-950 p-5 text-left shadow-xl">
    <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold">Financial Empire · Fiche à retenir</div>
    <h3 className="mt-1 text-xl font-bold text-white" data-testid="recap-title">{recap.title}</h3>
    <div className="mt-1 text-xs text-ink-300">{recap.when} · {recap.subtitle}</div>
    <div className="mt-3 flex flex-wrap items-center gap-2"><Badge tone={recap.verdict.tone === "info" ? "info" : recap.verdict.tone}>{recap.verdict.label}</Badge>{recap.outcome && <span className="text-sm text-ink-100">{recap.outcome}</span>}</div>
    {recap.points.length > 0 && <Section title="À retenir"><ul className="space-y-1.5 text-sm text-ink-100" data-testid="recap-points">{recap.points.map((p, i) => <li key={i} className="flex gap-2"><span className="text-gold">•</span><span>{p}</span></li>)}</ul></Section>}
    {recap.facts.length > 0 && <Section title="Chiffres clés"><dl className="grid gap-x-4 gap-y-1 text-sm sm:grid-cols-2">{recap.facts.map(([a, b]) => <div key={a} className="flex justify-between gap-3 border-b border-ink-800 py-0.5"><dt className="text-ink-300">{a}</dt><dd className="text-right font-medium text-white">{b}</dd></div>)}</dl></Section>}
    {recap.terms.length > 0 && <Section title="Notions employées"><ul className="space-y-2 text-sm" data-testid="recap-terms">{recap.terms.map((t) => <li key={t.term}><b className="text-white">{t.term}</b> <span className="text-ink-200">— {t.text}</span>{t.example && <div className="text-xs text-ink-400">Exemple : {t.example}</div>}</li>)}</ul></Section>}
    {recap.formulas.length > 0 && <Section title="Formules à connaître"><div className="space-y-3" data-testid="recap-formulas">{recap.formulas.map((f) => <div key={f.title} className="rounded-lg border border-ink-700 bg-ink-900 p-3">
      <div className="text-sm font-semibold text-white">{f.title}</div>
      <div className="mt-1.5 overflow-x-auto whitespace-pre-line rounded-md bg-ink-950 px-2.5 py-2 font-mono text-[13px] leading-snug text-gold" tabIndex={0} aria-label={`Formule : ${f.title}`}>{f.formula}</div>
      <ul className="mt-1.5 space-y-0.5 text-xs text-ink-300">{f.legend.map((l) => <li key={l}>• {l}</li>)}</ul>
      {f.example && <div className="mt-2 text-xs text-ink-100"><b className="text-gold">Calcul pas à pas · </b>{f.example}</div>}
      {f.pitfall && <div className="mt-1.5 text-xs text-amber-200">⚠ Piège : {f.pitfall}</div>}
    </div>)}</div></Section>}
    {recap.exercise && <Section title="Exercice supplémentaire"><div data-testid="recap-exercise" className="rounded-lg border border-gold/40 bg-yellow-500/5 p-3">
      <div className="text-xs font-semibold text-gold">{recap.exercise.title}</div>
      <p className="mt-1 text-sm text-white">{recap.exercise.prompt}</p>
      <button type="button" data-testid="recap-toggle" onClick={() => setShowSol(!showSol)} className="mt-2 text-xs text-ink-300 underline">{showSol ? "Masquer le corrigé (pour s'entraîner)" : "Afficher le corrigé"}</button>
      {showSol && <div data-testid="recap-solution" className="mt-2 rounded-md bg-ink-950 p-2 text-xs text-ink-100"><b className="text-gain">Corrigé : {recap.exercise.answer}</b><div className="mt-1 text-ink-300">{recap.exercise.solution}</div></div>}
    </div></Section>}
    {recap.decisions.length > 0 && <Section title="Vos décisions"><ul className="space-y-1 text-sm text-ink-200">{recap.decisions.map((d, i) => <li key={i} className="flex gap-2"><span className="text-gold">•</span><span>{d}</span></li>)}</ul></Section>}
    {recap.reactions.length > 0 && <Section title="Réactions de vos interlocuteurs"><ul className="space-y-1 text-sm text-ink-200">{recap.reactions.map((d, i) => <li key={i} className="flex gap-2"><span className="text-gold">•</span><span>{d}</span></li>)}</ul></Section>}
    {recap.tips.length > 0 && <Section title="Conseils"><ul className="space-y-1 text-sm text-ink-200">{recap.tips.map((d, i) => <li key={i} className="flex gap-2"><span className="text-gold">•</span><span>{d}</span></li>)}</ul></Section>}
    <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-ink-700 pt-3">
      <Button size="sm" data-testid="recap-png" onClick={download}>📸 Télécharger l'image</Button>
      <Button size="sm" variant="ghost" data-testid="recap-copy" onClick={copy}>📋 Copier le texte</Button>
      <span role="status" className="text-xs text-ink-300">{state === "png" ? "Image enregistrée ✔" : state === "copy" ? "Texte copié ✔" : state === "err" ? "Action impossible sur cet appareil : faites plutôt une capture d'écran." : "Ou faites une capture d'écran de cette fiche."}</span>
    </div>
    <div className="mt-2 text-[10px] text-ink-400">Simulation pédagogique : monnaie virtuelle, marchés et entreprises fictifs.</div>
  </section>;
}
