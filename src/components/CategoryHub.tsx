"use client";
import Link from "next/link";
import { useGame } from "@/lib/store";
import { CATEGORIES } from "./nav";
import { PageTitle } from "./ui";
import { tr } from "@/lib/i18n";

/** Page d'une catégorie : toutes ses rubriques sous forme de grandes tuiles expliquées */
export function CategoryHub({ id, compact = false }: { id: string; compact?: boolean }) {
  const snap = useGame((s) => s.snap);
  const cat = CATEGORIES.find((c) => c.id === id)!;
  const badge = (k?: string) => !snap ? 0 : k === "msgs" ? snap.unreadMsgs : k === "missions" ? snap.missionsActive : k === "meeting" ? (snap.pendingMeeting || snap.activeMeetingId ? "!" : 0) : 0;
  const items = cat.sections.flatMap((s) => s.items).filter((it) => !(compact && it.href === cat.hub));
  if (compact) return <div className="mb-4 grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-5" data-testid="hub">
    {items.map((it) => { const b = badge(it.badge); return <Link key={it.href} href={it.href} className="relative flex items-center gap-2 rounded-xl border border-ink-700 bg-ink-850 px-3 py-2.5 hover:border-gold"><span className="text-2xl">{it.icon}</span><span className="min-w-0"><span className="block truncate text-sm font-medium text-white">{tr(it.label)}</span><span className="block truncate text-[11px] text-ink-400">{tr(it.desc)}</span></span>{b ? <span className="absolute right-2 top-1.5 rounded-full bg-gold px-1.5 text-[10px] font-bold text-black">{b}</span> : null}</Link>; })}
  </div>;
  return <>
    <PageTitle env={`${cat.icon} ${tr(cat.label)}`} title={tr(cat.label)} subtitle={tr(cat.intro)} />
    <div data-testid="hub">{cat.sections.map((sec, i) => <section key={i} className="mb-6">
      {sec.title && <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.16em] text-gold">{tr(sec.title)}</h2>}
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">{sec.items.map((it) => { const b = badge(it.badge); return <Link key={it.href} href={it.href} className="relative flex items-center gap-4 rounded-xl border border-ink-700 bg-ink-850 p-4 transition hover:border-gold hover:bg-ink-800">
        <span className="text-3xl">{it.icon}</span><span className="min-w-0"><span className="block text-base font-semibold text-white">{tr(it.label)}</span><span className="block text-xs leading-snug text-ink-400">{tr(it.desc)}</span></span>
        <span className="ml-auto text-ink-500">›</span>
        {b ? <span className="absolute right-3 top-2 rounded-full bg-gold px-1.5 text-[10px] font-bold text-black">{b}</span> : null}
      </Link>; })}</div>
    </section>)}</div>
  </>;
}
