"use client";
import { useEffect, useRef, useState } from "react";
import { useView, useAction } from "@/lib/hooks";
import { useGame } from "@/lib/store";
import { Button, Badge, inputCls } from "./ui";

interface MView { id: string; title: string; type: string; location: string; done: boolean; outcome?: string; participants: { id: string; name: string; role: string; avatar: string; trust: number }[]; agenda: string[]; objectives: string[]; tension?: string; docs: { title: string; rows: [string, string][]; note?: string }[]; log: { who: string; text: string }[]; choices: { id: string; label: string; detail?: string }[]; numeric: { prompt: string; unit: string; hint?: string } | null; score: Record<string, number>; }

export function MeetingRoom({ meetingId, onClose }: { meetingId: string; onClose: () => void }) {
  const { data: m, reload } = useView<MView>("meeting", { id: meetingId }, 60000);
  const act = useAction();
  const [val, setVal] = useState("");
  const [busy, setBusy] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  useEffect(() => { logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" }); }, [m?.log.length]);
  if (!m) return null;
  const send = async (payload: Record<string, unknown>) => { setBusy(true); await act({ type: "answer_meeting", meetingId, ...payload }, { silent: true }); setVal(""); await reload(); setBusy(false); };
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-black/75 p-0 backdrop-blur-sm md:p-6" data-testid="meeting-room">
      <div className="panel mx-auto flex min-h-full w-full max-w-6xl flex-col md:min-h-0 md:rounded-xl">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-700 bg-ink-900 px-4 py-3">
          <div><div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold">{m.location} · {m.type}</div><h2 className="text-lg font-semibold text-white">{m.title}</h2></div>
          <div className="flex items-center gap-2">{m.done ? <Button onClick={onClose}>Quitter la salle</Button> : <Button variant="outline" size="sm" onClick={async () => { await act({ type: "leave_meeting" }); onClose(); }}>Quitter (mal perçu)</Button>}</div>
        </header>
        <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px]">
          <div className="flex min-h-0 flex-col">
            <div className="flex gap-3 overflow-x-auto border-b border-ink-800 px-4 py-3 scroll-thin">
              {m.participants.map((p) => <div key={p.id} className="flex min-w-[170px] items-center gap-2 rounded-lg bg-ink-800 px-3 py-2"><span className="text-2xl">{p.avatar}</span><div className="min-w-0"><div className="truncate text-sm font-medium">{p.name}</div><div className="truncate text-[11px] text-ink-400">{p.role} · confiance {Math.round(p.trust)}</div></div></div>)}
            </div>
            <div className="scroll-thin flex-1 space-y-3 overflow-y-auto p-4" ref={logRef} style={{ maxHeight: "52vh" }} data-testid="meeting-log">
              {m.log.map((l, i) => {
                const who = m.participants.find((p) => p.name === l.who);
                const mine = l.who.includes("(vous)"); const sys = l.who === "—" || l.who === "Correction" || l.who === "Exécution" || l.who === "Bilan";
                return <div key={i} className={`fade-in ${mine ? "ml-auto max-w-[80%] text-right" : "max-w-[90%]"}`}>
                  <div className={`text-[11px] ${sys ? "text-gold" : "text-ink-400"}`}>{who ? <>{who.avatar} <b className="text-ink-200">{who.name}</b> · {who.role}</> : l.who}</div>
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
          <aside className="scroll-thin space-y-4 border-t border-ink-700 bg-ink-900/60 p-4 lg:max-h-[80vh] lg:overflow-y-auto lg:border-l lg:border-t-0">
            {m.tension && <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-200">⚠ {m.tension}</div>}
            <div><div className="mb-1 text-[11px] uppercase tracking-wider text-ink-400">Ordre du jour</div><ol className="list-decimal space-y-0.5 pl-4 text-sm text-ink-200">{m.agenda.map((a) => <li key={a}>{a}</li>)}</ol></div>
            <div><div className="mb-1 text-[11px] uppercase tracking-wider text-ink-400">Objectifs</div><ul className="space-y-0.5 text-sm text-ink-200">{m.objectives.map((a) => <li key={a}>◆ {a}</li>)}</ul></div>
            {m.docs.map((d) => <div key={d.title} className="rounded-lg border border-ink-700 bg-ink-850 p-3"><div className="mb-2 text-xs font-semibold text-white">📄 {d.title}</div><dl className="space-y-1 text-xs">{d.rows.map(([k, v], i) => <div key={i} className="grid grid-cols-[minmax(0,40%)_1fr] gap-2"><dt className="text-ink-400">{k}</dt><dd className={`${/^[-+−]?[0-9]/.test(v) ? "num " : ""}text-ink-100`}>{v}</dd></div>)}</dl>{d.note && <div className="mt-2 text-[11px] text-ink-300">{d.note}</div>}</div>)}
            <div className="text-[11px] text-ink-400">Score en cours — finance {m.score.finance} · risque {m.score.risque} · communication {m.score.communication} · éthique {m.score.ethique}</div>
          </aside>
        </div>
      </div>
    </div>
  );
}

/** Ligne de participants : avatar, nom, rôle */
export function People({ people, max = 4 }: { people?: { id: string; name: string; role: string; avatar: string }[]; max?: number }) {
  if (!people?.length) return null;
  return <div className="flex flex-wrap gap-1.5">{people.slice(0, max).map((p) => <span key={p.id} className="inline-flex items-center gap-1 rounded-full bg-ink-800 px-2 py-0.5 text-[11px] text-ink-200" title={p.role}><span>{p.avatar}</span><b className="font-medium text-white">{p.name}</b><span className="text-ink-400">· {p.role}</span></span>)}{people.length > max && <span className="text-[11px] text-ink-400">+{people.length - max}</span>}</div>;
}

export function useJoinMeeting() {
  const act = useAction();
  const setOpen = useGame((s) => s.setMeetingOpen);
  return async () => { const r = await act({ type: "join_meeting" }, { silent: true }); if (r.ok && r.data?.meetingId) setOpen(r.data.meetingId); };
}

export function MeetingLauncher() {
  const snap = useGame((s) => s.snap);
  const open = useGame((s) => s.meetingOpen);
  const setOpen = useGame((s) => s.setMeetingOpen);
  const join = useJoinMeeting();
  const active = snap?.activeMeetingId ?? null;
  const pm = snap?.pendingMeeting;
  const closed = useRef<string | null>(null);
  // Toute réunion qui démarre (comité, appel client…) s'ouvre automatiquement, sauf si le joueur vient de la fermer
  useEffect(() => { if (active && !open && closed.current !== active) setOpen(active); }, [active, open, setOpen]);
  return <>
    {pm && !active && !open && <div className="fixed bottom-20 left-1/2 z-40 w-[min(640px,94vw)] -translate-x-1/2 rounded-xl border border-gold/50 bg-ink-850 p-4 shadow-2xl fade-in">
      <div className="flex items-start gap-3"><span className="text-2xl">📣</span><div className="min-w-0 flex-1">
        <div className="text-[11px] uppercase tracking-wider text-gold">On vous attend — {pm.info?.location ?? "salle de réunion"}</div>
        <div className="font-semibold text-white">{pm.info?.title ?? pm.title}</div>
        {pm.info?.participants?.length ? <div className="mt-1.5"><div className="mb-1 text-[11px] text-ink-400">Participants</div><People people={pm.info.participants} /></div> : null}
        {pm.info?.objectives?.length ? <div className="mt-1.5 text-xs text-ink-300">Votre objectif : {pm.info.objectives.join(" · ")}</div> : null}
      </div><Button onClick={join}>Rejoindre la réunion</Button></div>
    </div>}
    {active && !open && <div className="fixed bottom-20 left-1/2 z-40 -translate-x-1/2"><Button onClick={() => setOpen(active)}>Retourner en réunion</Button></div>}
    {(open ?? null) && <MeetingRoom meetingId={open!} onClose={() => { closed.current = open; setOpen(null); }} />}
  </>;
}
