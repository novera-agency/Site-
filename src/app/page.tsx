"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { api, STATIC } from "@/lib/api";
import { BANK_BY_ID, TRACKS } from "@/engine/data/banks";
import { fmtDateFor } from "@/engine/time";
import { Button, inputCls } from "@/components/ui";
import { Intro } from "@/components/Intro";
import { CareerCode } from "@/components/CareerCode";
import { OfficeScene, type Room } from "@/components/OfficeScene";
import { OfficeView } from "@/components/OfficeView";
import { webglOK } from "@/components/Stage3D";
import { loadDeviceAvatar } from "@/lib/avatar-pref";
import { defaultAvatar, type Avatar } from "@/engine/avatar";
import { hallOfFame, type HallEntry } from "@/lib/hall";
import { useT, setLang, getLang } from "@/lib/i18n";
import { setSoundPrefs, useSoundPrefs } from "@/lib/sound-prefs";

interface Meta { gameId: string; name: string; mode: string; bank: string; t: number; updatedAt: string; rank?: string; difficulty: string; epochYear?: number; }
type Item = "continuer" | "nouvelle" | "charger" | "libre" | "defis" | "honneur" | "options";

const CHALLENGES = [
  { id: "survivre_krach", name: "Survivre au krach", text: "100 000 € en poche, et le marché va s'effondrer. Tenez 30 jours en perdant moins de 10 %." },
  { id: "objectif_10", name: "Objectif +10 %", text: "50 000 € et 60 jours pour gagner 10 %, sans vous faire liquider." },
  { id: "choc_petrolier", name: "Choc pétrolier", text: "Une crise énergétique arrive. Gagnez 5 % en 40 jours avec 75 000 €." },
];
const MODE_LABEL: Record<string, string> = { carriere: "Carrière", bac_a_sable: "Partie libre", defi: "Défi" };

function careerLine(m: Meta) {
  if (m.mode !== "carriere") return MODE_LABEL[m.mode] ?? m.mode;
  const [track, , rank] = (m.rank ?? "").split(" ");
  const t = TRACKS[track as keyof typeof TRACKS];
  const title = t ? t.ranks[Number(rank)] ?? t.name : m.rank;
  return `${title} · ${BANK_BY_ID[m.bank]?.short ?? m.bank}`;
}

/** Décor original : ville de nuit et courbe de cours, dessinés en SVG */
function Skyline() {
  const buildings = useMemo(() => {
    let seed = 7;
    const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
    const out: { x: number; w: number; h: number; win: [number, number][] }[] = [];
    for (let x = 0; x < 1600; ) {
      const w = 40 + Math.floor(rnd() * 70), h = 90 + Math.floor(rnd() * 260);
      const win: [number, number][] = [];
      for (let wy = 14; wy < h - 10; wy += 16) for (let wx = 8; wx < w - 8; wx += 12) if (rnd() < 0.18) win.push([wx, wy]);
      out.push({ x, w, h, win });
      x += w + 4 + Math.floor(rnd() * 10);
    }
    return out;
  }, []);
  return (
    <svg className="pointer-events-none absolute inset-x-0 bottom-0 h-[32vh] w-full opacity-70" viewBox="0 0 1600 420" preserveAspectRatio="xMidYMax slice" aria-hidden>
      <polyline className="chartline" points="0,260 90,250 160,270 240,220 310,235 390,180 470,200 540,150 620,170 700,120 780,140 860,95 940,130 1020,85 1100,105 1180,60 1260,80 1340,40 1420,70 1500,30 1600,45" fill="none" stroke="#d4a94f" strokeOpacity=".35" strokeWidth="2" />
      {buildings.map((b, i) => (
        <g key={i} transform={`translate(${b.x},${420 - b.h})`}>
          <rect width={b.w} height={b.h} fill={i % 3 ? "#0c1220" : "#0e1626"} />
          {b.win.map(([x, y], k) => <rect key={k} x={x} y={y} width="5" height="7" fill="#e8c77a" opacity={0.25 + ((k * 37) % 50) / 100} />)}
        </g>
      ))}
    </svg>
  );
}

