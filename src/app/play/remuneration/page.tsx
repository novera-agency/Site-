"use client";
import { useView } from "@/lib/hooks";
import { Card, PageTitle, Loading, Stat, Table } from "@/components/ui";
import { fmtEur, fmtNum } from "@/lib/format";
import { fmtShortDate } from "@/engine/time";

export default function Remuneration() {
  const { data } = useView<any>("compensation", {}, 6000);
  if (!data) return <Loading />;
  return <>
    <PageTitle env="Rémunération" title="Rémunération" subtitle="Salaire mensuel versé le premier jour ouvré du mois (net ≈ 77 % du brut), bonus annuel en décembre selon le score, le P&L et la gestion du risque." />
    <div className="mb-4 grid grid-cols-2 gap-3 md:grid-cols-4"><Card><Stat label="Salaire fixe brut" value={fmtEur(data.salary)} /></Card><Card><Stat label="Mensuel net estimé" value={fmtEur(data.salary / 12 * 0.77)} /></Card><Card><Stat label="Bonus provisionné" value={fmtEur(data.bonusPool)} /></Card><Card><Stat label="Multiplicateur de bonus" value={`×${data.bank.bonusMult}`} sub={data.bank.name} /></Card></div>
    <div className="grid gap-4 xl:grid-cols-2">
      <Card title="Grille salariale (votre établissement)"><Table head={["Rang", "Poste", "Fixe annuel"]}>{data.grid.map((g: any) => <tr key={g.rank} className={g.rank === data.rank ? "bg-yellow-500/10" : ""}><td className="num px-2 py-1">{g.rank}</td><td className="px-2">{g.title}</td><td className="num px-2 text-right">{fmtEur(g.salary)}</td></tr>)}</Table></Card>
      <Card title="Bulletins et bonus"><Table head={["Date", "Libellé", "Montant"]}>{data.payslips.map((p: any) => <tr key={p.id}><td className="num px-2 py-1 text-xs">{fmtShortDate(p.t)}</td><td className="px-2 text-xs">{p.memo}</td><td className="num px-2 text-right text-gain">{fmtNum(p.amount / 100, 2)} €</td></tr>)}</Table>{data.payslips.length === 0 && <div className="text-sm text-ink-400">Premier salaire au début du mois prochain.</div>}</Card>
    </div>
  </>;
}
