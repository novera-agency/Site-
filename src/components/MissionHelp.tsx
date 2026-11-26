"use client";
import Link from "next/link";
import { useState } from "react";
import { useView, useAction } from "@/lib/hooks";
import { useGame } from "@/lib/store";
import { Button, Badge, Bar, inputCls } from "./ui";
import { Explained, HelpMe } from "./Explained";
import { fmtShortDate } from "@/engine/time";

/** Question d'une mission : mots de métier explicables au toucher + panneau « Je ne comprends pas » */
export function MissionQuiz({ m }: { m: any }) {
  return <><MissionQuizInner m={m} /><HelpMe help={m.help} /></>;
}
function MissionQuizInner({ m }: { m: any }) {
  const act = useAction();
  const [v, setV] = useState("");
  const q = m.question;
  if (!q) return null;
  if (q.kind === "numeric") return <div className="mt-2 rounded bg-ink-900 p-2"><div className="text-sm"><Explained text={q.question} /></div><div className="mt-1 flex gap-2"><input value={v} onChange={(e) => setV(e.target.value)} className={inputCls} placeholder={q.unit} /><Button onClick={() => act({ type: "answer_mission", missionId: m.id, value: Number(v.replace(",", ".")) })}>Répondre</Button></div></div>;
  if (q.kind === "choice") return <div className="mt-2 rounded bg-ink-900 p-2"><div className="text-sm"><Explained text={q.question} /></div><div className="mt-1 flex flex-wrap gap-2">{q.options.map((o: string, i: number) => <Button key={o} variant="outline" size="sm" onClick={() => act({ type: "answer_mission", missionId: m.id, choice: i })}>{o}</Button>)}</div></div>;
  return <div className="mt-2 rounded bg-ink-900 p-2"><div className="text-sm"><Explained text={q.question} /> {q.answered && <Badge tone="info">prévision : {q.answered}</Badge>}</div>{!q.answered && <div className="mt-1 flex gap-2">{q.options.map((o: string) => <Button key={o} variant="outline" size="sm" onClick={() => act({ type: "answer_mission", missionId: m.id, forecast: o })}>{o.replace("_", " ")}</Button>)}</div>}</div>;
}

/** Bouton qui active / désactive l'aide d'une mission */
export function HelpButton({ missionId, size = "md" }: { missionId: string; size?: "sm" | "md" }) {
  const help = useGame((s) => s.helpMission);
  const setHelp = useGame((s) => s.setHelp);
  const on = help === missionId;
  return <Button size={size} variant={on ? "success" : "outline"} data-testid={`help-${missionId}`} onClick={() => setHelp(on ? null : missionId)}>{on ? "💡 Aide activée — désactiver" : "💡 Activer l'aide"}</Button>;
}

/** Panneau d'aide flottant : visible sur tous les écrans, réductible et fermable */
export function MissionHelpPanel() {
  const id = useGame((s) => s.helpMission);
  const min = useGame((s) => s.helpMin);
  const setHelp = useGame((s) => s.setHelp);
  const now = useGame((s) => s.snap?.t ?? 0);
  const meetingBanner = useGame((s) => !!s.snap?.pendingMeeting && !s.snap?.activeMeetingId);
  const lift = meetingBanner ? "bottom-56 md:bottom-20" : "bottom-20";
  const { data: m } = useView<any>("mission", { id: id ?? "" }, 2500, !!id);
  if (!id || !m) return null;
  if (m.error) return null;
  if (min) return <button data-testid="help-pill" onClick={() => setHelp(id, false)} className={`fixed ${lift} right-3 z-40 flex max-w-[70vw] items-center gap-2 rounded-full border border-gold/60 bg-ink-850 px-3 py-2 text-xs text-white shadow-2xl`}><span>💡</span><span className="truncate">Aide : {m.title}</span><span className="text-ink-400">▲</span></button>;
  const d = Math.max(0, (m.deadlineT - now) / 1440);
  return <aside data-testid="help-panel" className={`fade-in fixed inset-x-2 ${lift} z-40 max-h-[45vh] overflow-y-auto overscroll-contain rounded-xl border border-gold/50 bg-ink-850/95 p-4 shadow-2xl backdrop-blur scroll-thin md:inset-x-auto md:right-4 md:w-96 md:max-h-[70vh]`}>
    <div className="mb-2 flex items-start justify-between gap-2">
      <div className="min-w-0"><div className="text-[10px] font-semibold uppercase tracking-[0.18em] text-gold">💡 Aide de mission</div><div className="font-semibold text-white">{m.title}</div></div>
      <div className="flex shrink-0 gap-1"><button title="Réduire" data-testid="help-min" onClick={() => setHelp(id, true)} className="rounded bg-ink-700 px-2 py-0.5 text-xs hover:bg-ink-600">▼</button><button title="Fermer l'aide" data-testid="help-close" onClick={() => setHelp(null)} className="rounded bg-ink-700 px-2 py-0.5 text-xs hover:bg-ink-600">✕</button></div>
    </div>
    {m.giverInfo && <div className="mb-2 text-xs text-ink-300">{m.giverInfo.avatar} Confiée par <b className="text-white">{m.giverInfo.name}</b> · {m.giverInfo.role}</div>}
    {m.status !== "active" ? <div className="mb-2"><Badge tone={m.status === "reussie" ? "gain" : "loss"}>{m.status === "reussie" ? "Mission réussie ✔" : "Mission échouée"}</Badge><p className="mt-2 text-xs text-ink-300">Vous pouvez fermer cette aide et en activer une autre dans l'onglet Missions.</p></div> : <>
      <div className="mb-2 flex items-center gap-2 text-xs"><Bar value={m.progress * 100} tone="gain" /><span className="num shrink-0">{Math.round(m.progress * 100)} %</span><span className="shrink-0 text-ink-400">· {d < 1 ? "dernier jour" : `${Math.round(d)} j restants`} ({fmtShortDate(m.deadlineT)})</span></div>
      <div className="text-[11px] font-semibold uppercase tracking-wider text-blue-300">Étapes</div>
      <ol className="mb-2 list-decimal space-y-1 pl-5 text-sm text-ink-100">{m.guide.steps.map((x: string, i: number) => <li key={i}>{x}</li>)}</ol>
      {m.guide.tip && <div className="mb-2 rounded-md bg-yellow-500/10 p-2 text-xs text-yellow-100"><b>Pour réussir :</b> {m.guide.tip}</div>}
      <div className="mb-2 text-[11px] uppercase tracking-wider text-ink-400">Critères de réussite</div>
      <ul className="mb-3 text-xs text-ink-300">{m.criteria.map((c: string) => <li key={c}>✓ {c}</li>)}</ul>
      <Link href={m.guide.link} className="inline-block rounded-md bg-accent px-3 py-1.5 text-sm font-medium text-white">{m.guide.linkLabel} →</Link>
      <MissionQuiz m={m} />
    </>}
  </aside>;
}
