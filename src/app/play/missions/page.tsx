"use client";
import { useState } from "react";
import Link from "next/link";
import { useGame } from "@/lib/store";
import { useView, useAction } from "@/lib/hooks";
import { Card, PageTitle, Loading, Badge, Bar, Button, inputCls, Tabs, Empty } from "@/components/ui";
import { fmtShortDate } from "@/engine/time";

function MissionQuiz({ m }: { m: any }) {
  const act = useAction();
  const [v, setV] = useState("");
  const q = m.question;
  if (!q) return null;
  if (q.kind === "numeric") return <div className="mt-2 rounded bg-ink-900 p-2"><div className="text-sm">{q.question}</div><div className="mt-1 flex gap-2"><input value={v} onChange={(e) => setV(e.target.value)} className={inputCls} placeholder={q.unit} /><Button onClick={() => act({ type: "answer_mission", missionId: m.id, value: Number(v.replace(",", ".")) })}>Répondre</Button></div></div>;
  if (q.kind === "choice") return <div className="mt-2 rounded bg-ink-900 p-2"><div className="text-sm">{q.question}</div><div className="mt-1 flex flex-wrap gap-2">{q.options.map((o: string, i: number) => <Button key={o} variant="outline" size="sm" onClick={() => act({ type: "answer_mission", missionId: m.id, choice: i })}>{o}</Button>)}</div></div>;
  return <div className="mt-2 rounded bg-ink-900 p-2"><div className="text-sm">{q.question} {q.answered && <Badge tone="info">prévision : {q.answered}</Badge>}</div>{!q.answered && <div className="mt-1 flex gap-2">{q.options.map((o: string) => <Button key={o} variant="outline" size="sm" onClick={() => act({ type: "answer_mission", missionId: m.id, forecast: o })}>{o.replace("_", " ")}</Button>)}</div>}</div>;
}
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
  return <>
    <PageTitle env="Carrière" title="Missions et objectifs" subtitle="Chaque mission a des critères explicites, évalués automatiquement par le moteur à partir de vos actions réelles." right={<Tabs tabs={[{ id: "active", label: "En cours" }, { id: "done", label: "Terminées" }]} value={tab} onChange={setTab} />} />
    {list.length === 0 ? <Empty>Aucune mission.</Empty> : <div className="grid gap-4 lg:grid-cols-2">{list.map((m: any) => <Card key={m.id} title={m.title} right={<Badge tone={m.status === "reussie" ? "gain" : m.status === "echouee" ? "loss" : "info"}>{m.status === "active" ? `à rendre ${due(m.deadlineT, now)} (${fmtShortDate(m.deadlineT)})` : m.status === "reussie" ? "réussie" : "échouée"}</Badge>}>
      {m.giverInfo ? <div className="mb-3 flex items-center gap-3 rounded-lg bg-ink-900 p-2.5"><span className="text-3xl">{m.giverInfo.avatar}</span><div className="min-w-0"><div className="text-[11px] uppercase tracking-wider text-ink-400">Mission confiée par</div><div className="font-semibold text-white">{m.giverInfo.name}</div><div className="text-xs text-ink-300">{m.giverInfo.role}</div></div></div> : <div className="mb-3 text-xs text-ink-400">Objectif personnel</div>}
      <p className="text-sm text-ink-100">{m.description}</p>
      {m.status === "active" && m.guide && <div className="mt-3 rounded-lg border border-blue-500/30 bg-blue-500/5 p-3"><div className="mb-1 text-[11px] font-semibold uppercase tracking-wider text-blue-300">Comment faire</div><ol className="list-decimal space-y-1 pl-5 text-sm text-ink-100">{m.guide.steps.map((x: string, i: number) => <li key={i}>{x}</li>)}</ol><Link href={m.guide.link} className="mt-2 inline-block rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white">{m.guide.linkLabel} →</Link></div>}
      <div className="mt-3 text-[11px] uppercase tracking-wider text-ink-400">Critères de réussite</div>
      <ul className="text-sm text-ink-300">{m.criteria.map((c: string) => <li key={c}>✓ {c}</li>)}</ul>
      <div className="mt-2 flex items-center gap-2 text-xs"><span className="text-ink-400">Progression</span><div className="flex-1"><Bar value={m.progress * 100} tone={m.status === "echouee" ? "loss" : "gain"} /></div><span className="num">{Math.round(m.progress * 100)} %</span></div>
      <div className="mt-1 text-[11px] text-ink-400">Récompense : {m.reward.xp} points d'expérience{m.giverInfo ? ` · confiance de ${m.giverInfo.name.split(" ")[0]} +${m.reward.trust?.delta ?? 0}` : ""}{m.params.rel !== undefined && ` · performance relative actuelle ${m.params.rel} %`}</div>
      {m.status === "active" && <MissionQuiz m={m} />}
    </Card>)}</div>}
  </>;
}
