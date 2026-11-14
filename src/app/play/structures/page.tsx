"use client";
import { useState } from "react";
import { useView, useAction } from "@/lib/hooks";
import { Card, PageTitle, Loading, Badge, Button, inputCls, Table, Term, Stat } from "@/components/ui";
import { fmtEur, fmtPct, fmtNum } from "@/lib/format";
import { fmtShortDate } from "@/engine/time";

function Scenarios({ id }: { id: string }) {
  const { data } = useView<any>("scenarios", { id }, 60000);
  if (!data) return <div className="text-xs text-ink-400">Simulation Monte-Carlo…</div>;
  if (data.error) return null;
  const max = Math.max(1, ...data.histogram);
  return <div className="mt-2 rounded bg-ink-900 p-2"><div className="grid grid-cols-2 gap-2 md:grid-cols-4"><Stat label="Valeur indicative" value={fmtPct(data.fair * 100, 1, false)} sub="du nominal" /><Stat label="Prob. perte en capital" value={fmtPct(data.probCapitalLoss * 100, 0, false)} tone={data.probCapitalLoss > 0.2 ? "loss" : "neutral"} /><Stat label="Prob. remb. anticipé" value={fmtPct(data.probEarly * 100, 0, false)} /><Stat label="Coupons attendus" value={fmtPct(data.avgCoupons * 100, 1, false)} /></div><div className="mt-2 flex h-14 items-end gap-0.5">{data.histogram.map((h: number, i: number) => <div key={i} title={`${(i / 8 * 100).toFixed(0)}–${((i + 1) / 8 * 100).toFixed(0)} %`} className={`flex-1 rounded-t ${i < 8 ? "bg-loss/70" : "bg-gain/70"}`} style={{ height: `${(h / max) * 100}%` }} />)}</div><div className="text-[10px] text-ink-500">Distribution des remboursements actualisés (0 % → 150 % du nominal), 400 scénarios déterministes.</div></div>;
}
export default function Structures() {
  const { data } = useView<any>("structured", {}, 5000);
  const act = useAction();
  const [amt, setAmt] = useState<Record<string, string>>({});
  const [open, setOpen] = useState<string | null>(null);
  if (!data) return <Loading />;
  return <>
    <PageTitle env="Ingénierie financière" title="Produits structurés" subtitle={<>Autocall, Phoenix, reverse convertible, capital protégé, participation, barrière. Le moteur observe chaque date contractuelle et applique exactement les conditions. <Term id="structures">Une barrière n'est pas une garantie</Term> ; <Term id="contrepartie">le risque émetteur</Term> est réel.</>} />
    <Card title="Mes produits" className="mb-4">{data.holdings.length === 0 ? <div className="text-sm text-ink-400">Aucun produit souscrit.</div> : <Table head={["Produit", "Nominal", "Valeur indicative", "Coupons perçus", "Statut", "Journal"]}>{data.holdings.map((h: any) => { const p = data.products.find((x: any) => x.id === h.productId); return <tr key={h.id}><td className="px-2 py-1">{p?.name ?? h.productId}</td><td className="num px-2">{fmtEur(h.nominal)}</td><td className="num px-2">{h.status === "actif" ? fmtEur(h.value) : h.redemption !== undefined ? `remboursé ${fmtEur(h.redemption)}` : "—"}</td><td className="num px-2">{fmtEur(h.couponsPaid, 2)}</td><td className="px-2"><Badge tone={h.status === "defaut" ? "loss" : h.status === "actif" ? "info" : "gain"}>{h.status}</Badge></td><td className="px-2 text-[11px] text-ink-400">{h.log.slice(-2).join(" · ")}</td></tr>; })}</Table>}</Card>
    <div className="grid gap-4 lg:grid-cols-2">{data.products.map((p: any) => <Card key={p.id} title={p.name} right={<Badge tone={p.open ? "gain" : "neutral"}>{p.open ? `souscription jusqu'au ${fmtShortDate(p.subscriptionEndDay * 1440)}` : "fermé"}</Badge>}>
      <div className="mb-2 flex flex-wrap gap-1"><Badge>{p.kind}</Badge><Badge>Émetteur : {p.issuer}</Badge>{p.issuerStress > 0.15 && <Badge tone="loss">émetteur sous tension</Badge>}{p.touched && <Badge tone="loss">barrière touchée</Badge>}</div>
      <p className="text-xs text-ink-200">{p.description}</p>
      <div className="mt-2 grid grid-cols-2 gap-x-4 gap-y-1 text-xs md:grid-cols-3"><div>Sous-jacents : <b>{p.underlyings.join(", ")}</b></div><div>Performance actuelle : <b className={p.perf >= 1 ? "text-gain" : "text-loss"}>{fmtPct((p.perf - 1) * 100, 1)}</b></div><div>Coupon : <b>{fmtPct(p.couponRate * 100, 2, false)}</b> / an</div><div>Barrière protection : <b>{p.protectionBarrier ? fmtPct(p.protectionBarrier * 100, 0, false) : "—"}</b></div><div>Barrière coupon : <b>{fmtPct(p.couponBarrier * 100, 0, false)}</b></div><div>Rappel anticipé : <b>{p.autocallLevel < 10 ? fmtPct(p.autocallLevel * 100, 0, false) : "non"}</b></div><div>Lancement : {fmtShortDate(p.launchDay * 1440)}</div><div>Maturité : {fmtShortDate(p.maturityDay * 1440)}</div><div>Observations : {p.observationsDone}/{p.observationDays.length} (tous les {p.freqMonths} mois)</div></div>
      <button onClick={() => setOpen(open === p.id ? null : p.id)} className="mt-2 text-xs text-accent">{open === p.id ? "Masquer" : "Voir"} les scénarios de remboursement</button>
      {open === p.id && <Scenarios id={p.id} />}
      {p.open && <div className="mt-3 flex gap-2"><input placeholder={`Montant (min ${fmtNum(p.minTicket, 0)} €)`} value={amt[p.id] ?? ""} onChange={(e) => setAmt({ ...amt, [p.id]: e.target.value })} className={inputCls} /><Button onClick={() => act({ type: "subscribe", productId: p.id, nominal: Number(amt[p.id]) })} disabled={!(Number(amt[p.id]) >= p.minTicket)}>Souscrire</Button></div>}
    </Card>)}</div>
    <p className="mt-3 text-xs text-ink-500">Liquidités disponibles en euros : {fmtEur(data.cash, 2)}. Les produits sont conservés jusqu'à leur remboursement (pas de marché secondaire dans cette version).</p>
  </>;
}
