"use client";
import Link from "next/link";
import { useState } from "react";
import { useView } from "@/lib/hooks";
import { Card, PageTitle, Loading, Table, Badge, Tabs, inputCls } from "@/components/ui";
import { fmtPx, fmtNum } from "@/lib/format";
import { fmtDateTime } from "@/engine/time";

export default function Transactions() {
  const [account, setAccount] = useState("perso");
  const [tab, setTab] = useState<"fills" | "ledger">("fills");
  const { data } = useView<any>("transactions", { account }, 3000);
  if (!data) return <Loading />;
  return <>
    <PageTitle env="Comptabilité" title="Historique des transactions" subtitle="Exécutions et journal comptable en partie double : chaque mouvement débite un compte et en crédite un autre du même montant." right={<select value={account} onChange={(e) => setAccount(e.target.value)} className={inputCls + " w-60"}>{data.accounts.map((a: any) => <option key={a.id} value={a.id}>{a.label}</option>)}</select>} />
    <div className="mb-3 flex flex-wrap items-center gap-3"><Tabs tabs={[{ id: "fills", label: "Exécutions" }, { id: "ledger", label: "Grand livre" }]} value={tab} onChange={setTab} /><Badge tone={data.balanced ? "gain" : "loss"}>{data.balanced ? "✔ Balance de vérification équilibrée (Σ débits = Σ crédits par devise)" : "✘ Déséquilibre détecté"}</Badge>{data.archived > 0 && <span className="text-xs text-ink-400">{data.archived} écritures archivées (soldes conservés)</span>}</div>
    {tab === "fills" ? <Card><Table head={["Date simulée", "Instrument", "Sens", "Quantité", "Prix", "Glissement", "Frais", "P&L réalisé"]}>{data.fills.map((f: any) => <tr key={f.id}><td className="num px-2 py-1 text-xs">{fmtDateTime(f.t)}</td><td className="px-2"><Link href={`/play/actif/${f.instrumentId}`} className="text-accent">{f.instrumentId}</Link></td><td className={`px-2 ${f.side === "buy" ? "text-gain" : "text-loss"}`}>{f.side === "buy" ? "Achat" : "Vente"}</td><td className="num px-2">{fmtNum(f.qty, 4).replace(/,0000$/, "")}</td><td className="num px-2">{fmtPx(f.price)}</td><td className="num px-2 text-xs">{fmtNum(f.slippageBps, 1)} pb</td><td className="num px-2">{(f.fees / 100).toFixed(2)} €</td><td className={`num px-2 ${f.realized > 0 ? "text-gain" : f.realized < 0 ? "text-loss" : ""}`}>{f.realized ? (f.realized / 100).toFixed(2) + " €" : "—"}</td></tr>)}</Table>{data.fills.length === 0 && <div className="py-4 text-center text-sm text-ink-400">Aucune exécution.</div>}</Card>
      : <Card><Table head={["N°", "Date simulée", "Débit", "Crédit", "Montant", "Devise", "Motif", "Réf."]}>{data.ledger.map((e: any) => <tr key={e.id}><td className="num px-2 py-1 text-xs text-ink-500">{e.id}</td><td className="num px-2 text-xs">{fmtDateTime(e.t)}</td><td className="px-2 text-xs">{e.debit}</td><td className="px-2 text-xs">{e.credit}</td><td className={`num px-2 ${e.debit.startsWith(account + ":cash") ? "text-gain" : "text-loss"}`}>{e.debit.startsWith(account + ":") ? "+" : "−"}{fmtNum(e.amount / 100, 2)}</td><td className="px-2 text-xs">{e.cur}</td><td className="px-2 text-xs">{e.memo}</td><td className="px-2 text-[10px] text-ink-500">{e.ref ?? ""}</td></tr>)}</Table></Card>}
  </>;
}
