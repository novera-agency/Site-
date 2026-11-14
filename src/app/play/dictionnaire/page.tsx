"use client";
import { useState } from "react";
import { LESSONS } from "@/engine/data/learning";
import { Card, PageTitle, inputCls, Badge } from "@/components/ui";

export default function Dictionnaire() {
  const [q, setQ] = useState("");
  const list = LESSONS.filter((l) => !q || (l.term + l.definition).toLowerCase().includes(q.toLowerCase())).sort((a, b) => a.term.localeCompare(b.term, "fr"));
  return <>
    <PageTitle env="Formation" title="Dictionnaire financier" subtitle="Consultable à tout moment. Les termes soulignés en pointillés dans le jeu ouvrent une explication contextuelle." right={<input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Rechercher un terme…" className={inputCls + " w-64"} />} />
    <div className="grid gap-3 md:grid-cols-2">{list.map((l) => <Card key={l.id} title={<span id={l.id}>{l.term}</span>} right={<Badge>{l.branch}</Badge>}><p className="text-sm text-ink-100">{l.definition}</p><p className="mt-2 text-sm text-ink-300">{l.simple}</p><p className="mt-2 text-xs text-ink-400">Exemple : {l.example}</p></Card>)}</div>
  </>;
}
