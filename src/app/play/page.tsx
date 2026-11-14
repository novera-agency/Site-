"use client";
import Link from "next/link";
import { useView } from "@/lib/hooks";
import { useGame } from "@/lib/store";
import { Card, Stat, Change, Badge, Loading, PageTitle, Bar, Empty } from "@/components/ui";
import { LineChart } from "@/components/charts";
import { fmtEur, fmtPx, fmtPct } from "@/lib/format";
import { fmtTime, fmtShortDate } from "@/engine/time";

export default function Bureau() {
  const { data } = useView<any>("dashboard");
  const snap = useGame((s) => s.snap);
  if (!data || !snap) return <Loading />;
  const perso = data.accounts.find((a: any) => a.id === "perso");
  const desk = data.accounts.find((a: any) => a.id === "desk");
  return <>
    <PageTitle env="Bureau personnel" title={`Bonjour ${snap.player.name.split(" ")[0]}`} subtitle={data.career ? `${data.career.title} — ${data.career.bank.name}` : snap.mode === "defi" ? "Mode défi" : "Investisseur indépendant"} right={<div className="flex gap-2"><Link href="/play/terminal" className="rounded-md bg-accent px-3 py-2 text-sm font-medium">Ouvrir le terminal</Link><Link href="/play/agenda" className="rounded-md bg-ink-700 px-3 py-2 text-sm">Agenda</Link></div>} />
    {data.challenge && <Card title={`Défi : ${data.challenge.def?.name}`} className="mb-4"><div className="flex flex-wrap gap-6"><Stat label="Performance" value={fmtPct(data.challenge.perf * 100)} tone={data.challenge.perf >= 0 ? "gain" : "loss"} /><Stat label="Objectif" value={fmtPct(data.challenge.target * 100)} /><Stat label="Échéance" value={fmtShortDate(data.challenge.deadlineT)} /><Stat label="Statut" value={data.challenge.status} /></div><p className="mt-2 text-xs text-ink-400">{data.challenge.def?.description}</p></Card>}
    <div className="grid gap-4 xl:grid-cols-3">
      <Card title="Mes comptes" className="xl:col-span-2">
        <div className="grid gap-4 md:grid-cols-2">
          <div className="rounded-lg bg-ink-900 p-3"><div className="mb-2 flex items-center justify-between"><span className="text-xs font-semibold uppercase tracking-wider text-ink-300">Compte personnel</span><Badge>Fonds propres</Badge></div><div className="grid grid-cols-2 gap-3"><Stat label="Valeur nette" value={fmtEur(perso.equity, 2)} /><Stat label="Liquidités" value={fmtEur(perso.cash, 2)} /><Stat label="Performance" value={fmtPct(perso.perf.totalReturn * 100)} tone={perso.perf.totalReturn >= 0 ? "gain" : "loss"} /><Stat label="P&L réalisé" value={fmtEur(perso.realized, 2)} /></div></div>
          {desk ? <div className="rounded-lg bg-ink-900 p-3"><div className="mb-2 flex items-center justify-between"><span className="text-xs font-semibold uppercase tracking-wider text-ink-300">Book du desk</span><Badge tone="info">Capital de la banque</Badge></div><div className="grid grid-cols-2 gap-3"><Stat label="Valeur" value={fmtEur(desk.equity)} /><Stat label="P&L semaine" value={fmtEur(snap.deskPnlWeek)} tone={(snap.deskPnlWeek ?? 0) >= 0 ? "gain" : "loss"} /><Stat label="VaR 99 % 1 j" value={fmtEur(data.career?.var)} sub={`limite ${fmtEur(data.career?.varLimit)}`} /><Stat label="Capital alloué" value={fmtEur(desk.capital)} /></div><div className="mt-2"><Bar value={data.career?.var ?? 0} max={data.career?.varLimit || 1} tone={(data.career?.var ?? 0) > (data.career?.varLimit ?? 1) * 0.8 ? "loss" : "gain"} /></div></div> : <div className="rounded-lg bg-ink-900 p-3 text-sm text-ink-400">Aucun book professionnel.</div>}
        </div>
        <div className="mt-4"><LineChart series={[{ name: "Personnel", color: "#3b82f6", data: data.equityHistory }]} height={180} /></div>
      </Card>
      <Card title="Agenda du jour" right={<Link href="/play/agenda" className="text-accent">tout voir</Link>}>
        {data.agenda.length === 0 ? <Empty>Aucun rendez-vous.</Empty> : <ul className="space-y-1.5">{data.agenda.map((a: any) => <li key={a.id} className={`flex gap-2 text-sm ${a.status !== "prevu" ? "opacity-50" : ""}`}><span className="num w-12 shrink-0 text-ink-400">{fmtTime(a.t)}</span><span className="flex-1">{a.title}</span>{a.status === "manque" && <Badge tone="loss">manqué</Badge>}{a.status === "fait" && <Badge tone="gain">fait</Badge>}{a.important && a.status === "prevu" && <Badge tone="warn">important</Badge>}</li>)}</ul>}
      </Card>
      <Card title="Marchés" right={<Badge tone={data.regime.id === "crise" ? "loss" : "info"}>{data.regime.label}</Badge>}>
        <table className="w-full text-sm"><tbody>{data.indices.map((q: any) => <tr key={q.id} className="border-b border-ink-800"><td className="py-1"><Link href={`/play/actif/${q.id}`} className="hover:text-accent">{q.n}</Link></td><td className="num text-right">{fmtPx(q.p)}</td><td className="w-20 text-right"><Change v={q.ch} /></td></tr>)}</tbody></table>
        <p className="mt-2 text-xs text-ink-400">{data.regime.description} Aversion au risque {Math.round(data.riskAversion * 100)}/100 · liquidité {Math.round(data.liquidity * 100)}/100.</p>
      </Card>
      <Card title="Missions en cours" right={<Link href="/play/missions" className="text-accent">missions</Link>}>{data.missions.length === 0 ? <Empty>Aucune mission active.</Empty> : <ul className="space-y-2">{data.missions.map((m: any) => <li key={m.id}><div className="flex justify-between text-sm"><span>{m.title}</span><span className="num text-xs text-ink-400">{fmtShortDate(m.deadlineT)}</span></div><Bar value={m.progress * 100} /></li>)}</ul>}</Card>
      <Card title="Dernières actualités" right={<Link href="/play/actualites" className="text-accent">journal</Link>}><ul className="space-y-2">{data.news.map((n: any) => <li key={n.id} className="text-sm"><span className="num mr-2 text-xs text-ink-500">{fmtTime(n.t)}</span>{n.impact === "fort" && <Badge tone="loss">fort</Badge>} {n.title}</li>)}</ul></Card>
      {data.career && <Card title="Carrière" right={<Link href="/play/carriere" className="text-accent">détails</Link>}>
        {!data.career.employed ? <div className="text-sm text-loss">Vous êtes actuellement sans poste. Consultez les offres dans <Link href="/play/rh" className="underline">Ressources humaines</Link>.</div> : <><div className="space-y-1 text-sm">{data.career.objectives.map((o: any) => <div key={o.key}>◆ {o.label}</div>)}</div>
        <div className="mt-3 grid grid-cols-2 gap-3"><Stat label="Stress" value={`${Math.round(data.career.stress)}/100`} tone={data.career.stress > 70 ? "loss" : "neutral"} /><Stat label="Dernière évaluation" value={data.career.lastReview ? `${data.career.lastReview.score}/100` : "—"} /></div></>}
      </Card>}
      <Card title="Calendrier (aujourd'hui / demain)" right={<Link href="/play/calendrier" className="text-accent">calendrier</Link>}>{data.calendar.length === 0 ? <Empty>Aucune publication.</Empty> : <ul className="space-y-1 text-sm">{data.calendar.map((c: any) => <li key={c.id} className={c.done ? "opacity-50" : ""}><span className="num mr-2 text-xs text-ink-400">{fmtShortDate(c.day * 1440).slice(0, 5)} {String(Math.floor(c.minute / 60)).padStart(2, "0")}:{String(c.minute % 60).padStart(2, "0")}</span>{"●".repeat(c.importance)} {c.title}{c.actual && <span className="ml-1 text-gold">→ {c.actual}</span>}</li>)}</ul>}</Card>
      {data.crises.length > 0 && <Card title="⚠ Situation de crise" className="xl:col-span-3 border-red-500/40">{data.crises.map((c: any) => <div key={c.id} className="text-sm"><b className="text-loss">{c.label}</b> — phase {c.phase} · {c.log[c.log.length - 1]?.text}</div>)}</Card>}
    </div>
  </>;
}
