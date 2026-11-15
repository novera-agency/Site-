"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { useGame } from "@/lib/store";
import { api } from "@/lib/api";
import { useAction } from "@/lib/hooks";
import { fmtDate, fmtTime } from "@/engine/time";
import { fmtEur, fmtPct, clsChange } from "@/lib/format";
import { MeetingLauncher } from "./MeetingRoom";
import { MissionHelpPanel } from "./MissionHelp";
import { Badge, Disclaimer } from "./ui";
import type { Snapshot } from "@/server/views";
import { CATEGORIES, categoryOf, itemOf, type NavCategory } from "./nav";


const SPEEDS = [1, 2, 5, 10, 25, 50, 100];

function TopBar({ snap, onMenu }: { snap: Snapshot; onMenu: () => void }) {
  const act = useAction();
  const [bell, setBell] = useState(false);
  const [skip, setSkip] = useState(false);
  return (
    <div className="sticky top-0 z-30 border-b border-ink-700 bg-ink-950/95 backdrop-blur">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2">
        <button onClick={onMenu} className="hidden rounded-md bg-ink-800 px-2 py-1 text-sm md:block lg:hidden" aria-label="Menu">☰</button>
        <Link href="/play" className="hidden text-sm font-bold tracking-[0.18em] text-white sm:block">FINANCIAL<span className="text-gold"> EMPIRE</span></Link>
        <div className="flex items-center gap-2">
          <div className="text-right"><div className="num text-lg font-semibold leading-none text-white">{fmtTime(snap.t)}</div><div className="text-[11px] capitalize text-ink-300">{fmtDate(snap.t)}</div></div>
          <div className="flex items-center gap-1" data-testid="speed-controls">
            <button data-testid="play-pause" onClick={() => act({ type: "pause", paused: !snap.paused }, { silent: true })} className={`rounded-md px-2.5 py-1.5 text-sm font-semibold ${snap.paused ? "bg-green-600 text-white" : "bg-amber-500 text-black"}`} title={snap.paused ? "Reprendre" : "Pause"}>{snap.paused ? "▶" : "❚❚"}</button>
            {SPEEDS.map((x) => <button key={x} data-testid={`speed-${x}`} onClick={() => act({ type: "speed", speed: x }, { silent: true })} className={`num rounded px-1.5 py-1 text-[11px] ${[1, 10, 100].includes(x) ? "" : "hidden sm:inline-block "}${snap.speed === x && !snap.paused ? "bg-accent text-white" : snap.speed === x ? "bg-ink-600 text-white" : "bg-ink-800 text-ink-300 hover:text-white"}`}>x{x}</button>)}
            <div className="relative">
              <button onClick={() => setSkip(!skip)} className="rounded bg-ink-800 px-2 py-1 text-[11px] text-ink-200 hover:text-white">⏭</button>
              {skip && <div className="absolute left-0 top-full z-50 mt-1 w-56 rounded-md border border-ink-600 bg-ink-850 p-1 shadow-xl">{[["next_event", "Jusqu'au prochain rendez-vous"], ["next_hour", "Avancer d'une heure"], ["market_open", "Jusqu'à l'ouverture (9 h)"], ["next_morning", "Jusqu'à demain 7 h 30"]].map(([k, l]) => <button key={k} onClick={() => { setSkip(false); act({ type: "skip", to: k }); }} className="block w-full rounded px-2 py-1.5 text-left text-xs hover:bg-ink-700">{l}</button>)}</div>}
            </div>
          </div>
        </div>
        <div className="hidden items-center gap-1.5 md:flex">{snap.sessions.filter((x) => ["EU", "US", "ASIA", "CRYPTO"].includes(x.id)).map((x) => <span key={x.id} title={x.label} className="flex items-center gap-1 text-[11px] text-ink-300"><span className={`h-1.5 w-1.5 rounded-full ${x.open ? "bg-gain" : "bg-ink-500"}`} />{x.id}</span>)}</div>
        <span className="hidden sm:inline"><Badge tone={snap.crisisActive ? "loss" : "info"}>{snap.regimeLabel}</Badge></span>
        <span className="hidden text-[11px] text-ink-300 md:inline">Volatilité <span className="num text-ink-100">{snap.vix}</span></span>
        <div className="ml-auto flex items-center gap-4">
          {snap.life && <Link href="/play/vie" data-testid="life-chip" title={`Santé mentale ${snap.life.mental} · Forme ${snap.life.physique} · Vie sociale ${snap.life.social} · Épanouissement ${snap.life.fun}`} className="hidden items-center gap-1.5 rounded-md bg-ink-800 px-2 py-1 text-[11px] hover:bg-ink-700 sm:flex">{([["🧠", snap.life.mental], ["💪", snap.life.physique], ["🫂", snap.life.social], ["🎉", snap.life.fun]] as [string, number][]).map(([e, v]) => <span key={e} className={`num ${v >= 60 ? "text-gain" : v >= 35 ? "text-amber-300" : "text-loss"}`}>{e}{v}</span>)}</Link>}
          <div className="text-right"><div className="text-[10px] uppercase tracking-wider text-ink-400">Patrimoine</div><div className="num text-sm font-semibold">{fmtEur(snap.wealth)}</div></div>
          {snap.desk !== null && <div className="hidden text-right sm:block"><div className="text-[10px] uppercase tracking-wider text-ink-400">P&L desk semaine</div><div className={`num text-sm font-semibold ${clsChange(snap.deskPnlWeek ?? 0)}`}>{fmtEur(snap.deskPnlWeek)}</div></div>}
          <Link href="/play/messagerie" className="relative text-lg" title="Messagerie">✉️{snap.unreadMsgs > 0 && <span className="absolute -right-2 -top-1 rounded-full bg-accent px-1 text-[10px] text-white">{snap.unreadMsgs}</span>}</Link>
          <div className="relative">
            <button onClick={() => { setBell(!bell); if (!bell) act({ type: "read", what: "notifications" }, { silent: true }); }} className="relative text-lg" title="Notifications">🔔{snap.unread > 0 && <span className="absolute -right-2 -top-1 rounded-full bg-loss px-1 text-[10px] text-white">{snap.unread}</span>}</button>
            {bell && <div className="absolute right-0 top-full z-50 mt-2 w-80 rounded-lg border border-ink-600 bg-ink-850 p-2 shadow-2xl">{snap.notifications.length === 0 ? <div className="p-3 text-xs text-ink-400">Aucune notification</div> : snap.notifications.map((n) => <Link key={n.id} href={n.link ?? "/play"} onClick={() => setBell(false)} className="block rounded px-2 py-1.5 hover:bg-ink-700"><div className={`text-xs font-medium ${n.level === "critique" ? "text-loss" : n.level === "alerte" ? "text-amber-300" : n.level === "succes" ? "text-gain" : "text-ink-100"}`}>{n.title}</div>{n.body && <div className="line-clamp-2 text-[11px] text-ink-400">{n.body}</div>}<div className="num text-[10px] text-ink-500">{fmtTime(n.t)}</div></Link>)}</div>}
          </div>
        </div>
      </div>
      {snap.paused && snap.pauseReason && snap.pauseReason !== "Pause" && <div className="border-t border-amber-500/30 bg-amber-500/10 px-4 py-1.5 text-xs text-amber-200">⏸ {snap.pauseReason} — la simulation est en pause. Analysez la situation, puis reprenez avec ▶.</div>}
    </div>
  );
}

