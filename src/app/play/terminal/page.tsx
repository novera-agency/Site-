"use client";
import { useEffect, useMemo, useState } from "react";
import { useGame } from "@/lib/store";
import { useView, useAction } from "@/lib/hooks";
import { AssetPanel } from "@/components/AssetPanel";
import { Card, Change, PageTitle, inputCls } from "@/components/ui";
import { fmtPx } from "@/lib/format";

export default function Terminal() {
  const snap = useGame((s) => s.snap);
  const act = useAction();
  const { data } = useView<any>("search", {}, 60000);
  const [sel, setSel] = useState("XWLD");
  const [q, setQ] = useState("");
  useEffect(() => { act({ type: "tutorial_visit", page: "terminal" }, { silent: true }); }, [act]);
  const names: Record<string, string> = useMemo(() => Object.fromEntries((data?.list ?? []).map((x: any) => [x.id, x.n])), [data]);
  if (!snap) return null;
  const quotes = snap.quotes;
  const watch = (data?.watchlist ?? []).filter((w: string) => quotes[w]);
  const movers = Object.entries(quotes).filter(([k]) => !k.startsWith("OPT-") && !k.startsWith("IDX")).sort((a, b) => b[1][1] - a[1][1]);
  const results = q.length >= 1 ? (data?.list ?? []).filter((x: any) => x.id.toLowerCase().includes(q.toLowerCase()) || x.n.toLowerCase().includes(q.toLowerCase())).slice(0, 8) : [];
  const Row = ({ id }: { id: string }) => <button onClick={() => setSel(id)} className={`grid w-full grid-cols-[1fr_auto_64px] gap-2 rounded px-2 py-1 text-left text-xs hover:bg-ink-800 ${sel === id ? "bg-ink-700" : ""}`}><span className="truncate"><b>{id}</b> <span className="text-ink-400">{names[id] ?? ""}</span></span><span className="num">{fmtPx(quotes[id][0])}</span><span className="text-right"><Change v={quotes[id][1]} /></span></button>;
  return <>
    <PageTitle env="Salle des marchés · Terminal" title="Terminal de marché" subtitle="Données issues du moteur de simulation — cotations fictives, mises à jour en continu." />
    <div className="grid gap-4 xl:grid-cols-[280px_1fr]">
      <div className="space-y-4">
        <Card title="Recherche"><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Ticker ou nom…" className={inputCls} data-testid="terminal-search" />{results.map((r: any) => <button key={r.id} onClick={() => { setSel(r.id); setQ(""); }} className="mt-1 block w-full truncate rounded px-2 py-1 text-left text-xs hover:bg-ink-800"><b>{r.id}</b> {r.n}</button>)}</Card>
        <Card title="Liste de surveillance" pad={false}><div className="p-1">{watch.length ? watch.map((w: string) => <Row key={w} id={w} />) : <div className="p-3 text-xs text-ink-400">Ajoutez des instruments avec ☆.</div>}</div></Card>
        <Card title="Plus fortes hausses" pad={false}><div className="p-1">{movers.slice(0, 6).map(([k]) => <Row key={k} id={k} />)}</div></Card>
        <Card title="Plus fortes baisses" pad={false}><div className="p-1">{movers.slice(-6).reverse().map(([k]) => <Row key={k} id={k} />)}</div></Card>
      </div>
      <div className="min-w-0"><AssetPanel id={sel} compact /></div>
    </div>
  </>;
}
