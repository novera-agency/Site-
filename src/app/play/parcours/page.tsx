"use client";
import Link from "next/link";
import { useView, useAction } from "@/lib/hooks";
import { Card, PageTitle, Loading, Badge, Bar, Button } from "@/components/ui";
import { saveToHallOfFame } from "@/lib/hall";

const eur = (v: number) => `${Math.round(v).toLocaleString("fr-FR")} €`;
const PART: Record<string, string> = { patrimoine: "Patrimoine", carriere: "Carrière", reputation: "Réputation", succes: "Succès", equilibre: "Équilibre de vie", parcours: "Parcours" };

export default function Parcours() {
  const { data } = useView<any>("progress", {}, 5000);
  const act = useAction();
  if (!data) return <Loading />;
  if (data.mode !== "carriere") return <><PageTitle env="Bureau" title="Parcours et succès" /><Card><p className="text-sm text-ink-300">Le parcours guidé et les succès sont disponibles en mode carrière.</p></Card></>;
  const done = data.achievements.filter((a: any) => a.done).length;
  return <>
    <PageTitle env="Bureau" title="Parcours et succès" subtitle="Votre carrière en chapitres : chacun vous fait découvrir une partie du jeu. Les succès récompensent vos exploits (et vos échecs mémorables)." />
    <div className="mb-4 grid gap-3 md:grid-cols-3">
      <Card><div className="text-xs text-ink-400">Score de carrière</div><div className="num text-2xl font-semibold text-gold" data-testid="score">{data.score.total}</div><div className="mt-1 flex flex-wrap gap-x-3 text-[11px] text-ink-400">{Object.entries(data.score.parts).map(([k, v]) => <span key={k}>{PART[k]} {v as number}</span>)}</div></Card>
      <Card><div className="text-xs text-ink-400">Chapitres</div><div className="num text-2xl font-semibold">{data.chapters.filter((c: any) => c.done).length} / {data.chapters.length}</div><div className="mt-2"><Bar value={data.chapters.filter((c: any) => c.done).length} max={data.chapters.length} tone="gold" /></div></Card>
      <Card><div className="text-xs text-ink-400">Succès</div><div className="num text-2xl font-semibold">{done} / {data.achievements.length}</div><div className="mt-2"><Bar value={done} max={data.achievements.length} tone="gain" /></div></Card>
    </div>

    <Card title="🧭 Parcours" className="mb-4">
      <ol className="space-y-3" data-testid="chapters">{data.chapters.map((c: any, i: number) => <li key={c.id} className={`rounded-lg border p-3 ${c.current ? "border-gold/60 bg-yellow-500/5" : c.done ? "border-ink-700 bg-ink-900 opacity-80" : "border-ink-800 bg-ink-950 opacity-75"}`}>
        <div className="flex items-center justify-between gap-2"><div className="font-semibold text-white">Chapitre {i + 1} — {c.title}</div>{c.done ? <Badge tone="gain">terminé</Badge> : c.current ? <Badge tone="gold">en cours</Badge> : <Badge>à venir</Badge>}</div>
        {(c.current || c.done) && <p className="mt-1 text-xs text-ink-400">{c.intro}</p>}
        {c.current && <ul className="mt-2 space-y-1.5">{c.objectives.map((o: any) => <li key={o.id} className="flex items-start gap-2 text-sm"><span className={o.done ? "text-gain" : "text-ink-500"}>{o.done ? "✔" : "○"}</span><span className="min-w-0 flex-1"><span className={o.done ? "text-ink-400 line-through" : "text-white"}>{o.label}</span>{!o.done && <span className="block text-[11px] text-ink-400">{o.hint} <Link href={o.link} className="text-accent">Y aller →</Link></span>}</span></li>)}</ul>}
        {c.current && <p className="mt-2 text-[11px] text-gold/80">Récompense : {c.reward}</p>}
      </li>)}</ol>
    </Card>

    <Card title="🏆 Succès" className="mb-4">
      <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3" data-testid="achievements">{data.achievements.map((a: any) => <div key={a.id} className={`flex items-center gap-3 rounded-lg border p-2.5 ${a.done ? "border-gold/50 bg-yellow-500/5" : "border-ink-800 bg-ink-900 opacity-75"}`}>
        <span className={`text-2xl ${a.done ? "" : "grayscale"}`}>{a.done || !a.secret ? a.icon : "❔"}</span>
        <span className="min-w-0"><span className="block text-sm font-medium text-white">{a.done || !a.secret ? a.title : "Succès secret"}</span><span className="block text-[11px] text-ink-400">{a.done || !a.secret ? a.desc : "À découvrir…"}</span></span>
      </div>)}</div>
    </Card>

    <Card title="🏁 Fin de carrière">
      {data.ended ? <p className="text-sm">{data.ended.title} — score final <b>{data.ended.score}</b>.</p> : <>
        <p className="text-sm text-ink-300">La partie peut continuer aussi longtemps que vous le souhaitez. Quand vous le voudrez, terminez-la pour inscrire votre score au tableau d'honneur.</p>
        <div className="mt-2 text-xs text-ink-400">Âge actuel : {data.age} ans · patrimoine : {eur(data.wealth.total)}. Retraite possible à 55 ans ou avec 2 M€ ; « Empire bâti » avec 50 M€. La faillite personnelle survient après quatre mois de lourd découvert.</div>
        <div className="mt-3 flex flex-wrap gap-2">{data.endings.length ? data.endings.map((e: any) => <Button key={e.id} data-testid={`end-${e.id}`} onClick={async () => { const r = await act({ type: "end_game", ending: e.id }); if (r?.ok) saveToHallOfFame(); }}>{e.id === "retraite" ? "🌅 Prendre ma retraite" : "👑 Proclamer mon empire"}</Button>) : <span className="text-sm text-ink-500">Aucune fin disponible pour l'instant.</span>}</div>
      </>}
    </Card>
  </>;
}