function Ticker({ snap }: { snap: Snapshot }) {
  const ids = ["IDX-EU", "IDX-US", "IDX-AS", "EURUSD", "USDJPY", "GOLD", "BRENT", "DE10Y", "US10Y", "AURC", "MAIS", "NOVX", "LUTB", "HDMP", "TERA", "ELEC"];
  const items = ids.filter((i) => snap.quotes[i]).map((i) => <span key={i} className="mx-4 whitespace-nowrap text-[11px]"><span className="text-ink-300">{i}</span> <span className="num text-ink-100">{snap.quotes[i][0]}</span> <span className={`num ${clsChange(snap.quotes[i][1])}`}>{fmtPct(snap.quotes[i][1])}</span></span>);
  return <div className="overflow-hidden border-b border-ink-800 bg-ink-900/70 py-1"><div className="ticker flex w-max">{items}{items}</div></div>;
}

const TUTO: Record<number, { hint: string; link?: string }> = {
  1: { hint: "Vous êtes arrivé·e dans votre banque." },
  2: { hint: "Appuyez sur ▶ : à 7 h 15, votre responsable vous accueille en réunion. Cliquez « Rejoindre la réunion » quand le bandeau apparaît.", link: "/play/agenda" },
  3: { hint: "Ouvrez la Salle des marchés pour découvrir le terminal.", link: "/play/terminal" },
  4: { hint: "À 8 h 30, rejoignez la réunion du desk avec votre responsable et vos collègues.", link: "/play/agenda" },
  5: { hint: "Mission de votre responsable : ouvrez la fiche Maison Valombre et répondez à la question dans Missions.", link: "/play/missions" },
  6: { hint: "Achetez un instrument (par exemple 10 parts de l'ETF Monde XWLD).", link: "/play/actif?id=XWLD" },
  7: { hint: "À 11 h, une nouvelle économique tombe : lisez-la dans Actualités.", link: "/play/actualites" },
  8: { hint: "30 minutes après la nouvelle, observez la réaction de l'action Maison Valombre.", link: "/play/actif?id=MAIS" },
  9: { hint: "À 14 h, un client mécontent vous appelle : rejoignez l'appel.", link: "/play/clients" },
  10: { hint: "À 16 h 15, votre responsable vous pose une question technique.", link: "/play/agenda" },
  11: { hint: "Laissez la journée avancer jusqu'à 17 h 30." },
  12: { hint: "À 18 h, votre responsable évalue votre première journée.", link: "/play/carriere" },
};
function Tutorial({ snap }: { snap: Snapshot }) {
  const [hide, setHide] = useState(false);
  if (!snap.tutorial || hide) return null;
  const done = snap.tutorial.filter((x) => x.done).length;
  const cur = snap.tutorial.find((x) => !x.done);
  const tip = cur ? TUTO[cur.id] : null;
  return <div className="mb-4 rounded-lg border border-gold/40 bg-gradient-to-r from-yellow-900/20 to-transparent p-3">
    <div className="mb-2 flex items-center justify-between"><div className="text-xs font-semibold uppercase tracking-wider text-gold">Première journée — {done}/12 étapes</div><button onClick={() => setHide(true)} className="text-xs text-ink-400">masquer</button></div>
    {cur && tip && <div className="mb-2 flex flex-wrap items-center gap-2 rounded-md bg-ink-900/80 px-3 py-2 text-sm"><span className="font-semibold text-gold">Étape {cur.id} — {cur.label} :</span><span className="text-ink-100">{tip.hint}</span>{tip.link && <Link href={tip.link} className="rounded bg-accent px-2 py-0.5 text-xs text-white">Y aller →</Link>}</div>}
    <div className="hidden flex-wrap gap-1.5 md:flex">{snap.tutorial.map((s) => { const t = TUTO[s.id]; const cls = `rounded px-2 py-0.5 text-[11px] ${s.done ? "bg-green-600/20 text-green-300 line-through" : s.id === cur?.id ? "bg-gold/20 text-gold" : "bg-ink-800 text-ink-200"}`; return t?.link && !s.done ? <Link key={s.id} href={t.link} title={t.hint} className={cls + " hover:bg-ink-700"}>{s.id}. {s.label}</Link> : <span key={s.id} title={t?.hint} className={cls}>{s.id}. {s.label}</span>; })}</div>
  </div>;
}

