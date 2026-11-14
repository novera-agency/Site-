"use client";
import Link from "next/link";
import { useState } from "react";
import { useView, useAction } from "@/lib/hooks";
import { Card, PageTitle, Loading, Badge, Button, inputCls } from "@/components/ui";
import { fmtEur } from "@/lib/format";
import { fmtShortDate } from "@/engine/time";

export default function RH() {
  const { data } = useView<any>("hr", {}, 4000);
  const act = useAction();
  const [days, setDays] = useState(5);
  if (!data) return <Loading />;
  const c = data.career;
  return <>
    <PageTitle env="Ressources humaines" title="Ressources humaines" subtitle="Offres de recrutement, entretiens, congés, mobilité. Changer d'établissement remet à zéro votre capital de confiance interne." />
    <div className="grid gap-4 xl:grid-cols-2">
      <Card title="Offres reçues">{c.offers.length === 0 ? <div className="text-sm text-ink-400">Aucune offre en cours. Les chasseurs de têtes approchent les profils à forte réputation.</div> : c.offers.map((o: any) => <div key={o.id} className="mb-2 rounded-md border border-ink-700 p-3"><div className="flex items-center gap-2"><b>{o.bank.name}</b><Badge tone="gold">{"★".repeat(o.bank.prestige)}</Badge>{o.ready && <Badge tone="gain">offre ferme</Badge>}</div><div className="text-sm">{o.title} — {fmtEur(o.salary)} / an</div><div className="text-xs text-ink-400">Expire le {fmtShortDate(o.expiresT)} · {o.bank.culture}</div><Link href="/play/messagerie" className="mt-1 inline-block text-xs text-accent">Répondre dans la messagerie →</Link></div>)}</Card>
      <Card title="Congés et bien-être"><div className="text-sm">Stress : <b>{Math.round(c.stress)}/100</b> · jours de congé restants : <b>{data.vacationLeft}</b></div><p className="mt-1 text-xs text-ink-400">Un stress supérieur à 92 déclenche un arrêt pour épuisement (10 jours). Les congés annulent vos rendez-vous sans pénalité ; le marché continue d'évoluer.</p><div className="mt-2 flex gap-2"><input type="number" min={1} max={15} value={days} onChange={(e) => setDays(Number(e.target.value))} className={inputCls + " w-24"} /><Button disabled={!c.employed} onClick={() => act({ type: "vacation", days })}>Poser {days} jour(s)</Button></div></Card>
      <Card title="Grille des établissements" className="xl:col-span-2"><div className="grid gap-2 md:grid-cols-2 xl:grid-cols-4">{data.banks.map((b: any) => <div key={b.id} className="rounded-md p-3" style={{ background: `linear-gradient(135deg, ${b.color}55, #0e131c 70%)` }}><div className="text-sm font-semibold">{b.name}</div><div className="text-[11px] text-ink-300">{b.city} · prestige {b.prestige} · difficulté {b.difficulty}</div><div className="text-[11px] text-ink-400">Salaire ×{b.salaryMult} · bonus ×{b.bonusMult}</div>{b.id === c.bankId && c.employed && <Badge tone="info">votre employeur</Badge>}</div>)}</div></Card>
    </div>
  </>;
}
