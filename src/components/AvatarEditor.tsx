"use client";
import { useState } from "react";
import { type Avatar, AVATAR_LISTS } from "@/engine/avatar";
import { AvatarPortrait } from "./AvatarPortrait";

type Key = keyof Avatar;
const TABS: { id: string; label: string; icon: string; rows: { key: Key; label: string; swatch?: boolean }[] }[] = [
  { id: "visage", label: "Teint", icon: "🙂", rows: [{ key: "skin", label: "Teint de peau", swatch: true }] },
  { id: "cheveux", label: "Cheveux", icon: "💈", rows: [{ key: "hair", label: "Coiffure" }, { key: "hairColor", label: "Couleur", swatch: true }, { key: "beard", label: "Moustache" }] },
  { id: "silhouette", label: "Silhouette", icon: "🧍", rows: [{ key: "build", label: "Carrure" }, { key: "height", label: "Taille" }] },
  { id: "tenue", label: "Tenue", icon: "🤵", rows: [{ key: "suit", label: "Costume", swatch: true }, { key: "shirt", label: "Chemise", swatch: true }, { key: "tie", label: "Cravate", swatch: true }, { key: "glasses", label: "Lunettes" }, { key: "watch", label: "Montre" }] },
];

/** Atelier de personnalisation : aperçu à gauche, réglages à droite. `rank` limite les costumes et accessoires prestigieux. */
export function AvatarEditor({ avatar, onChange, rank = 0 }: { avatar: Avatar; onChange: (a: Avatar) => void; rank?: number }) {
  const [tab, setTab] = useState("visage");
  const t = TABS.find((x) => x.id === tab)!;
  const av = avatar;
  const set = (k: Key, v: number | boolean) => onChange({ ...av, [k]: v } as Avatar);
  const pickTab = (id: string) => setTab(id);
  return <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]" data-testid="avatar-editor">
    <div className="flex items-center justify-center rounded-xl border border-ink-700 bg-ink-900 p-6" data-testid="avatar-preview"><AvatarPortrait avatar={av} size={240} title="Aperçu de votre personnage" /></div>
    <div>
      <div role="tablist" aria-label="Personnaliser" className="mb-3 flex flex-wrap gap-1.5">
        {TABS.map((x) => <button key={x.id} role="tab" aria-selected={tab === x.id} data-testid={`av-tab-${x.id}`} onClick={() => pickTab(x.id)} className={`rounded-full border px-3 py-1 text-xs ${tab === x.id ? "border-gold bg-gold/15 text-white" : "border-ink-600 bg-ink-850 text-ink-300 hover:text-white"}`}><span aria-hidden>{x.icon} </span>{x.label}</button>)}
      </div>
      <div className="space-y-3" role="tabpanel">
        {t.rows.map((row) => { const list = AVATAR_LISTS[row.key]; return <fieldset key={row.key}>
          <legend className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-400">{row.label}</legend>
          <div className="flex flex-wrap gap-1.5">{list.map((o, i) => { const locked = (o.unlock ?? 0) > rank, on = av[row.key] === i; return <button key={i} type="button" data-testid={`av-${row.key}-${i}`} aria-pressed={on} disabled={locked} title={locked ? `${o.label} — débloqué au grade ${o.unlock}` : o.label} aria-label={locked ? `${o.label} (verrouillé, grade ${o.unlock})` : o.label}
            onClick={() => set(row.key, i)} className={`relative flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition ${on ? "border-gold bg-gold/15 text-white" : "border-ink-600 bg-ink-850 text-ink-200 hover:border-ink-400"} ${locked ? "opacity-45" : ""}`}>
            {row.swatch && o.color && <span aria-hidden className="inline-block h-3.5 w-3.5 rounded-full border border-white/30" style={{ background: o.color }} />}{o.label}{locked ? <span aria-hidden> 🔒</span> : null}
          </button>; })}</div>
        </fieldset>; })}
      </div>
    </div>
  </div>;
}
