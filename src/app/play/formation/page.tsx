"use client";
import { useState } from "react";
import { useView, useAction } from "@/lib/hooks";
import { Card, PageTitle, Loading, Badge, Button, inputCls, Tabs } from "@/components/ui";

export default function Formation() {
  const { data } = useView<any>("learning", {}, 30000);
  const act = useAction();
  const [sel, setSel] = useState<string | null>(null);
  const [ans, setAns] = useState("");
  const [res, setRes] = useState<{ correct: boolean; correction: string } | null>(null);
  const [branch, setBranch] = useState("");
  if (!data) return <Loading />;
  const lessons = data.lessons.filter((l: any) => !branch || l.branch === branch);
  const l = data.lessons.find((x: any) => x.id === sel) ?? lessons[0];
  const submit = async (v: number) => { const r = await act({ type: "lesson", lessonId: l.id, answer: v }, { silent: true }); if (r.ok) setRes(r.data); };
  return <>
    <PageTitle env="Centre de formation" title="Formation financière" subtitle={`${data.completed.length}/${data.lessons.length} modules validés. Chaque module : définition, explication simple, exemple chiffré, application dans le jeu, exercice et correction. L'XP n'est attribuée qu'une fois par module.`} right={<Tabs tabs={[{ id: "", label: "Tout" }, { id: "marches", label: "Marchés" }, { id: "maths", label: "Maths" }, { id: "analyse", label: "Analyse" }, { id: "risque", label: "Risque" }, { id: "macro", label: "Macro" }]} value={branch} onChange={setBranch} />} />
    <div className="grid gap-4 lg:grid-cols-[300px_1fr]">
      <Card pad={false}><ul className="scroll-thin max-h-[70vh] divide-y divide-ink-800 overflow-y-auto">{lessons.map((x: any) => <li key={x.id}><button onClick={() => { setSel(x.id); setAns(""); setRes(null); }} className={`flex w-full items-center justify-between px-3 py-2 text-left text-sm hover:bg-ink-800 ${l?.id === x.id ? "bg-ink-800" : ""}`}><span>{x.term}</span>{data.completed.includes(x.id) ? <Badge tone="gain">✔</Badge> : <Badge>niv. {x.level}</Badge>}</button></li>)}</ul></Card>
      {l && <Card title={l.term} right={<Badge tone="info">{l.branch}</Badge>}>
        <div className="space-y-3 text-sm leading-relaxed">
          <div><div className="text-[11px] uppercase text-gold">1. Définition</div>{l.definition}</div>
          <div><div className="text-[11px] uppercase text-gold">2. Explication simple</div>{l.simple}</div>
          <div><div className="text-[11px] uppercase text-gold">3. Exemple chiffré</div>{l.example}</div>
          <div><div className="text-[11px] uppercase text-gold">4. Application dans le jeu</div>{l.application}</div>
          <div className="rounded-lg border border-ink-600 bg-ink-900 p-3"><div className="text-[11px] uppercase text-gold">5. Exercice</div><div className="mb-2 font-medium">{l.exercise.question}</div>
            {l.exercise.kind === "qcm" ? <div className="grid gap-2">{l.exercise.options.map((o: string, i: number) => <Button key={o} variant="outline" onClick={() => submit(i)}>{o}</Button>)}</div> : <div className="flex gap-2"><input value={ans} onChange={(e) => setAns(e.target.value)} className={inputCls} placeholder={l.exercise.unit} /><Button onClick={() => submit(Number(ans.replace(",", ".").replace(/\s/g, "")))}>Valider</Button></div>}
            {res && <div className={`mt-3 rounded p-2 text-sm ${res.correct ? "bg-green-500/10 text-green-200" : "bg-red-500/10 text-red-200"}`}><div className="text-[11px] uppercase">6. Correction détaillée</div>{res.correct ? "✔ Bonne réponse. " : "✘ Réponse incorrecte. "}{res.correction}</div>}
          </div>
        </div>
      </Card>}
    </div>
  </>;
}
