"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useView, useAction } from "@/lib/hooks";
import { useGame } from "@/lib/store";
import { Button, Badge, inputCls } from "./ui";
import { voiceSupport, voiceFor, speak, stopSpeaking, listen, type Listener } from "@/lib/voice";
import { matchChoice, parseFrenchNumber } from "@/lib/voice-match";

/** Temps de réponse à l'oral selon la difficulté (secondes) */
const LIMIT: Record<string, number> = { debutant: 30, normal: 20, expert: 15, simulation: 12 };
function usePref(key: string, def: boolean): [boolean, (v: boolean) => void] {
  const [v, setV] = useState(def);
  useEffect(() => { try { const x = localStorage.getItem(key); if (x !== null) setV(x === "1"); } catch { /* */ } }, [key]);
  return [v, (nv: boolean) => { setV(nv); try { localStorage.setItem(key, nv ? "1" : "0"); } catch { /* */ } }];
}

interface MView { id: string; title: string; type: string; location: string; done: boolean; outcome?: string; participants: { id: string; name: string; role: string; avatar: string; trust: number }[]; agenda: string[]; objectives: string[]; tension?: string; docs: { title: string; rows: [string, string][]; note?: string }[]; log: { who: string; text: string }[]; choices: { id: string; label: string; detail?: string }[]; numeric: { prompt: string; unit: string; hint?: string } | null; score: Record<string, number>; }