function useBadge(snap: Snapshot) {
  return (k?: string) => k === "msgs" ? snap.unreadMsgs : k === "missions" ? snap.missionsActive : k === "meeting" ? (snap.pendingMeeting || snap.activeMeetingId ? "!" : 0) : 0;
}
/** Fil d'Ariane et croix de fermeture : ramène à la page de la catégorie (ou au bureau depuis une catégorie) */
function BackBar({ path }: { path: string }) {
  const p = path.length > 1 ? path.replace(/\/$/, "") : path;
  if (p === "/play") return null;
  const cat = CATEGORIES.find((c) => c.id === categoryOf(p))!;
  const isHub = CATEGORIES.some((c) => c.hub === p);
  const item = itemOf(p);
  const target = isHub ? "/play" : cat.hub;
  const here = isHub ? null : item?.label ?? (p.startsWith("/play/actif") ? "Fiche de l'instrument" : null);
  return <div className="mb-3 flex items-center justify-between gap-3" data-testid="back-bar">
    <nav className="min-w-0 truncate text-xs text-ink-400"><Link href="/play" className="hover:text-white">🏢 Bureau</Link>{cat.id !== "bureau" ? <> › <Link href={cat.hub} className="hover:text-white">{cat.icon} {cat.label}</Link></> : null}{here && <> › <span className="text-ink-200">{here}</span></>}</nav>
    <Link href={target} data-testid="back-x" aria-label={`Fermer et revenir à ${isHub ? "Bureau" : cat.label}`} title={`Revenir à ${isHub ? "Bureau" : cat.label}`} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-ink-600 bg-ink-850 text-lg text-ink-200 hover:border-gold hover:text-white">✕</Link>
  </div>;
}

