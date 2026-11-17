"use client";
import { useRef, useState } from "react";
import { type Avatar, AVATAR_LISTS, normalizeForModel } from "@/engine/avatar";
import { CreatorStage, webglOK, type CreatorHandle } from "./Stage3D";
import type { View } from "@/lib/three/stage";
import type { GestureId } from "@/lib/three/character/animator";

type Key = keyof Avatar;
/** Options réellement gérées par le modèle 3D (les autres réglages du moteur ne changent pas l'apparence et ne sont pas proposés) */
const ONLY: Partial<Record<Key, number[]>> = { hair: [0, 1, 3, 5], beard: [0, 3] };
const TABS: { id: string; label: string; icon: string; view: View; rows: { key: Key; label: string; swatch?: boolean }[] }[] = [
  { id: "visage", label: "Teint", icon: "🙂", view: "portrait", rows: [{ key: "skin", label: "Teint de peau", swatch: true }] },
  { id: "cheveux", label: "Cheveux", icon: "💈", view: "portrait", rows: [{ key: "hair", label: "Coiffure" }, { key: "hairColor", label: "Couleur", swatch: true }, { key: "beard", label: "Moustache" }] },
  { id: "silhouette", label: "Silhouette", icon: "🧍", view: "full", rows: [{ key: "build", label: "Carrure" }, { key: "height", label: "Taille" }] },
  { id: "tenue", label: "Tenue", icon: "🤵", view: "bust", rows: [{ key: "suit", label: "Costume", swatch: true }, { key: "shirt", label: "Chemise", swatch: true }, { key: "tie", label: "Cravate", swatch: true }, { key: "glasses", label: "Lunettes" }, { key: "watch", label: "Montre" }] },
];
const VIEWS: { id: View; label: string }[] = [{ id: "full", label: "En pied" }, { id: "threeQuarter", label: "Trois quarts" }, { id: "front", label: "Face" }, { id: "profile", label: "Profil" }, { id: "back", label: "Dos" }, { id: "bust", label: "Buste" }, { id: "portrait", label: "Portrait" }];
const GESTURES: { id: GestureId; label: string }[] = [
  { id: "bienvenue", label: "Bienvenue" }, { id: "salut", label: "Saluer" }, { id: "presenter", label: "Présenter" }, { id: "pointer", label: "Pointer" }, { id: "acquiescer", label: "Acquiescer" },
  { id: "cravate", label: "Ajuster la cravate" }, { id: "veste", label: "Replacer la veste" }, { id: "montre", label: "Regarder sa montre" }, { id: "bras_croises", label: "Bras croisés" },
  { id: "poches", label: "Mains en poches" }, { id: "reflechir", label: "Réfléchir" }, { id: "assurance", label: "Assurance" },
];

