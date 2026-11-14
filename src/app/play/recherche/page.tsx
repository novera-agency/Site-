"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useView } from "@/lib/hooks";
import { useGame } from "@/lib/store";
import { Card, Change, PageTitle, Loading, inputCls, Table, Badge } from "@/components/ui";
import { fmtPx, CLS_LABEL, ZONE_LABEL } from "@/lib/format";

export default function Recherche() {
  const { data } = useView<any>("search", {}, 30000);
  const snap = useGame((s) => s.snap);
  const [q, setQ] = useState(""); const [cls, setCls] = useState(""); const [zone, setZone] = useState(""); const [sort, setSort] = useState<"id" | "ch">("id");
  const list = useMemo(() => (data?.list ?? []).filter((x: any) => (!q || x.id.toLowerCase().includes(q.toLowerCase()) || x.n.toLowerCase().includes(q.toLowerCase())) && (!cls || x.c === cls) && (!zone || x.z === zone)).map((x: any) => ({ ...x, p: snap?.quotes[x.id]?.[0] ?? x.p, ch: snap?.quotes[x.id]?.[1] ?? x.ch })).sort((a: any, b: any) => (sort === "ch" ? b.ch - a.ch : a.id.localeCompare(b.id))), [data, q, cls, zone, sort, snap]);
  if (!data) return <Loading />;
  return <>
    <PageTitle env="Terminal" title="Recherche d'instruments" subtitle={`${data.list.length} instruments négociables ou consultables dans l'univers du jeu (hors options, générées à la demande).`} />
    <Card>
      <div className="mb-3 grid gap-2 md:grid-cols-4"><input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher…" className={inputCls} /><select value={cls} onChange={(e) => setCls(e.target.value)} className={inputCls}><option value="">Toutes classes</option>{Object.entries(CLS_LABEL).filter(([k]) => k !== "option").map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select><select value={zone} onChange={(e) => setZone(e.target.value)} className={inputCls}><option value="">Toutes zones</option>{Object.entries(ZONE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select><select value={sort} onChange={(e) => setSort(e.target.value as "id" | "ch")} className={inputCls}><option value="id">Tri alphabétique</option><option value="ch">Tri par variation</option></select></div>
      <Table head={["Ticker", "Nom", "Classe", "Secteur", "Zone", "Devise", "Cours", "Var. jour", "Accès desk"]}>{list.map((x: any) => <tr key={x.id} className="hover:bg-ink-800"><td className="px-2 py-1.5"><Link href={`/play/actif?id=${x.id}`} className="font-semibold text-accent">{x.id}</Link></td><td className="px-2">{x.n}</td><td className="px-2 text-xs">{CLS_LABEL[x.c]}</td><td className="px-2 text-xs text-ink-300">{x.s ?? "—"}</td><td className="px-2 text-xs">{ZONE_LABEL[x.z]}</td><td className="px-2 text-xs">{x.cur}</td><td className="num px-2 text-right">{fmtPx(x.p)}</td><td className="px-2 text-right"><Change v={x.ch} /></td><td className="px-2">{x.desk ? <Badge tone="gain">oui</Badge> : <Badge>non</Badge>}</td></tr>)}</Table>
    </Card>
  </>;
}
