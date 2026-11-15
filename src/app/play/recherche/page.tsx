"use client";
import Link from "next/link";
import { useMemo, useState } from "react";
import { useView } from "@/lib/hooks";
import { useGame } from "@/lib/store";
import { Card, Change, PageTitle, Loading, inputCls, Table, Badge, Button } from "@/components/ui";
import { fmtPx, CLS_LABEL, ZONE_LABEL } from "@/lib/format";

const PAGE = 50;
const fmtCap = (b: number | null) => (b === null ? "—" : b >= 1 ? `${b.toLocaleString("fr-FR", { maximumFractionDigits: 1 })} Md$` : `${Math.round(b * 1000)} M$`);

export default function Recherche() {
  const { data } = useView<any>("search", {}, 30000);
  const snap = useGame((s) => s.snap);
  const [q, setQ] = useState(""); const [cls, setCls] = useState(""); const [zone, setZone] = useState(""); const [sector, setSector] = useState(""); const [country, setCountry] = useState(""); const [size, setSize] = useState("");
  const [sort, setSort] = useState<"cap" | "id" | "ch" | "chd">("cap");
  const [page, setPage] = useState(0);
  const all: any[] = useMemo(() => data?.list ?? [], [data]);
  const sectors = useMemo(() => [...new Set(all.map((x) => x.s).filter(Boolean))].sort(), [all]);
  const countries = useMemo(() => [...new Set(all.filter((x) => x.c === "action").map((x) => x.country).filter(Boolean))].sort(), [all]);
  const list = useMemo(() => {
    const ql = q.toLowerCase();
    return all.filter((x) => (!ql || x.id.toLowerCase().includes(ql) || x.n.toLowerCase().includes(ql)) && (!cls || x.c === cls) && (!zone || x.z === zone) && (!sector || x.s === sector) && (!country || x.country === country)
      && (!size || (x.cap !== null && (size === "big" ? x.cap >= 10 : size === "mid" ? x.cap >= 2 && x.cap < 10 : x.cap < 2))))
      .map((x) => ({ ...x, p: snap?.quotes[x.id]?.[0] ?? x.p, ch: snap?.quotes[x.id]?.[1] ?? x.ch }))
      .sort((a, b) => (sort === "ch" ? b.ch - a.ch : sort === "chd" ? a.ch - b.ch : sort === "cap" ? (b.cap ?? -1) - (a.cap ?? -1) : a.id.localeCompare(b.id)));
  }, [all, q, cls, zone, sector, country, size, sort, snap]);
  if (!data) return <Loading />;
  const pages = Math.max(1, Math.ceil(list.length / PAGE));
  const pg = Math.min(page, pages - 1);
  const stocks = all.filter((x) => x.c === "action").length;
  const set = <T,>(f: (v: T) => void) => (v: T) => { f(v); setPage(0); };
  return <>
    <PageTitle env="Terminal" title="Recherche d'instruments" subtitle={`${all.length.toLocaleString("fr-FR")} instruments, dont ${stocks.toLocaleString("fr-FR")} actions de ${countries.length} pays (sociétés fictives). Les options sont générées à la demande.`} />
    <Card>
      <div className="mb-3 grid gap-2 md:grid-cols-4 xl:grid-cols-7">
        <input data-testid="search-q" value={q} onChange={(e) => set(setQ)(e.target.value)} placeholder="Ticker ou nom…" className={inputCls} />
        <select aria-label="Classe d'actifs" value={cls} onChange={(e) => set(setCls)(e.target.value)} className={inputCls}><option value="">Toutes classes</option>{Object.entries(CLS_LABEL).filter(([k]) => k !== "option").map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <select aria-label="Secteur" data-testid="search-sector" value={sector} onChange={(e) => set(setSector)(e.target.value)} className={inputCls}><option value="">Tous secteurs</option>{sectors.map((x) => <option key={x}>{x}</option>)}</select>
        <select aria-label="Pays" data-testid="search-country" value={country} onChange={(e) => set(setCountry)(e.target.value)} className={inputCls}><option value="">Tous pays</option>{countries.map((x) => <option key={x}>{x}</option>)}</select>
        <select aria-label="Zone" value={zone} onChange={(e) => set(setZone)(e.target.value)} className={inputCls}><option value="">Toutes zones</option>{Object.entries(ZONE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <select aria-label="Taille" value={size} onChange={(e) => set(setSize)(e.target.value)} className={inputCls}><option value="">Toutes tailles</option><option value="big">Grandes capitalisations (≥ 10 Md$)</option><option value="mid">Moyennes (2 à 10 Md$)</option><option value="small">Petites (&lt; 2 Md$)</option></select>
        <select aria-label="Tri" value={sort} onChange={(e) => set(setSort)(e.target.value as typeof sort)} className={inputCls}><option value="cap">Tri par capitalisation</option><option value="id">Tri alphabétique</option><option value="ch">Plus fortes hausses</option><option value="chd">Plus fortes baisses</option></select>
      </div>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-2 text-xs text-ink-400"><span data-testid="search-count">{list.length.toLocaleString("fr-FR")} résultat{list.length > 1 ? "s" : ""}</span>{pages > 1 && <span className="flex items-center gap-2"><Button size="sm" variant="ghost" disabled={pg === 0} onClick={() => setPage(pg - 1)}>← Précédent</Button>Page {pg + 1} / {pages}<Button size="sm" variant="ghost" disabled={pg >= pages - 1} onClick={() => setPage(pg + 1)}>Suivant →</Button></span>}</div>
      <Table head={["Ticker", "Nom", "Classe", "Secteur", "Pays / zone", "Capitalisation", "Cours", "Var. jour", "Accès desk"]}>{list.slice(pg * PAGE, pg * PAGE + PAGE).map((x: any) => <tr key={x.id} className="hover:bg-ink-800"><td className="px-2 py-1.5"><Link href={`/play/actif?id=${x.id}`} className="font-semibold text-accent">{x.id}</Link></td><td className="px-2">{x.n}{x.halted && <Badge tone="warn">non coté</Badge>}</td><td className="px-2 text-xs">{CLS_LABEL[x.c]}</td><td className="px-2 text-xs text-ink-300">{x.s ?? "—"}</td><td className="px-2 text-xs">{x.c === "action" ? x.country : ZONE_LABEL[x.z]}</td><td className="num px-2 text-right text-xs">{fmtCap(x.cap)}</td><td className="num px-2 text-right">{fmtPx(x.p)} <span className="text-[10px] text-ink-500">{x.cur}</span></td><td className="px-2 text-right"><Change v={x.ch} /></td><td className="px-2">{x.desk ? <Badge tone="gain">oui</Badge> : <Badge>non</Badge>}</td></tr>)}</Table>
    </Card>
  </>;
}
