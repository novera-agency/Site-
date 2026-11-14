"use client";
import { useView } from "@/lib/hooks";
import { Card, PageTitle, Loading, Badge, Table } from "@/components/ui";
import { fmtDate } from "@/engine/time";
import { ZONE_LABEL } from "@/lib/format";

export default function Calendrier() {
  const { data } = useView<any>("calendar", {}, 5000);
  if (!data) return <Loading />;
  const byDay: Record<number, any[]> = {};
  for (const e of data.events) (byDay[e.day] ??= []).push(e);
  return <>
    <PageTitle env="Centre d'actualités" title="Calendrier économique" subtitle="Banques centrales, statistiques (IPC, emploi, PIB, PMI), résultats d'entreprises, dividendes, observations de produits structurés. Consensus vs réalisé." />
    <div className="space-y-3">{Object.entries(byDay).map(([day, evs]) => <Card key={day} title={<span className="capitalize">{fmtDate(Number(day) * 1440)}{Number(day) === data.today && " — aujourd'hui"}</span>}>
      <Table head={["Heure", "Événement", "Zone", "Importance", "Consensus", "Réalisé"]}>{evs.map((e: any) => <tr key={e.id} className={e.done ? "opacity-60" : ""}><td className="num px-2 py-1 text-xs">{String(Math.floor(e.minute / 60)).padStart(2, "0")}:{String(e.minute % 60).padStart(2, "0")}</td><td className="px-2">{e.title}</td><td className="px-2 text-xs">{e.zone ? ZONE_LABEL[e.zone] : "—"}</td><td className="px-2 text-gold">{"●".repeat(e.importance)}</td><td className="num px-2 text-xs">{e.kind === "banque_centrale" && e.consensus !== undefined && e.consensus !== "" ? `${Number(e.consensus) > 0 ? "+" : ""}${Math.round(Number(e.consensus) * 100)} pb` : e.consensus ?? "—"}</td><td className="num px-2 text-xs">{e.actual ? <Badge tone="gold">{e.actual}</Badge> : e.done ? "publié" : "—"}</td></tr>)}</Table>
    </Card>)}</div>
  </>;
}