/** Barre du bas : chaque catégorie ouvre sa propre page */
function BottomNav({ snap, path }: { snap: Snapshot; path: string }) {
  const badge = useBadge(snap);
  const current = categoryOf(path);
  const catBadge = (c: NavCategory) => c.sections.flatMap((x) => x.items).reduce((a, it) => { const b = badge(it.badge); return b === "!" ? "!" : a === "!" ? a : (Number(a) || 0) + (Number(b) || 0); }, 0 as number | string);
  return <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-ink-700 bg-ink-950/95 backdrop-blur" style={{ paddingBottom: "env(safe-area-inset-bottom)" }} data-testid="bottom-nav">
    <div className="mx-auto grid max-w-3xl grid-cols-5">
      {CATEGORIES.map((c) => { const on = current === c.id; const b = catBadge(c); return <Link key={c.id} href={c.hub} data-testid={`cat-${c.id}`} aria-current={on ? "page" : undefined} className={`relative flex flex-col items-center gap-0.5 py-2 text-[10px] transition ${on ? "text-white" : "text-ink-400 hover:text-white"}`}>
        {on && <span className="absolute inset-x-3 top-0 h-0.5 rounded bg-gold" />}
        <span className="text-xl leading-none">{c.icon}</span><span className="truncate font-medium">{c.short}</span>
        {b ? <span className="absolute right-[24%] top-1 min-w-4 rounded-full bg-gold px-1 text-center text-[9px] font-bold text-black">{b}</span> : null}
      </Link>; })}
    </div>
  </nav>;
}

