"use client";
import { useView } from "@/lib/hooks";
import { Card, PageTitle, Loading, Bar, Badge } from "@/components/ui";
import { fmtDateTime } from "@/engine/time";

export default function Reputation() {
  const { data } = useView<any>("skills", {}, 5000);
  if (!data) return <Loading />;
  return <>
    <PageTitle env="Réputation" title="Réputation et historique des décisions" subtitle={`Réputation moyenne : ${Math.round(data.avgRep)}/100. Les PNJ, recruteurs et clients en tiennent compte.`} />
    <div className="grid gap-4 xl:grid-cols-[1fr_1.4fr]">
      <Card title="Indicateurs"><div className="space-y-3">{data.reputation.map((r: any) => <div key={r.id}><div className="flex justify-between text-sm capitalize"><span>Réputation {r.name}</span><span className="num">{Math.round(r.value)}</span></div><Bar value={r.value} tone={r.value < 35 ? "loss" : r.value < 55 ? "warn" : "gain"} /></div>)}</div></Card>
      <Card title="Historique des décisions"><ul className="scroll-thin max-h-[560px] space-y-1 overflow-y-auto text-xs">{data.decisions.map((d: any, i: number) => <li key={i}><span className="num mr-2 text-ink-500">{fmtDateTime(d.t)}</span><Badge>{d.kind}</Badge> {d.text}</li>)}</ul></Card>
    </div>
  </>;
}
