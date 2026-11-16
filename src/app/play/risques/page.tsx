"use client";
import { useState } from "react";
import { useView, useAction } from "@/lib/hooks";
import { Card, PageTitle, Loading, Stat, Table, Badge, Bar, inputCls, Term, Button } from "@/components/ui";
import { HBars } from "@/components/charts";
import { fmtEur, fmtNum, fmtPct, ZONE_LABEL } from "@/lib/format";

export default function Risques() {
  const [account, setAccount] = useState<string | undefined>(undefined);
  const { data } = useView<any>("risk", { account }, 3000);
  const act = useAction();
  if (!data) return <Loading />;
  const v = data.var;
  const pct = data.limit ? (v.var / data.limit) * 100 : 0;
  return <>
    <PageTitle env="Salle de gestion des risques" title="Gestion des risques" subtitle="VaR historique, stress tests, concentration, risque de crédit des émetteurs et santé du système bancaire." right={<div className="flex gap-2"><select aria-label="Compte" value={account ?? data.account?.id} onChange={(e) => setAccount(e.target.value)} className={inputCls + " w-60"}>{data.accounts.map((a: any) => <option key={a.id} value={a.id}>{a.label}</option>)}</select><Button variant="ghost" onClick={() => act({ type: "start_meeting", template: "comite_risques" })}>Convoquer le comité</Button></div>} />
    <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-6">
      <Card><Stat label={<Term id="var">VaR 99 % 1 j</Term>} value={fmtEur(v.var)} sub={`${v.scenarios} scénarios`} /></Card>
      <Card><Stat label="Expected shortfall" value={fmtEur(v.es)} /></Card>
      {data.limit !== null && <Card><Stat label="Limite du desk" value={fmtEur(data.limit)} sub={`${pct.toFixed(0)} % consommés`} tone={pct > 100 ? "loss" : "neutral"} /><div className="mt-2"><Bar value={pct} tone={pct > 100 ? "loss" : pct > 80 ? "warn" : "gain"} /></div></Card>}
      <Card><Stat label="Indice de volatilité" value={fmtNum(data.vix, 1)} /></Card>
      <Card><Stat label="Aversion au risque" value={`${Math.round(data.riskAversion * 100)}/100`} /></Card>
      <Card><Stat label="Liquidité de marché" value={`${Math.round(data.liquidity * 100)}/100`} tone={data.liquidity < 0.7 ? "loss" : "neutral"} sub={`incidents : ${data.breaches} · avertissements : ${data.warnings}`} /></Card>
    </div>
    <div className="grid gap-4 xl:grid-cols-3">
      <Card title="Stress tests (choc instantané)"><Table head={["Scénario", "P&L estimé"]}>{v.stressed.map((s: any) => <tr key={s.name}><td className="px-2 py-1.5">{s.name}</td><td className={`num px-2 text-right ${s.pnl > 0 ? "text-gain" : s.pnl < 0 ? "text-loss" : "text-ink-300"}`}>{fmtEur(s.pnl)}</td></tr>)}</Table></Card>
      <Card title="Concentration"><HBars data={data.positions.sort((a: any, b: any) => b.notionalEur - a.notionalEur).slice(0, 10).map((p: any) => [p.instrumentId, p.weight])} /><div className="mt-2 text-xs text-ink-400">Plafond par position (desk) : {fmtPct(data.maxPos * 100, 0, false)} du capital.</div></Card>
      <Card title="Expositions géographiques"><HBars data={Object.entries(data.exposures.zone).map(([k, x]) => [ZONE_LABEL[k] ?? k, x as number])} /></Card>
      <Card title={<span><Term id="risque_credit">Risque de crédit</Term> des émetteurs</span>} className="xl:col-span-2"><Table head={["Obligation", "Émetteur", "Note", "Spread (pb vs État 10 ans)", "Stress", ""]}>{data.credit.map((c: any) => <tr key={c.id}><td className="px-2 py-1">{c.id}</td><td className="px-2 text-xs">{c.issuer}</td><td className="px-2">{c.rating}</td><td className="num px-2">{c.spread}</td><td className="w-32 px-2"><Bar value={c.stress * 100} tone={c.stress > 0.4 ? "loss" : c.stress > 0.15 ? "warn" : "gain"} /></td><td className="px-2">{c.defaulted && <Badge tone="loss">défaut</Badge>}</td></tr>)}</Table><p className="mt-2 text-xs text-ink-400">L'élargissement des spreads et la hausse du stress d'un émetteur sont des signaux faibles : ils précèdent souvent les crises.</p></Card>
      <Card title="Santé des établissements"><Table head={["Banque", "Santé", "Dépôts"]}>{data.banks.map((b: any) => <tr key={b.id}><td className="px-2 py-1 text-xs">{b.name}</td><td className="w-28 px-2"><Bar value={b.health * 100} tone={b.health < 0.4 ? "loss" : b.health < 0.65 ? "warn" : "gain"} /></td><td className="num px-2 text-xs">{fmtPct(b.deposits * 100 - 100, 1)}</td></tr>)}</Table></Card>
      {data.crises.length > 0 && <Card title="Journal des crises" className="xl:col-span-3">{data.crises.map((c: any) => <div key={c.id} className="mb-2 rounded bg-ink-900 p-2"><div className="flex items-center gap-2"><b>{c.label}</b>{c.target && <Badge>{c.target}</Badge>}<Badge tone={c.resolved ? "gain" : "loss"}>{c.resolved ? "résolue" : `phase ${c.phase}`}</Badge></div><ul className="mt-1 text-xs text-ink-300">{c.log.map((l: any, i: number) => <li key={i}>• {l.text}</li>)}</ul></div>)}</Card>}
    </div>
  </>;
}