function Ticker() {
  const rows = [["EUROPA 50", "5 000", "+0,4"], ["AMERICA 100", "6 000", "+0,7"], ["EUR/USD", "1,080", "−0,1"], ["OR", "2 650", "+0,3"], ["BRENT", "78,00", "−0,6"], ["LUTÈCE", "56,40", "+1,2"], ["VALOMBRE", "825,60", "+0,9"], ["NOVEXA", "220,10", "−1,4"], ["BUND 10 ANS", "98,27", "−0,2"]];
  const items = rows.map(([n, p, c]) => <span key={n} className="mx-6 whitespace-nowrap"><span className="text-ink-400">{n}</span> <span className="num text-ink-100">{p}</span> <span className={`num ${c.startsWith("+") ? "text-gain" : "text-loss"}`}>{c} %</span></span>);
  return <div className="absolute inset-x-0 bottom-0 overflow-hidden border-t border-ink-800 bg-ink-950/90 py-1.5 text-[11px]"><div className="ticker flex w-max">{items}{items}</div></div>;
}

export default function Home() {
  const T = useT();
  const snd = useSoundPrefs();
  const [lang, setLangState] = useState<"fr" | "en">("fr");
  useEffect(() => { setLangState(getLang()); }, []);
  const router = useRouter();
  const [session, setSession] = useState<{ name: string; guest: boolean } | null | undefined>(undefined);
  const [saves, setSaves] = useState<Meta[] | null>(null);
  const [sel, setSel] = useState<Item>("nouvelle");
  const [auth, setAuth] = useState<"none" | "login" | "register">("none");
  const [name, setName] = useState(""); const [pw, setPw] = useState(""); const [msg, setMsg] = useState("");
  const [mps, setMps] = useState(1);
  const panelRef = useRef<HTMLElement>(null);
  const [hall, setHall] = useState<HallEntry[]>([]);
  const [deviceAvatar, setDeviceAvatar] = useState<Avatar>(defaultAvatar());
  const [arrived, setArrived] = useState(false);
  const [use3d, setUse3d] = useState<boolean | null>(null);
  const [classic, setClassic] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  useEffect(() => { if (!panelOpen) return; const k = (e: KeyboardEvent) => { if (e.key === "Escape") setPanelOpen(false); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [panelOpen]);
  useEffect(() => { setDeviceAvatar(loadDeviceAvatar() ?? defaultAvatar()); setUse3d(webglOK()); }, []);
  useEffect(() => { setHall(hallOfFame()); }, []);
  const [ioMsg, setIoMsg] = useState("");
  const exportAll = async () => {
    const list = await api<{ games: Meta[] }>("/api/saves");
    const games: string[] = [];
    for (const g of list.games ?? []) { const r = await api<{ ok: boolean; data?: string }>("/api/saves", { action: "export_json", gameId: g.gameId }); if (r.ok && r.data) games.push(r.data); }
    const blob = new Blob([JSON.stringify({ format: "financial-empire-backup", version: 1, games })], { type: "application/json" });
    const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `financial-empire-sauvegarde-${new Date().toISOString().slice(0, 10)}.json`; a.click();
    setIoMsg(`${games.length} partie${games.length > 1 ? "s" : ""} téléchargée${games.length > 1 ? "s" : ""}.`);
  };
  const importAll = async (f: File) => {
    try {
      const txt = await f.text(); const j = JSON.parse(txt);
      const games: string[] = j?.format === "financial-empire-backup" ? j.games : [txt];
      let n = 0; for (const g of games) { const r = await api<{ ok: boolean }>("/api/saves", { action: "import", data: g }); if (r.ok) n++; }
      setIoMsg(`${n} partie${n > 1 ? "s" : ""} restaurée${n > 1 ? "s" : ""}.`); load();
    } catch { setIoMsg("Fichier illisible : choisissez un fichier téléchargé depuis Financial Empire."); }
  };

  const load = useCallback(async () => {
    const r = await api<{ session: { name: string; guest: boolean } | null }>("/api/auth");
    setSession(r.session);
    if (r.session) { const s = await api<{ games: Meta[] }>("/api/saves"); setSaves(s.games ?? []); if (s.games?.length) setSel("continuer"); }
    else setSaves([]);
  }, []);
  useEffect(() => { load(); try { setMps(Number(localStorage.getItem("fe_mps") || 1)); } catch { /* */ } }, [load]);

  const ensure = async () => { if (!session) await api("/api/auth", { action: "guest" }); };
  const open = async (id: string) => { await ensure(); try { localStorage.setItem("fe_game", id); } catch { /* */ } router.push("/play"); };
  const go = async (href: string) => { await ensure(); router.push(href); };
  const last = saves?.[0];

  const items: { id: Item; label: string; hint: string; hidden?: boolean }[] = [
    { id: "continuer", label: "Continuer", hint: last ? `${last.name} — ${careerLine(last)}` : "", hidden: !last },
    { id: "nouvelle", label: "Nouvelle carrière", hint: "Commencer de zéro dans une banque" },
    { id: "charger", label: "Charger une partie", hint: saves?.length ? `${saves.length} partie${saves.length > 1 ? "s" : ""} enregistrée${saves.length > 1 ? "s" : ""}` : "Aucune partie pour l'instant" },
    { id: "libre", label: "Partie libre", hint: "Investir sans patron ni horaires" },
    { id: "defis", label: "Défis", hint: "Scénarios courts et chronométrés" },
    { id: "honneur", label: "Tableau d'honneur", hint: "Vos meilleures fins de carrière" },
    { id: "options", label: "Options", hint: STATIC ? "Vitesse du temps" : "Vitesse du temps, compte" },
  ];
  const visible = items.filter((i) => !i.hidden);
  const ROOMS: Omit<Room, "locked">[] = [
    { id: "continuer", slot: 0, kind: "directeur", icon: "🗝️", label: "Continuer", sub: "Bureau du directeur" },
    { id: "nouvelle", slot: 1, kind: "marches", icon: "📈", label: "Nouvelle carrière", sub: "Salle des marchés" },
    { id: "defis", slot: 2, kind: "conseil", icon: "🎯", label: "Défis", sub: "Salle du conseil" },
    { id: "charger", slot: 3, kind: "archives", icon: "🗄️", label: "Charger", sub: "Archives" },
    { id: "libre", slot: 4, kind: "openspace", icon: "💼", label: "Partie libre", sub: "Open space" },
    { id: "honneur", slot: 5, kind: "honneur", icon: "🏅", label: "Tableau d'honneur", sub: "Salon d'honneur" },
    { id: "options", slot: 6, kind: "conciergerie", icon: "🛎️", label: "Options", sub: "Conciergerie" },
  ];
  const rooms: Room[] = ROOMS.map((r) => ({ ...r, label: T(r.label), sub: T(r.sub ?? ""), locked: r.id === "continuer" && !last, hint: r.id === "continuer" && !last ? T("aucune partie à reprendre") : items.find((i) => i.id === r.id)?.hint }));
  const activate = useCallback((id: Item) => {
    if (id === "continuer" && last) open(last.gameId);
    else if (id === "nouvelle") go("/nouvelle?mode=carriere");
    else if (id === "libre") go("/nouvelle?mode=bac_a_sable");
    else { setSel(id); setPanelOpen(true); if (typeof window !== "undefined" && window.innerWidth < 768) setTimeout(() => panelRef.current?.scrollIntoView({ behavior: "smooth", block: "start" }), 50); }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [last, session]);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (auth !== "none" || (e.target as HTMLElement)?.tagName === "INPUT") return;
      const i = visible.findIndex((v) => v.id === sel);
      if (e.key === "ArrowDown") { e.preventDefault(); setSel(visible[(i + 1) % visible.length].id); }
      if (e.key === "ArrowUp") { e.preventDefault(); setSel(visible[(i - 1 + visible.length) % visible.length].id); }
      if (e.key === "Enter") activate(sel);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sel, visible, activate, auth]);

  const submitAuth = async () => { const r = await api<{ ok: boolean; error?: string }>("/api/auth", { action: auth, name, password: pw }); if (!r.ok) setMsg(r.error ?? "Erreur"); else { setAuth("none"); setMsg(""); load(); } };

  const panels: Record<Item, ReactNode> = {
    continuer: last && <>
      <h2 className="text-2xl font-semibold text-white">{last.name}</h2>
      <p className="mt-1 text-ink-300">{careerLine(last)}</p>
      <dl className="mt-5 grid grid-cols-2 gap-4 text-sm">
        <div><dt className="text-ink-500">Date dans le jeu</dt><dd className="mt-0.5 capitalize text-ink-100">{fmtDateFor(last.t, last.epochYear)}</dd></div>
        <div><dt className="text-ink-500">Dernière session</dt><dd className="mt-0.5 text-ink-100">{new Date(last.updatedAt).toLocaleDateString("fr-FR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}</dd></div>
      </dl>
      <Button className="mt-6" onClick={() => open(last.gameId)} data-testid="continue-last">Reprendre la partie</Button>
    </>,
    nouvelle: <>
      <h2 className="text-2xl font-semibold text-white">{T("Votre première journée")}</h2>
      <p className="mt-2 text-ink-300">{T("Lundi matin, 7 h. Vous arrivez dans une banque avec 10 000 € d'économies. Votre responsable vous attend pour vous présenter l'équipe.")}</p>
      <ol className="mt-5 space-y-3 text-sm">
        {[["Créez votre personnage", "Nom, formation, niveau en finance."], ["Choisissez un métier et une banque", "Trader, gérant, analyste… Les banques prestigieuses recrutent les profils solides."], ["Laissez-vous guider", "La première journée sert de tutoriel : réunions, premier ordre, premier client."]].map(([a, b], i) => (
          <li key={a} className="flex gap-3"><span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gold text-xs font-bold text-black">{i + 1}</span><span><b className="text-white">{a}</b><span className="block text-ink-400">{b}</span></span></li>
        ))}
      </ol>
      <Button className="mt-6" onClick={() => activate("nouvelle")}>Commencer</Button>
    </>,
    charger: <>
      <h2 className="text-2xl font-semibold text-white">Charger une partie</h2>
      {!saves?.length ? <p className="mt-2 text-ink-400">Vous n'avez pas encore de partie. Lancez une nouvelle carrière : elle sera sauvegardée automatiquement.</p> : (
        <ul className="mt-4 space-y-2">{saves.slice(0, 6).map((g) => (
          <li key={g.gameId}><button onClick={() => open(g.gameId)} className="flex w-full items-center justify-between gap-3 rounded-lg border border-ink-700 bg-ink-900/80 px-4 py-3 text-left hover:border-gold/60">
            <span className="min-w-0"><b className="block truncate text-white">{g.name}</b><span className="block truncate text-xs text-ink-400">{careerLine(g)} · {fmtDateFor(g.t, g.epochYear, false)}</span></span><span className="shrink-0 text-sm text-gold">Jouer</span>
          </button></li>))}
        </ul>)}
      <div className="mt-5 rounded-lg border border-ink-700 bg-ink-950/60 p-3 text-sm">
        <div className="font-medium text-white">💾 Garder ses parties en sécurité</div>
        <p className="mt-1 text-xs text-ink-400">{STATIC ? "Sur ce site, vos parties sont enregistrées uniquement dans ce navigateur : changer d'appareil ou effacer les données du site les ferait disparaître. Téléchargez régulièrement une copie." : "Téléchargez une copie de vos parties pour les garder ou les transférer."}</p>
        <div className="mt-2 flex flex-wrap gap-2"><Button size="sm" data-testid="export-all" onClick={exportAll}>📤 Télécharger toutes mes parties</Button><label className="cursor-pointer rounded-md border border-ink-600 px-3 py-1.5 text-xs text-ink-200 hover:border-gold">📥 Restaurer depuis un fichier<input type="file" accept="application/json,.json" className="hidden" data-testid="import-all" onChange={(e) => { const f = e.target.files?.[0]; if (f) importAll(f); }} /></label></div>
        {ioMsg && <p className="mt-2 text-xs text-gold">{ioMsg}</p>}
      </div>
      <details className="mt-4 rounded-lg border border-ink-700 bg-ink-950/60 p-3 text-sm" data-testid="home-career-code">
        <summary className="cursor-pointer font-medium text-white">🔑 {T("J'ai un code de carrière")}</summary>
        <div className="mt-3"><CareerCode importOnly gameId={null} onImported={(id) => open(id)} /></div>
      </details>
      <Link href="/sauvegardes" className="mt-4 inline-block text-sm text-ink-300 underline-offset-4 hover:underline">Gérer les sauvegardes (emplacements, export, import)</Link>
    </>,
    libre: <>
      <h2 className="text-2xl font-semibold text-white">Partie libre</h2>
      <p className="mt-2 text-ink-300">Pas de patron, pas de réunions, pas d'horaires. Vous choisissez votre capital de départ et vous investissez comme vous voulez sur tous les marchés du jeu.</p>
      <p className="mt-3 text-sm text-ink-400">Idéal pour tester une stratégie ou apprendre les options et les obligations à votre rythme.</p>
      <Button className="mt-6" onClick={() => activate("libre")}>Lancer une partie libre</Button>
    </>,
    defis: <>
      <h2 className="text-2xl font-semibold text-white">Défis</h2>
      <p className="mt-2 text-sm text-ink-400">Un objectif, un capital, une date limite.</p>
      <ul className="mt-4 space-y-2">{CHALLENGES.map((c) => (
        <li key={c.id} className="rounded-lg border border-ink-700 bg-ink-900/80 p-3"><div className="flex items-center justify-between gap-3"><b className="text-white">{c.name}</b><Button size="sm" onClick={() => go(`/nouvelle?mode=defi&defi=${c.id}`)}>Relever</Button></div><p className="mt-1 text-sm text-ink-400">{c.text}</p></li>))}
      </ul>
    </>,
    honneur: <>
      <h2 className="text-2xl font-semibold text-white">Tableau d'honneur</h2>
      <p className="mt-2 text-sm text-ink-400">Les scores des carrières terminées sur cet appareil (retraite, empire bâti ou faillite). Terminez une partie depuis Bureau → Parcours et succès.</p>
      {hall.length === 0 ? <p className="mt-4 text-sm text-ink-500">Aucune carrière terminée pour l'instant.</p> : <ol className="mt-4 space-y-2" data-testid="hall">{hall.map((h, i) => <li key={i} className="flex items-center justify-between gap-3 rounded-lg border border-ink-700 bg-ink-900/80 px-4 py-2.5"><span className="min-w-0"><b className="text-white">{i + 1}. {h.name}</b><span className="block truncate text-xs text-ink-400">{h.title} · {h.ending === "retraite" ? "retraite" : h.ending === "fortune" ? "empire bâti" : "faillite"} · {h.epoch === 2000 ? "depuis 2000" : "monde 2027"}</span></span><span className="num text-lg font-semibold text-gold">{h.score}</span></li>)}</ol>}
    </>,
    options: <>
      <h2 className="text-2xl font-semibold text-white">Options</h2>
      <label className="mt-4 block text-sm text-ink-300">Vitesse de base du temps
        <select value={mps} onChange={(e) => { setMps(Number(e.target.value)); try { localStorage.setItem("fe_mps", e.target.value); } catch { /* */ } }} className={inputCls + " mt-1"}>
          <option value={0.5}>Lente — 30 secondes de jeu par seconde</option><option value={1}>Normale — 1 minute de jeu par seconde</option><option value={2}>Rapide — 2 minutes de jeu par seconde</option><option value={5}>Très rapide — 5 minutes de jeu par seconde</option>
        </select>
        <span className="mt-1 block text-xs text-ink-500">S'applique aux nouvelles parties. En jeu, les boutons x2 à x100 accélèrent encore.</span>
      </label>
      <label className="mt-5 flex cursor-pointer items-start gap-2 text-sm text-ink-300"><input type="checkbox" className="mt-1" data-testid="home-mute" checked={snd.muted} onChange={(e) => setSoundPrefs({ muted: e.target.checked })} /><span>Mode silencieux : couper tous les bruits et les voix<span className="block text-xs text-ink-500">Réglages détaillés dans la partie : Options → Paramètres.</span></span></label>
      {!STATIC && <div className="mt-6 text-sm">{session && !session.guest ? <p className="text-ink-300">Connecté en tant que <b className="text-white">{session.name}</b>. <button className="text-ink-400 underline" onClick={async () => { await api("/api/auth", { action: "logout" }); setSession(null); setSaves([]); }}>Se déconnecter</button></p> : <p className="text-ink-300">Un compte permet de retrouver vos parties depuis un autre navigateur. <button className="text-gold underline" onClick={() => setAuth("login")}>Se connecter</button> · <button className="text-gold underline" onClick={() => setAuth("register")}>Créer un compte</button></p>}</div>}
      {STATIC && <p className="mt-6 text-sm text-ink-400">Vos parties sont enregistrées dans ce navigateur. Pour les transférer, utilisez l'export dans « Gérer les sauvegardes ».</p>}
    </>,
  };

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#070a12]">
      {use3d === false && <Intro />}
      <Skyline />
      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-[32vh] bg-gradient-to-b from-[#070a12] via-transparent to-transparent" />
      {use3d && !classic && <OfficeView fullscreen rooms={rooms} avatar={deviceAvatar} arrival selected={sel} label={T("Plan de la banque")} onArrive={(id) => activate(id as Item)} onArrived={() => setArrived(true)} inRoom={panelOpen} onFail={() => setUse3d(false)}>
        <header className="pointer-events-auto absolute inset-x-0 top-0 flex items-center gap-3 bg-gradient-to-b from-black/75 to-transparent px-4 pb-6 pt-3 md:px-6">
          <span className="flex h-9 w-9 items-center justify-center rounded-md border border-gold/60 text-sm font-black text-gold">FE</span>
          <span className="text-sm font-semibold tracking-[0.25em] text-ink-100">FINANCIAL EMPIRE</span>
          <span className="ml-auto flex items-center gap-2 text-[11px]">
            <button data-testid="classic-menu" onClick={() => setClassic(true)} className="rounded border border-white/25 bg-black/50 px-2 py-1 text-ink-100 hover:bg-black/70">{T("Menu classique")}</button>
            <span className="flex gap-1" role="group" aria-label="Langue / Language">{(["fr", "en"] as const).map((l) => <button key={l} data-testid={`lang-${l}`} aria-pressed={lang === l} onClick={() => lang !== l && setLang(l)} className={`rounded px-2 py-1 ${lang === l ? "bg-gold font-bold text-black" : "bg-black/50 text-ink-200"}`}>{l.toUpperCase()}</button>)}</span>
          </span>
        </header>
        <p className="pointer-events-none absolute inset-x-0 bottom-4 px-6 text-center text-sm text-white/90 drop-shadow">{!arrived ? T("Paris, 7 h 02. Votre badge vous attend à l'accueil de la banque.") : T("Touchez un ascenseur : votre personnage y monte. Faites glisser pour parcourir le hall.")}</p>
        {arrived && panelOpen && <aside role="region" aria-label={T(sel)} data-testid="home-panel" className="pointer-events-auto absolute bottom-14 left-3 right-3 top-16 overflow-y-auto rounded-xl border border-ink-600 bg-ink-900/95 p-5 shadow-2xl backdrop-blur sm:bottom-6 sm:left-auto sm:right-6 sm:top-16 sm:w-[min(440px,90vw)] md:p-7">
          <button onClick={() => setPanelOpen(false)} className="mb-3 text-xs text-ink-300 underline hover:text-white">← {T("Retour au hall")}</button>
          {panels[sel]}
        </aside>}
      </OfficeView>}
      <div className="relative z-10 mx-auto flex min-h-screen max-w-6xl flex-col px-5 pb-16 pt-8 md:px-8" {...(use3d && !classic ? { inert: true } : {})}>
        <header className="flex items-center gap-3">
          <span className="flex h-9 w-9 items-center justify-center rounded-md border border-gold/60 text-sm font-black text-gold">FE</span>
          <span className="text-sm font-semibold tracking-[0.25em] text-ink-200">FINANCIAL EMPIRE</span>
          <span className="ml-auto flex gap-1 text-[11px]" role="group" aria-label="Langue / Language">{(["fr", "en"] as const).map((l) => <button key={l} data-testid={`lang-${l}`} aria-pressed={lang === l} onClick={() => lang !== l && setLang(l)} className={`rounded px-2 py-1 font-semibold uppercase ${lang === l ? "bg-gold text-black" : "bg-ink-800 text-ink-300 hover:text-white"}`}>{l}</button>)}</span>
        </header>

        {(use3d === false || classic) && <div className="mt-6 md:mt-8"><OfficeScene rooms={rooms} selected={sel} label={T("Plan de la banque")} onArrive={(id) => activate(id as Item)}>
          <p className="mt-2 text-center text-xs text-ink-400">{T("Touchez une pièce : votre personnage s'y rend. Le menu classique reste disponible juste en dessous.")}</p>
          {classic && <p className="mt-1 text-center"><button onClick={() => setClassic(false)} data-testid="back-to-3d" className="text-xs text-gold underline">{T("Revenir à l'arrivée en 3D")}</button></p>}
        </OfficeScene></div>}

        <div className="mt-8 grid flex-1 items-start gap-8 md:mt-16 md:grid-cols-[minmax(0,320px)_minmax(0,1fr)] md:gap-14">
          <div>
            <h1 className="text-4xl font-black leading-[1.05] text-white md:text-5xl">{T("De stagiaire")}<br />{T("à patron")}<br />{T("de banque.")}</h1>
            <nav className="mt-8 space-y-1" aria-label="Menu principal">
              {saves === null ? <div className="h-40" /> : visible.map((it) => (
                <button key={it.id} data-testid={it.id === "nouvelle" ? "new-career" : `menu-${it.id}`} onMouseEnter={() => setSel(it.id)} onFocus={() => setSel(it.id)} onClick={() => activate(it.id)}
                  className={`group relative block w-full rounded-md py-2.5 pl-5 pr-3 text-left transition ${sel === it.id ? "bg-white/[0.06]" : "hover:bg-white/[0.03]"}`}>
                  <span className={`absolute left-0 top-2 bottom-2 w-1 rounded-full transition ${sel === it.id ? "bg-gold" : "bg-transparent"}`} />
                  <span className={`block text-lg font-semibold ${sel === it.id ? "text-white" : "text-ink-300"}`}>{T(it.label)}</span>
                  <span className="block truncate text-xs text-ink-400">{T(it.hint)}</span>
                </button>
              ))}
            </nav>
            {saves !== null && !saves.length && <p className="mt-6 max-w-xs text-sm text-ink-400">Première fois ? Choisissez <b className="text-ink-200">Nouvelle carrière</b> : la première journée vous apprend tout.</p>}
            <p className="mt-6 hidden text-[11px] text-ink-500 md:block">{T("↑ ↓ pour naviguer · Entrée pour valider")}</p>
          </div>

          <section ref={panelRef} key={sel} className="fade-in scroll-mt-4 rounded-xl border border-ink-700/80 bg-ink-900/85 p-6 backdrop-blur md:p-8">{panels[sel]}</section>
        </div>

        <footer className="relative mt-10 w-fit rounded bg-[#070a12]/80 px-2 py-1 text-[11px] text-ink-400">{T("Jeu de simulation : argent virtuel, marchés et entreprises fictifs, aucune transaction réelle.")} <Link href="/a-propos" className="underline">{T("À propos")}</Link>{lang === "en" && <span className="ml-2 text-ink-500">{T("Les textes du jeu (dialogues, missions, actualités) restent en français.")}</span>}</footer>
      </div>
      <Ticker />

      {auth !== "none" && <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"><div className="w-full max-w-sm space-y-3 rounded-xl border border-ink-700 bg-ink-900 p-5"><h2 className="text-lg font-semibold">{auth === "login" ? "Connexion" : "Créer un compte"}</h2><input placeholder="Identifiant" className={inputCls} value={name} onChange={(e) => setName(e.target.value)} /><input type="password" placeholder="Mot de passe (8 caractères min.)" className={inputCls} value={pw} onChange={(e) => setPw(e.target.value)} />{msg && <div className="text-xs text-loss">{msg}</div>}<div className="flex gap-2"><Button onClick={submitAuth}>Valider</Button><Button variant="ghost" onClick={() => setAuth("none")}>Annuler</Button></div></div></div>}
    </div>
  );
}
