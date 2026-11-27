"use client";
import { useView } from "@/lib/hooks";
import { Card, PageTitle, Loading, Bar } from "@/components/ui";
import { fmtDateTime } from "@/engine/time";
import Link from "next/link";

const DESC: Record<string, string> = { analyse: "Comptabilité, valorisation, ratios, analyse fondamentale.", marches: "Actions, obligations, devises, dérivés, exécution.", maths: "Probabilités, statistiques, valorisation, sensibilités.", macro: "Inflation, croissance, politique monétaire, cycles.", risque: "VaR, stress tests, couverture, liquidité.", client: "Communication, négociation, conseil, gestion de conflits.", management: "Leadership, recrutement, stratégie, organisation.", entrepreneuriat: "Financement, création d'entreprise, développement commercial." };
export default function Competences() {
  const { data } = useView<any>("skills", {}, 5000);
  const { data: pr } = useView<any>("practice", {}, 8000);
  if (!data) return <Loading />;
  return <>
    <PageTitle env="Progression" title="Arbre de compétences" subtitle="L'expérience s'acquiert uniquement en agissant : ordres, réunions, missions, formation. Les actions répétées rapportent de moins en moins." />
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">{data.skills.map((s: any) => <Card key={s.id} title={s.name}><div className="num text-3xl font-bold text-gold">Niv. {s.level}</div><div className="mt-1 text-xs text-ink-400">{DESC[s.id]}</div><div className="mt-3"><Bar value={s.next ? s.xp - s.prev : 1} max={s.next ? s.next - s.prev : 1} tone="gold" /></div><div className="num mt-1 text-[11px] text-ink-400">{s.xp} XP{s.next ? ` / ${s.next}` : " (max)"}</div></Card>)}</div>
    {pr && <Card title="Ma pratique : ce que je maîtrise, ce que je rate" className="mt-4">
      <p className="mb-2 text-xs text-ink-400" data-testid="practice-summary">{pr.total === 0 ? "Aucune mission de calcul terminée pour l'instant : répondez à vos missions du jour, votre progression apparaîtra ici." : `${pr.total} type${pr.total > 1 ? "s" : ""} de problèmes essayé${pr.total > 1 ? "s" : ""} sur ${pr.available}. Les missions proposées reviennent plus souvent sur ceux que vous ratez, et sur ceux que vous n'avez pas encore vus.`}</p>
      {pr.weak.length > 0 && <div className="mb-3 rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-sm text-amber-100" data-testid="practice-weak"><b>À retravailler :</b> {pr.weak.map((f: any) => `${f.title} (${f.rate} %)`).join(" · ")}. <Link href="/play/formation" className="text-accent underline">Réviser en formation</Link></div>}
      <div className="grid gap-x-6 gap-y-1 md:grid-cols-2">{[...pr.other, ...pr.families].filter((f: any) => f.rate !== null).sort((a: any, b: any) => a.rate - b.rate).map((f: any) => <div key={f.key} className="flex items-center gap-2 text-xs"><span className="w-56 truncate" title={f.title}>{f.title}</span><div className="flex-1"><Bar value={f.rate} tone={f.rate >= 75 ? "gain" : f.rate >= 50 ? "warn" : "loss"} /></div><span className="num w-24 text-right text-ink-300">{f.ok} ✔ / {f.ko} ✘</span></div>)}</div>
    </Card>}
    <Card title="Journal d'expérience" className="mt-4"><ul className="space-y-1 text-xs">{data.log.map((l: any, i: number) => <li key={i}><span className="num mr-2 text-ink-500">{fmtDateTime(l.t)}</span><b>+{l.xp}</b> {l.branch} — {l.reason}</li>)}</ul></Card>
  </>;
}
