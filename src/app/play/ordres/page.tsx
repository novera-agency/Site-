"use client";
import Link from "next/link";
import { useState } from "react";
import { useView, useAction } from "@/lib/hooks";
import { Card, PageTitle, Loading, Table, Badge, Tabs, inputCls } from "@/components/ui";
import { AssetPanel } from "@/components/AssetPanel";
import { fmtPx } from "@/lib/format";
import { fmtDateTime } from "@/engine/time";

export default function Ordres() {
  const [account, setAccount] = useState("perso");
  const { data } = useView<any>("transactions", { account });
  const act = useAction();
  const [inst, setInst] = useState("");
  const [tab, setTab] = useState<"pending" | "all">("pending");
  if (!data) return <Loading />;
  const orders = data.orders.filter((o: any) => (tab === "pending" ? o.status === "en_attente" || o.status === "partiel" : true));
  return <>
    <PageTitle env="Terminal" title="Passage d'ordres" subtitle="Ordres au marché, limite, stop, stop-limite, stop-loss / take-profit attachés, validité jour / illimitée / durée limitée." right={<select value={account} onChange={(e) => setAccount(e.target.value)} className={inputCls + " w-56"}>{data.accounts.map((a: any) => <option key={a.id} value={a.id}>{a.label}</option>)}</select>} />
    <Card title="Nouvel ordre" className="mb-4"><input value={inst} onChange={(e) => setInst(e.target.value.toUpperCase())} placeholder="Ticker de l'instrument (ex. MAIS, XWLD, EURUSD, FEUH27…)" className={inputCls} />{inst.length >= 3 && <div className="mt-4"><AssetPanel id={inst} compact /></div>}</Card>
    <Card title="Carnet d'ordres du compte" right={<Tabs tabs={[{ id: "pending", label: "En attente" }, { id: "all", label: "Historique" }]} value={tab} onChange={setTab} />}>
      <Table head={["Créé", "Instrument", "Sens", "Type", "Qté", "Exécuté", "Limite", "Stop", "Prix moyen", "Frais", "Statut", ""]}>{orders.map((o: any) => <tr key={o.id}><td className="num px-2 py-1 text-xs">{fmtDateTime(o.createdT)}</td><td className="px-2"><Link href={`/play/actif?id=${o.instrumentId}`} className="text-accent">{o.instrumentId}</Link></td><td className={`px-2 ${o.side === "buy" ? "text-gain" : "text-loss"}`}>{o.side === "buy" ? "Achat" : "Vente"}</td><td className="px-2 text-xs">{o.type}{o.tag ? ` · ${o.tag}` : ""}</td><td className="num px-2">{o.qty}</td><td className="num px-2">{o.filled}</td><td className="num px-2">{o.limit ? fmtPx(o.limit) : "—"}</td><td className="num px-2">{o.stop ? fmtPx(o.stop) : "—"}</td><td className="num px-2">{o.avgFill ? fmtPx(o.avgFill) : "—"}</td><td className="num px-2">{(o.fees / 100).toFixed(2)} €</td><td className="px-2"><Badge tone={o.status === "execute" ? "gain" : ["rejete", "annule", "expire"].includes(o.status) ? "loss" : "warn"}>{o.status}</Badge>{o.reason && <div className="text-[10px] text-ink-400">{o.reason}</div>}</td><td className="px-2">{(o.status === "en_attente" || o.status === "partiel") && <button onClick={() => act({ type: "cancel", orderId: o.id })} className="text-xs text-loss">Annuler</button>}</td></tr>)}</Table>
      {orders.length === 0 && <div className="py-4 text-center text-sm text-ink-400">Aucun ordre.</div>}
    </Card>
  </>;
}