export function MeetingRoom({ meetingId, onClose }: { meetingId: string; onClose: () => void }) {
  const { data: m, reload } = useView<MView>("meeting", { id: meetingId }, 60000);
  const act = useAction();
  const [val, setVal] = useState("");
  const [busy, setBusy] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  useEffect(() => { logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" }); }, [m?.log.length]);

  /* ───── Interaction vocale ───── */
  const sup = useMemo(() => voiceSupport(), []);
  const difficulty = useGame((st) => st.snap?.difficulty ?? "normal");
  const limit = LIMIT[difficulty] ?? 20;
  const [ttsOn, setTtsOn] = usePref("fe_voice_tts", true);
  const [sttOn, setSttOn] = usePref("fe_voice_stt", true);
  const [phase, setPhase] = useState<"idle" | "speaking" | "listening">("idle");
  const [speaker, setSpeaker] = useState<string | null>(null);
  const [heard, setHeard] = useState("");
  const [hint, setHint] = useState("");
  const [left, setLeft] = useState(limit);
  const mRef = useRef<MView | null>(null); mRef.current = m;
  const spokenUpTo = useRef<number | null>(null);
  const runId = useRef(0);
  const listener = useRef<Listener | null>(null);
  const deadline = useRef(0);
  const busyRef = useRef(false);

  const send = useCallback(async (payload: Record<string, unknown>) => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true);
    listener.current?.stop(); listener.current = null; setPhase("idle"); setHeard("");
    await act({ type: "answer_meeting", meetingId, ...payload }, { silent: true });
    setVal(""); await reload(); busyRef.current = false; setBusy(false);
  }, [act, meetingId, reload]);

  const onFinal = useCallback((t: string) => {
    const cur = mRef.current;
    if (!cur || busyRef.current) return;
    setHeard(t);
    if (cur.numeric) {
      const v = parseFrenchNumber(t);
      if (v === null) { setHint("Je n'ai pas entendu de nombre. Donnez un chiffre, par exemple « quarante mille »."); return; }
      send({ value: v, spoken: t });
      return;
    }
    const r = matchChoice(t, cur.choices.map((c) => c.label));
    if (r.index < 0 || r.ambiguous) { setHint("Pas sûr d'avoir compris. Reformulez avec vos mots, ou dites « la première », « la deuxième »…"); return; }
    send({ choiceId: cur.choices[r.index].id, spoken: t });
  }, [send]);

  const startListening = useCallback(() => {
    const cur = mRef.current;
    if (!cur || cur.done || !(cur.choices.length || cur.numeric)) { setPhase("idle"); return; }
    setPhase("listening"); setHeard(""); setHint("");
    deadline.current = Date.now() + limit * 1000; setLeft(limit);
    listener.current?.stop();
    listener.current = listen({
      onInterim: (t) => setHeard(t),
      onFinal,
      onError: (code) => {
        setPhase("idle"); listener.current = null;
        setHint(code === "not-allowed" || code === "service-not-allowed" ? "Micro refusé : autorisez le micro pour ce site, ou répondez en cliquant." : code === "unsupported" ? "Votre navigateur ne sait pas écouter le micro (essayez Chrome, Edge ou Safari). Répondez en cliquant." : "Le micro ne répond pas. Répondez en cliquant ou réessayez.");
      },
    });
  }, [limit, onFinal]);

  // Les personnages prononcent leurs répliques, puis le micro s'ouvre
  useEffect(() => {
    if (!m) return;
    const my = ++runId.current;
    if (spokenUpTo.current === null) { let k = 0; m.log.forEach((l, i) => { if (l.who.includes("(vous)")) k = i + 1; }); spokenUpTo.current = k; }
    const lines = m.log.slice(spokenUpTo.current);
    spokenUpTo.current = m.log.length;
    (async () => {
      if (ttsOn && sup.tts) {
        setPhase("speaking");
        for (const l of lines) {
          if (runId.current !== my) return;
          if (l.who.includes("(vous)") || l.text.startsWith("(")) continue;
          const p = m.participants.find((x) => x.name === l.who);
          setSpeaker(p?.id ?? null);
          const prefix = l.who === "Correction" ? "Correction. " : l.who === "Bilan" ? "Bilan. " : "";
          await speak(prefix + l.text.replace(/^[✔✘]\s*/, ""), voiceFor(p?.id ?? "narrateur", p?.role));
        }
        setSpeaker(null);
      }
      if (runId.current !== my) return;
      if (sttOn && sup.stt && !m.done) startListening(); else setPhase("idle");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m?.log.length, m?.id]);

  // Compte à rebours : au bout du temps, silence = pas de réponse
  useEffect(() => {
    if (phase !== "listening") return;
    const id = setInterval(() => {
      const l = Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000));
      setLeft(l);
      if (l <= 0) { clearInterval(id); send({ timeout: true }); }
    }, 250);
    return () => clearInterval(id);
  }, [phase, send]);

  useEffect(() => () => { runId.current++; listener.current?.stop(); stopSpeaking(); }, []);
  const skipSpeech = () => { runId.current++; stopSpeaking(); setSpeaker(null); if (sttOn && sup.stt) startListening(); else setPhase("idle"); };
  const manual = (payload: Record<string, unknown>) => { runId.current++; stopSpeaking(); send(payload); };

  if (!m) return null;
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
              {m.participants.map((p) => <div key={p.id} className={`flex min-w-[170px] items-center gap-2 rounded-lg px-3 py-2 transition ${speaker === p.id ? "bg-yellow-500/15 ring-2 ring-gold" : "bg-ink-800"}`}><span className={`text-2xl ${speaker === p.id ? "animate-pulse" : ""}`}>{p.avatar}</span><div className="min-w-0"><div className="truncate text-sm font-medium">{p.name}{speaker === p.id && <span className="ml-1 text-[10px] text-gold">parle…</span>}</div><div className="truncate text-[11px] text-ink-400">{p.role} · confiance {Math.round(p.trust)}</div></div></div>)}
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
              <div className="mb-3 flex flex-wrap items-center gap-2 text-xs">
                <button data-testid="toggle-tts" onClick={() => { if (ttsOn) { runId.current++; stopSpeaking(); setSpeaker(null); } setTtsOn(!ttsOn); }} className={`rounded-full px-2.5 py-1 ${ttsOn ? "bg-gold/20 text-gold" : "bg-ink-800 text-ink-400"}`}>{ttsOn ? "🔊 Voix activées" : "🔇 Voix coupées"}</button>
                <button data-testid="toggle-stt" disabled={!sup.stt} onClick={() => { if (sttOn) { listener.current?.stop(); setPhase("idle"); } else if (!m.done) startListening(); setSttOn(!sttOn); }} className={`rounded-full px-2.5 py-1 disabled:opacity-40 ${sttOn && sup.stt ? "bg-gold/20 text-gold" : "bg-ink-800 text-ink-400"}`}>{sttOn && sup.stt ? `🎙️ Réponse à l'oral · ${limit} s` : "⌨️ Réponse au clic"}</button>
                {!sup.stt && <span className="text-ink-500">Votre navigateur ne permet pas de répondre à l'oral (essayez Chrome, Edge ou Safari).</span>}
              </div>
              {!m.done && phase === "speaking" && <div className="mb-3 flex items-center justify-between gap-2 rounded-lg bg-ink-850 px-3 py-2 text-sm"><span className="text-ink-200">🔊 {m.participants.find((p) => p.id === speaker)?.name ?? "On"} vous parle…</span><button onClick={skipSpeech} className="text-xs text-ink-400 underline">passer</button></div>}
              {!m.done && phase === "listening" && <div data-testid="voice-listening" className="mb-3 rounded-lg border border-gold/50 bg-yellow-500/5 p-3">
                <div className="flex items-center gap-3"><span className="relative flex h-9 w-9 items-center justify-center"><span className="absolute inset-0 animate-ping rounded-full bg-red-500/40" /><span className="relative rounded-full bg-red-600 p-2 text-sm">🎙️</span></span>
                  <div className="min-w-0 flex-1"><div className="text-sm font-semibold text-white">À vous — répondez à voix haute</div><div className="text-xs text-ink-400">{m.numeric ? `Donnez un nombre (${m.numeric.unit}).` : "Avec vos propres mots. Les pistes ci-dessous sont des exemples."}</div></div>
                  <span className={`num text-2xl font-bold ${left <= 5 ? "text-loss" : "text-gold"}`}>{left}s</span></div>
                <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-ink-700"><div className={`h-full transition-all ${left <= 5 ? "bg-loss" : "bg-gold"}`} style={{ width: `${(left / limit) * 100}%` }} /></div>
                <div className="mt-2 min-h-5 text-sm italic text-ink-100">{heard ? `« ${heard} »` : <span className="text-ink-500">J'écoute…</span>}</div>
                {hint && <div className="mt-1 text-xs text-amber-300">{hint}</div>}
              </div>}
              {!m.done && phase === "idle" && hint && <div className="mb-3 text-xs text-amber-300">{hint}</div>}
              {m.done ? <div className="text-sm"><Badge tone="gold">Réunion terminée</Badge> <span className="ml-2 text-ink-200">{m.outcome}</span></div>
                : m.numeric ? <form onSubmit={(e) => { e.preventDefault(); const v = Number(val.replace(/\s/g, "").replace(",", ".")); if (Number.isFinite(v)) manual({ value: v }); }} className="space-y-2">
                  <div className="text-sm text-ink-200">{m.numeric.prompt}</div>
                  {m.numeric.hint && <div className="text-xs text-ink-400">💡 {m.numeric.hint}</div>}
                  <div className="flex gap-2"><input value={val} onChange={(e) => setVal(e.target.value)} className={inputCls} placeholder={`Ou tapez la réponse (${m.numeric.unit})`} inputMode="decimal" /><Button type="submit" disabled={busy || !val}>Répondre</Button></div>
                </form>
                : <div>{phase === "listening" && <div className="mb-1.5 text-[11px] uppercase tracking-wider text-ink-500">Pistes de réponse (vous pouvez aussi cliquer)</div>}<div className="grid gap-2">{m.choices.map((c, i) => <button key={c.id} disabled={busy} onClick={() => manual({ choiceId: c.id })} className="rounded-lg border border-ink-600 bg-ink-850 px-3 py-2.5 text-left text-sm text-ink-100 transition hover:border-accent hover:bg-ink-800 disabled:opacity-50">{phase === "listening" && <span className="mr-2 text-ink-500">{i + 1}.</span>}{c.label}{c.detail && <span className="mt-0.5 block text-xs text-ink-400">{c.detail}</span>}</button>)}</div></div>}
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
