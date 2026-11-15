"use client";
import { useState } from "react";
import Link from "next/link";
import { useView, useAction } from "@/lib/hooks";
import { Card, Stat, Change, Badge, Loading, Button, inputCls, Table, Term } from "./ui";
import { PriceChart } from "./charts";
import { OrderTicket } from "./OrderTicket";
import { fmtPx, fmtNum, fmtPct, fmtCompact, CLS_LABEL, ZONE_LABEL, fmtEur } from "@/lib/format";
import { fmtShortDate, fmtTime, fmtDateTime } from "@/engine/time";
import { histVol, atr } from "@/lib/indicators";

const INDS: [string, string][] = [["sma20", "MM20"], ["sma50", "MM50"], ["ema20", "MME20"], ["boll", "Bollinger"], ["rsi", "RSI"], ["macd", "MACD"]];
export function AssetPanel({ id, compact = false }: { id: string; compact?: boolean }) {
  const { data } = useView<any>("instrument", { id }, 1200);
  const act = useAction();
  const [tf, setTf] = useState<"intraday" | "daily">("daily");
  const [kind, setKind] = useState<"candles" | "line">("candles");
  const [inds, setInds] = useState<string[]>(["sma20"]);
  const [alert, setAlert] = useState("");
  const [alertErr, setAlertErr] = useState("");
  if (!data) return <Loading />;
  if (data.error) return <div className="text-loss">{data.error}</div>;
  const d = data.def, q = data.quote, a = data.analytics;
  const bars = tf === "daily" ? data.daily : data.intraday;
  const ch = q.prevClose ? (q.price / q.prevClose - 1) * 100 : 0;
  const closes = data.daily.map((b: any) => b.c);
  const hv = histVol(closes, 20, d.session === "CRYPTO" ? 365 : 252).at(-1);
  const at = atr(data.daily.map((b: any) => b.h), data.daily.map((b: any) => b.l), closes).at(-1);
  return <div className="space-y-4">
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div><div className="flex flex-wrap items-center gap-2"><h1 className="text-xl font-semibold text-white">{d.name}</h1><Badge>{d.id}</Badge><Badge tone="info">{CLS_LABEL[d.cls]}</Badge>{d.sector && <Badge>{d.sector}</Badge>}<Badge>{ZONE_LABEL[d.zone]}</Badge>{q.defaulted && <Badge tone="loss">EN DÉFAUT</Badge>}{!data.book.open && <Badge tone="warn">marché fermé</Badge>}</div><p className="mt-1 max-w-3xl text-xs text-ink-300">{d.description}</p></div>
      <div className="text-right"><div className="num text-3xl font-semibold text-white">{fmtPx(q.price)} <span className="text-sm text-ink-400">{d.currency}</span></div><Change v={ch} /></div>
    </div>
    <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
      <Card pad={false} title={<span>Graphique</span>} right={<div className="flex flex-wrap items-center gap-1">{(["intraday", "daily"] as const).map((x) => <button key={x} onClick={() => setTf(x)} className={`rounded px-2 py-0.5 ${tf === x ? "bg-ink-600 text-white" : ""}`}>{x === "daily" ? "Journalier" : "15 min"}</button>)}<span className="mx-1 text-ink-500">|</span>{(["candles", "line"] as const).map((x) => <button key={x} onClick={() => setKind(x)} className={`rounded px-2 py-0.5 ${kind === x ? "bg-ink-600 text-white" : ""}`}>{x === "candles" ? "Chandeliers" : "Courbe"}</button>)}<span className="mx-1 text-ink-500">|</span>{INDS.map(([k, l]) => <button key={k} onClick={() => setInds(inds.includes(k) ? inds.filter((x) => x !== k) : [...inds, k])} className={`rounded px-1.5 py-0.5 ${inds.includes(k) ? "bg-accent text-white" : ""}`}>{l}</button>)}</div>}>
        <div className="p-2"><PriceChart bars={bars} kind={kind} indicators={inds} height={compact ? 300 : 380} /></div>
        <div className="grid grid-cols-3 gap-3 border-t border-ink-700 p-3 2xl:grid-cols-6">
          <Stat label="Ouverture" value={fmtPx(q.dayOpen)} /><Stat label="Plus haut" value={fmtPx(q.dayHigh)} /><Stat label="Plus bas" value={fmtPx(q.dayLow)} />
          <Stat label={<Term id="volatilite">Vol. hist. 20 j</Term>} value={hv ? `${hv.toFixed(1)} %` : "—"} /><Stat label="ATR 14" value={at ? fmtPx(at) : "—"} /><Stat label="Volume du jour" value={fmtCompact(q.dayVolume)} />
        </div>
      </Card>
      <Card title="Passer un ordre"><OrderTicket inst={data} defaultAccount={data.positions.some((p: any) => p.account === "desk") ? "desk" : "perso"} /></Card>
    </div>
    <div className="grid gap-4 lg:grid-cols-3">
      <Card title="Carnet d'ordres (simplifié)">
        <table className="w-full text-xs"><thead><tr className="text-ink-400"><th className="text-left">Qté acheteur</th><th className="text-right">Bid</th><th className="text-right">Ask</th><th className="text-right">Qté vendeur</th></tr></thead><tbody>{data.book.depth.map((l: any, i: number) => <tr key={i}><td className="num text-gain">{fmtCompact(l.bidQty)}</td><td className="num text-right text-gain">{fmtPx(l.bid)}</td><td className="num text-right text-loss">{fmtPx(l.ask)}</td><td className="num text-right text-loss">{fmtCompact(l.askQty)}</td></tr>)}</tbody></table>
        <div className="mt-2 text-xs text-ink-400"><Term id="spread">Spread</Term> {fmtNum(data.book.spreadBps, 1)} pb · <Term id="liquidite">Volume moyen</Term> {fmtEur(data.adv)} / jour</div>
      </Card>
      <Card title="Données fondamentales" className="lg:col-span-2">
        {d.cls === "action" && <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
          <Stat label={<Term id="capitalisation">Capitalisation</Term>} value={fmtCompact(a.marketCap) + " " + d.currency} /><Stat label="Nombre d'actions" value={fmtCompact(a.shares)} /><Stat label="Chiffre d'affaires" value={fmtCompact(a.revenue)} /><Stat label="Résultat net (annualisé)" value={fmtCompact(a.netIncome)} />
          <Stat label="BPA" value={fmtNum(a.eps, 2)} /><Stat label={<Term id="per">PER</Term>} value={fmtNum(a.per, 1)} sub={`normatif ${a.fairPE}`} /><Stat label="Dividende annuel" value={fmtNum(a.dividend, 2)} sub={fmtPct(a.yield * 100, 2, false)} /><Stat label={<Term id="ebitda">Dette / EBITDA</Term>} value={`${fmtNum(a.debtEbitda, 1)}x`} />
          <Stat label="Croissance anticipée" value={fmtPct(a.growth * 100, 1)} /><Stat label="Valeur fondamentale (modèle)" value={fmtPx(a.fair)} sub={a.fair ? fmtPct((a.fair / q.price - 1) * 100) : ""} /><Stat label="Prochains résultats" value={a.nextEarnings ? fmtShortDate(a.nextEarnings * 1440) : "—"} /><Stat label="Taux de distribution" value={fmtPct(a.payout * 100, 0, false)} />
          <div className="col-span-2 md:col-span-4 text-xs text-ink-300"><b>Perspectives :</b> {a.outlook} <b className="ml-2">Risques :</b> {a.risks?.join(", ")}{a.stress > 0.1 && <span className="ml-2 text-loss">Stress de crédit élevé ({Math.round(a.stress * 100)}/100)</span>}</div>
        </div>}
        {d.bond && <div className="grid grid-cols-2 gap-3 md:grid-cols-4"><Stat label="Émetteur" value={a.issuer} /><Stat label="Notation" value={a.rating} /><Stat label={<Term id="coupon">Coupon</Term>} value={`${fmtNum(a.couponRate * 100, 2)} %${a.floating ? " (variable)" : ""}`} /><Stat label="Échéance" value={fmtShortDate(a.maturityDay * 1440)} /><Stat label="Taux actuariel" value={`${fmtNum(a.ytm, 3)} %`} /><Stat label={<Term id="duration">Duration modifiée</Term>} value={fmtNum(a.modified, 2)} sub={`Macaulay ${fmtNum(a.macaulay, 2)}`} /><Stat label="Convexité" value={fmtNum(a.convexity, 1)} /><Stat label="DV01 (pour 100)" value={fmtNum(a.dv01, 4)} /><Stat label={<Term id="nominal">Nominal</Term>} value={`${a.nominal} ${d.currency}`} /><Stat label="Coupon couru (info)" value={fmtNum(a.accrued, 3)} /><Stat label="Prochain coupon" value={a.nextCoupon ? fmtShortDate(a.nextCoupon * 1440) : "—"} /><Stat label="Prix" value={`${fmtNum(q.price, 3)} %`} sub="pied de coupon inclus (prix « sale »)" /></div>}
        {d.option && <div className="grid grid-cols-2 gap-3 md:grid-cols-4"><Stat label="Sous-jacent" value={<Link className="text-accent" href={`/play/actif?id=${a.underlying}`}>{a.underlying}</Link>} sub={fmtPx(a.underlyingPrice)} /><Stat label="Type / strike" value={`${a.type} ${a.strike}`} /><Stat label="Échéance" value={fmtShortDate(a.expiryDay * 1440)} /><Stat label="Vol. implicite" value={fmtPct(a.iv * 100, 1, false)} /><Stat label={<Term id="delta">Delta</Term>} value={fmtNum(a.delta, 3)} /><Stat label={<Term id="gamma">Gamma</Term>} value={fmtNum(a.gamma, 4)} /><Stat label={<Term id="theta">Thêta / jour</Term>} value={fmtNum(a.theta, 3)} /><Stat label={<Term id="vega">Véga</Term>} value={fmtNum(a.vega, 3)} /><Stat label="Rho" value={fmtNum(a.rho, 3)} /><Stat label="Valeur intrinsèque" value={fmtNum(a.intrinsic, 2)} /><Stat label="Valeur temps" value={fmtNum(a.timeValue, 2)} /><Stat label="Multiplicateur" value={a.multiplier} /></div>}
        {d.future && <div className="grid grid-cols-2 gap-3 md:grid-cols-4"><Stat label="Sous-jacent" value={<Link className="text-accent" href={`/play/actif?id=${a.underlying}`}>{a.underlying}</Link>} sub={fmtPx(a.underlyingPrice)} /><Stat label="Base" value={fmtNum(a.basis, 2)} /><Stat label="Notionnel / contrat" value={fmtNum(a.notional, 0)} /><Stat label={<Term id="marge">Dépôt de garantie</Term>} value={fmtNum(a.initialMargin, 0)} sub={`${a.marginPct * 100} %`} /><Stat label="Échéance" value={fmtShortDate(a.expiryDay * 1440)} /><Stat label="Multiplicateur" value={a.multiplier} /></div>}
        {d.basket && <div><div className="mb-2 text-xs text-ink-400">Principales composantes (poids dans le panier)</div><div className="grid grid-cols-1 gap-1 md:grid-cols-3">{a.members.map((m: any) => <Link key={m.id} href={`/play/actif?id=${m.id}`} className="flex justify-between rounded bg-ink-900 px-2 py-1 text-xs hover:bg-ink-800"><span>{m.name}</span><span className="num">{fmtPct(m.weight * 100, 1, false)}</span></Link>)}</div></div>}
        {(d.cls === "devise" || d.cls === "matiere" || d.cls === "crypto") && <div className="text-sm text-ink-300">{d.description}<div className="mt-2 text-xs">Volatilité de référence : {fmtPct(q.baseVol * 100, 1, false)} annualisée.</div></div>}
      </Card>
    </div>
    <div className="grid gap-4 lg:grid-cols-3">
      <Card title="Mes positions"> {data.positions.length === 0 ? <div className="text-sm text-ink-400">Aucune position.</div> : data.positions.map((p: any) => <div key={p.account} className="mb-2 rounded bg-ink-900 p-2 text-sm"><div className="text-xs text-ink-400">{p.label}</div><div className="num">{fmtNum(p.pos.qty, d.cls === "crypto" ? 4 : 0)} @ {fmtPx(p.pos.avgPrice)} — P&L latent <span className={(q.price - p.pos.avgPrice) * p.pos.qty >= 0 ? "text-gain" : "text-loss"}>{fmtNum((q.price - p.pos.avgPrice) * p.pos.qty * (d.option?.multiplier ?? d.future?.multiplier ?? (d.bond ? 10 : 1)), 2)} {d.currency}</span></div></div>)}
        <div className="mt-3 flex flex-wrap gap-2"><Button size="sm" variant="ghost" onClick={() => act({ type: "watch", instrumentId: id, on: !data.watch })}>{data.watch ? "★ Retirer de la liste" : "☆ Surveiller"}</Button>{data.optionable && <Link href={`/play/options?u=${id}`} className="rounded-md bg-ink-700 px-2.5 py-1 text-xs">Chaîne d'options</Link>}</div>
        <div className="mt-3 flex gap-1"><input placeholder="Alerte à… (prix)" inputMode="decimal" onKeyDown={(e) => { if (e.key === "Enter") (e.currentTarget.nextElementSibling as HTMLButtonElement | null)?.click(); }} value={alert} onChange={(e) => setAlert(e.target.value)} className={inputCls} /><Button size="sm" onClick={() => { const lv = Number(alert.replace(/\s/g, "").replace(",", ".")); if (lv > 0) { act({ type: "alert", instrumentId: id, level: lv, above: lv > q.price }); setAlert(""); setAlertErr(""); } else setAlertErr("Saisissez un prix, par exemple " + fmtNum(q.price * 1.02, 2) + "."); }}>🔔 Créer l'alerte</Button></div>
        {alertErr && <div className="mt-1 text-xs text-amber-300">{alertErr}</div>}
        {data.alerts.map((al: any) => <div key={al.id} className="mt-1 flex justify-between text-xs"><span>{al.above ? "≥" : "≤"} {al.level} {al.triggered && <Badge tone="gold">déclenchée</Badge>}</span><button onClick={() => act({ type: "alert_delete", id: al.id }, { silent: true })} className="text-ink-500">✕</button></div>)}
      </Card>
      <Card title="Actualités associées" className="lg:col-span-2">{data.news.length === 0 ? <div className="text-sm text-ink-400">Aucune actualité récente.</div> : <ul className="space-y-2">{data.news.map((n: any) => <li key={n.id} className="text-sm"><span className="num mr-2 text-xs text-ink-500">{fmtDateTime(n.t)}</span><b>{n.title}</b><div className="text-xs text-ink-400">{n.body}</div></li>)}</ul>}</Card>
    </div>
    {data.orders.length > 0 && <Card title="Ordres sur cet instrument"><Table head={["Heure", "Compte", "Sens", "Type", "Qté", "Exécuté", "Prix moyen", "Statut", ""]}>{data.orders.map((o: any) => <tr key={o.id}><td className="num px-2 py-1 text-xs">{fmtDateTime(o.createdT)}</td><td className="px-2 text-xs">{o.account}</td><td className={`px-2 ${o.side === "buy" ? "text-gain" : "text-loss"}`}>{o.side === "buy" ? "Achat" : "Vente"}</td><td className="px-2 text-xs">{o.type}{o.tag ? ` (${o.tag})` : ""}</td><td className="num px-2">{o.qty}</td><td className="num px-2">{o.filled}</td><td className="num px-2">{o.avgFill ? fmtPx(o.avgFill) : "—"}</td><td className="px-2"><Badge tone={o.status === "execute" ? "gain" : o.status === "rejete" || o.status === "annule" ? "loss" : "warn"}>{o.status}</Badge></td><td className="px-2">{(o.status === "en_attente" || o.status === "partiel") && <button onClick={() => act({ type: "cancel", orderId: o.id })} className="text-xs text-loss">Annuler</button>}</td></tr>)}</Table></Card>}
    <div className="text-[11px] text-ink-500">Dernière mise à jour simulée : {fmtTime(data.daily.at(-1)?.t ?? 0)}</div>
  </div>;
}