/** Menu latéral (ordinateur) : les 5 mêmes catégories, celle de la page courante ouverte */
function SideNav({ snap, path }: { snap: Snapshot; path: string }) {
  const current = categoryOf(path);
  const [open, setOpen] = useState<Record<string, boolean>>({});
  const badge = useBadge(snap);
  return <>{CATEGORIES.map((c) => { const isOpen = open[c.id] ?? c.id === current; return <div key={c.id} className="mb-1.5">
    <div className="flex items-center"><Link href={c.hub} className={`flex flex-1 items-center gap-2 rounded-md px-2 py-2 text-sm font-semibold ${c.id === current ? "text-white" : "text-ink-300 hover:text-white"}`}><span className="w-5 text-center">{c.icon}</span>{c.label}</Link><button onClick={() => setOpen({ ...open, [c.id]: !isOpen })} aria-label={isOpen ? "Replier" : "Déplier"} className="px-2 py-2 text-[10px] text-ink-500 hover:text-white">{isOpen ? "▾" : "▸"}</button></div>
    {isOpen && <div className="mb-1 ml-3 border-l border-ink-800 pl-2">{c.sections.map((sec, i) => <div key={i}>{sec.title && <div className="mt-1.5 px-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-ink-500">{sec.title}</div>}{sec.items.map((it) => { const b = badge(it.badge); const on = path === it.href || path === it.href + "/"; return <Link key={it.href} href={it.href} title={it.desc} className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] ${on ? "bg-ink-700 text-white" : "text-ink-300 hover:bg-ink-800 hover:text-white"}`}><span className="w-5 text-center">{it.icon}</span>{it.label}{b ? <span className="ml-auto rounded-full bg-gold px-1.5 text-[10px] font-bold text-black">{b}</span> : null}</Link>; })}</div>)}</div>}
  </div>; })}</>;
}

export function Shell({ children }: { children: ReactNode }) {
  const { gameId, snap, setGame, setSnap, toasts, dismiss } = useGame();
  const router = useRouter();
  const path = usePathname();
  const [menu, setMenu] = useState(false);
  const busy = useRef(false);
  useEffect(() => {
    let id: string | null = null;
    try { id = localStorage.getItem("fe_game"); } catch { /* */ }
    if (!id) { router.replace("/"); return; }
    setGame(id);
  }, [router, setGame]);
  useEffect(() => {
    if (!gameId) return;
    let stop = false;
    const loop = async () => {
      if (stop) return;
      if (!busy.current) {
        busy.current = true;
        try {
          const r = await api<Snapshot & { ok?: boolean; error?: string }>(`/api/game/${gameId}/tick`, {});
          if ((r as { error?: string }).error) { if (r.ok === false) { setGame(null); router.replace("/"); return; } }
          else setSnap(r);
        } finally { busy.current = false; }
      }
      const paused = useGame.getState().snap?.paused;
      setTimeout(loop, paused ? 2500 : 1000);
    };
    loop();
    return () => { stop = true; };
  }, [gameId, setSnap, setGame, router]);
  useEffect(() => { setMenu(false); }, [path]);
  if (!snap) return <div className="flex min-h-screen items-center justify-center text-sm text-ink-400">Ouverture de la session de simulation…</div>;
  return (
    <div className="min-h-screen">
      <TopBar snap={snap} onMenu={() => setMenu(!menu)} />
      <div className="hidden md:block"><Ticker snap={snap} /></div>
      <div className="flex">
        <nav className={`${menu ? "block" : "hidden"} scroll-thin fixed inset-y-0 left-0 z-40 w-64 overflow-y-auto overscroll-contain border-r border-ink-700 bg-ink-950 p-3 pb-24 pt-4 lg:pb-3 lg:sticky lg:top-[88px] lg:block lg:h-[calc(100vh-88px-64px)]`}>
          <div className="mb-3 rounded-lg bg-ink-850 p-3"><div className="text-sm font-semibold">{snap.player.name}</div><div className="text-xs text-ink-300">{snap.player.title}</div>{snap.player.bank && <div className="mt-1 text-[11px]" style={{ color: snap.player.bankColor }}>{snap.player.bank}</div>}</div>
          <SideNav snap={snap} path={path} />
        </nav>
        {menu && <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setMenu(false)} />}
        <main className="min-w-0 flex-1 p-3 pb-28 md:p-5 md:pb-28">
          <BackBar path={path} />
          <Tutorial snap={snap} />
          {children}
          <div className="mt-8 border-t border-ink-800 pt-3"><Disclaimer /></div>
        </main>
      </div>
      <BottomNav snap={snap} path={path} />
      <MissionHelpPanel />
      <MeetingLauncher />
      <div className="fixed right-4 top-24 z-[60] space-y-2">{toasts.map((t) => <div key={t.id} onClick={() => dismiss(t.id)} className={`fade-in max-w-sm cursor-pointer rounded-lg border px-3 py-2 text-sm shadow-xl ${t.kind === "err" ? "border-red-500/40 bg-red-950/90 text-red-100" : t.kind === "ok" ? "border-green-500/40 bg-green-950/90 text-green-100" : "border-ink-600 bg-ink-850 text-ink-100"}`}>{t.text}</div>)}</div>
    </div>
  );
}
