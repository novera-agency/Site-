"use client";
import { useState } from "react";
import Link from "next/link";
import { useGame } from "@/lib/store";
import { MissionQuiz, HelpButton } from "@/components/MissionHelp";
import { useView, useAction } from "@/lib/hooks";
import { Card, PageTitle, Loading, Badge, Bar, Button, inputCls, Tabs, Empty } from "@/components/ui";
import { fmtShortDate } from "@/engine/time";
import { Portrait } from "@/components/Portrait";

function due(deadline: number, now: number) {
  const d = (deadline - now) / 1440;
  if (d < 0) return "échue";
  if (d < 1) return `dans ${Math.max(1, Math.round(d * 24))} h`;
  return `dans ${Math.round(d)} jour${Math.round(d) > 1 ? "s" : ""}`;
}
export default function Missions() {
  const { data } = useView<any>("missions", {}, 3000);
  const now = useGame((st) => st.snap?.t ?? 0);
  const [tab, setTab] = useState<"active" | "done">("active");
  if (!data) return <Loading />;
  const list = data.missions.filter((m: any) => (tab === "active" ? m.status === "active" : m.status !== "active"));
  const today = list.filter((m: any) => m.daily), other = list.filter((m: any) => !m.daily);
  const ap = data.appreciation as number;
  const STAKE: Record<number, [string, string, string]> = { 1: ["🟢 Enjeu faible", "gain", "Peu de risque, petite récompense."], 2: ["🟡 Enjeu moyen", "warn", "Récompense correcte ; un échec est remarqué."], 3: ["🔴 Enjeu élevé", "loss", "Grosse récompense et bonus ; un échec coûte cher en confiance et en réputation."] };
  const renderCard = (m: any) => (<Card key={m.id} title={m.title} right={<Badge tone={m.status === "reussie" ? "gain" : m.status === "echouee" ? "loss" : "info"}>{m.status === "active" ? `à rendre ${due(m.deadlineT, now)} (${fmtShortDate(m.deadlineT)})` : m.status === "reussie" ? "réussie" : "échouée"}</Badge>}>
      {m.giverInfo ? <div className="mb-3 flex items-center gap-3 rounded-lg bg-ink-900 p-2.5"><Portrait id={m.giverInfo.id} size={44} title={m.giverInfo.name} /><div className="min-w-0"><div className="text-[11px] uppercase tracking-wider text-ink-400">Mission confiée par</div><div className="font-semibold text-white">{m.giverInfo.name}</div><div className="text-xs text-ink-300">{m.giverInfo.role}</div></div></div> : <div className="mb-3 text-xs text-ink-400">Objectif personnel</div>}
      {m.daily && m.stakes && <div className="mb-2 flex flex-wrap items-center gap-2 text-xs"><Badge tone={STAKE[m.stakes][1] as any}>{STAKE[m.stakes][0]}</Badge><span className="text-ink-400">{STAKE[m.stakes][2]}</span></div>}
      <p className="text-sm text-ink-100">{m.description}</p>
      {m.status === "active" && <div className="mt-3 flex flex-wrap items-center gap-2 rounded-lg border border-ink-700 bg-ink-900 p-2.5"><HelpButton missionId={m.id} size="sm" /><span className="text-xs text-ink-400">Affiche les étapes et un conseil pour réussir dans un panneau à l'écran, même en changeant d'onglet.</span></div>}
      <div className="mt-3 text-[11px] uppercase tracking-wider text-ink-400">Critères de réussite</div>
      <ul className="text-sm text-ink-300">{m.criteria.map((c: string) => <li key={c}>✓ {c}</li>)}</ul>
      <div className="mt-2 flex items-center gap-2 text-xs"><span className="text-ink-400">Progression</span><div className="flex-1"><Bar value={m.progress * 100} tone={m.status === "echouee" ? "loss" : "gain"} /></div><span className="num">{Math.round(m.progress * 100)} %</span></div>
      <div className="mt-1 text-[11px] text-ink-400">Récompense : {m.reward.xp} points d'expérience{m.giverInfo ? ` · confiance de ${m.giverInfo.name.split(" ")[0]} +${m.reward.trust?.delta ?? 0}` : ""}{m.params.rel !== undefined && ` · performance relative actuelle ${m.params.rel} %`}</div>
      {m.status === "active" && <MissionQuiz m={m} />}
    </Card>);
  return <>
    <PageTitle env="Carrière" title="Missions et objectifs" subtitle="Chaque mission a des critères explicites, évalués automatiquement. Besoin d'un coup de main ? Activez l'aide 💡 sur la mission de votre choix." right={<Tabs tabs={[{ id: "active", label: "En cours" }, { id: "done", label: "Terminées" }]} value={tab} onChange={setTab} />} />
    {tab === "active" && <div className="mb-4 rounded-lg border border-ink-700 bg-ink-900 p-3 text-sm text-ink-200" data-testid="appreciation">
      <div className="flex flex-wrap items-center gap-3"><span>Appréciation de votre hiérarchie : <b className={ap >= 65 ? "text-gain" : ap >= 45 ? "text-amber-300" : "text-loss"}>{ap}/100</b></span><div className="w-40"><Bar value={ap} tone={ap >= 65 ? "gain" : ap >= 45 ? "warn" : "loss"} /></div></div>
      <p className="mt-1 text-xs text-ink-400">Chaque jour ouvré, de nouvelles missions arrivent. Plus vous êtes apprécié et gradé, plus on vous confie des dossiers à <b>fort enjeu</b> : grosses récompenses (expérience, réputation, bonus) mais lourdes conséquences en cas d'échec. Peu apprécié, vous recevez surtout des tâches sans risque… qui font peu progresser.</p>
    </div>}
    {list.length === 0 ? <Empty>Aucune mission.</Empty> : <>
      {tab === "active" && <h2 className="mb-2 mt-1 text-sm font-semibold uppercase tracking-wider text-gold">Missions du jour ({today.length})</h2>}
      {tab === "active" && (today.length ? <div className="mb-6 grid gap-4 lg:grid-cols-2" data-testid="daily-missions">{today.map((m: any) => renderCard(m))}</div> : <p className="mb-6 text-sm text-ink-400">Les missions du jour arrivent chaque jour ouvré, dès minuit.</p>)}
      {tab === "active" && other.length > 0 && <h2 className="mb-2 text-sm font-semibold uppercase tracking-wider text-ink-300">Dossiers de fond ({other.length})</h2>}
      <div className="grid gap-4 lg:grid-cols-2">{(tab === "active" ? other : list).map((m: any) => renderCard(m))}</div>
    </>}
  </>;
}
