"use client";
import { useView, useAction } from "@/lib/hooks";
import { Card, PageTitle, Loading, Badge, Button, Empty } from "@/components/ui";
import { fmtDateTime } from "@/engine/time";

export default function Reunions() {
  const { data } = useView<any>("meetings", {}, 3000);
  const act = useAction();
  if (!data) return <Loading />;
  return <>
    <PageTitle env="Salle de réunion" title="Réunions professionnelles" subtitle="Réunions du desk, comités, clients, crises, entretiens. Les réponses chiffrées sont vérifiées par le moteur avec les données réelles de votre book." />
    {data.pending && <Card title="Réunion en attente" className="mb-4"><div className="flex items-center justify-between"><span>{data.pending.title}</span><Button onClick={() => act({ type: "join_meeting" })}>Rejoindre</Button></div></Card>}
    {data.active && <Card title="Réunion en cours" className="mb-4"><div>{data.active.title} — utilisez le bouton « Retourner en réunion ».</div></Card>}
    <Card title="Provoquer une réunion" className="mb-4"><div className="flex flex-wrap gap-2"><Button variant="ghost" onClick={() => act({ type: "start_meeting", template: "comite_investissement" })}>Présenter une idée au comité d'investissement</Button><Button variant="ghost" onClick={() => act({ type: "start_meeting", template: "comite_risques" })}>Comité des risques</Button><Button variant="ghost" onClick={() => act({ type: "start_meeting", template: "desk_quotidien" })}>Point de desk</Button></div><p className="mt-2 text-xs text-ink-400">Une réunion de chaque type au maximum par jour simulé.</p></Card>
    <Card title="Historique">{data.history.length === 0 ? <Empty>Aucune réunion terminée.</Empty> : <ul className="space-y-2">{data.history.map((h: any) => <li key={h.id} className="rounded bg-ink-900 p-2"><div className="flex flex-wrap items-center justify-between gap-2"><b className="text-sm">{h.title}</b><span className="num text-xs text-ink-400">{fmtDateTime(h.startedT)}</span></div><div className="text-xs text-ink-300">{h.outcome}</div><div className="mt-1 flex gap-1">{Object.entries(h.score).map(([k, v]) => <Badge key={k} tone={(v as number) > 0 ? "gain" : (v as number) < 0 ? "loss" : "neutral"}>{k} {v as number}</Badge>)}</div></li>)}</ul>}</Card>
  </>;
}
