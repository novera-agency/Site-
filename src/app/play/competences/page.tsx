"use client";
import { useView } from "@/lib/hooks";
import { Card, PageTitle, Loading, Bar } from "@/components/ui";
import { fmtDateTime } from "@/engine/time";

const DESC: Record<string, string> = { analyse: "Comptabilité, valorisation, ratios, analyse fondamentale.", marches: "Actions, obligations, devises, dérivés, exécution.", maths: "Probabilités, statistiques, valorisation, sensibilités.", macro: "Inflation, croissance, politique monétaire, cycles.", risque: "VaR, stress tests, couverture, liquidité.", client: "Communication, négociation, conseil, gestion de conflits.", management: "Leadership, recrutement, stratégie, organisation.", entrepreneuriat: "Financement, création d'entreprise, développement commercial." };
export default function Competences() {
  const { data } = useView<any>("skills", {}, 5000);
  if (!data) return <Loading />;
  return <>
    <PageTitle env="Progression" title="Arbre de compétences" subtitle="L'expérience s'acquiert uniquement en agissant : ordres, réunions, missions, formation. Les actions répétées rapportent de moins en moins." />
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{data.skills.map((s: any) => <Card key={s.id} title={s.name}><div className="num text-3xl font-bold text-gold">Niv. {s.level}</div><div className="mt-1 text-xs text-ink-400">{DESC[s.id]}</div><div className="mt-3"><Bar value={s.next ? s.xp - s.prev : 1} max={s.next ? s.next - s.prev : 1} tone="gold" /></div><div className="num mt-1 text-[11px] text-ink-400">{s.xp} XP{s.next ? ` / ${s.next}` : " (max)"}</div></Card>)}</div>
    <Card title="Journal d'expérience" className="mt-4"><ul className="space-y-1 text-xs">{data.log.map((l: any, i: number) => <li key={i}><span className="num mr-2 text-ink-500">{fmtDateTime(l.t)}</span><b>+{l.xp}</b> {l.branch} — {l.reason}</li>)}</ul></Card>
  </>;
}
