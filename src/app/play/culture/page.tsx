"use client";
import { useEffect, useState } from "react";
import { useView, useAction } from "@/lib/hooks";
import { Card, PageTitle, Loading, Badge, Bar, Button, Tabs } from "@/components/ui";

type Res = { correct: boolean; answer: number; explain: string; xp: number; streak: number; first: boolean };
const LEVEL = ["", "Facile", "Moyen", "Difficile"];

export default function Culture() {
  const [cat, setCat] = useState<"mix" | "micro" | "macro">("mix");
  const { data } = useView<any>("culture", { cat }, 3000);
  const act = useAction();
  const [queue, setQueue] = useState<any[] | null>(null);
  const [seen, setSeen] = useState<string[]>([]);
  const [picked, setPicked] = useState<number | null>(null);
  const [res, setRes] = useState<Res | null>(null);
  const [round, setRound] = useState({ ok: 0, n: 0 });
  // La série (5 questions) est figée au départ ; la vue se rafraîchit en arrière-plan sans la changer
  useEffect(() => { if (data && data.cat === cat && data.mode === "carriere" && queue === null) setQueue(data.batch); }, [data, cat, queue]);
  if (!data || (data.mode === "carriere" && queue === null)) return <Loading />;
  const sub = "Micro et macroéconomie : une question à la fois, avec l'explication à chaque réponse. Chaque bonne réponse développe vos compétences (analyse pour la micro, macro pour la macro).";
  if (data.mode !== "carriere") return <><PageTitle env="Carrière" title="Quiz d'économie" subtitle={sub} /><Card><p className="text-sm text-ink-300">Le quiz d'économie est disponible en mode carrière.</p></Card></>;
  const q = queue ? queue[seen.length] : undefined;
  const total = data.stats.micro.total + data.stats.macro.total;
  const done = data.stats.micro.done + data.stats.macro.done;
  const pick = async (i: number) => {
    if (res || !q) return;
    setPicked(i);
    const r = await act({ type: "quiz_answer", id: q.id, choice: i }, { silent: true });
    if (r.ok && r.data) { setRes(r.data as Res); setRound((x) => ({ ok: x.ok + ((r.data as Res).correct ? 1 : 0), n: x.n + 1 })); }
  };
  const next = () => { if (q) setSeen((s) => [...s, q.id]); setPicked(null); setRes(null); };
  const restart = () => { setQueue(null); setSeen([]); setPicked(null); setRes(null); setRound({ ok: 0, n: 0 }); };
  return <>
    <PageTitle env="Carrière" title="Quiz d'économie" subtitle={sub} />
    <div className="mb-4 grid gap-3 md:grid-cols-3" data-testid="quiz-stats">
      <Card><div className="text-xs text-ink-400">Questions réussies</div><div className="num text-2xl font-semibold text-gold">{done} / {total}</div><div className="mt-2"><Bar value={done} max={total} tone="gold" /></div></Card>
      <Card><div className="text-xs text-ink-400">Microéconomie</div><div className="num text-xl font-semibold">{data.stats.micro.done} / {data.stats.micro.total}</div><div className="mt-2"><Bar value={data.stats.micro.done} max={data.stats.micro.total} /></div></Card>
      <Card><div className="text-xs text-ink-400">Macroéconomie</div><div className="num text-xl font-semibold">{data.stats.macro.done} / {data.stats.macro.total}</div><div className="mt-2"><Bar value={data.stats.macro.done} max={data.stats.macro.total} tone="gain" /></div></Card>
    </div>
    <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
      <Tabs tabs={[{ id: "mix" as const, label: "Mélange" }, { id: "micro" as const, label: "Micro" }, { id: "macro" as const, label: "Macro" }]} value={cat} onChange={(v) => { setCat(v); restart(); }} />
      <div className="text-xs text-ink-400">Série en cours : <b className="num text-white" data-testid="quiz-streak">{data.stats.streak}</b> · meilleure : <span className="num">{data.stats.best}</span></div>
    </div>
    {!q ? <Card title="Série terminée 🎉"><p className="text-sm text-ink-200" data-testid="quiz-end">{round.n > 0 ? `Vous avez réussi ${round.ok} question${round.ok > 1 ? "s" : ""} sur ${round.n}.` : "Vous avez répondu à toutes les questions disponibles dans cette catégorie !"} {queue && queue.length === 0 ? "Plus aucune question à découvrir ici : changez de catégorie." : ""}</p><div className="mt-3">{queue && queue.length > 0 && <Button onClick={restart}>Nouvelle série</Button>}</div></Card>
      : <Card>
        <div className="mb-2 flex items-center gap-2"><Badge tone={q.cat === "macro" ? "gain" : "info"}>{q.cat === "macro" ? "Macro" : "Micro"}</Badge><Badge tone="neutral">{LEVEL[q.level]}</Badge><span className="ml-auto text-[11px] text-ink-400">Question {seen.length + 1} / {queue!.length}</span></div>
        <h2 className="mb-3 text-base font-semibold text-white" data-testid="quiz-question">{q.q}</h2>
        <div className="space-y-2" role="group" aria-label="Réponses possibles">{q.options.map((o: string, i: number) => {
          const state = !res ? "" : i === res.answer ? "border-green-500 bg-green-500/10" : i === picked ? "border-red-500 bg-red-500/10" : "opacity-60";
          return <button key={i} data-testid={`quiz-opt-${i}`} disabled={!!res} onClick={() => pick(i)} className={`block w-full rounded-lg border px-3 py-2.5 text-left text-sm transition ${state || "border-ink-600 bg-ink-900 hover:border-gold"}`}><span className="mr-2 text-ink-400">{String.fromCharCode(65 + i)}.</span>{o}{res && i === res.answer && <span className="ml-2 text-gain">✔</span>}{res && i === picked && i !== res.answer && <span className="ml-2 text-loss">✘</span>}</button>;
        })}</div>
        {res && <div className={`mt-3 rounded-lg border p-3 text-sm ${res.correct ? "border-green-500/40 bg-green-500/5" : "border-red-500/40 bg-red-500/5"}`} data-testid="quiz-result" role="status">
          <div className={`font-semibold ${res.correct ? "text-gain" : "text-loss"}`}>{res.correct ? "✔ Bonne réponse !" : "✘ Pas tout à fait."}{res.xp > 0 && <span className="ml-2 text-xs text-gold">+{res.xp} XP</span>}</div>
          <p className="mt-1 text-ink-200">{res.explain}</p>
          <div className="mt-3"><Button data-testid="quiz-next" onClick={next}>Question suivante →</Button></div>
        </div>}
      </Card>}
  </>;
}