/** Atelier de personnalisation : aperçu 3D à gauche, réglages à droite. `rank` limite les costumes et accessoires prestigieux. */
export function AvatarEditor({ avatar, onChange, rank = 0 }: { avatar: Avatar; onChange: (a: Avatar) => void; rank?: number }) {
  const [tab, setTab] = useState("visage");
  const [view, setView] = useState<View>("full");
  const [fail, setFail] = useState(false);
  const [sitting, setSitting] = useState(false);
  const handle = useRef<CreatorHandle>(null);
  const t = TABS.find((x) => x.id === tab)!;
  const av = normalizeForModel(avatar);
  const set = (k: Key, v: number | boolean) => onChange({ ...av, [k]: v } as Avatar);
  const use3d = typeof window !== "undefined" && webglOK() && !fail;
  const pickTab = (id: string) => { setTab(id); setView(TABS.find((x) => x.id === id)!.view); };
  return <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]" data-testid="avatar-editor">
    <div>{use3d
      ? <>
        <CreatorStage ref={handle} avatar={av} view={view} onFail={() => setFail(true)} />
        <div className="mt-2 flex flex-wrap gap-1" role="group" aria-label="Angle de vue">{VIEWS.map((v) => <button key={v.id} type="button" data-testid={`av-view-${v.id}`} aria-pressed={view === v.id} onClick={() => setView(v.id)} className={`rounded-full border px-2.5 py-1 text-[11px] ${view === v.id ? "border-gold bg-gold/15 text-white" : "border-ink-600 bg-ink-850 text-ink-300 hover:text-white"}`}>{v.label}</button>)}</div>
        <details className="mt-2 rounded-lg border border-ink-700 bg-ink-900/60 p-2" data-testid="av-anims" open>
          <summary className="cursor-pointer text-xs font-semibold text-ink-200">Animations</summary>
          <div className="mt-2 flex flex-wrap gap-1" role="group" aria-label="Gestes">
            {GESTURES.map((g) => <button key={g.id} type="button" data-testid={`av-gesture-${g.id}`} onClick={() => handle.current?.play(g.id)} className="rounded-md border border-ink-600 bg-ink-850 px-2 py-1 text-[11px] text-ink-100 hover:border-gold">{g.label}</button>)}
            <button type="button" data-testid="av-sit" aria-pressed={sitting} onClick={() => { const n = !sitting; setSitting(n); handle.current?.sit(n); }} className="rounded-md border border-ink-600 bg-ink-850 px-2 py-1 text-[11px] text-ink-100 hover:border-gold">{sitting ? "Se relever" : "S'asseoir"}</button>
            <button type="button" data-testid="av-look" onClick={() => handle.current?.lookAtMe(true)} className="rounded-md border border-ink-600 bg-ink-850 px-2 py-1 text-[11px] text-ink-100 hover:border-gold">Me regarder</button>
            <button type="button" data-testid="av-turn" onClick={() => handle.current?.turnToMe(true)} className="rounded-md border border-ink-600 bg-ink-850 px-2 py-1 text-[11px] text-ink-100 hover:border-gold">Se tourner vers moi</button>
            <button type="button" data-testid="av-walk" onClick={() => handle.current?.treadmill(1.5)} className="rounded-md border border-ink-600 bg-ink-850 px-2 py-1 text-[11px] text-ink-100 hover:border-gold">Marcher</button>
            <button type="button" data-testid="av-run" onClick={() => handle.current?.treadmill(3.9)} className="rounded-md border border-ink-600 bg-ink-850 px-2 py-1 text-[11px] text-ink-100 hover:border-gold">Courir</button>
            <button type="button" data-testid="av-stop" onClick={() => handle.current?.treadmill(0)} className="rounded-md border border-ink-600 bg-ink-850 px-2 py-1 text-[11px] text-ink-100 hover:border-gold">Arrêter</button>
            <button type="button" data-testid="av-smile" onClick={() => handle.current?.expression("smile")} className="rounded-md border border-ink-600 bg-ink-850 px-2 py-1 text-[11px] text-ink-100 hover:border-gold">Sourire</button>
            <button type="button" data-testid="av-surprise" onClick={() => handle.current?.expression("surprise")} className="rounded-md border border-ink-600 bg-ink-850 px-2 py-1 text-[11px] text-ink-100 hover:border-gold">Surprise</button>
            <button type="button" data-testid="av-reset" onClick={() => { setSitting(false); setView("full"); handle.current?.reset(); }} className="rounded-md border border-gold/60 bg-gold/10 px-2 py-1 text-[11px] text-gold hover:bg-gold/20">↺ Pose initiale</button>
          </div>
        </details>
      </>
      : <div className="flex aspect-[5/4] items-center justify-center rounded-xl border border-ink-700 bg-ink-900 p-4 text-center text-sm text-ink-400">L&apos;aperçu 3D n&apos;est pas disponible sur cet appareil : vos choix sont enregistrés et s&apos;afficheront ailleurs.</div>}
    </div>
    <div>
      <div role="tablist" aria-label="Personnaliser" className="mb-3 flex flex-wrap gap-1.5">
        {TABS.map((x) => <button key={x.id} role="tab" aria-selected={tab === x.id} data-testid={`av-tab-${x.id}`} onClick={() => pickTab(x.id)} className={`rounded-full border px-3 py-1 text-xs ${tab === x.id ? "border-gold bg-gold/15 text-white" : "border-ink-600 bg-ink-850 text-ink-300 hover:text-white"}`}><span aria-hidden>{x.icon} </span>{x.label}</button>)}
      </div>
      <div className="space-y-3" role="tabpanel">
        {t.rows.map((row) => { const list = AVATAR_LISTS[row.key]; const only = ONLY[row.key]; return <fieldset key={row.key}>
          <legend className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-ink-400">{row.label}</legend>
          <div className="flex flex-wrap gap-1.5">{list.map((o, i) => { if (only && !only.includes(i)) return null; const locked = (o.unlock ?? 0) > rank, on = av[row.key] === i; return <button key={i} type="button" data-testid={`av-${row.key}-${i}`} aria-pressed={on} disabled={locked} title={locked ? `${o.label} — débloqué au grade ${o.unlock}` : o.label} aria-label={locked ? `${o.label} (verrouillé, grade ${o.unlock})` : o.label}
            onClick={() => set(row.key, i)} className={`relative flex items-center gap-1.5 rounded-md border px-2 py-1 text-xs transition ${on ? "border-gold bg-gold/15 text-white" : "border-ink-600 bg-ink-850 text-ink-200 hover:border-ink-400"} ${locked ? "opacity-45" : ""}`}>
            {row.swatch && o.color && <span aria-hidden className="inline-block h-3.5 w-3.5 rounded-full border border-white/30" style={{ background: o.color }} />}{o.label}{locked ? <span aria-hidden> 🔒</span> : null}
          </button>; })}</div>
        </fieldset>; })}
      </div>
    </div>
  </div>;
}
