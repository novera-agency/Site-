"use client";
import { useState } from "react";
import { type Avatar, AVATAR_LISTS, POCKET_UNLOCK, CUFFLINKS_UNLOCK } from "@/engine/avatar";
import { CreatorStage, webglOK } from "./Stage3D";
import type { Focus } from "@/lib/three/stage";

type Key = keyof Avatar;
const TABS: { id: string; label: string; icon: string; focus: Focus; rows: { key: Key; label: string; swatch?: boolean }[]; bools?: { key: "pocket" | "cufflinks"; label: string; unlock: number }[] }[] = [
  { id: "visage", label: "Visage", icon: "🙂", focus: "face", rows: [{ key: "skin", label: "Teint", swatch: true }, { key: "face", label: "Forme du visage" }, { key: "nose", label: "Nez" }, { key: "eyes", label: "Yeux", swatch: true }, { key: "brows", label: "Sourcils" }, { key: "age", label: "Âge apparent" }] },
  { id: "cheveux", label: "Cheveux", icon: "💈", focus: "face", rows: [{ key: "hair", label: "Coiffure" }, { key: "hairColor", label: "Couleur", swatch: true }, { key: "beard", label: "Barbe" }] },
  { id: "silhouette", label: "Silhouette", icon: "🧍", focus: "body", rows: [{ key: "build", label: "Carrure" }, { key: "height", label: "Taille" }] },
  { id: "tenue", label: "Tenue", icon: "🤵", focus: "bust", rows: [{ key: "suit", label: "Costume", swatch: true }, { key: "shirt", label: "Chemise", swatch: true }, { key: "tie", label: "Cravate" }, { key: "glasses", label: "Lunettes" }, { key: "watch", label: "Montre" }], bools: [{ key: "pocket", label: "Pochette", unlock: POCKET_UNLOCK }, { key: "cufflinks", label: "Boutons de manchette", unlock: CUFFLINKS_UNLOCK }] },
];

/** Atelier de personnalisation : aperçu 3D à gauche, réglages à droite. `rank` limite les costumes et accessoires prestigieux. */
export function AvatarEditor({ avatar, onChange, rank = 0 }: { avatar: Avatar; onChange: (a: Avatar) => void; rank?: number }) {
  const [tab, setTab] = useState("visage");
  const [fail, setFail] = useState(false);
  const t = TABS.find((x) => x.id === tab)!;
  const set = (k: Key, v: number | boolean) => onChange({ ...avatar, [k]: v } as Avatar);
  const use3d = typeof window !== "undefined" && webglOK() && !fail;
  return <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]" data-testid="avatar-editor">
    <div>{use3d
      ? <CreatorStage avatar={avatar} focus={t.focus} onFail={() => setFail(true)} />
      : <div className="flex aspect-[5/4] items-center justify-center rounded-xl border border-ink-700 bg-ink-900 p-4 text-center text-sm text-ink-400">L&apos;aperçu 3D n&apos;est pas disponible sur cet appareil : vos choix sont enregistrés et s&apos;afficheront ailleurs.</div>}
    </div>
    <div>
      <div role="tablist" aria-label="Personnaliser" className="mb-3 flex flex-wrap gap-1.5">
        {TABS.map((x) => <button key={x.id} role="tab" aria-selected={tab === x.id} data-testid={`av-tab-${x.id}`} onClick={() => setTab(x.id)} className={`rounded-full border px-3 py-1 text-xs ${tab === x.id ? "border-gold bg-gold/15 text-white" : "border-ink-600 bg-ink-850 text-ink-300 hover:text-white"}`}><span aria-hidden>{x.icon} </span>{x.label}</button>)}
      </div>
      <div className="space-y-3" role="tabpanel">
        {t.rows.map((row) => { const list = AVATAR_LISTS[row.key]; return <fieldset key={row.key}>
          <legend className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-400">{row.label}</legend>
          <div className="flex flex-wrap gap-1.5">{list.map((o, i) => { const locked = (o.unlock ?? 0) > rank, on = avatar[row.key] === i; return <button key={i} type="button" data-testid={`av-${row.key}-${i}`} aria-pressed={on} disabled={locked} title={locked ? `${o.label} — débloqué au grade ${o.unlock}` : o.label} aria-label={locked ? `${o.label} (verrouillé, grade ${o.unlock})` : o.label}
            onClick={() => set(row.key, i)} className={`relative flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition ${on ? "border-gold bg-gold/15 text-white" : "border-ink-600 bg-ink-850 text-ink-200 hover:border-ink-400"} ${locked ? "opacity-45" : ""}`}>
            {row.swatch && o.color && <span aria-hidden className="inline-block h-3.5 w-3.5 rounded-full border border-white/30" style={{ background: o.color }} />}{o.label}{locked ? <span aria-hidden> 🔒</span> : null}
          </button>; })}</div>
        </fieldset>; })}
        {t.bools?.map((b) => { const locked = rank < b.unlock; return <label key={b.key} className={`flex items-center gap-2 text-sm ${locked ? "opacity-50" : ""}`}><input type="checkbox" data-testid={`av-${b.key}`} disabled={locked} checked={avatar[b.key]} onChange={(e) => set(b.key, e.target.checked)} />{b.label}{locked ? <span className="text-[11px] text-ink-400"> — débloqué au grade {b.unlock} 🔒</span> : null}</label>; })}
      </div>
    </div>
  </div>;
}
