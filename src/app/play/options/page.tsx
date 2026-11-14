"use client";
import Link from "next/link";
import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { useView, useAction } from "@/lib/hooks";
import { useGame } from "@/lib/store";
import { Card, PageTitle, Loading, Button, inputCls, Badge, Term, Field } from "@/components/ui";
import { PayoffChart } from "@/components/charts";
import { blackScholes } from "@/engine/pricing";
import { fmtNum, fmtPx } from "@/lib/format";
import { fmtShortDate } from "@/engine/time";

type Leg = { type: "call" | "put" | "stock"; K: number; qty: number; premium: number; id?: string };
const STRATS: Record<string, { label: string; desc: string; build: (k: (o: number) => number, S: number) => { type: "call" | "put" | "stock"; o: number; qty: number }[] }> = {
  long_call: { label: "Achat de call", desc: "Pari haussier, perte limitée à la prime.", build: () => [{ type: "call", o: 0, qty: 1 }] },
  long_put: { label: "Achat de put", desc: "Pari baissier ou assurance, perte limitée à la prime.", build: () => [{ type: "put", o: 0, qty: 1 }] },
  covered_call: { label: "Covered call", desc: "Détenir le sous-jacent et vendre un call OTM : encaisser une prime contre un plafonnement du gain.", build: () => [{ type: "stock", o: 0, qty: 100 }, { type: "call", o: 2, qty: -1 }] },
  protective_put: { label: "Protective put", desc: "Détenir le sous-jacent et acheter un put : assurance contre la baisse.", build: () => [{ type: "stock", o: 0, qty: 100 }, { type: "put", o: -2, qty: 1 }] },
  bull_spread: { label: "Bull call spread", desc: "Acheter un call, vendre un call plus haut : hausse modérée, coût réduit.", build: () => [{ type: "call", o: 0, qty: 1 }, { type: "call", o: 2, qty: -1 }] },
  bear_spread: { label: "Bear put spread", desc: "Acheter un put, vendre un put plus bas : baisse modérée.", build: () => [{ type: "put", o: 0, qty: 1 }, { type: "put", o: -2, qty: -1 }] },
  straddle: { label: "Straddle", desc: "Call + put même strike : pari sur un fort mouvement (long volatilité).", build: () => [{ type: "call", o: 0, qty: 1 }, { type: "put", o: 0, qty: 1 }] },
  strangle: { label: "Strangle", desc: "Call OTM + put OTM : pari sur un très fort mouvement, moins cher.", build: () => [{ type: "call", o: 2, qty: 1 }, { type: "put", o: -2, qty: 1 }] },
  iron_condor: { label: "Iron condor", desc: "Vente d'un strangle protégé : gain si le marché reste dans une zone (short volatilité, risque limité).", build: () => [{ type: "put", o: -3, qty: 1 }, { type: "put", o: -1, qty: -1 }, { type: "call", o: 1, qty: -1 }, { type: "call", o: 3, qty: 1 }] },
};

