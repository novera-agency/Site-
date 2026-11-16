"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useView, useAction } from "@/lib/hooks";
import { useGame } from "@/lib/store";
import { Card, PageTitle, Loading, Badge, Bar, Button, Field, inputCls } from "@/components/ui";
import { RecapCard } from "@/components/RecapCard";

const fr = (n: number) => n.toLocaleString("fr-FR");
const hm = (m: number) => `${Math.floor(m / 60)} h ${String(m % 60).padStart(2, "0")}`;
const opts = (from: number, to: number, step = 15) => Array.from({ length: Math.floor((to - from) / step) + 1 }, (_, i) => from + i * step);
const TONE: Record<string, "gain" | "info" | "warn" | "loss"> = { excellent: "gain", correct: "info", court: "warn", insuffisant: "loss" };

/** Frise de la journée : nuit, matin, travail, soir, avec un repère « maintenant » */
function Timeline({ d }: { d: any }) {
  const pc = (m: number) => `${(m / 1440) * 100}%`;
  const seg = (a: number, b: number, cls: string, label: string) => <div key={label} className={`absolute inset-y-0 ${cls}`} style={{ left: pc(a), width: pc(b - a) }} title={label} />;
  return <div data-testid="timeline">
    <div className="relative h-8 overflow-hidden rounded-md border border-ink-700 bg-ink-900" role="img" aria-label={`Journée : réveil ${hm(d.plan.wake)}, travail de ${hm(d.plan.start)} à ${hm(d.window.end)}, maintenant ${hm(d.now)}`}>
      {seg(0, d.plan.wake, "bg-indigo-900/70", "Nuit")}
      {seg(d.plan.wake, d.plan.start, "bg-sky-800/60", "Matin")}
      {d.workDay ? seg(d.plan.start, d.window.end, "bg-amber-600/60", "Travail") : seg(d.plan.start, d.window.end, "bg-emerald-800/40", "Journée libre")}
      {seg(d.window.end, 1440, "bg-emerald-800/50", "Soirée")}
      <div className="absolute inset-y-0 w-0.5 bg-white" style={{ left: pc(d.now) }} />
    </div>
    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-ink-300">
      <span><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-indigo-900" />Nuit</span>
      <span><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-sky-800" />Matin</span>
      <span><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-amber-600" />{d.workDay ? "Travail" : "Journée libre"}</span>
      <span><span className="mr-1 inline-block h-2 w-2 rounded-sm bg-emerald-800" />Soirée</span>
      <span className="ml-auto">Il est <b className="num text-white">{hm(d.now)}</b></span>
    </div>
  </div>;
}


const SUBJECTS: [string, string][] = [["auto", "Ma compétence la plus faible (automatique)"], ["erreurs", "Mes erreurs passées (révision)"], ["marches", "Marchés et produits financiers"], ["analyse", "Analyse financière"], ["maths", "Mathématiques financières"], ["macro", "Macroéconomie"], ["risque", "Risques, assurance et conformité"]];
const BR: Record<string, string> = { marches: "marchés", analyse: "analyse", maths: "maths financières", macro: "macroéconomie", risque: "risques", client: "relation client", management: "management", entrepreneuriat: "entrepreneuriat" };

