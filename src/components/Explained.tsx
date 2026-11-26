"use client";
import { useMemo, useState } from "react";
import Link from "next/link";
import { annotate, searchTerms, type TermDef } from "@/engine/glossary";

/**
 * Texte dont chaque mot de métier est explicable : les mots soulignés en pointillés s'ouvrent au toucher ou au clic
 * (définition en mots simples + petit exemple). Utilisable partout où une question ou un énoncé est affiché.
 */
export function Explained({ text, className = "" }: { text: string; className?: string }) {
  const segs = useMemo(() => annotate(text), [text]);
  const [open, setOpen] = useState<TermDef | null>(null);
  return <span className={className}>
    {segs.map((s, i) => s.def
      ? <button key={i} type="button" data-testid="term" aria-expanded={open?.term === s.def.term} onClick={(e) => { e.preventDefault(); setOpen(open?.term === s.def!.term ? null : s.def!); }} className="cursor-help border-b border-dotted border-gold/70 text-inherit hover:text-white focus-visible:outline focus-visible:outline-2 focus-visible:outline-gold">{s.text}</button>
      : <span key={i}>{s.text}</span>)}
    {open && <span role="note" data-testid="term-card" className="my-2 block rounded-md border border-gold/40 bg-ink-850 p-3 text-left text-xs font-normal normal-case tracking-normal text-ink-100 shadow-lg">
      <span className="mb-1 flex items-start justify-between gap-2"><b className="text-sm text-white">{open.term}</b><button type="button" aria-label="Fermer l'explication" onClick={() => setOpen(null)} className="rounded bg-ink-700 px-1.5 text-ink-200 hover:bg-ink-600">✕</button></span>
      <span className="block leading-relaxed">{open.simple}</span>
      {open.example && <span className="mt-1.5 block rounded bg-ink-900 p-1.5 text-ink-300"><b className="text-gold">Exemple :</b> {open.example}</span>}
      <Link href="/play/dictionnaire" className="mt-1.5 inline-block text-[11px] text-accent underline">Ouvrir le dictionnaire</Link>
    </span>}
  </span>;
}

export interface HelpData {
  plain?: string; formula?: string;
  terms: { term: string; simple: string; example?: string }[];
  examples: { question: string; options?: string[]; answer: string; explain: string }[];
  steps?: string[];
}
/** « Je ne comprends pas » : la question en mots simples, tous les mots expliqués, la méthode, des exemples résolus */
export function HelpMe({ help, label = "🤔 Je ne comprends pas", defaultOpen = false }: { help: HelpData | null | undefined; label?: string; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen);
  const [ex, setEx] = useState(0);
  if (!help) return null;
  const e = help.examples[ex % Math.max(1, help.examples.length)];
  return <div className="mt-2">
    <button type="button" data-testid="help-me" aria-expanded={open} onClick={() => setOpen(!open)} className="rounded-md border border-gold/50 bg-gold/10 px-2.5 py-1 text-xs font-semibold text-gold hover:bg-gold/20">{open ? "▲ Masquer l'explication" : label}</button>
    {open && <div data-testid="help-me-panel" className="mt-2 space-y-3 rounded-lg border border-gold/30 bg-ink-900 p-3 text-sm text-ink-100">
      {help.plain && <section><h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-gold">1. Ce que demande la question, en mots simples</h4><p className="leading-relaxed"><Explained text={help.plain} /></p></section>}
      {help.terms.length > 0 && <section><h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-gold">{help.plain ? "2" : "1"}. Les mots de la question</h4>
        <ul className="space-y-1.5">{help.terms.map((t) => <li key={t.term} className="rounded bg-ink-850 p-2"><b className="text-white">{t.term}</b> — {t.simple}{t.example && <span className="mt-0.5 block text-xs text-ink-300">Exemple : {t.example}</span>}</li>)}</ul></section>}
      {(help.formula || (help.steps && help.steps.length > 0)) && <section><h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-gold">La méthode</h4>
        {help.formula && <p className="mb-1 rounded bg-yellow-500/10 p-2 text-xs text-yellow-100"><b>À retenir :</b> {help.formula}</p>}
        {help.steps && help.steps.length > 0 && <ol className="list-decimal space-y-1 pl-5">{help.steps.map((x, i) => <li key={i}>{x}</li>)}</ol>}</section>}
      {e && <section><h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-gold">Un exemple résolu (autres chiffres)</h4>
        <div className="rounded bg-ink-850 p-2"><p className="mb-1"><Explained text={e.question} /></p>
          {e.options && <ul className="mb-1 list-disc pl-5 text-xs text-ink-300">{e.options.map((o) => <li key={o}>{o}</li>)}</ul>}
          <p className="text-xs text-ink-200"><b className="text-white">Résolution :</b> {e.explain}</p>
          {e.answer && <p className="mt-1 text-xs"><b className="text-gain">Réponse : {e.answer}</b></p>}</div>
        {help.examples.length > 1 && <button type="button" onClick={() => setEx(ex + 1)} className="mt-1.5 text-xs text-accent underline">Voir un autre exemple</button>}</section>}
      <WordSearch />
      <p className="text-[11px] text-ink-400">Touchez aussi n'importe quel mot souligné dans la question, ou ouvrez le <Link href="/play/dictionnaire" className="text-accent underline">dictionnaire</Link>.</p>
    </div>}
  </div>;
}

/** « Un mot que vous ne comprenez pas ? » : tapez-le, le dictionnaire du jeu l'explique */
function WordSearch() {
  const [q, setQ] = useState("");
  const res = useMemo(() => (q.trim().length > 1 ? searchTerms(q, 3) : []), [q]);
  return <section><h4 className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-gold">Un mot que vous ne comprenez pas ?</h4>
    <input value={q} onChange={(e) => setQ(e.target.value)} aria-label="Chercher un mot dans le dictionnaire" data-testid="help-word" placeholder="Tapez le mot (ex. bêta, spread, franchise…)" className="w-full rounded-md border border-ink-600 bg-ink-850 px-3 py-1.5 text-sm text-ink-100 outline-none focus:border-gold" />
    {q.trim().length > 1 && (res.length ? <ul className="mt-1.5 space-y-1.5">{res.map((d) => <li key={d.term} className="rounded bg-ink-850 p-2"><b className="text-white">{d.term}</b> — {d.simple}{d.example && <span className="mt-0.5 block text-xs text-ink-300">Exemple : {d.example}</span>}</li>)}</ul> : <p className="mt-1.5 text-xs text-ink-300">Ce mot n'est pas dans le dictionnaire du jeu. Essayez un synonyme, ou demandez au responsable en réunion (« Qu'est-ce que… ? »).</p>)}
  </section>;
}
