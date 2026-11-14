"use client";
import { useState } from "react";
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
export default function Missions() {
  const { data } = useView<any>("missions", {}, 3000);
  const [tab, setTab] = useState<"active" | "done">("active");
  if (!data) return <Loading />;
  const list = data.missions.filter((m: any) => (tab === "active" ? m.status === "active" : m.status !== "active"));
  return <>
    <PageTitle env="Carrière" title="Missions et objectifs" subtitle="Chaque mission a des critères explicites, évalués automatiquement par le moteur à partir de vos actions réelles." right={<Tabs tabs={[{ id: "active", label: "En cours" }, { id: "done", label: "Terminées" }]} value={tab} onChange={setTab} />} />
    {list.length === 0 ? <Empty>Aucune mission.</Empty> : <div className="grid gap-3 lg:grid-cols-2">{list.map((m: any) => <Card key={m.id} title={m.title} right={<Badge tone={m.status === "reussie" ? "gain" : m.status === "echouee" ? "loss" : "info"}>{m.status === "active" ? `échéance ${fmtShortDate(m.deadlineT)}` : m.status}</Badge>}>
      <p className="text-sm text-ink-200">{m.description}</p>
      <ul className="mt-2 text-xs text-ink-300">{m.criteria.map((c: string) => <li key={c}>✓ {c}</li>)}</ul>
      <div className="mt-2 flex items-center gap-2 text-xs"><span className="text-ink-400">Progression</span><div className="flex-1"><Bar value={m.progress * 100} tone={m.status === "echouee" ? "loss" : "gain"} /></div><span className="num">{Math.round(m.progress * 100)} %</span></div>
      <div className="mt-1 text-[11px] text-ink-400">Catégorie : {m.category} · Récompense : {m.reward.xp} XP {Object.entries(m.reward.rep).map(([k, v]) => `· réputation ${k} +${v}`).join(" ")}{m.params.rel !== undefined && ` · performance relative ${m.params.rel} %`}</div>
      {m.status === "active" && <MissionQuiz m={m} />}
    </Card>)}</div>}
  </>;
}