/** Séance de formation : menée en réunion par le responsable ; ici, l'état, la reprise et le bilan avec les corrections */
function TrainingStatus({ t, act }: { t: any; act: (a: Record<string, unknown>, o?: { silent?: boolean }) => Promise<any> }) {
  const setOpen = useGame((s) => s.setMeetingOpen);
  const activeId = useGame((s) => s.snap?.activeMeetingId ?? null);
  const missed = t.items.filter((x: any) => x.result && !x.result.ok);
  if (t.done) {
    const sc = Math.round((t.done.correct / t.done.total) * 100);
    return <Card title="📚 Bilan de la séance de formation" className="mb-4">
      <div data-testid="tr-summary" className="space-y-3 text-sm">
        <div className="flex flex-wrap items-center gap-3"><span className="num text-2xl font-semibold text-gold">{t.done.correct} / {t.done.total}</span><Badge tone={sc >= 80 ? "gain" : sc >= 50 ? "warn" : "loss"}>{sc} %</Badge>
          {t.done.bonusXp > 0 ? <span className="text-gain">Séance réussie : +{t.done.bonusXp} XP en {BR[t.subject] ?? t.subject} et un responsable plus confiant.</span> : <span className="text-ink-300">Sous 80 % : pas de bonus, mais vos erreurs sont dans le carnet ci-dessous.</span>}</div>
        {missed.length > 0 && <div><div className="mb-1 text-xs font-semibold uppercase tracking-wider text-ink-400">À retenir (vos erreurs)</div>
          <ul className="space-y-2">{missed.map((x: any) => <li key={x.i} className="rounded-md border border-ink-700 bg-ink-900 p-2 text-xs"><div className="font-medium text-ink-100">{x.prompt}</div><div className="mt-1 text-ink-300">{x.result.explain}</div></li>)}</ul></div>}
        <p className="text-xs text-ink-400">Pour aller plus loin : le <Link href="/play/formation" className="underline">centre de formation</Link> et le <Link href="/play/dictionnaire" className="underline">dictionnaire</Link>.</p>
        <Button data-testid="tr-close" onClick={() => act({ type: "training_close" }, { silent: true })}>Fermer le bilan</Button>
      </div>
    </Card>;
  }
  const inMeeting = t.meetingActive && activeId;
  return <Card title={`📚 Séance de formation en cours — ${t.revision ? "révision de vos erreurs" : BR[t.subject] ?? t.subject}`} className="mb-4" right={<span className="text-xs text-ink-400">{t.answered} / {t.count} questions</span>}>
    <div data-testid="training" className="space-y-3 text-sm">
      <Bar value={t.answered} max={t.count} tone="gold" />
      <p className="text-ink-200">Votre responsable pose lui-même les questions en réunion (à l'oral ou à l'écrit) et corrige chaque réponse.</p>
      {inMeeting ? <Button data-testid="tr-open" onClick={() => setOpen(activeId)}>Retourner en réunion</Button>
        : <div className="flex flex-wrap gap-2"><Button data-testid="tr-resume" onClick={() => act({ type: "training_resume" }, { silent: true })}>Reprendre avec mon responsable</Button><Button variant="ghost" onClick={() => act({ type: "training_close" }, { silent: true })}>Abandonner (les points déjà gagnés sont conservés)</Button></div>}
    </div>
  </Card>;
}


/** Erreurs passées : fiche de révision intégrée (formules, calcul, exercice) et possibilité de refaire la question */
function RevisionPanel({ rv, act }: { rv: any; act: (a: Record<string, unknown>, o?: { silent?: boolean }) => Promise<any> }) {
  const [open, setOpen] = useState<string | null>(null);
  const [res, setRes] = useState<Record<string, { choice: number; correct: boolean; answer: number; explain: string; fixed: boolean }>>({});
  const [filter, setFilter] = useState<"todo" | "all">("todo");
  const shown = rv.entries.filter((e: any) => filter === "all" || !e.fixed);
  const retry = async (key: string, choice: number) => { const r = await act({ type: "review_answer", key, choice }, { silent: true }); if (r.ok && r.data) setRes((x) => ({ ...x, [key]: { choice, ...r.data } })); };
  return <div className="space-y-3" data-testid="revision">
    <div className="flex flex-wrap items-center justify-between gap-2"><div className="text-xs text-ink-300"><b className="num text-white" data-testid="rv-count">{rv.unresolved}</b> erreur{rv.unresolved > 1 ? "s" : ""} à revoir · {rv.total} au total</div>
      <div className="flex gap-1 text-[11px]">{([["todo", "À revoir"], ["all", "Toutes"]] as const).map(([k, l]) => <button key={k} aria-pressed={filter === k} onClick={() => setFilter(k)} className={`rounded px-2 py-1 ${filter === k ? "bg-gold text-black" : "bg-ink-800 text-ink-300"}`}>{l}</button>)}</div></div>
    {shown.length === 0 && <p className="text-xs text-ink-400">{rv.total === 0 ? "Les questions que vous ratez en séance de formation ou au point culture s'ajoutent ici, avec leur fiche de révision." : "Aucune erreur à revoir : bravo !"}</p>}
    <ul className="space-y-2">{shown.map((e: any) => {
      const r = res[e.key]; const isOpen = open === e.key; const fixed = e.fixed || r?.fixed;
      return <li key={e.key} className="rounded-lg border border-ink-700 bg-ink-900 p-3" data-testid="rv-entry">
        <div className="flex flex-wrap items-center gap-2"><Badge tone={fixed ? "gain" : e.count > 2 ? "loss" : "warn"}>{fixed ? "Maîtrisée" : e.count > 1 ? `Ratée ${e.count} fois` : "À revoir"}</Badge><Badge tone="neutral">{e.kind}</Badge><span className="text-[11px] text-ink-400">{e.when}</span></div>
        <div className="mt-1 text-sm font-medium text-ink-100">{e.title}</div>
        <button data-testid="rv-toggle" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : e.key)} className="mt-2 text-xs text-gold underline">{isOpen ? "Masquer la fiche de révision" : "📒 Voir la fiche de révision"}</button>
        {isOpen && <div data-testid="rv-fiche"><RecapCard recap={e.recap} />
          {e.retry && <div className="mx-auto mt-3 w-full max-w-2xl rounded-lg border border-ink-700 bg-ink-950 p-3" data-testid="rv-retry">
            <div className="text-xs font-semibold uppercase tracking-wider text-gold">Refaire la question, sans la correction</div>
            <p className="mt-1 text-sm text-white">{e.retry.prompt}</p>
            <div className="mt-2 space-y-1.5" role="group" aria-label="Réponses possibles">{e.retry.options.map((o: string, i: number) => {
              const st = !r ? "border-ink-600 bg-ink-900 hover:border-gold" : i === r.answer ? "border-green-500 bg-green-500/10" : i === r.choice ? "border-red-500 bg-red-500/10" : "border-ink-700 bg-ink-900 opacity-60";
              return <button key={i} data-testid={`rv-opt-${i}`} disabled={!!r} onClick={() => retry(e.key, i)} className={`block w-full rounded-md border px-3 py-2 text-left text-sm ${st}`}><span className="mr-2 text-ink-400">{String.fromCharCode(65 + i)}.</span>{o}{r && i === r.answer && <span className="ml-2 text-gain">✔</span>}{r && i === r.choice && i !== r.answer && <span className="ml-2 text-loss">✘</span>}</button>;
            })}</div>
            {r && <div data-testid="rv-result" role="status" className={`mt-2 rounded-md border p-2 text-xs ${r.correct ? "border-green-500/40 text-gain" : "border-red-500/40 text-loss"}`}><b>{r.correct ? (r.fixed ? "✔ Bonne réponse : question maîtrisée !" : "✔ Bonne réponse.") : "✘ Pas encore."}</b><span className="ml-1 text-ink-200">{r.explain}</span>{!r.correct && <button className="ml-2 underline" onClick={() => setRes((x) => { const c = { ...x }; delete c[e.key]; return c; })}>Réessayer</button>}</div>}
          </div>}
        </div>}
      </li>;
    })}</ul>
  </div>;
}

