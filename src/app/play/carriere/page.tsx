"use client";
import Link from "next/link";
import { useView } from "@/lib/hooks";
import { Card, PageTitle, Loading, Stat, Badge, Bar, Table } from "@/components/ui";
import { fmtEur } from "@/lib/format";
import { fmtShortDate, fmtDateTime } from "@/engine/time";

export default function Carriere() {
  const { data } = useView<any>("hr", {}, 4000);
  if (!data) return <Loading />;
  const c = data.career, t = data.track, sc = data.score;
  return <>
    <PageTitle env="Interface de gestion de carrière" title={c.employed ? c.title : data.mode === "carriere" ? "Sans poste" : "Mode libre"} subtitle={`${t.name} · ${data.bank.name}`} />
    <div className="mb-4 rounded-xl border border-ink-700 p-4" style={{ background: `linear-gradient(120deg, ${data.bank.color}66, #0a0e15 60%)` }}>
      <div className="mb-3 text-[11px] uppercase tracking-[0.2em] text-ink-300">Échelle de carrière — {t.name}</div>
      <div className="flex flex-wrap gap-1">{t.ranks.map((r: string, i: number) => <div key={r} className={`flex-1 min-w-[90px] rounded-md px-2 py-2 text-center text-[11px] ${i === c.rank ? "bg-gold text-black font-bold" : i < c.rank ? "bg-green-700/40 text-green-200" : "bg-ink-800 text-ink-400"}`}>{r}<div className="num">{Math.round(data.baseSalary[i] * data.bank.salaryMult / 1000)} k€</div></div>)}</div>
      <div className="mt-2 text-xs text-ink-300">Condition de victoire : {t.win}</div>
    </div>
    <div className="grid gap-4 xl:grid-cols-3">
      <Card title="Score de performance (trimestre)">{sc ? <><div className="num mb-2 text-4xl font-bold">{sc.total}<span className="text-base text-ink-400">/100</span></div>{Object.entries(sc.details).map(([k, v]) => <div key={k} className="mb-1.5"><div className="flex justify-between text-xs capitalize"><span>{k}</span><span className="num">{v as number}</span></div><Bar value={v as number} tone={(v as number) < 40 ? "loss" : (v as number) < 60 ? "warn" : "gain"} /></div>)}<p className="mt-2 text-[11px] text-ink-400">Un P&L élevé ne suffit pas : la promotion exige aussi gestion du risque, conformité, compétences, réputation et ancienneté.</p></> : <div className="text-sm text-ink-400">Pas d'évaluation hors poste.</div>}</Card>
      <Card title="Situation"><div className="grid grid-cols-2 gap-3"><Stat label="Salaire fixe" value={fmtEur(c.salaryAnnual)} /><Stat label="Bonus provisionné" value={fmtEur(c.ytdBonusPool)} /><Stat label="Stress" value={`${Math.round(c.stress)}/100`} tone={c.stress > 70 ? "loss" : "neutral"} /><Stat label="Énergie" value={`${Math.round(c.energy)}/100`} /><Stat label="Missions réussies" value={c.missionsDone} sub={`${c.missionsFailed} échouées`} /><Stat label="Incidents de risque" value={c.breaches} sub={`${c.warnings} avertissement(s)`} tone={c.breaches > 0 ? "loss" : "neutral"} /><Stat label="Limite VaR" value={fmtEur(c.deskLimitVaR)} /><Stat label="En poste depuis" value={fmtShortDate(c.hiredT)} /></div></Card>
      <Card title="Objectifs"><ul className="space-y-1 text-sm">{c.objectives.map((o: any) => <li key={o.key}>◆ {o.label}</li>)}</ul><div className="mt-3 text-xs text-ink-400">Compétences clés du métier : {t.skills.join(", ")}.</div><div className="mt-3 flex gap-2"><Link href="/play/missions" className="text-xs text-accent">Missions →</Link><Link href="/play/competences" className="text-xs text-accent">Compétences →</Link><Link href="/play/rh" className="text-xs text-accent">RH →</Link></div></Card>
      <Card title="Évaluations" className="xl:col-span-2"><Table head={["Date", "Type", "Score", "Résultat", "Commentaire"]}>{c.reviews.map((r: any, i: number) => <tr key={i}><td className="num px-2 py-1 text-xs">{fmtShortDate(r.t)}</td><td className="px-2"><Badge>{r.kind}</Badge></td><td className="num px-2">{r.score}</td><td className="px-2 text-xs">{r.outcome}</td><td className="px-2 text-xs text-ink-400">{r.comment}</td></tr>)}</Table></Card>
      <Card title="Parcours"><ul className="space-y-1 text-xs">{c.history.map((h: any, i: number) => <li key={i}><span className="num mr-1 text-ink-500">{fmtDateTime(h.t).slice(0, 10)}</span>{h.text}</li>)}</ul></Card>
    </div>
  </>;
}
