"use client";
import { useEffect, useState } from "react";
import { useView, useAction } from "@/lib/hooks";
import { Card, PageTitle, Loading, Stat, Badge, Button, Bar, Empty, inputCls } from "@/components/ui";
import { LineChart } from "@/components/charts";
import { fmtEur, fmtPct, fmtNum } from "@/lib/format";
import { fmtDateTime } from "@/engine/time";

export default function Clients() {
  const { data } = useView<any>("clients", {}, 4000);
  const act = useAction();
  const [sel, setSel] = useState<string | null>(null);
  const [alloc, setAlloc] = useState<Record<string, number>>({});
  const c = data?.clients.find((x: any) => x.id === sel) ?? data?.clients.find((x: any) => !x.lost);
  useEffect(() => { if (c) setAlloc(Object.fromEntries(Object.entries(c.targetAllocation).map(([k, v]) => [k, Math.round((v as number) * 100)]))); }, [c?.id]);
  if (!data) return <Loading />;
  if (!data.clients.length) return <><PageTitle title="Clients" /><Empty>Aucun client. Votre réputation commerciale vous apportera des prospects.</Empty></>;
  const total = Object.values(alloc).reduce((a, b) => a + (b || 0), 0);
  const eqW = data.buckets.reduce((a: number, b: any) => a + ((alloc[b.id] ?? 0) / 100) * b.equity, 0);
  return <>
    <PageTitle env="Espace de gestion patrimoniale" title="Relation client" subtitle={`Encours total sous gestion : ${fmtEur(data.totalAum)} · collecte par téléphone : ${fmtEur(data.salesYtd)} · frais perçus (année) : ${fmtEur(data.feesYtd)}. Les fonds des clients sont ségrégués : ils ne se mélangent jamais aux vôtres ni à ceux de la banque.`} />
    <div className="mb-4 flex flex-wrap gap-2">{data.clients.map((x: any) => <button key={x.id} onClick={() => setSel(x.id)} className={`rounded-lg border px-3 py-2 text-left ${c?.id === x.id ? "border-accent bg-blue-500/10" : "border-ink-700 bg-ink-850"} ${x.lost ? "opacity-40" : ""}`}><div className="text-sm font-semibold">{x.npc?.avatar} {x.name}</div><div className="text-xs text-ink-400">{fmtEur(x.aum)} · satisfaction {Math.round(x.satisfaction)}</div></button>)}</div>
    {c && <div className="grid gap-4 xl:grid-cols-3">
      <Card title={`${c.name}${c.lost ? " (perdu)" : ""}`} right={<Badge>{c.kind}</Badge>}>
        <div className="grid grid-cols-2 gap-3"><Stat label="Encours" value={fmtEur(c.aum)} /><Stat label="Patrimoine total" value={fmtEur(c.wealth)} /><Stat label="Performance" value={fmtPct(c.perf.totalReturn * 100)} tone={c.perf.totalReturn >= 0 ? "gain" : "loss"} /><Stat label="Drawdown max" value={fmtPct(-c.perf.maxDrawdown * 100)} /><Stat label="Profil de risque" value={`${c.riskTolerance}/7`} /><Stat label="Horizon" value={`${c.horizonYears} ans`} /><Stat label="Rendement attendu" value={fmtPct(c.expectedReturn * 100, 1, false)} /><Stat label="Frais" value={`${c.feeBps} pb`} /></div>
        <div className="mt-3 space-y-2 text-sm"><div><span className="text-ink-400">Objectif :</span> {c.objective}</div><div><span className="text-ink-400">Exigences :</span> {c.demands}</div><div><span className="text-ink-400">Contraintes :</span> {c.constraints.join(" ; ")}</div><div><span className="text-ink-400">Personnalité :</span> {c.npc?.personality}</div></div>
        <div className="mt-3"><div className="flex justify-between text-xs"><span>Satisfaction</span><span>{Math.round(c.satisfaction)}/100</span></div><Bar value={c.satisfaction} tone={c.satisfaction < 35 ? "loss" : c.satisfaction < 60 ? "warn" : "gain"} /><div className="mt-1 flex justify-between text-xs"><span>Confiance</span><span>{Math.round(c.npc?.trust ?? 50)}/100</span></div><Bar value={c.npc?.trust ?? 50} /></div>
        {!c.lost && <><Button data-testid="call-client" className="mt-3 w-full" onClick={() => act({ type: "call_client", clientId: c.id })}>📞 Appeler {c.name}</Button><p className="mt-1 text-[11px] text-ink-400">Appel commercial avec un objectif de collecte : chaque maladresse le réduit. Le client décroche plus volontiers en semaine entre 8 h et 20 h, et s'il est satisfait.</p></>}
      </Card>
      <Card title="Allocation du mandat" className="xl:col-span-2">
        <div className="grid gap-4 md:grid-cols-2">
          <div><div className="mb-2 text-[11px] uppercase text-ink-400">Allocation actuelle</div>{Object.entries(c.allocation).sort((a: any, b: any) => b[1] - a[1]).map(([k, v]) => <div key={k} className="mb-1 grid grid-cols-[120px_1fr_50px] items-center gap-2 text-xs"><span>{data.buckets.find((b: any) => b.id === k)?.label ?? k}</span><Bar value={(v as number) * 100} /><span className="num text-right">{fmtNum((v as number) * 100, 1)} %</span></div>)}<div className="mt-2 text-xs">Exposition actions actuelle : <b>{fmtPct(c.equityWeight * 100, 0, false)}</b> — bande adaptée au profil : {Math.round(c.band[0] * 100)}–{Math.round(c.band[1] * 100)} %</div></div>
          {!c.lost && <div><div className="mb-2 text-[11px] uppercase text-ink-400">Nouvelle allocation cible</div>{data.buckets.map((b: any) => <div key={b.id} className="mb-1 grid grid-cols-[130px_1fr] items-center gap-2 text-xs"><span>{b.label}</span><input type="number" min={0} max={100} value={alloc[b.id] ?? 0} onChange={(e) => setAlloc({ ...alloc, [b.id]: Math.max(0, Math.min(100, Number(e.target.value))) })} className={inputCls + " py-1"} /></div>)}<div className={`mt-2 text-xs ${total === 100 ? "text-gain" : "text-loss"}`}>Total : {total} % · exposition actions cible : {Math.round(eqW * 100)} % {eqW > c.band[1] || eqW < c.band[0] ? <span className="text-loss">— hors bande adaptée !</span> : <span className="text-gain">— adaptée</span>}</div><Button className="mt-2 w-full" disabled={total !== 100} onClick={() => act({ type: "rebalance", clientId: c.id, target: Object.fromEntries(Object.entries(alloc).filter(([, v]) => v > 0).map(([k, v]) => [k, v / 100])) })}>Valider et rééquilibrer</Button><p className="mt-1 text-[11px] text-ink-400">Le rééquilibrage génère de vrais ordres sur le compte du client (frais, spread, horaires de marché).</p></div>}
        </div>
        <div className="mt-4"><LineChart height={160} series={[{ name: "Valeur du mandat", color: "#22c55e", data: c.equityHistory }]} /></div>
      </Card>
      <Card title="Historique de la relation" className="xl:col-span-3"><ul className="space-y-1 text-sm">{c.history.map((h: any, i: number) => <li key={i}><span className="num mr-2 text-xs text-ink-500">{fmtDateTime(h.t)}</span>{h.text}</li>)}{c.npc?.memory?.slice(0, 5).map((m: any, i: number) => <li key={"m" + i} className="text-ink-400"><span className="num mr-2 text-xs text-ink-500">{fmtDateTime(m.t)}</span>Mémoire du client : {m.text} ({m.impact > 0 ? "+" : ""}{m.impact})</li>)}</ul></Card>
    </div>}
  </>;
}
