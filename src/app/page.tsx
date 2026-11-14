"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api, STATIC } from "@/lib/api";
import { Button, inputCls, Disclaimer, Field } from "@/components/ui";

interface Meta { gameId: string; name: string; mode: string; bank: string; t: number; updatedAt: string; rank?: string; }
export default function Home() {
  const router = useRouter();
  const [session, setSession] = useState<{ name: string; guest: boolean } | null | undefined>(undefined);
  const [saves, setSaves] = useState<Meta[]>([]);
  const [auth, setAuth] = useState<"none" | "login" | "register">("none");
  const [name, setName] = useState(""); const [pw, setPw] = useState(""); const [msg, setMsg] = useState("");
  const [settings, setSettings] = useState(false);
  const [mps, setMps] = useState(1);
  const load = async () => {
    const r = await api<{ session: { name: string; guest: boolean } | null }>("/api/auth");
    setSession(r.session);
    if (r.session) { const s = await api<{ games: Meta[] }>("/api/saves"); setSaves(s.games ?? []); }
  };
  useEffect(() => { load(); try { setMps(Number(localStorage.getItem("fe_mps") || 1)); } catch { /* */ } }, []);
  const ensure = async () => { if (!session) { await api("/api/auth", { action: "guest" }); await load(); } };
  const go = async (href: string) => { await ensure(); router.push(href); };
  const cont = async (id: string) => { try { localStorage.setItem("fe_game", id); } catch { /* */ } router.push("/play"); };
  const submitAuth = async () => { const r = await api<{ ok: boolean; error?: string }>("/api/auth", { action: auth, name, password: pw }); if (!r.ok) setMsg(r.error ?? "Erreur"); else { setAuth("none"); setMsg(""); load(); } };
  return (
    <div className="grid-bg relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute -top-40 left-1/2 h-[520px] w-[900px] -translate-x-1/2 rounded-full bg-blue-600/10 blur-3xl" />
      <div className="relative mx-auto flex min-h-screen max-w-6xl flex-col px-4 py-8">
        <header className="flex items-center justify-between">
          <div className="text-xs font-semibold tracking-[0.3em] text-ink-300">SIMULATION · CARRIÈRE · MARCHÉS</div>
          <div className="text-xs text-ink-300">{STATIC ? <span>Édition navigateur — parties enregistrées dans ce navigateur</span> : session ? <>Connecté : <b className="text-white">{session.name}</b>{session.guest && <> · <button onClick={() => setAuth("register")} className="text-accent">créer un compte</button></>} · <button onClick={async () => { await api("/api/auth", { action: "logout" }); setSession(null); setSaves([]); }} className="text-ink-400 hover:text-white">déconnexion</button></> : <><button onClick={() => setAuth("login")} className="text-accent">Se connecter</button> · <button onClick={() => setAuth("register")} className="text-accent">Créer un compte</button></>}</div>
        </header>
        <div className="mt-16 grid flex-1 grid-cols-1 gap-10 lg:grid-cols-[1.2fr_1fr]">
          <div>
            <h1 className="text-5xl font-black tracking-tight text-white md:text-7xl">FINANCIAL<br /><span className="bg-gradient-to-r from-gold to-amber-200 bg-clip-text text-transparent">EMPIRE</span></h1>
            <p className="mt-5 max-w-xl text-lg text-ink-200">Vivez une carrière dans la finance de marché : des marchés qui évoluent seuls, des banques centrales qui surprennent, des clients exigeants, des crises qui couvent — et des décisions aux conséquences durables.</p>
            <ul className="mt-6 grid max-w-xl grid-cols-2 gap-2 text-sm text-ink-300">
              {["117 instruments fictifs cotés en continu", "Moteur multi-facteurs & 10 régimes", "Options Black-Scholes, futures, structurés", "Grand livre en partie double", "Réunions, clients et PNJ persistants", "Promotions, bonus, licenciements", "Crises à phases & signaux faibles", "Créez votre propre société"].map((x) => <li key={x} className="flex gap-2"><span className="text-gold">◆</span>{x}</li>)}
            </ul>
          </div>
          <div className="panel h-fit space-y-2 p-5">
            <MenuBtn primary onClick={() => go("/nouvelle?mode=carriere")} title="Nouvelle carrière" sub="Commencez trader junior dans une banque fictive, avec 10 000 € virtuels" testid="new-career" />
            <MenuBtn onClick={() => go("/sauvegardes")} title="Continuer une carrière" sub={saves.length ? `${saves.length} partie(s) — dernière : ${saves[0].name}` : "Reprendre une partie sauvegardée"} />
            {saves[0] && <button onClick={() => cont(saves[0].gameId)} className="w-full rounded-md bg-ink-800 px-3 py-2 text-left text-xs text-ink-200 hover:bg-ink-700" data-testid="continue-last">▶ Reprendre « {saves[0].name} » ({saves[0].rank})</button>}
            <MenuBtn onClick={() => go("/nouvelle?mode=bac_a_sable")} title="Mode bac à sable" sub="Marchés libres, capital personnalisé, aucune contrainte de carrière" />
            <MenuBtn onClick={() => go("/nouvelle?mode=defi")} title="Mode défi" sub="Scénarios chronométrés : krach, choc pétrolier, objectif de performance" />
            <MenuBtn onClick={() => setSettings(!settings)} title="Paramètres" sub="Vitesse du temps, comptes" />
            {settings && <div className="rounded-md bg-ink-900 p-3 text-sm"><Field label="Ratio temps simulé à x1 (minutes simulées par seconde réelle)" hint="Par défaut 1 min/s. À x100 : 100 min simulées par seconde."><input type="number" min={0.25} max={60} step={0.25} value={mps} onChange={(e) => { setMps(Number(e.target.value)); try { localStorage.setItem("fe_mps", e.target.value); } catch { /* */ } }} className={inputCls} /></Field></div>}
          </div>
        </div>
        {auth !== "none" && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"><div className="panel w-full max-w-sm space-y-3 p-5"><h2 className="text-lg font-semibold">{auth === "login" ? "Connexion" : "Créer un compte"}</h2><p className="text-xs text-ink-400">Compte local du jeu (mot de passe haché scrypt, session signée). {auth === "register" && session?.guest ? "Vos parties d'invité seront rattachées." : ""}</p><input placeholder="Identifiant" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} /><input type="password" placeholder="Mot de passe (8 caractères min.)" className={inputCls} value={pw} onChange={(e) => setPw(e.target.value)} />{msg && <div className="text-xs text-loss">{msg}</div>}<div className="flex gap-2"><Button onClick={submitAuth}>Valider</Button><Button variant="ghost" onClick={() => setAuth("none")}>Annuler</Button></div></div></div>}
        <footer className="mt-12 flex flex-wrap items-center justify-between gap-2 border-t border-ink-800 pt-4"><Disclaimer /><span className="text-[11px] text-ink-500">Application pédagogique — n'est pas une plateforme de courtage. <Link href="/a-propos" className="underline">À propos</Link></span></footer>
      </div>
    </div>
  );
}
function MenuBtn({ title, sub, onClick, primary, testid }: { title: string; sub: string; onClick: () => void; primary?: boolean; testid?: string }) {
  return <button data-testid={testid} onClick={onClick} className={`group w-full rounded-lg border px-4 py-3 text-left transition ${primary ? "border-gold/50 bg-gradient-to-r from-yellow-900/30 to-ink-850 hover:border-gold" : "border-ink-700 bg-ink-850 hover:border-ink-500"}`}><div className="font-semibold text-white">{title} <span className="float-right text-ink-500 transition group-hover:translate-x-1 group-hover:text-white">→</span></div><div className="text-xs text-ink-300">{sub}</div></button>;
}
