"use client";
import Link from "next/link";
import { useState, type ReactNode } from "react";
import { LESSON_BY_ID } from "@/engine/data/learning";
import { clsChange, fmtPct } from "@/lib/format";

export function Card({ title, right, children, className = "", pad = true }: { title?: ReactNode; right?: ReactNode; children: ReactNode; className?: string; pad?: boolean }) {
  return (
    <section className={`panel fade-in ${className}`}>
      {(title || right) && <header className="flex items-center justify-between gap-2 border-b border-ink-700 px-4 py-2.5"><h2 className="text-[13px] font-semibold uppercase tracking-wider text-ink-200">{title}</h2><div className="text-xs text-ink-300">{right}</div></header>}
      <div className={pad ? "p-4" : ""}>{children}</div>
    </section>
  );
}
export function Stat({ label, value, sub, tone, hint }: { label: ReactNode; value: ReactNode; sub?: ReactNode; tone?: "gain" | "loss" | "neutral"; hint?: string }) {
  return (
    <div className="min-w-0" title={hint}>
      <div className="text-[11px] uppercase tracking-wider text-ink-400">{label}</div>
      <div className={`num truncate text-lg font-semibold ${tone === "gain" ? "text-gain" : tone === "loss" ? "text-loss" : "text-ink-100"}`}>{value}</div>
      {sub && <div className="truncate text-xs text-ink-300">{sub}</div>}
    </div>
  );
}
export function Change({ v, d = 2 }: { v: number; d?: number }) { return <span className={`num ${clsChange(v)}`}>{fmtPct(v, d)}</span>; }
export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "gain" | "loss" | "warn" | "info" | "gold" }) {
  const c = { neutral: "bg-ink-700 text-ink-200", gain: "bg-green-500/15 text-green-400", loss: "bg-red-500/15 text-red-400", warn: "bg-amber-500/15 text-amber-300", info: "bg-blue-500/15 text-blue-300", gold: "bg-yellow-600/15 text-gold" }[tone];
  return <span className={`inline-flex items-center rounded px-1.5 py-0.5 text-[11px] font-medium ${c}`}>{children}</span>;
}
export function Button({ children, onClick, variant = "primary", disabled, className = "", type = "button", size = "md", title, ...rest }: { children: ReactNode; onClick?: () => void; variant?: "primary" | "ghost" | "danger" | "success" | "outline"; disabled?: boolean; className?: string; type?: "button" | "submit"; size?: "sm" | "md"; title?: string; [k: `data-${string}`]: string | undefined }) {
  const v = { primary: "bg-accent hover:bg-blue-500 text-white", ghost: "bg-ink-700 hover:bg-ink-600 text-ink-100", danger: "bg-red-600 hover:bg-red-500 text-white", success: "bg-green-600 hover:bg-green-500 text-white", outline: "border border-ink-600 hover:border-ink-400 text-ink-100" }[variant];
  return <button {...rest} title={title} type={type} onClick={onClick} disabled={disabled} className={`${v} ${size === "sm" ? "px-2.5 py-1 text-xs" : "px-3.5 py-2 text-sm"} rounded-md font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${className}`}>{children}</button>;
}
export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: ReactNode }[]; value: T; onChange: (v: T) => void }) {
  return <div className="flex flex-wrap gap-1 rounded-lg bg-ink-900 p-1">{tabs.map((t) => <button key={t.id} onClick={() => onChange(t.id)} className={`rounded-md px-3 py-1.5 text-xs font-medium transition ${value === t.id ? "bg-ink-700 text-white" : "text-ink-300 hover:text-white"}`}>{t.label}</button>)}</div>;
}
export function Empty({ children }: { children: ReactNode }) { return <div className="rounded-md border border-dashed border-ink-700 p-6 text-center text-sm text-ink-400">{children}</div>; }
export function Loading() { return <div className="flex h-40 items-center justify-center text-sm text-ink-400"><span className="mr-2 inline-block h-3 w-3 animate-pulse rounded-full bg-accent" />Chargement des données de simulation…</div>; }
export function PageTitle({ title, subtitle, right, env }: { title: string; subtitle?: ReactNode; right?: ReactNode; env?: string }) {
  return (
    <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
      <div>{env && <div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold">{env}</div>}<h1 className="text-xl font-semibold text-white md:text-2xl">{title}</h1>{subtitle && <p className="mt-0.5 text-sm text-ink-300">{subtitle}</p>}</div>
      {right}
    </div>
  );
}
export function Bar({ value, max = 100, tone = "accent" }: { value: number; max?: number; tone?: "accent" | "gain" | "loss" | "gold" | "warn" }) {
  const c = { accent: "bg-accent", gain: "bg-gain", loss: "bg-loss", gold: "bg-gold", warn: "bg-amber-400" }[tone];
  return <div className="h-1.5 w-full overflow-hidden rounded-full bg-ink-700"><div className={`h-full ${c} transition-all`} style={{ width: `${Math.max(0, Math.min(100, (value / max) * 100))}%` }} /></div>;
}
/** Terme financier avec explication contextuelle (dictionnaire intégré) */
export function Term({ id, children }: { id: string; children?: ReactNode }) {
  const [open, setOpen] = useState(false);
  const l = LESSON_BY_ID[id];
  if (!l) return <>{children}</>;
  return (
    <span className="relative inline-block">
      <button type="button" onClick={() => setOpen(!open)} onMouseEnter={() => setOpen(true)} onMouseLeave={() => setOpen(false)} className="cursor-help border-b border-dotted border-ink-400">{children ?? l.term}</button>
      {open && <span className="absolute left-0 top-full z-50 mt-1 block w-72 rounded-md border border-ink-600 bg-ink-850 p-3 text-left text-xs font-normal normal-case tracking-normal text-ink-200 shadow-xl"><span className="mb-1 block font-semibold text-white">{l.term}</span>{l.simple} <span className="mt-1 block text-ink-400">{l.example}</span><Link href={`/play/dictionnaire#${l.id}`} className="mt-1 block text-accent">Voir la fiche →</Link></span>}
    </span>
  );
}
export function Field({ label, children, hint }: { label: ReactNode; children: ReactNode; hint?: ReactNode }) {
  return <label className="block"><span className="mb-1 block text-[11px] font-medium uppercase tracking-wider text-ink-400">{label}</span>{children}{hint && <span className="mt-1 block text-[11px] text-ink-400">{hint}</span>}</label>;
}
export const inputCls = "w-full rounded-md border border-ink-600 bg-ink-900 px-3 py-2 text-sm text-ink-100 outline-none focus:border-accent";
export function Table({ head, children, className = "" }: { head: ReactNode[]; children: ReactNode; className?: string }) {
  return <div tabIndex={0} role="region" aria-label="Tableau défilable" className={`scroll-thin overflow-x-auto ${className}`}><table className="w-full text-sm"><thead><tr className="border-b border-ink-700 text-left text-[11px] uppercase tracking-wider text-ink-400">{head.map((h, i) => <th key={i} className="whitespace-nowrap px-2 py-2 font-medium">{h}</th>)}</tr></thead><tbody className="divide-y divide-ink-800">{children}</tbody></table></div>;
}
export function Sparkline({ data, w = 120, h = 32 }: { data: number[]; w?: number; h?: number }) {
  if (data.length < 2) return <svg width={w} height={h} />;
  const min = Math.min(...data), max = Math.max(...data), rg = max - min || 1;
  const pts = data.map((v, i) => `${(i / (data.length - 1)) * w},${h - ((v - min) / rg) * (h - 4) - 2}`).join(" ");
  const up = data[data.length - 1] >= data[0];
  return <svg width={w} height={h} className="overflow-visible"><polyline points={pts} fill="none" stroke={up ? "#22c55e" : "#ef4444"} strokeWidth="1.5" /></svg>;
}
export function Disclaimer() { return <div className="text-[11px] text-ink-400">Simulation — monnaie virtuelle — aucune transaction réelle. Les cours sont fictifs et générés par le moteur du jeu.</div>; }
