"use client";
import { useState } from "react";
import { useView, useAction } from "@/lib/hooks";
import { useGame } from "@/lib/store";
import { Button, Badge, inputCls } from "./ui";

interface MView { id: string; title: string; type: string; location: string; done: boolean; outcome?: string; participants: { id: string; name: string; role: string; avatar: string; trust: number }[]; agenda: string[]; objectives: string[]; tension?: string; docs: { title: string; rows: [string, string][]; note?: string }[]; log: { who: string; text: string }[]; choices: { id: string; label: string; detail?: string }[]; numeric: { prompt: string; unit: string; hint?: string } | null; score: Record<string, number>; }

export function MeetingRoom({ meetingId, onClose }: { meetingId: string; onClose: () => void }) {
  const { data: m, reload } = useView<MView>("meeting", { id: meetingId }, 60000);
  const act = useAction();
  const [val, setVal] = useState("");
  const [busy, setBusy] = useState(false);
  if (!m) return null;
  const send = async (payload: Record<string, unknown>) => { setBusy(true); await act({ type: "answer_meeting", meetingId, ...payload }, { silent: true }); setVal(""); await reload(); setBusy(false); };
  return (
    <div className="fixed inset-0 z-50 flex items-stretch justify-center bg-black/75 p-0 backdrop-blur-sm md:p-6">
      <div className="panel flex w-full max-w-6xl flex-col overflow-hidden md:rounded-xl">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-700 bg-ink-900 px-4 py-3">
          <div><div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold">{m.location} · {m.type}</div><h2 className="text-lg font-semibold text-white">{m.title}</h2></div>
          <div className="flex items-center gap-2">{m.done ? <Button onClick={onClose}>Quitter la salle</Button> : <Button variant="outline" size="sm" onClick={async () => { await act({ type: "leave_meeting" }); onClose(); }}>Quitter (mal perçu)</Button>}</div>
        </header>
        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[1fr_340px]">
          <div className="flex min-h-0 flex-col">
            <div className="flex gap-3 overflow-x-auto border-b border-ink-800 px-4 py-3 scroll-thin">
              {m.participants.map((p) => <div key={p.id} className="flex min-w-[170px] items-center gap-2 rounded-lg bg-ink-800 px-3 py-2"><span className="text-2xl">{p.avatar}</span><div className="min-w-0"><div className="truncate text-sm font-medium">{p.name}</div><div className="truncate text-[11px] text-ink-400">{p.role} · confiance {Math.round(p.trust)}</div></div></div>)}
            </div>
            <div className="scroll-thin flex-1 space-y-3 overflow-y-auto p-4" style={{ maxHeight: "52vh" }}>
              {m.log.map((l, i) => {
                const mine = l.who.includes("(vous)"); const sys = l.who === "—" || l.who === "Correction" || l.who === "Exécution" || l.who === "Bilan";
                return <div key={i} className={`fade-in ${mine ? "ml-auto max-w-[80%] text-right" : "max-w-[90%]"}`}>
                  <div className={`text-[11px] ${sys ? "text-gold" : "text-ink-400"}`}>{l.who}</div>
                  <div className={`mt-0.5 inline-block rounded-lg px-3 py-2 text-sm leading-relaxed ${mine ? "bg-accent/20 text-blue-100" : sys ? "border border-ink-600 bg-ink-850 text-ink-200" : "bg-ink-800 text-ink-100"}`}>{l.text}</div>
                </div>;
              })}
            </div>
            <div className="border-t border-ink-700 bg-ink-900 p-4">
              {m.done ? <div className="text-sm"><Badge tone="gold">Réunion terminée</Badge> <span className="ml-2 text-ink-200">{m.outcome}</span></div>
                : m.numeric ? <form onSubmit={(e) => { e.preventDefault(); const v = Number(val.replace(/\s/g, "").replace(",", ".")); if (Number.isFinite(v)) send({ value: v }); }} className="space-y-2">
                  <div className="text-sm text-ink-200">{m.numeric.prompt}</div>
                  {m.numeric.hint && <div className="text-xs text-ink-400">💡 {m.numeric.hint}</div>}
                  <div className="flex gap-2"><input autoFocus value={val} onChange={(e) => setVal(e.target.value)} className={inputCls} placeholder={`Réponse (${m.numeric.unit})`} inputMode="decimal" /><Button type="submit" disabled={busy || !val}>Répondre</Button></div>
                </form>
                : <div className="grid gap-2">{m.choices.map((c) => <button key={c.id} disabled={busy} onClick={() => send({ choiceId: c.id })} className="rounded-lg border border-ink-600 bg-ink-850 px-3 py-2.5 text-left text-sm text-ink-100 transition hover:border-accent hover:bg-ink-800 disabled:opacity-50">{c.label}{c.detail && <span className="mt-0.5 block text-xs text-ink-400">{c.detail}</span>}</button>)}</div>}
            </div>
          </div>
          <aside className="scroll-thin space-y-4 overflow-y-auto border-l border-ink-700 bg-ink-900/60 p-4" style={{ maxHeight: "80vh" }}>
            {m.tension && <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-200">⚠ {m.tension}</div>}
            <div><div className="mb-1 text-[11px] uppercase tracking-wider text-ink-400">Ordre du jour</div><ol className="list-decimal space-y-0.5 pl-4 text-sm text-ink-200">{m.agenda.map((a) => <li key={a}>{a}</li>)}</ol></div>
            <div><div className="mb-1 text-[11px] uppercase tracking-wider text-ink-400">Objectifs</div><ul className="space-y-0.5 text-sm text-ink-200">{m.objectives.map((a) => <li key={a}>◆ {a}</li>)}</ul></div>
            {m.docs.map((d) => <div key={d.title} className="rounded-lg border border-ink-700 bg-ink-850 p-3"><div className="mb-2 text-xs font-semibold text-white">📄 {d.title}</div><dl className="space-y-1 text-xs">{d.rows.map(([k, v], i) => <div key={i} className="grid grid-cols-[minmax(0,40%)_1fr] gap-2"><dt className="text-ink-400">{k}</dt><dd className="num text-ink-100">{v}</dd></div>)}</dl>{d.note && <div className="mt-2 text-[11px] text-ink-300">{d.note}</div>}</div>)}
            <div className="text-[11px] text-ink-400">Score en cours — finance {m.score.finance} · risque {m.score.risque} · communication {m.score.communication} · éthique {m.score.ethique}</div>
          </aside>
        </div>
      </div>
    </div>
  );
}

export function MeetingLauncher() {
  const snap = useGame((s) => s.snap);
  const act = useAction();
  const [open, setOpen] = useState<string | null>(null);
  const active = snap?.activeMeetingId ?? null;
  const shown = open ?? active;
  return <>
    {snap?.pendingMeeting && !active && <div className="fixed bottom-4 left-1/2 z-40 flex -translate-x-1/2 items-center gap-3 rounded-xl border border-gold/50 bg-ink-850 px-4 py-3 shadow-2xl fade-in"><span className="text-xl">📣</span><div><div className="text-[11px] uppercase tracking-wider text-gold">Vous êtes attendu</div><div className="text-sm font-medium">{snap.pendingMeeting.title}</div></div><Button onClick={async () => { const r = await act({ type: "join_meeting" }, { silent: true }); if (r.ok && r.data?.meetingId) setOpen(r.data.meetingId); }}>Rejoindre</Button></div>}
    {active && !open && <div className="fixed bottom-4 left-1/2 z-40 -translate-x-1/2"><Button onClick={() => setOpen(active)}>Retourner en réunion</Button></div>}
    {shown && <MeetingRoom meetingId={shown} onClose={() => setOpen(null)} />}
  </>;
}
