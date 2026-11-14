"use client";
import Link from "next/link";
import { useView } from "@/lib/hooks";
import { Card, PageTitle, Loading, Table, Bar } from "@/components/ui";
import { fmtCompact, fmtPx } from "@/lib/format";

export default function Banques() {
  const { data } = useView<any>("banks", {}, 8000);
  if (!data) return <Loading />;
  return <>
    <PageTitle env="Concurrence" title="Établissements financiers" subtitle="Les banques concurrentes sont des agents : leurs encours, leur santé et leur appétit pour le risque évoluent avec le marché et influencent la liquidité." />
    <Card><Table head={["Établissement", "Stratégie", "Encours", "P&L de trading (année)", "Santé", "Réputation", "Appétit risque", "Action"]}>{data.banks.map((b: any) => <tr key={b.id}><td className="px-2 py-1.5 font-medium">{b.name}</td><td className="px-2 text-xs text-ink-300">{b.strategy}</td><td className="num px-2">{fmtCompact(b.aum)} €</td><td className={`num px-2 ${b.tradingPnlYtd >= 0 ? "text-gain" : "text-loss"}`}>{fmtCompact(b.tradingPnlYtd)} €</td><td className="w-28 px-2"><Bar value={b.health * 100} tone={b.health < 0.4 ? "loss" : b.health < 0.65 ? "warn" : "gain"} /></td><td className="num px-2">{Math.round(b.reputation)}</td><td className="num px-2">{Math.round(b.riskAppetite * 100)}</td><td className="px-2">{b.stockId ? <Link href={`/play/actif/${b.stockId}`} className="text-accent">{b.stockId} {fmtPx(b.price)}</Link> : "non cotée"}</td></tr>)}</Table></Card>
  </>;
}
