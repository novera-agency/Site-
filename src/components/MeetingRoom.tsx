"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useView, useAction } from "@/lib/hooks";
import { useGame } from "@/lib/store";
import { Button, Badge, inputCls } from "./ui";
import { voiceSupport, voiceFor, voiceCast, ringTone, speak, stopSpeaking, listen, type Listener } from "@/lib/voice";
import { matchChoice, parseFrenchNumber } from "@/lib/voice-match";
import { isTermQuestion } from "@/engine/glossary";

interface MView { id: string; title: string; type: string; location: string; done: boolean; outcome?: string; participants: { id: string; name: string; role: string; avatar: string; trust: number }[]; agenda: string[]; objectives: string[]; tension?: string; docs: { title: string; rows: [string, string][]; note?: string }[]; log: { who: string; text: string }[]; choices: { id: string; label: string; detail?: string }[]; numeric: { prompt: string; unit: string; hint?: string } | null; score: Record<string, number>; penalties: number; maxPenalties: number; failed: boolean; sales: { initial: number; current: number; faults: number; floor: number; obtained: number | null } | null; phone: boolean; pickup: boolean | null; }
type Mode = "oral" | "ecrit";

/** Temps de réponse à l'oral selon la difficulté (secondes) */
const LIMIT: Record<string, number> = { debutant: 30, normal: 20, expert: 15, simulation: 12 };