function OptionsInner() {
  const sp = useSearchParams();
  const [und, setUnd] = useState(sp.get("u") ?? "XWLD");
  const [exp, setExp] = useState<number | undefined>(undefined);
  const { data } = useView<any>("chain", { id: und, expiry: exp }, 2000);
  const act = useAction();
  const explanations = useGame((s) => s.snap?.explanations);
  const [strat, setStrat] = useState("long_call");
  const [contracts, setContracts] = useState(1);
  const [ack, setAck] = useState(false);
  const [busy, setBusy] = useState(false);
  const legs: Leg[] = useMemo(() => {
    if (!data?.rows) return [];
    const atm = data.rows.reduce((b: number, r: any, i: number) => (Math.abs(r.K - data.spot) < Math.abs(data.rows[b].K - data.spot) ? i : b), 0);
    return STRATS[strat].build((o) => o, data.spot).map((l) => {
      if (l.type === "stock") return { type: "stock" as const, K: 0, qty: l.qty * contracts, premium: data.spot };
      const r = data.rows[Math.max(0, Math.min(data.rows.length - 1, atm + l.o))];
      const o = l.type === "call" ? r.call : r.put;
      return { type: l.type, K: r.K, qty: l.qty * contracts, premium: o.price, id: o.id };
    });
  }, [data, strat, contracts]);
  if (!data) return <Loading />;
  if (data.error) return <div>{data.error}</div>;
  const M = data.multiplier;
  const pnlAt = (S: number, T: number) => legs.reduce((a, l) => {
    if (l.type === "stock") return a + (S - l.premium) * l.qty;
    const v = T <= 0 ? Math.max(0, l.type === "call" ? S - l.K : l.K - S) : blackScholes(l.type, S, l.K, T, data.r, data.rows.find((r: any) => r.K === l.K)?.iv ?? data.baseVol, data.q).price;
    return a + (v - l.premium) * l.qty * M;
  }, 0);
  const lo = data.spot * 0.7, hi = data.spot * 1.3;
  const points = Array.from({ length: 81 }, (_, i) => { const S = lo + ((hi - lo) * i) / 80; return { x: S, y: pnlAt(S, 0), y2: pnlAt(S, data.T / 2) }; });
  const be: number[] = []; for (let i = 1; i < points.length; i++) if (Math.sign(points[i].y) !== Math.sign(points[i - 1].y) && points[i - 1].y !== 0) be.push(points[i - 1].x + (points[i].x - points[i - 1].x) * (-points[i - 1].y / (points[i].y - points[i - 1].y)));
  const maxG = Math.max(...points.map((p) => p.y)), maxL = Math.min(...points.map((p) => p.y));
  const cost = legs.reduce((a, l) => a + l.premium * l.qty * (l.type === "stock" ? 1 : M), 0);
  const greeks = legs.reduce((g, l) => { if (l.type === "stock") return { ...g, delta: g.delta + l.qty }; const b = blackScholes(l.type, data.spot, l.K, data.T, data.r, data.rows.find((r: any) => r.K === l.K)?.iv ?? data.baseVol, data.q); return { delta: g.delta + b.delta * l.qty * M, gamma: g.gamma + b.gamma * l.qty * M, theta: g.theta + b.theta * l.qty * M, vega: g.vega + b.vega * l.qty * M }; }, { delta: 0, gamma: 0, theta: 0, vega: 0 });
  const execute = async () => {
    setBusy(true);
    for (const l of legs) await act({ type: "order", account: "perso", instrumentId: l.type === "stock" ? und : l.id, side: l.qty > 0 ? "buy" : "sell", orderType: "market", qty: Math.abs(l.qty), clientRef: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}` });
    setBusy(false); setAck(false);
  };
  return <>
    <PageTitle env="Terminal · Dérivés" title="Options" subtitle={<>Options européennes valorisées par <Term id="call">Black-Scholes-Merton</Term> avec smile de volatilité modélisé. Règlement en espèces à l'échéance (17 h 30 le 3e vendredi).</>} right={<div className="flex gap-2"><select value={und} onChange={(e) => { setUnd(e.target.value); setExp(undefined); }} className={inputCls + " w-56"}>{["XWLD", "XUSA", "XEUR", "XTEC", "IDX-EU", "IDX-US", "MAIS", "NOVX", "TERA", "LUTB", "HDMP", "ELEC", "AERO", "QBIT", "CURA", "HALO"].map((x) => <option key={x}>{x}</option>)}</select></div>} />
    <div className="mb-3 flex flex-wrap items-center gap-2"><span className="text-sm">Sous-jacent <Link href={`/play/actif/${und}`} className="text-accent">{data.name}</Link> : <b className="num">{fmtPx(data.spot)}</b> {data.currency} · vol. de référence {fmtNum(data.baseVol * 100, 1)} % · taux {fmtNum(data.r * 100, 2)} %</span>{data.expiries.map((e: number) => <button key={e} onClick={() => setExp(e)} className={`rounded px-2 py-1 text-xs ${data.expiry === e ? "bg-accent text-white" : "bg-ink-800"}`}>{fmtShortDate(e * 1440)}</button>)}</div>
    <div className="grid gap-4 xl:grid-cols-[1.3fr_1fr]">
      <Card title={`Chaîne d'options — échéance ${fmtShortDate(data.expiry * 1440)} (multiplicateur ${M})`} pad={false}><div className="scroll-thin overflow-x-auto"><table className="w-full text-xs"><thead><tr className="border-b border-ink-700 text-ink-400"><th className="px-2 py-2 text-left">Call Δ</th><th>Γ</th><th>Θ/j</th><th>Prime</th><th className="bg-ink-800 px-2">Strike</th><th>VI</th><th>Prime</th><th>Θ/j</th><th>Put Δ</th><th></th></tr></thead><tbody>{data.rows.map((r: any) => { const itmC = r.K < data.spot, itmP = r.K > data.spot; return <tr key={r.K} className="border-b border-ink-800"><td className={`num px-2 py-1 ${itmC ? "bg-green-500/5" : ""}`}>{fmtNum(r.call.delta, 2)}</td><td className="num text-center">{fmtNum(r.call.gamma, 4)}</td><td className="num text-center">{fmtNum(r.call.theta, 3)}</td><td className="num text-center"><Link className="text-accent" href={`/play/actif/${encodeURIComponent(r.call.id)}`}>{fmtNum(r.call.price, 2)}</Link></td><td className="num bg-ink-800 px-2 text-center font-semibold">{r.K}{Math.abs(r.K - data.spot) / data.spot < 0.013 && <Badge tone="gold">ATM</Badge>}</td><td className="num text-center text-ink-400">{fmtNum(r.iv * 100, 1)}%</td><td className="num text-center"><Link className="text-accent" href={`/play/actif/${encodeURIComponent(r.put.id)}`}>{fmtNum(r.put.price, 2)}</Link></td><td className="num text-center">{fmtNum(r.put.theta, 3)}</td><td className={`num px-2 ${itmP ? "bg-red-500/5" : ""}`}>{fmtNum(r.put.delta, 2)}</td><td className="text-[10px] text-ink-500">{itmC ? "C ITM" : itmP ? "P ITM" : ""}</td></tr>; })}</tbody></table></div><div className="p-2 text-[11px] text-ink-400">Cliquez une prime pour ouvrir la fiche du contrat et passer un ordre unitaire. <Term id="moneyness">ITM / ATM / OTM</Term> · <Term id="delta" /> · <Term id="gamma" /> · <Term id="theta" /> · <Term id="vega" /></div></Card>
      <Card title="Constructeur de stratégie">
        <div className="grid grid-cols-2 gap-2"><Field label="Stratégie"><select value={strat} onChange={(e) => setStrat(e.target.value)} className={inputCls}>{Object.entries(STRATS).map(([k, v]) => <option key={k} value={k}>{v.label}</option>)}</select></Field><Field label="Nombre de contrats"><input type="number" min={1} max={500} value={contracts} onChange={(e) => setContracts(Math.max(1, Number(e.target.value)))} className={inputCls} /></Field></div>
        <p className="mt-2 text-xs text-ink-300">{STRATS[strat].desc}</p>
        <table className="mt-2 w-full text-xs"><tbody>{legs.map((l, i) => <tr key={i}><td className={l.qty > 0 ? "text-gain" : "text-loss"}>{l.qty > 0 ? "Achat" : "Vente"} {Math.abs(l.qty)}</td><td>{l.type === "stock" ? `${und} (sous-jacent)` : `${l.type} ${l.K}`}</td><td className="num text-right">{fmtNum(l.premium, 2)}</td></tr>)}</tbody></table>
        <PayoffChart points={points} spot={data.spot} breakevens={be} />
        <div className="text-[11px] text-ink-400"><span className="text-gain">━ à l'échéance</span> · <span className="text-violet-400">┅ à mi-parcours (effet du temps et de la volatilité)</span></div>
        <div className="mt-2 grid grid-cols-2 gap-1 text-xs"><div>Coût net : <b className="num">{fmtNum(cost, 2)} {data.currency}</b></div><div>Gain max (zone tracée) : <b className="num text-gain">{fmtNum(maxG, 0)}</b></div><div>Perte max (zone tracée) : <b className="num text-loss">{fmtNum(maxL, 0)}</b></div><div>Seuils : <b className="num">{be.map((b) => fmtNum(b, 2)).join(" / ") || "—"}</b></div><div>Δ position : <b className="num">{fmtNum(greeks.delta, 1)}</b></div><div>Γ : <b className="num">{fmtNum(greeks.gamma, 3)}</b> · Θ/j : <b className="num">{fmtNum(greeks.theta, 2)}</b> · Véga : <b className="num">{fmtNum(greeks.vega, 2)}</b></div></div>
        {explanations && <div className="mt-2 rounded border border-blue-500/30 bg-blue-500/10 p-2 text-xs text-blue-100">💡 Avant d'exécuter : la perte maximale d'un acheteur d'options est la prime payée. Une vente d'option (jambe négative) exige une marge et peut générer des pertes importantes. La valeur temps s'érode chaque jour (thêta).</div>}
        <label className="mt-2 flex items-start gap-2 text-xs text-amber-200"><input type="checkbox" checked={ack} onChange={(e) => setAck(e.target.checked)} />J'ai compris le profil de gain/perte et les exigences de marge.</label>
        <Button className="mt-2 w-full" disabled={!ack || busy} onClick={execute}>Exécuter la stratégie (compte personnel)</Button>
      </Card>
    </div>
  </>;
}
export default function Page() { return <Suspense><OptionsInner /></Suspense>; }