export default function Planning() {
  const { data: d } = useView<any>("planning", {}, 2000);
  const act = useAction();
  const [hours, setHours] = useState(1);
  const [focus, setFocus] = useState("avance");
  const [subject, setSubject] = useState("auto");
  // Horaires choisis en attente d'enregistrement : les changements rapides s'enchaînent sans se piétiner
  const [local, setLocal] = useState<{ start: number; end: number; wake: number } | null>(null);
  const chain = useRef<Promise<unknown>>(Promise.resolve());
  // Dès que les données du serveur reflètent le choix, on abandonne la valeur locale
  useEffect(() => { if (local && d?.plan && local.start === d.plan.start && local.end === d.plan.end && local.wake === d.plan.wake) setLocal(null); }, [local, d]);
  if (!d) return <Loading />;
  const sub = "Choisissez vos horaires de travail et votre heure de réveil, dormez, et faites des heures supplémentaires pour prendre de l'avance.";
  if (!d.enabled) return <><PageTitle env="Bureau" title="Planning et sommeil" subtitle={sub} /><Card><p className="text-sm text-ink-300">Le planning est disponible en mode carrière.</p></Card></>;
  const plan = local ?? d.plan;
  const save = (patch: Partial<{ start: number; end: number; wake: number }>) => {
    const next = { ...plan, ...patch };
    setLocal(next);
    // Les enregistrements s'enchaînent dans l'ordre ; en cas de refus on revient à la valeur du serveur
    chain.current = chain.current.then(() => act({ type: "set_plan", ...next })).then((r) => { if (!(r as { ok: boolean }).ok) setLocal(null); });
  };
  const dh = Math.round(d.delta * 10) / 10;
  const effect = Math.abs(dh) < 0.05 ? "Journée standard : aucun effet particulier." : dh > 0
    ? `Journée plus longue que la référence (+${fr(dh)} h) : stress, fatigue et moral en pâtissent chaque jour, mais votre responsable apprécie votre présence.`
    : `Journée plus courte que la référence (${fr(dh)} h) : vous êtes plus serein, mais votre responsable s'inquiète de votre présence.`;
  const maxH = Math.max(1, d.overtime.maxHours);
  const blockedTraining = d.trainedToday && !(d.training && !d.training.done);
  return <>
    <PageTitle env="Bureau" title="Planning et sommeil" subtitle={sub} />
    {d.training && <TrainingStatus key={d.training.id + (d.training.done ? "d" : "")} t={d.training} act={act} />}
    <Card className="mb-4"><Timeline d={d} /></Card>
    <div className="grid gap-4 lg:grid-cols-3">
      <Card title="🕘 Horaires de travail">
        <div className="space-y-3">
          <Field label="Heure de réveil"><select data-testid="plan-wake" aria-label="Heure de réveil" className={inputCls} value={plan.wake} onChange={(e) => save({ wake: Number(e.target.value) })}>{opts(270, 600).map((m) => <option key={m} value={m}>{hm(m)}</option>)}</select></Field>
          <Field label="Arrivée au bureau"><select data-testid="plan-start" aria-label="Arrivée au bureau" className={inputCls} value={plan.start} onChange={(e) => save({ start: Number(e.target.value) })}>{opts(420, 600).map((m) => <option key={m} value={m}>{hm(m)}</option>)}</select></Field>
          <Field label="Départ du bureau"><select data-testid="plan-end" aria-label="Départ du bureau" className={inputCls} value={plan.end} onChange={(e) => save({ end: Number(e.target.value) })}>{opts(930, 1260).map((m) => <option key={m} value={m}>{hm(m)}</option>)}</select></Field>
          <div className="rounded-md bg-ink-900 p-2 text-xs text-ink-200" data-testid="plan-summary">Journée de <b className="num text-white">{fr(Math.round(d.net * 10) / 10)} h</b> de travail (déjeuner d'1 h déduit) · référence {fr(d.standard)} h.<br />{effect}</div>
          {d.window.early > 0 && <div className="rounded-md border border-gain/40 bg-green-500/5 p-2 text-xs text-gain">Aujourd'hui vous partez {d.window.early} h plus tôt : fin du travail à {hm(d.window.end)}.</div>}
          <p className="text-[11px] text-ink-400">Les réunions et appels sont replacés dans vos horaires. Le réveil doit précéder l'arrivée d'au moins 45 minutes. Moins de 6 h 30 de sommeil par nuit fatigue.</p>
        </div>
      </Card>

      <Card title="😴 Sommeil">
        <div className="space-y-3 text-sm">
          <p className="text-ink-200">Réveil prévu à <b className="num text-white">{hm(d.plan.wake)}</b>. Dormir fait avancer l'horloge jusqu'au réveil : 7 à 9 h de sommeil restaurent la forme, le moral et réduisent le stress.</p>
          {d.sleep.ok
            ? <div data-testid="sleep-info" className="rounded-md bg-ink-900 p-2 text-xs">Si vous vous couchez maintenant : <b className="num text-white">{fr(d.sleep.hours)} h</b> de sommeil <Badge tone={TONE[d.sleep.label]}>{d.sleep.label}</Badge></div>
            : <div data-testid="sleep-block" className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-100">{d.sleep.error}</div>}
          <Button data-testid="sleep-btn" disabled={!d.sleep.ok} onClick={() => act({ type: "sleep" })}>😴 Aller dormir jusqu'à {hm(d.plan.wake)}</Button>
          {d.lastSleep && <p className="text-xs text-ink-400">Dernière nuit : {fr(d.lastSleep.hours)} h ({d.lastSleep.label}), il y a {d.lastSleep.ago} h.</p>}
          <p className="text-[11px] text-ink-400">Si vous ne vous couchez pas vous-même, le jeu simule une nuit à votre heure de réveil (sans bonus). La touche « Jusqu'à demain matin » du temps (⏭) vous met aussi au lit le soir.</p>
        </div>
      </Card>

      <Card title="⏱️ Heures supplémentaires" right={<span className="text-xs text-ink-400">cette semaine : {d.overtime.weekHours} h</span>}>
        <div className="space-y-3 text-sm">
          {d.workDay ? <p className="text-ink-200">Possibles après votre départ ({hm(d.window.end)}). Elles coûtent de l'énergie, mais vous font avancer.</p> : <p className="text-ink-200">Jour de repos : possibles à partir de 8 h, avec une fatigue accrue.</p>}
          {d.overtime.maxHours === 0 && <div data-testid="ot-block" className="rounded-md border border-amber-500/40 bg-amber-500/10 p-2 text-xs text-amber-100">{d.overtime.error}</div>}
          <Field label="Durée"><select data-testid="ot-hours" aria-label="Heures supplémentaires" className={inputCls} value={Math.min(hours, maxH)} onChange={(e) => setHours(Number(e.target.value))}>{opts(1, maxH, 1).map((h) => <option key={h} value={h}>{h} h</option>)}</select></Field>
          <fieldset className="space-y-1.5"><legend className="mb-1 text-[11px] font-medium uppercase tracking-wider text-ink-400">Objectif</legend>
            {d.overtime.focus.map((f: any) => <label key={f.id} className="flex cursor-pointer items-start gap-2 rounded-md border border-ink-700 bg-ink-900 p-2"><input type="radio" name="focus" className="mt-1" checked={focus === f.id} onChange={() => setFocus(f.id)} data-testid={`ot-focus-${f.id}`} /><span><span className="block text-xs font-medium text-ink-100">{f.label}</span><span className="block text-[11px] text-ink-400">{f.desc}</span></span></label>)}
          </fieldset>
          {focus === "formation" && d.revision.unresolved > 0 && <p className="text-[11px] text-gold" data-testid="ot-errors-hint">Vous avez {d.revision.unresolved} erreur{d.revision.unresolved > 1 ? "s" : ""} passée{d.revision.unresolved > 1 ? "s" : ""} à revoir : choisissez « Mes erreurs passées » ou ouvrez les fiches de révision plus bas.</p>}
          {focus === "formation" && <Field label="Matière de la séance"><select data-testid="ot-subject" aria-label="Matière de la séance" className={inputCls} value={subject} onChange={(e) => setSubject(e.target.value)}>{SUBJECTS.filter(([k]) => k !== "erreurs" || d.revision.unresolved > 0).map(([k, l]) => <option key={k} value={k}>{k === "erreurs" ? `${l} · ${d.revision.unresolved}` : l}</option>)}</select></Field>}
          {focus === "formation" && <p className="text-[11px] text-ink-300" data-testid="ot-formation-hint">{blockedTraining ? "Vous avez déjà fait votre séance de formation aujourd'hui (une seule par jour) : revenez demain." : `Séance du jour : ${Math.min(hours, maxH) + 1} questions avec votre responsable (une seule séance par jour, de 2 à 5 questions selon la durée).`}</p>}
          <Button data-testid="ot-btn" disabled={d.overtime.maxHours === 0 || (focus === "formation" && blockedTraining)} onClick={() => act({ type: "overtime", hours: Math.min(hours, maxH), focus, ...(focus === "formation" ? { subject } : {}) })}>⏱️ Faire {Math.min(hours, maxH)} h supplémentaire{Math.min(hours, maxH) > 1 ? "s" : ""}</Button>
          <div className="text-xs text-ink-300">Avance en réserve : <b className="num text-white" data-testid="ahead">{d.overtime.ahead} h</b> / {d.overtime.maxAhead} h
            <Bar value={d.overtime.ahead} max={d.overtime.maxAhead} tone="gain" /></div>
        </div>
      </Card>
    </div>
    <Card title="🔁 Mes erreurs passées et carnet de formation" className="mt-4" right={<span className="text-xs text-ink-400">{d.notebook.stats.sessions} séance{d.notebook.stats.sessions > 1 ? "s" : ""} · {d.notebook.stats.correct}/{d.notebook.stats.total} bonnes réponses</span>}>
      <div className="space-y-3 text-sm" data-testid="notebook">
        <div className="text-xs text-ink-300">Fiches de cours validées : <b className="num text-white">{d.notebook.lessons.length} / {d.notebook.totalLessons}</b> · <Link href="/play/formation" className="underline">centre de formation</Link></div>
        <RevisionPanel rv={d.revision} act={act} />
        {d.notebook.lessons.length > 0 && <details><summary className="cursor-pointer text-xs font-semibold uppercase tracking-wider text-ink-400">Fiches validées ({d.notebook.lessons.length})</summary><ul className="mt-2 space-y-2">{d.notebook.lessons.map((n: any) => <li key={n.id} className="rounded-md border border-ink-700 bg-ink-900 p-2 text-xs"><div className="font-medium text-ink-100">{n.term}</div><div className="text-ink-300">{n.simple}</div><div className="mt-1 text-ink-400">À quoi ça sert : {n.application}</div></li>)}</ul></details>}
      </div>
    </Card>
    <p className="mt-4 text-xs text-ink-400">Les activités de loisirs se font en dehors de vos heures de travail : voir <Link href="/play/vie" className="underline">Vie privée</Link>.</p>
  </>;
}
