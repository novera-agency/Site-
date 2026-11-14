"use client";
import Link from "next/link";
import { useState } from "react";
import { useView, useAction } from "@/lib/hooks";
import { Card, PageTitle, Loading, Stat, Table, Change, Badge, inputCls, Term, Button, Empty } from "@/components/ui";
import { LineChart, HBars } from "@/components/charts";
import { fmtEur, fmtPx, fmtNum, fmtPct, CLS_LABEL, ZONE_LABEL } from "@/lib/format";

export default function Portefeuille() {
  const [account, setAccount] = useState("perso");
  const { data } = useView<any>("portfolio", { account });
  const act = useAction();
  const [conv, setConv] = useState({ from: "EUR", to: "USD", amount: "" });
  if (!data) return <Loading />;
  if (data.error) return <div>{data.error}</div>;
  const a = data.account, p = a.perf, ex = data.exposures;
  const bm0 = data.benchmark[0]?.v, eq0 = data.history[0]?.v;
  return <>
    <PageTitle env="Portefeuille" title={a.label} subtitle={a.kind === "personnel" ? "Vos fonds propres, strictement séparés des capitaux de la banque et des clients." : a.kind === "desk" ? "Capital de la banque — soumis aux limites de risque du desk." : "Fonds confiés par le client (mandat)."} right={<select data-testid="portfolio-account" value={account} onChange={(e) => setAccount(e.target.value)} className={inputCls + " w-60"}>{data.accounts.map((x: any) => <option key={x.id} value={x.id}>{x.label}</option>)}</select>} />
    {a.marginCall && <div className="mb-4 rounded-md border border-red-500/50 bg-red-950/50 p-3 text-sm text-red-100">⚠ APPEL DE MARGE en cours : réduisez vos positions ou apportez des liquidités avant l'échéance, sinon liquidation forcée.</div>}
    <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-8">
      <Card><Stat label="Valeur totale" value={fmtEur(a.equity, 2)} /></Card>
      <Card><Stat label="Liquidités" value={fmtEur(a.cash, 2)} sub={Object.entries(a.cashByCur).map(([k, v]) => `${k} ${fmtNum(v as number, 2)}`).join(" · ")} /></Card>
      <Card><Stat label="Plus-values latentes" value={fmtEur(data.positions.reduce((s: number, x: any) => s + x.unrealizedEur, 0), 2)} tone={data.positions.reduce((s: number, x: any) => s + x.unrealizedEur, 0) >= 0 ? "gain" : "loss"} /></Card>
      <Card><Stat label="Plus-values réalisées" value={fmtEur(a.realized, 2)} tone={a.realized >= 0 ? "gain" : "loss"} /></Card>
      <Card><Stat label="Perf. cumulée" value={fmtPct(p.totalReturn * 100)} tone={p.totalReturn >= 0 ? "gain" : "loss"} sub={`annualisée ${fmtPct(p.annualized * 100)}`} /></Card>
      <Card><Stat label="Perf. du jour" value={fmtPct(p.dayReturn * 100)} tone={p.dayReturn >= 0 ? "gain" : "loss"} /></Card>
      <Card><Stat label={<Term id="sharpe">Sharpe</Term>} value={fmtNum(p.sharpe, 2)} sub={`vol. ${fmtPct(p.vol * 100, 1, false)}`} /></Card>
      <Card><Stat label="Drawdown max" value={fmtPct(-p.maxDrawdown * 100)} tone="loss" sub={`frais ${fmtEur(a.fees)} · revenus ${fmtEur(a.income)}`} /></Card>
    </div>
    <div className="grid gap-4 xl:grid-cols-3">
      <Card title="Évolution vs benchmark (ETF Monde)" className="xl:col-span-2"><LineChart series={[{ name: "Portefeuille (base 100)", color: "#3b82f6", data: data.history.map((h: any) => ({ t: h.t, v: eq0 ? (h.v / eq0) * 100 : 100 })) }, { name: "Benchmark", color: "#d4a94f", data: data.benchmark.filter((b: any) => b.t >= (data.history[0]?.t ?? 0) - 1440).map((b: any) => ({ t: b.t, v: bm0 ? (b.v / bm0) * 100 : 100 })) }]} height={240} /></Card>
      <Card title="Expositions"><div className="space-y-4"><div><div className="mb-1 text-[11px] uppercase text-ink-400">Secteur / classe</div><HBars data={Object.entries(ex.sector).sort((x: any, y: any) => Math.abs(y[1]) - Math.abs(x[1])).slice(0, 8) as [string, number][]} /></div><div><div className="mb-1 text-[11px] uppercase text-ink-400">Zone géographique</div><HBars data={Object.entries(ex.zone).map(([k, v]) => [ZONE_LABEL[k] ?? k, v]) as [string, number][]} /></div><div><div className="mb-1 text-[11px] uppercase text-ink-400">Devise (y compris liquidités)</div><HBars data={Object.entries(ex.currency) as [string, number][]} /></div><div className="text-xs text-ink-400">Concentration (HHI) {fmtNum(ex.hhi, 3)} · plus grosse ligne {fmtPct(ex.largestWeight, 1, false)} · levier brut {fmtNum(ex.grossLeverage, 2)}x</div></div></Card>
    </div>
    <Card title="Positions" className="mt-4">
      {data.positions.length === 0 ? <Empty>Aucune position. <Link href="/play/terminal" className="text-accent">Ouvrir le terminal</Link></Empty> : <Table head={["Instrument", "Classe", "Quantité", "PRU", "Cours", "Valeur (EUR)", "P&L latent", "%", "Jour", "Poids", ""]}>{data.positions.map((x: any) => <tr key={x.instrumentId} className="hover:bg-ink-800"><td className="px-2 py-1.5"><Link href={`/play/actif/${x.instrumentId}`} className="font-semibold text-accent">{x.instrumentId}</Link><div className="text-[11px] text-ink-400">{x.name}</div></td><td className="px-2 text-xs">{CLS_LABEL[x.cls]}</td><td className={`num px-2 ${x.qty < 0 ? "text-loss" : ""}`}>{fmtNum(x.qty, x.cls === "crypto" ? 4 : 0)}</td><td className="num px-2">{fmtPx(x.avgPrice)}</td><td className="num px-2">{fmtPx(x.price)} <span className="text-[10px] text-ink-500">{x.currency}</span></td><td className="num px-2">{fmtEur(x.mvEur, 2)}</td><td className={`num px-2 ${x.unrealizedEur >= 0 ? "text-gain" : "text-loss"}`}>{fmtEur(x.unrealizedEur, 2)}</td><td className="px-2"><Change v={x.unrealizedPct} /></td><td className="px-2"><Change v={x.dayChangePct} /></td><td className="num px-2">{fmtPct(x.weight, 1, false)}</td><td className="px-2"><Link href={`/play/actif/${x.instrumentId}`} className="text-xs text-accent">Trader</Link></td></tr>)}</Table>}
    </Card>
    {data.structured.length > 0 && <Card title="Produits structurés détenus" className="mt-4"><Table head={["Produit", "Nominal", "Valeur indicative", "Coupons perçus", "Statut"]}>{data.structured.map((h: any) => <tr key={h.id}><td className="px-2 py-1">{h.product?.name}</td><td className="num px-2">{fmtEur(h.nominal / 100)}</td><td className="num px-2">{fmtEur(h.value)}</td><td className="num px-2">{fmtEur(h.couponsPaid / 100, 2)}</td><td className="px-2"><Badge>{h.status}</Badge></td></tr>)}</Table></Card>}
    {(a.kind === "personnel" || a.kind === "desk") && <Card title="Conversion de devises" className="mt-4"><div className="flex flex-wrap items-end gap-2"><select value={conv.from} onChange={(e) => setConv({ ...conv, from: e.target.value })} className={inputCls + " w-24"}>{["EUR", "USD", "GBP", "CHF", "JPY", "CAD", "AUD", "CNY"].map((c) => <option key={c}>{c}</option>)}</select><span>→</span><select value={conv.to} onChange={(e) => setConv({ ...conv, to: e.target.value })} className={inputCls + " w-24"}>{["EUR", "USD", "GBP", "CHF", "JPY", "CAD", "AUD", "CNY"].map((c) => <option key={c}>{c}</option>)}</select><input value={conv.amount} onChange={(e) => setConv({ ...conv, amount: e.target.value })} placeholder="Montant" className={inputCls + " w-40"} /><Button onClick={() => act({ type: "convert", account, from: conv.from, to: conv.to, amount: Number(conv.amount) })} disabled={!(Number(conv.amount) > 0) || conv.from === conv.to}>Convertir</Button><span className="text-xs text-ink-400">Commission de change : {a.kind === "personnel" ? "0,25 %" : "0,02 %"} du montant.</span></div></Card>}
    {data.orders.length > 0 && <div className="mt-3 text-sm text-ink-300">{data.orders.length} ordre(s) en attente — <Link href="/play/ordres" className="text-accent">gérer</Link></div>}
    <div className="mt-2 text-xs text-ink-500">Marge requise : {fmtEur(a.marginReq)} · dépôts de garantie bloqués : {fmtEur(a.margin)} · pouvoir d'achat : {fmtEur(a.buyingPower)}</div>
  </>;
}
