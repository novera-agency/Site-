"use client";
import { Suspense, useMemo, useState, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { api } from "@/lib/api";
import { BANKS, TRACKS, BASE_SALARY } from "@/engine/data/banks";
import { Button, Field, inputCls, Badge, Disclaimer } from "@/components/ui";
import type { Track } from "@/engine/types";
import { AvatarEditor } from "@/components/AvatarEditor";
import { defaultAvatar, parseAvatar, type Avatar } from "@/engine/avatar";
import { saveDeviceAvatar, loadDeviceAvatar } from "@/lib/avatar-pref";

const KNOW = [
  { id: "debutant", label: "Débutant", desc: "Explications progressives, aucune connaissance requise.", max: 2 },
  { id: "etudiant", label: "Étudiant en finance", desc: "Bases théoriques, peu de pratique.", max: 3 },
  { id: "analyste", label: "Analyste junior", desc: "Analyse financière et valorisation.", max: 4 },
  { id: "trader", label: "Trader junior", desc: "Marchés, exécution, gestion du risque.", max: 4 },
  { id: "entrepreneur", label: "Entrepreneur", desc: "Création d'entreprise, négociation.", max: 3 },
  { id: "expert", label: "Expert", desc: "Vocabulaire professionnel, démarre un rang plus haut.", max: 5 },
] as const;
const CHALLENGES = [
  { id: "survivre_krach", name: "Survivre au krach", desc: "100 000 € — terminez 30 jours avec une perte < 10 %." },
  { id: "objectif_10", name: "Objectif +10 %", desc: "50 000 € — +10 % en 60 jours." },
  { id: "choc_petrolier", name: "Choc pétrolier", desc: "75 000 € — +5 % en 40 jours malgré une crise énergétique." },
];
const DIFF = [
  { id: "debutant", label: "Débutant", desc: "Conseils, missions guidées, pas de vente à découvert, marges réduites." },
  { id: "normal", label: "Normal", desc: "Économie crédible, concurrence, progression équilibrée." },
  { id: "expert", label: "Expert", desc: "Moins d'assistance, gestion du risque exigeante." },
  { id: "simulation", label: "Simulation", desc: "Marges renforcées, conformité stricte, échec professionnel possible." },
] as const;

function Wizard() {
  const router = useRouter();
  const sp = useSearchParams();
  const mode = (sp.get("mode") ?? "carriere") as "carriere" | "bac_a_sable" | "defi";
  const steps = mode === "carriere" ? ["Difficulté", "Personnage", "Métier", "Banque", "Argent de départ", "C'est parti"] : mode === "defi" ? ["Défi", "Personnage", "C'est parti"] : ["Difficulté", "Personnage", "Argent de départ", "C'est parti"];
  const [step, setStep] = useState(0);
  const [difficulty, setDifficulty] = useState<"debutant" | "normal" | "expert" | "simulation">("normal");
  const [challenge, setChallenge] = useState(sp.get("defi") ?? "survivre_krach");
  const [p, setP] = useState({ firstName: "", lastName: "", nationality: "Française", age: 24, education: "Master en finance de marché", knowledge: "etudiant" as (typeof KNOW)[number]["id"], goal: "Devenir Managing Director", specialization: "Marchés actions", riskProfile: "equilibre" as "prudent" | "equilibre" | "dynamique" | "agressif" });
  const [track, setTrack] = useState<Track>("trader");
  const [avatar, setAvatar] = useState<Avatar>(defaultAvatar());
  useEffect(() => { const a = loadDeviceAvatar(); if (a) setAvatar(a); }, []);
  const [bankId, setBankId] = useState("lutece");
  const [capitalMode, setCapitalMode] = useState<"standard" | "1000" | "10000" | "100000" | "libre">("standard");
  const [free, setFree] = useState(25000);
  const [seed, setSeed] = useState("");
  const [historical, setHistorical] = useState(sp.get("epoque") !== "fictif");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const maxDiff = KNOW.find((k) => k.id === p.knowledge)!.max + (p.education.toLowerCase().includes("master") || p.education.toLowerCase().includes("grande école") ? 1 : 0);
  const capital = mode === "defi" ? 0 : capitalMode === "standard" ? 10000 : capitalMode === "libre" ? free : Number(capitalMode);
  const bank = BANKS.find((b) => b.id === bankId)!;
  const cur = steps[step];
  const canNext = useMemo(() => {
    if (cur === "Personnage") return p.firstName.trim().length > 0 && p.lastName.trim().length > 0;
    if (cur === "Banque") return bank.difficulty <= maxDiff && bank.tracks.includes(track);
    if (cur === "Argent de départ") return capital >= 100 || mode === "defi";
    return true;
  }, [cur, p, bank, maxDiff, track, capital, mode]);
  const create = async () => {
    setBusy(true); setErr("");
    await api("/api/auth", { action: "guest" });
    let mps = 1; try { mps = Number(localStorage.getItem("fe_mps") || 1); } catch { /* */ }
    const r = await api<{ ok: boolean; gameId?: string; error?: string }>("/api/game/new", { mode, difficulty, bankId: mode === "carriere" ? bankId : "lutece", track: mode === "carriere" ? track : "trader", startingCapital: mode === "defi" ? 10000 : capital, profile: { ...p, avatar }, seed: seed || undefined, challengeId: mode === "defi" ? challenge : undefined, minutesPerSecond: mps, historical: mode !== "defi" && historical });
    if (!r.ok || !r.gameId) { setErr(r.error ?? "Création impossible"); setBusy(false); return; }
    try { localStorage.setItem("fe_game", r.gameId); localStorage.setItem("fe_intro_new", r.gameId); } catch { /* */ } // l'introduction cinématographique se joue à l'arrivée
    router.push("/play");
  };
  return (
    <div className="grid-bg min-h-screen">
      <div className="mx-auto max-w-5xl px-4 py-8">
        <div className="mb-6 flex items-center justify-between"><Link href="/" className="text-sm text-ink-400 hover:text-white">← Menu</Link><div className="text-xs uppercase tracking-[0.3em] text-gold">{mode === "carriere" ? "Nouvelle carrière" : mode === "defi" ? "Mode défi" : "Bac à sable"}</div></div>
        <ol className="mb-6 flex flex-wrap gap-2">{steps.map((s, i) => <li key={s} className={`rounded-full px-3 py-1 text-xs ${i === step ? "bg-accent text-white" : i < step ? "bg-green-600/25 text-green-300" : "bg-ink-800 text-ink-400"}`}>{i + 1}. {s}</li>)}</ol>
        <h1 className="sr-only">Nouvelle partie</h1>
        <div className="panel p-5 fade-in" key={cur}>
          {(cur === "Difficulté" || cur === "Défi") && <div className="space-y-5">
            {mode !== "defi" && <div>
              <h2 className="text-xl font-semibold">Quelle époque ?</h2>
              <div className="mt-3 grid gap-3 md:grid-cols-2">
                <button data-testid="epoch-hist" onClick={() => setHistorical(true)} className={`rounded-lg border p-4 text-left ${historical ? "border-gold bg-yellow-500/10" : "border-ink-700 bg-ink-850 hover:border-ink-500"}`}><div className="font-semibold">🕰️ De 2000 à aujourd'hui — l'histoire réelle</div><div className="mt-1 text-xs text-ink-300">Départ le 3 janvier 2000, en pleine bulle Internet. Vous traversez les vrais événements : 11 septembre, faillite de Lehman, crise de l'euro, Brexit, élections, Covid, guerre en Ukraine, inflation, guerre contre l'Iran et choc pétrolier de 2026… Les marchés suivent leurs trajectoires réelles jusqu'au 13 novembre 2026, puis la simulation prend le relais. Les trajectoires sont reconstituées de façon approchée ; les entreprises et banques du jeu restent fictives.</div></button>
                <button data-testid="epoch-fictif" onClick={() => setHistorical(false)} className={`rounded-lg border p-4 text-left ${!historical ? "border-gold bg-yellow-500/10" : "border-ink-700 bg-ink-850 hover:border-ink-500"}`}><div className="font-semibold">🔮 2027 — un monde imaginaire</div><div className="mt-1 text-xs text-ink-300">Départ le 4 janvier 2027. Les marchés, crises et événements sont entièrement simulés : personne ne sait ce qui va arriver.</div></button>
              </div>
            </div>}
            <h2 className="text-xl font-semibold">Niveau de difficulté</h2>
            <div className="grid gap-3 md:grid-cols-2">{DIFF.map((d) => <button key={d.id} onClick={() => setDifficulty(d.id)} className={`rounded-lg border p-4 text-left ${difficulty === d.id ? "border-accent bg-blue-500/10" : "border-ink-700 bg-ink-850 hover:border-ink-500"}`}><div className="font-semibold">{d.label}</div><div className="text-xs text-ink-300">{d.desc}</div></button>)}</div>
            <p className="text-xs text-ink-400">La difficulté ne modifie pas artificiellement vos gains : elle change l'assistance, les marges, la sévérité des contrôles et l'exigence des PNJ.</p>
            {mode === "defi" && <div><h3 className="mb-2 font-semibold">Défi</h3><div className="grid gap-3 md:grid-cols-3">{CHALLENGES.map((c) => <button key={c.id} onClick={() => setChallenge(c.id)} className={`rounded-lg border p-3 text-left ${challenge === c.id ? "border-gold bg-yellow-500/10" : "border-ink-700 bg-ink-850"}`}><div className="font-semibold">{c.name}</div><div className="text-xs text-ink-300">{c.desc}</div></button>)}</div></div>}
            <Field label="Graine de simulation (facultatif)" hint="Une même graine produit les mêmes marchés pour les mêmes décisions (simulation reproductible)."><input value={seed} onChange={(e) => setSeed(e.target.value)} className={inputCls} placeholder="aléatoire" /></Field>
          </div>}
          {cur === "Personnage" && <div className="space-y-4">
            <h2 className="text-xl font-semibold">Votre personnage</h2>
            <div className="grid gap-3 md:grid-cols-3">
              <Field label="Prénom"><input data-testid="first-name" className={inputCls} value={p.firstName} onChange={(e) => setP({ ...p, firstName: e.target.value })} /></Field>
              <Field label="Nom"><input data-testid="last-name" className={inputCls} value={p.lastName} onChange={(e) => setP({ ...p, lastName: e.target.value })} /></Field>
              <Field label="Nationalité"><input className={inputCls} value={p.nationality} onChange={(e) => setP({ ...p, nationality: e.target.value })} /></Field>
              <Field label="Âge (fictif)"><input type="number" min={18} max={80} className={inputCls} value={p.age} onChange={(e) => setP({ ...p, age: Number(e.target.value) })} /></Field>
              <Field label="Formation"><select className={inputCls} value={p.education} onChange={(e) => setP({ ...p, education: e.target.value })}>{["Licence d'économie", "Master en finance de marché", "Grande école de commerce", "Grande école d'ingénieurs (quant)", "Doctorat en mathématiques financières", "Autodidacte"].map((x) => <option key={x}>{x}</option>)}</select></Field>
              <Field label="Profil de risque"><select className={inputCls} value={p.riskProfile} onChange={(e) => setP({ ...p, riskProfile: e.target.value as typeof p.riskProfile })}><option value="prudent">Prudent</option><option value="equilibre">Équilibré</option><option value="dynamique">Dynamique</option><option value="agressif">Agressif</option></select></Field>
              <Field label="Objectif professionnel"><input className={inputCls} value={p.goal} onChange={(e) => setP({ ...p, goal: e.target.value })} /></Field>
              <Field label="Spécialisation"><input className={inputCls} value={p.specialization} onChange={(e) => setP({ ...p, specialization: e.target.value })} /></Field>
            </div>
            <div><div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-ink-400">Niveau de connaissances financières</div><div className="grid gap-2 md:grid-cols-3">{KNOW.map((k) => <button key={k.id} onClick={() => setP({ ...p, knowledge: k.id })} className={`rounded-lg border p-3 text-left ${p.knowledge === k.id ? "border-accent bg-blue-500/10" : "border-ink-700 bg-ink-850"}`}><div className="text-sm font-semibold">{k.label}</div><div className="text-xs text-ink-300">{k.desc}</div></button>)}</div></div>
            <div><div className="mb-2 text-[11px] font-medium uppercase tracking-wider text-ink-400">Votre apparence</div><AvatarEditor avatar={avatar} onChange={(a) => { setAvatar(a); saveDeviceAvatar(a); }} /></div>
          </div>}
          {cur === "Métier" && <div className="space-y-3"><h2 className="text-xl font-semibold">Parcours professionnel</h2><div className="grid gap-3 md:grid-cols-2">{(Object.values(TRACKS)).map((t) => <button key={t.id} data-testid={`track-${t.id}`} onClick={() => setTrack(t.id)} className={`rounded-lg border p-4 text-left ${track === t.id ? "border-accent bg-blue-500/10" : "border-ink-700 bg-ink-850 hover:border-ink-500"}`}><div className="font-semibold">{t.name}</div><div className="mt-1 text-xs text-ink-300">{t.description}</div><div className="mt-2 text-[11px] text-ink-400">Missions : {t.missions.join(", ")}</div><div className="text-[11px] text-gold">Objectif de carrière : {t.win}</div></button>)}</div></div>}
          {cur === "Banque" && <div className="space-y-3"><h2 className="text-xl font-semibold">Choix de l'établissement</h2><p className="text-xs text-ink-400">Votre profil vous donne accès aux établissements de difficulté ≤ {maxDiff}. Les plus prestigieux exigent un meilleur bagage.</p><div className="grid gap-3 md:grid-cols-2">{BANKS.map((b) => { const locked = b.difficulty > maxDiff; const noTrack = !b.tracks.includes(track); return <button key={b.id} data-testid={`bank-${b.id}`} disabled={locked || noTrack} onClick={() => setBankId(b.id)} className={`rounded-lg border p-4 text-left disabled:opacity-40 ${bankId === b.id ? "border-accent" : "border-ink-700"}`} style={{ background: `linear-gradient(135deg, ${b.color}55, #0e131c 70%)` }}>
            <div className="flex items-center gap-3"><div className="flex h-11 w-11 items-center justify-center rounded-md text-sm font-black" style={{ background: b.color, color: b.accent, border: `1px solid ${b.accent}` }}>{b.monogram}</div><div><div className="font-semibold">{b.name}</div><div className="text-[11px] text-ink-300">{b.type} · {b.city}</div></div></div>
            <div className="mt-2 flex flex-wrap gap-1"><Badge tone="gold">Prestige {"★".repeat(b.prestige)}</Badge><Badge>Difficulté {b.difficulty}/5</Badge><Badge>{b.aumBn.toLocaleString("fr-FR")} Md€ d'actifs</Badge></div>
            <div className="mt-2 text-xs text-ink-200">{b.culture}</div>
            <div className="mt-1 text-[11px] text-ink-400">Spécialités : {b.specialties.join(", ")} · Risque : {b.riskPolicy}</div>
            <div className="mt-1 text-[11px] text-ink-300">Salaire junior ≈ {Math.round(BASE_SALARY[1] * b.salaryMult).toLocaleString("fr-FR")} € · bonus ×{b.bonusMult} · promotions ×{b.promoSpeed}</div>
            {locked && <div className="mt-1 text-[11px] text-loss">🔒 Profil insuffisant pour être recruté</div>}{noTrack && !locked && <div className="mt-1 text-[11px] text-amber-300">Ce métier n'existe pas dans cet établissement</div>}
          </button>; })}</div></div>}
          {cur === "Argent de départ" && <div className="space-y-3"><h2 className="text-xl font-semibold">Capital personnel de départ</h2>{mode === "defi" ? <p className="text-sm text-ink-300">Le capital est fixé par le défi.</p> : <>
            <div className="grid gap-2 md:grid-cols-5">{([["standard", "Standard", "10 000 €"], ["1000", "Modeste", "1 000 €"], ["10000", "Classique", "10 000 €"], ["100000", "Confortable", "100 000 €"], ["libre", "Libre", "montant libre"]] as const).map(([k, l, v]) => <button key={k} onClick={() => setCapitalMode(k)} className={`rounded-lg border p-3 text-left ${capitalMode === k ? "border-accent bg-blue-500/10" : "border-ink-700 bg-ink-850"}`}><div className="text-sm font-semibold">{l}</div><div className="text-xs text-ink-300">{v}</div></button>)}</div>
            {capitalMode === "libre" && <Field label="Montant (€ virtuels)"><input type="number" min={100} max={100000000} value={free} onChange={(e) => setFree(Number(e.target.value))} className={inputCls} /></Field>}
            <p className="text-xs text-ink-400">Il s'agit d'argent fictif. Votre patrimoine personnel est strictement séparé du capital de la banque et des fonds de vos clients.</p></>}</div>}
          {cur === "C'est parti" && <div className="space-y-2 text-sm"><h2 className="text-xl font-semibold">Récapitulatif</h2>
            <div className="grid gap-2 md:grid-cols-2"><div className="rounded-md bg-ink-900 p-3"><div className="text-ink-400">Personnage</div><div className="font-semibold">{p.firstName} {p.lastName}, {p.age} ans — {p.nationality}</div><div className="text-xs text-ink-300">{p.education} · {KNOW.find((k) => k.id === p.knowledge)?.label}</div></div>
            <div className="rounded-md bg-ink-900 p-3"><div className="text-ink-400">Partie</div><div className="font-semibold">{mode === "carriere" ? `${TRACKS[track].name} chez ${bank.name}` : mode === "defi" ? CHALLENGES.find((c) => c.id === challenge)?.name : "Bac à sable"}</div><div className="text-xs text-ink-300">{mode !== "defi" && (historical ? "Histoire réelle depuis 2000 · " : "Monde imaginaire 2027 · ")}Difficulté {difficulty} · Capital {mode === "defi" ? "fixé par le défi" : `${capital.toLocaleString("fr-FR")} €`}</div></div></div>
            {mode === "carriere" && <p className="text-xs text-ink-300">Vous commencerez votre première journée à {bank.city} {historical ? "le lundi 3 janvier 2000" : "le lundi 4 janvier 2027"} à 7 h. Votre responsable vous attend.</p>}
            {err && <div className="text-loss">{err}</div>}
          </div>}
          <div className="mt-6 flex justify-between"><Button variant="ghost" onClick={() => (step === 0 ? router.push("/") : setStep(step - 1))}>Retour</Button>{step < steps.length - 1 ? <Button data-testid="next" disabled={!canNext} onClick={() => setStep(step + 1)}>Continuer</Button> : <Button data-testid="create" variant="success" disabled={busy} onClick={create}>{busy ? "Génération du monde financier…" : "Commencer"}</Button>}</div>
        </div>
        <div className="mt-4"><Disclaimer /></div>
      </div>
    </div>
  );
}
export default function Page() { return <Suspense><Wizard /></Suspense>; }