/** Documents et ordre du jour : utiles dans les deux modes (les chiffres demandés s'y trouvent) */
function Dossier({ m }: { m: MView }) {
  return <aside className="scroll-thin space-y-4 border-t border-ink-700 bg-ink-900/60 p-4 lg:max-h-[80vh] lg:overflow-y-auto lg:border-l lg:border-t-0">
    {m.tension && !(m.phone && m.pickup === false) && <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-2 text-xs text-amber-200">⚠ {m.tension}</div>}
    <div><div className="mb-1 text-[11px] uppercase tracking-wider text-ink-400">Ordre du jour</div><ol className="list-decimal space-y-0.5 pl-4 text-sm text-ink-200">{m.agenda.map((a) => <li key={a}>{a}</li>)}</ol></div>
    <div><div className="mb-1 text-[11px] uppercase tracking-wider text-ink-400">Objectifs</div><ul className="space-y-0.5 text-sm text-ink-200">{m.objectives.map((a) => <li key={a}>◆ {a}</li>)}</ul></div>
    {m.docs.map((d) => <div key={d.title} className="rounded-lg border border-ink-700 bg-ink-850 p-3"><div className="mb-2 text-xs font-semibold text-white">📄 {d.title}</div><dl className="space-y-1 text-xs">{d.rows.map(([k, v], i) => <div key={i} className="grid grid-cols-[minmax(0,40%)_1fr] gap-2"><dt className="text-ink-400">{k}</dt><dd className={`${/^[-+−]?[0-9]/.test(v) ? "num " : ""}text-ink-100`}>{v}</dd></div>)}</dl>{d.note && <div className="mt-2 text-[11px] text-ink-300">{d.note}</div>}</div>)}
  </aside>;
}

export function MeetingRoom({ meetingId, onClose }: { meetingId: string; onClose: () => void }) {
  const { data: m, reload } = useView<MView>("meeting", { id: meetingId }, 60000);
  const act = useAction();
  const [val, setVal] = useState("");
  const [busy, setBusy] = useState(false);
  const logRef = useRef<HTMLDivElement>(null);
  const sup = useMemo(() => voiceSupport(), []);
  const difficulty = useGame((st) => st.snap?.difficulty ?? "normal");
  const limit = LIMIT[difficulty] ?? 20;
  const [mode, setMode] = useState<Mode | null>(null);
  const [lastMode, setLastMode] = useState<Mode>("ecrit");
  const [micError, setMicError] = useState("");
  const [phase, setPhase] = useState<"idle" | "speaking" | "listening" | "thinking">("idle");
  const [speaker, setSpeaker] = useState<string | null>(null);
  const [heard, setHeard] = useState("");
  const [hint, setHint] = useState("");
  const [left, setLeft] = useState(limit);
  const [replay, setReplay] = useState(0);
  const mRef = useRef<MView | null>(null); mRef.current = m;
  const spokenUpTo = useRef<number | null>(null);
  const runId = useRef(0);
  const listener = useRef<Listener | null>(null);
  const deadline = useRef(0);
  const busyRef = useRef(false);

  const [ringing, setRinging] = useState<boolean | null>(null);
  const [callStart] = useState(() => Date.now());
  const [, tick] = useState(0);
  useEffect(() => { if (!m?.phone) return; const id = setInterval(() => tick((x) => x + 1), 1000); return () => clearInterval(id); }, [m?.phone]);
  useEffect(() => { if (!m || ringing !== null) return; if (m.phone && !m.done && m.log.length <= 1) { setRinging(true); ringTone(2).then(() => setRinging(false)); } else setRinging(false); }, [m, ringing]);
  useEffect(() => { try { const x = localStorage.getItem("fe_meeting_mode"); if (x === "oral" || x === "ecrit") setLastMode(x); } catch { /* */ } }, []);
  useEffect(() => { if (m?.done && mode === null) setMode("ecrit"); }, [m?.done, mode]);
  useEffect(() => { if (mode === "ecrit") logRef.current?.scrollTo({ top: logRef.current.scrollHeight, behavior: "smooth" }); }, [m?.log.length, mode]);
  const remember = (x: Mode) => { setLastMode(x); try { localStorage.setItem("fe_meeting_mode", x); } catch { /* */ } };

  const stopVoice = useCallback(() => { runId.current++; listener.current?.stop(); listener.current = null; stopSpeaking(); setSpeaker(null); setPhase("idle"); }, []);

  const send = useCallback(async (payload: Record<string, unknown>) => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true);
    listener.current?.stop(); listener.current = null; setPhase("thinking"); setHeard("");
    await act({ type: "answer_meeting", meetingId, ...payload }, { silent: true });
    setVal(""); await reload(); busyRef.current = false; setBusy(false);
  }, [act, meetingId, reload]);

  /** « Qu'est-ce que… ? » : la personne qui a employé le terme l'explique (pas de pénalité, le temps repart à zéro) */
  const askTerm = useCallback(async (question: string) => {
    if (busyRef.current) return;
    busyRef.current = true; setBusy(true);
    listener.current?.stop(); listener.current = null; setPhase("thinking"); setHeard(""); setHint("");
    await act({ type: "ask_term", meetingId, question }, { silent: true });
    await reload(); busyRef.current = false; setBusy(false);
  }, [act, meetingId, reload]);

  const onFinal = useCallback((t: string) => {
    const cur = mRef.current;
    if (!cur || busyRef.current) return;
    setHeard(t);
    if (isTermQuestion(t)) { askTerm(t); return; }
    if (cur.numeric) {
      const v = parseFrenchNumber(t);
      if (v === null) { send({ offtopic: true, spoken: t }); return; } // ni nombre ni question : hors sujet
      send({ value: v, spoken: t });
      return;
    }
    const r = matchChoice(t, cur.choices.map((c) => c.label));
    if (r.index < 0 || r.score < 0.3) { send({ offtopic: true, spoken: t }); return; } // trop éloigné de la question : pénalité
    if (r.ambiguous) { setHint("Votre réponse hésite entre deux idées. Précisez votre position."); return; } // proche mais ambigu : on demande de préciser, sans pénalité
    send({ choiceId: cur.choices[r.index].id, spoken: t });
  }, [send, askTerm]);

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
        listener.current = null; setPhase("idle");
        setMicError(code === "not-allowed" || code === "service-not-allowed" ? "L'accès au micro a été refusé. Autorisez-le pour ce site, ou passez en mode écrit." : "Le micro ne répond pas. Réessayez ou passez en mode écrit.");
      },
    });
  }, [limit, onFinal]);

  // Mode oral : les participants prononcent leurs répliques (voix distinctes), puis le micro s'ouvre
  useEffect(() => {
    if (!m || mode !== "oral") return;
    const my = ++runId.current;
    if (spokenUpTo.current === null) { let k = 0; m.log.forEach((l, i) => { if (l.who.includes("(vous)")) k = i + 1; }); spokenUpTo.current = k; }
    const lines = m.log.slice(spokenUpTo.current);
    spokenUpTo.current = m.log.length;
    (async () => {
      setPhase("speaking");
      for (const l of lines) {
        if (runId.current !== my) return;
        if (l.who.includes("(vous)") || l.text.startsWith("(")) continue;
        const p = m.participants.find((x) => x.name === l.who);
        setSpeaker(p?.id ?? "narrateur");
        const prefix = l.who === "Correction" ? "Correction. " : l.who === "Bilan" ? "Bilan de la réunion. " : "";
        const cast = voiceCast(m.participants);
        await speak(prefix + l.text.replace(/^[✔✘]\s*/, ""), p ? cast.get(p.id)!.profile : voiceFor("narrateur"));
      }
      if (runId.current !== my) return;
      setSpeaker(null);
      if (!m.done) startListening(); else setPhase("idle");
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [m?.log.length, m?.id, mode, replay]);

  // Compte à rebours : au bout du temps, le silence compte comme une absence de réponse
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

  const chooseOral = async () => {
    setMicError("");
    if (!sup.stt) { setMicError("Votre navigateur ne sait pas écouter le micro. Utilisez Chrome, Edge ou Safari, ou choisissez le mode écrit."); return; }
    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new Error("indisponible");
      const st = await navigator.mediaDevices.getUserMedia({ audio: true });
      st.getTracks().forEach((t) => t.stop());
      spokenUpTo.current = null; // la question en attente est (re)prononcée
      remember("oral"); setMode("oral");
    } catch { setMicError("L'accès au micro a été refusé ou n'est pas disponible. Autorisez le micro dans votre navigateur (icône à gauche de l'adresse), puis réessayez — ou choisissez le mode écrit."); }
  };
  const toWritten = () => { stopVoice(); remember("ecrit"); setMode("ecrit"); };
  const repeat = () => { const cur = mRef.current; if (!cur) return; listener.current?.stop(); stopSpeaking(); let k = 0; cur.log.forEach((l, i) => { if (l.who.includes("(vous)")) k = i + 1; }); spokenUpTo.current = k; setReplay((r) => r + 1); };

  if (!m) return null;
  const quit = m.done ? <Button onClick={() => { stopVoice(); onClose(); }}>Quitter la salle</Button> : <Button variant="outline" size="sm" onClick={async () => { stopVoice(); await act({ type: "leave_meeting" }); onClose(); }}>Quitter (mal perçu)</Button>;
  const speakingP = m.participants.find((p) => p.id === speaker);
  const cast = voiceCast(m.participants);
  const elapsed = Math.floor((Date.now() - callStart) / 1000);
  const callee = m.participants[0];
  const salesBar = m.sales && <div data-testid="sales-objective" className="w-full max-w-xl rounded-lg border border-ink-700 bg-ink-900/80 p-3 text-left">
    <div className="flex items-baseline justify-between gap-2 text-xs"><span className="uppercase tracking-wider text-ink-400">Objectif de vente</span><span className="num text-sm font-semibold text-white">{m.sales.obtained !== null ? `Obtenu : ${m.sales.obtained.toLocaleString("fr-FR")} €` : `${m.sales.current.toLocaleString("fr-FR")} €`} <span className="text-ink-500">/ {m.sales.initial.toLocaleString("fr-FR")} €</span></span></div>
    <div className="relative mt-1.5 h-2 overflow-hidden rounded-full bg-ink-700"><div className={`h-full transition-all duration-700 ${m.sales.current / m.sales.initial < 0.5 ? "bg-loss" : m.sales.current / m.sales.initial < 0.8 ? "bg-amber-400" : "bg-gain"}`} style={{ width: `${(m.sales.current / m.sales.initial) * 100}%` }} /><div className="absolute inset-y-0 w-0.5 bg-white/60" style={{ left: `${m.sales.floor * 100}%` }} title="Sous ce seuil, le client raccroche" /></div>
    <div className="mt-1 text-[11px] text-ink-400">{m.sales.faults} faute{m.sales.faults > 1 ? "s" : ""} · chaque maladresse fait baisser l'objectif · sous le trait blanc ({Math.round(m.sales.floor * 100)} %), le client raccroche</div>
  </div>;
  const warn = !m.done && m.penalties > 0 && <div data-testid="penalties" className={`rounded-full px-3 py-1 text-xs ${m.penalties >= m.maxPenalties - 1 ? "bg-red-500/20 text-red-200" : "bg-amber-500/15 text-amber-200"}`}>⚠ Avertissements : {m.penalties}/{m.maxPenalties} — {m.maxPenalties - m.penalties === 1 ? "encore un et la réunion est ratée" : "réponses hors sujet ou silences"}</div>;

  return (
    <div className="fixed inset-0 z-50 overflow-y-auto overscroll-contain bg-black/80 p-0 backdrop-blur-sm md:p-6" data-testid="meeting-room">
      <div className="panel mx-auto flex min-h-full w-full max-w-6xl flex-col md:min-h-0 md:rounded-xl">
        <header className="flex flex-wrap items-center justify-between gap-2 border-b border-ink-700 bg-ink-900 px-4 py-3">
          <div><div className="text-[11px] font-semibold uppercase tracking-[0.2em] text-gold">{m.location} · {m.type}{mode && <span className="ml-2 rounded bg-ink-700 px-1.5 py-0.5 text-[10px] tracking-normal text-ink-200">{mode === "oral" ? "🎙️ mode oral" : "💬 mode écrit"}</span>}</div><h2 className="text-lg font-semibold text-white">{m.phone && callee ? <>📞 {m.done ? "Appel terminé avec" : m.pickup === false ? "Messagerie de" : "En ligne avec"} {callee.name} {!m.done && <span className="num ml-2 text-sm font-normal text-ink-400">{String(Math.floor(elapsed / 60)).padStart(2, "0")}:{String(elapsed % 60).padStart(2, "0")}</span>}</> : m.title}</h2></div>
          <div className="flex items-center gap-2">{quit}</div>
        </header>

        {ringing ? (
          <div className="flex flex-1 flex-col items-center justify-center gap-4 p-10 text-center" data-testid="ringing">
            <span className="text-6xl animate-pulse">{callee?.avatar ?? "📞"}</span>
            <div className="text-xl font-semibold text-white">Appel de {callee?.name}…</div>
            <div className="text-sm text-ink-400">Ça sonne</div>
          </div>
        ) : mode === null ? (
          /* ───── Choix du mode à l'entrée ───── */
          <div className="flex flex-1 flex-col items-center justify-center gap-6 p-6 text-center" data-testid="mode-chooser">
            <div><div className="text-sm text-ink-400">Autour de la table</div><div className="mt-3 flex flex-wrap justify-center gap-3">{m.participants.map((p) => <div key={p.id} className="flex items-center gap-2 rounded-lg bg-ink-800 px-3 py-2 text-left"><span className="text-2xl">{p.avatar}</span><div><div className="text-sm font-medium text-white">{p.name}</div><div className="text-[11px] text-ink-400">{p.role}</div></div></div>)}</div></div>
            {m.phone && <div className="text-sm text-ink-200">{m.pickup ? `📞 ${callee?.name} décroche.` : `📞 ${callee?.name} ne répond pas : vous tombez sur la messagerie.`}</div>}
            {salesBar && m.pickup && <div className="flex w-full justify-center">{salesBar}</div>}
            <div className="text-lg font-semibold text-white">{m.phone ? "Comment voulez-vous mener cet appel ?" : "Comment voulez-vous mener cette réunion ?"}</div>
            <div className="grid w-full max-w-2xl gap-3 md:grid-cols-2">
              <button data-testid="mode-oral" onClick={chooseOral} className={`rounded-xl border p-5 text-left transition hover:border-gold ${lastMode === "oral" ? "border-gold/70 bg-yellow-500/10" : "border-ink-600 bg-ink-850"}`}>
                <div className="text-3xl">🎙️</div><div className="mt-2 text-lg font-semibold text-white">Mode oral</div>
                <p className="mt-1 text-sm text-ink-300">Les participants vous parlent, chacun avec sa voix. Vous répondez à voix haute, en {limit} secondes maximum. Aucun texte à l'écran : écoutez et répondez.</p>
                <p className="mt-2 text-xs text-ink-500">Le navigateur va demander l'accès au micro.</p>
              </button>
              <button data-testid="mode-ecrit" onClick={() => { remember("ecrit"); setMode("ecrit"); }} className={`rounded-xl border p-5 text-left transition hover:border-gold ${lastMode === "ecrit" ? "border-gold/70 bg-yellow-500/10" : "border-ink-600 bg-ink-850"}`}>
                <div className="text-3xl">💬</div><div className="mt-2 text-lg font-semibold text-white">Mode écrit</div>
                <p className="mt-1 text-sm text-ink-300">Vous lisez la conversation, avec qui a dit quoi, et vous choisissez vos réponses. Pas de limite de temps.</p>
              </button>
            </div>
            {micError && <div className="max-w-2xl rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-sm text-amber-200" data-testid="mic-error">{micError}</div>}
          </div>
        ) : (
          <div className="grid min-h-0 flex-1 grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px]">
            {mode === "oral" ? (
              /* ───── Mode oral : pas d'historique, on écoute et on répond ───── */
              <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 p-6" data-testid="oral-stage">
                {warn}
                {salesBar}
                <div className="flex flex-wrap justify-center gap-4">{m.participants.map((p) => <div key={p.id} className={`flex w-36 flex-col items-center rounded-xl px-3 py-4 text-center transition ${speaker === p.id ? "bg-yellow-500/15 ring-2 ring-gold" : "bg-ink-800/80"}`}>
                  <span className={`text-4xl ${speaker === p.id ? "animate-pulse" : ""}`}>{p.avatar}</span><div className="mt-2 text-sm font-medium text-white">{p.name}</div><div className="text-[11px] text-ink-400">{p.role}</div><div className="mt-1 text-[10px] text-ink-500" data-testid="voice-label">🔊 {cast.get(p.id)?.label}</div>{speaker === p.id && <div className="mt-1 text-[11px] font-semibold text-gold">parle…</div>}</div>)}</div>
                <div className="w-full max-w-xl text-center">
                  {m.done ? <div><Badge tone={m.failed ? "loss" : "gold"}>{m.failed ? "Réunion ratée" : "Réunion terminée"}</Badge><p className="mt-3 text-sm text-ink-200">{m.outcome}</p><button onClick={() => setMode("ecrit")} className="mt-4 rounded-full bg-ink-800 px-4 py-2 text-sm text-ink-200 hover:bg-ink-700" data-testid="show-transcript">📄 Voir le compte rendu écrit</button></div>
                    : phase === "speaking" ? <div className="text-ink-200"><div className="text-lg">🔊 {speakingP ? `${speakingP.name} vous parle…` : "Écoutez…"}</div><button onClick={() => { runId.current++; stopSpeaking(); setSpeaker(null); startListening(); }} className="mt-2 text-xs text-ink-400 underline">passer</button></div>
                    : phase === "listening" ? <div data-testid="voice-listening" className="rounded-xl border border-gold/50 bg-yellow-500/5 p-5">
                        <div className="mb-2 text-[11px] text-ink-500">Un mot vous échappe ? Demandez : « Qu'est-ce que… ? »</div>
                        <div className="flex items-center justify-center gap-4"><span className="relative flex h-14 w-14 items-center justify-center"><span className="absolute inset-0 animate-ping rounded-full bg-red-500/40" /><span className="relative rounded-full bg-red-600 p-3 text-xl">🎙️</span></span><span className={`num text-4xl font-bold ${left <= 5 ? "text-loss" : "text-gold"}`}>{left}s</span></div>
                        <div className="mt-3 text-base font-semibold text-white">À vous — répondez à voix haute</div>
                        <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-ink-700"><div className={`h-full transition-all ${left <= 5 ? "bg-loss" : "bg-gold"}`} style={{ width: `${(left / limit) * 100}%` }} /></div>
                        <div className="mt-3 min-h-6 text-sm italic text-ink-200">{heard ? `« ${heard} »` : <span className="text-ink-500">J'écoute…</span>}</div>
                        {hint && <div className="mt-1 text-sm text-amber-300">{hint}</div>}
                      </div>
                    : phase === "thinking" ? <div className="text-ink-400">…</div>
                    : <div className="text-sm text-ink-400">{micError || "Préparation…"}</div>}
                </div>
                {micError && phase !== "listening" && !m.done && <div className="text-sm text-amber-200" data-testid="mic-error">{micError}</div>}
                {!m.done && <div className="flex flex-wrap justify-center gap-3 text-sm"><button onClick={repeat} className="rounded-full bg-ink-800 px-4 py-2 text-ink-200 hover:bg-ink-700" data-testid="repeat">🔁 Faire répéter</button><button onClick={toWritten} className="rounded-full bg-ink-800 px-4 py-2 text-ink-200 hover:bg-ink-700" data-testid="switch-ecrit">💬 Passer en mode écrit</button></div>}
              </div>
            ) : (
              /* ───── Mode écrit : historique complet de la conversation ───── */
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
                  {warn && <div className="mb-3">{warn}</div>}
                  {salesBar && <div className="mb-3">{salesBar}</div>}
                  {!m.done && <form data-testid="ask-term" onSubmit={(e) => { e.preventDefault(); const q = (e.currentTarget.elements.namedItem("q") as HTMLInputElement); if (q.value.trim().length > 1) { askTerm(/\?$/.test(q.value) || isTermQuestion(q.value) ? q.value : `Qu'est-ce que ${q.value} ?`); q.value = ""; } }} className="mb-3 flex gap-2"><input name="q" className={inputCls + " py-1.5 text-xs"} placeholder="Un terme vous échappe ? Demandez : « Qu'est-ce que la duration ? »" /><Button size="sm" variant="ghost" type="submit" disabled={busy}>❓ Demander</Button></form>}
                  {m.done ? <div className="text-sm"><Badge tone={m.failed ? "loss" : "gold"}>{m.failed ? "Réunion ratée" : "Réunion terminée"}</Badge> <span className="ml-2 text-ink-200">{m.outcome}</span></div>
                    : m.numeric ? <form onSubmit={(e) => { e.preventDefault(); const v = Number(val.replace(/\s/g, "").replace(",", ".")); if (Number.isFinite(v)) send({ value: v }); }} className="space-y-2">
                      <div className="text-sm text-ink-200">{m.numeric.prompt}</div>
                      {m.numeric.hint && <div className="text-xs text-ink-400">💡 {m.numeric.hint}</div>}
                      <div className="flex gap-2"><input autoFocus value={val} onChange={(e) => setVal(e.target.value)} className={inputCls} placeholder={`Votre réponse (${m.numeric.unit})`} inputMode="decimal" /><Button type="submit" disabled={busy || !val}>Répondre</Button></div>
                    </form>
                    : <div className="grid gap-2">{m.choices.map((c) => <button key={c.id} disabled={busy} onClick={() => send({ choiceId: c.id })} className="rounded-lg border border-ink-600 bg-ink-850 px-3 py-2.5 text-left text-sm text-ink-100 transition hover:border-accent hover:bg-ink-800 disabled:opacity-50">{c.label}{c.detail && <span className="mt-0.5 block text-xs text-ink-400">{c.detail}</span>}</button>)}</div>}
                  {!m.done && sup.stt && <button onClick={chooseOral} className="mt-3 text-xs text-ink-400 underline" data-testid="switch-oral">🎙️ Passer en mode oral</button>}
                  {micError && <div className="mt-2 text-xs text-amber-300">{micError}</div>}
                </div>
              </div>
            )}
            <Dossier m={m} />
          </div>
        )}
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
