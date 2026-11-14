"use client";
import Link from "next/link";
import { useState } from "react";
import { useView } from "@/lib/hooks";
import { Card, PageTitle, Loading, Badge, Tabs } from "@/components/ui";
import { fmtDateTime, fmtShortDate } from "@/engine/time";

const CATS: Record<string, string> = { "": "Tout", macro: "Macroéconomie", entreprises: "Entreprises", banques_centrales: "Banques centrales", geopolitique: "Géopolitique", matieres: "Matières premières", marches: "Marchés", reglementation: "Réglementation", crises: "Crises" };
export default function Actualites() {
  const { data } = useView<any>("news");
  const [cat, setCat] = useState("");
  if (!data) return <Loading />;
  const news = data.news.filter((n: any) => !cat || n.category === cat);
  return <>
    <PageTitle env="Centre d'actualités économiques" title="Le Journal des Marchés" subtitle="Toutes les nouvelles sont générées à partir de l'état réel de la simulation et influencent les prix." />
    <div className="mb-4"><Tabs tabs={Object.entries(CATS).map(([id, label]) => ({ id, label }))} value={cat} onChange={setCat} /></div>
    <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
      <div className="space-y-2">{news.map((n: any) => <article key={n.id} className={`panel p-4 ${n.impact === "fort" ? "border-l-4 border-l-red-500" : n.impact === "moyen" ? "border-l-4 border-l-amber-400" : ""}`}>
        <div className="mb-1 flex flex-wrap items-center gap-2 text-[11px] text-ink-400"><span className="num">{fmtDateTime(n.t)}</span><Badge>{CATS[n.category]}</Badge><Badge tone={n.impact === "fort" ? "loss" : n.impact === "moyen" ? "warn" : "neutral"}>impact {n.impact}</Badge>{n.tickers.filter(Boolean).map((t: string) => <Link key={t} href={`/play/actif/${t}`} className="text-accent">{t}</Link>)}</div>
        <h3 className="font-semibold text-white">{n.title}</h3><p className="mt-1 text-sm text-ink-300">{n.body}</p></article>)}</div>
      <div className="space-y-4">
        <Card title="Chocs récents intégrés aux prix"><ul className="space-y-1 text-xs">{data.impulses.map((i: any) => <li key={i.id} className="flex justify-between gap-2"><span className="text-ink-300">{i.source}</span><span className={`num ${i.totalLogReturn >= 0 ? "text-gain" : "text-loss"}`}>{(i.totalLogReturn * 100).toFixed(1)} %</span></li>)}</ul><p className="mt-2 text-[11px] text-ink-500">Les chocs sont intégrés progressivement pendant les heures de cotation (et en gap à l'ouverture si la nouvelle tombe marché fermé).</p></Card>
        <Card title="Historique des régimes de marché"><ul className="space-y-1 text-xs">{[...data.regimes].reverse().map((r: any, i: number) => <li key={i} className="flex justify-between"><span>{r.label}</span><span className="num text-ink-400">{fmtShortDate(r.day * 1440)}</span></li>)}</ul></Card>
      </div>
    </div>
  </>;
}
