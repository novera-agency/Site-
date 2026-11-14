"use client";
import { useView, useAction } from "@/lib/hooks";
import { Card, PageTitle, Loading, Badge, Button } from "@/components/ui";
import { fmtDate, fmtTime, dayIndex } from "@/engine/time";
import { People } from "@/components/MeetingRoom";

export default function Agenda() {
  const { data } = useView<any>("agenda", {}, 3000);
  const act = useAction();
  if (!data) return <Loading />;
  const byDay: Record<number, any[]> = {};
  for (const a of data.agenda) (byDay[dayIndex(a.t)] ??= []).push(a);
  return <>
    <PageTitle env="Bureau" title="Agenda professionnel" subtitle="Réunions, appels et échéances. Un rendez-vous manqué dégrade votre fiabilité et la satisfaction des clients." right={<div className="flex gap-2"><Button variant="ghost" onClick={() => act({ type: "skip", to: "next_event" })}>⏭ Prochain rendez-vous</Button><Button variant="ghost" onClick={() => act({ type: "start_meeting", template: "comite_investissement" })}>Proposer un comité d'investissement</Button></div>} />
    <div className="space-y-3">{Object.entries(byDay).reverse().map(([d, items]) => <Card key={d} title={<span className="capitalize">{fmtDate(Number(d) * 1440)}</span>}><ul className="space-y-1">{items.map((a) => <li key={a.id} className="flex items-center gap-3 text-sm"><span className="num w-12 text-ink-400">{fmtTime(a.t)}</span><span className="flex-1">{a.title}{a.info && <span className="mt-0.5 block"><span className="mr-2 text-[11px] text-ink-400">📍 {a.info.location}</span><People people={a.info.participants} /></span>}</span>{a.meetingTemplate && <Badge tone="info">{a.kind}</Badge>}<Badge tone={a.status === "fait" ? "gain" : a.status === "manque" ? "loss" : a.status === "annule" ? "neutral" : a.t < data.t ? "warn" : "neutral"}>{a.status}</Badge></li>)}</ul></Card>)}</div>
  </>;
}
