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
import { Badge, Disclaimer } from "./ui";
import type { Snapshot } from "@/server/views";

const NAV: { group: string; items: [string, string, string][] }[] = [
  { group: "Bureau", items: [["/play", "Bureau personnel", "🏢"], ["/play/agenda", "Agenda", "🗓️"], ["/play/messagerie", "Messagerie", "✉️"], ["/play/reunions", "Réunions", "🤝"]] },
  { group: "Marchés", items: [["/play/terminal", "Salle des marchés", "📈"], ["/play/recherche", "Recherche d'instruments", "🔎"], ["/play/ordres", "Passage d'ordres", "🧾"], ["/play/options", "Options", "🎛️"], ["/play/structures", "Produits structurés", "🧩"]] },
  { group: "Portefeuille", items: [["/play/portefeuille", "Portefeuille", "💼"], ["/play/transactions", "Transactions & grand livre", "📒"], ["/play/risques", "Gestion des risques", "🛡️"], ["/play/patrimoine", "Patrimoine personnel", "🏦"]] },
  { group: "Informations", items: [["/play/actualites", "Actualités", "📰"], ["/play/calendrier", "Calendrier économique", "📅"], ["/play/macro", "Macroéconomie", "🌍"]] },
  { group: "Carrière", items: [["/play/carriere", "Tableau de bord carrière", "🏆"], ["/play/clients", "Clients", "👥"], ["/play/missions", "Missions", "🎯"], ["/play/competences", "Compétences", "🧠"], ["/play/reputation", "Réputation & décisions", "⭐"], ["/play/reseau", "Relations professionnelles", "🕸️"], ["/play/rh", "Ressources humaines", "📋"], ["/play/remuneration", "Rémunération", "💶"], ["/play/banques", "Établissements", "🏛️"]] },
  { group: "Entreprise", items: [["/play/entreprise", "Entrepreneuriat & société", "🚀"]] },
  { group: "Formation", items: [["/play/formation", "Centre de formation", "🎓"], ["/play/dictionnaire", "Dictionnaire financier", "📖"]] },
  { group: "Système", items: [["/play/parametres", "Paramètres", "⚙️"], ["/play/sauvegardes", "Sauvegardes", "💾"]] },
];
const SPEEDS = [1, 2, 5, 10, 25, 50, 100];

function TopBar({ snap, onMenu }: { snap: Snapshot; onMenu: () => void }) {
  const act = useAction();
  const [bell, setBell] = useState(false);
  const [skip, setSkip] = useState(false);
  return (
    <div className="sticky top-0 z-30 border-b border-ink-700 bg-ink-950/95 backdrop-blur">
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2 px-3 py-2">
        <button onClick={onMenu} className="rounded-md bg-ink-800 px-2 py-1 text-sm lg:hidden" aria-label="Menu">☰</button>
        <Link href="/play" className="hidden text-sm font-bold tracking-[0.18em] text-white sm:block">FINANCIAL<span className="text-gold"> EMPIRE</span></Link>
        <div className="flex items-center gap-2">
          <div className="text-right"><div className="num text-lg font-semibold leading-none text-white">{fmtTime(snap.t)}</div><div className="text-[11px] capitalize text-ink-300">{fmtDate(snap.t)}</div></div>
          <div className="flex items-center gap-1" data-testid="speed-controls">
            <button data-testid="play-pause" onClick={() => act({ type: "pause", paused: !snap.paused }, { silent: true })} className={`rounded-md px-2.5 py-1.5 text-sm font-semibold ${snap.paused ? "bg-green-600 text-white" : "bg-amber-500 text-black"}`} title={snap.paused ? "Reprendre" : "Pause"}>{snap.paused ? "▶" : "❚❚"}</button>
            {SPEEDS.map((x) => <button key={x} data-testid={`speed-${x}`} onClick={() => act({ type: "speed", speed: x }, { silent: true })} className={`num rounded px-1.5 py-1 text-[11px] ${snap.speed === x && !snap.paused ? "bg-accent text-white" : snap.speed === x ? "bg-ink-600 text-white" : "bg-ink-800 text-ink-300 hover:text-white"}`}>x{x}</button>)}
            <div className="relative">
              <button onClick={() => setSkip(!skip)} className="rounded bg-ink-800 px-2 py-1 text-[11px] text-ink-200 hover:text-white">⏭</button>
              {skip && <div className="absolute left-0 top-full z-50 mt-1 w-56 rounded-md border border-ink-600 bg-ink-850 p-1 shadow-xl">{[["next_event", "Jusqu'au prochain rendez-vous"], ["next_hour", "Avancer d'une heure"], ["market_open", "Jusqu'à l'ouverture (9 h)"], ["next_morning", "Jusqu'à demain 7 h 30"]].map(([k, l]) => <button key={k} onClick={() => { setSkip(false); act({ type: "skip", to: k }); }} className="block w-full rounded px-2 py-1.5 text-left text-xs hover:bg-ink-700">{l}</button>)}</div>}
            </div>
          </div>
        </div>
        <div className="hidden items-center gap-1.5 md:flex">{snap.sessions.filter((x) => ["EU", "US", "ASIA", "CRYPTO"].includes(x.id)).map((x) => <span key={x.id} title={x.label} className="flex items-center gap-1 text-[11px] text-ink-300"><span className={`h-1.5 w-1.5 rounded-full ${x.open ? "bg-gain" : "bg-ink-500"}`} />{x.id}</span>)}</div>
        <Badge tone={snap.crisisActive ? "loss" : "info"}>{snap.regimeLabel}</Badge>
        <span className="hidden text-[11px] text-ink-300 md:inline">Volatilité <span className="num text-ink-100">{snap.vix}</span></span>
        <div className="ml-auto flex items-center gap-4">
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

function Tutorial({ snap }: { snap: Snapshot }) {
  const [hide, setHide] = useState(false);
  if (!snap.tutorial || hide) return null;
  const done = snap.tutorial.filter((x) => x.done).length;
  return <div className="mb-4 rounded-lg border border-gold/40 bg-gradient-to-r from-yellow-900/20 to-transparent p-3">
    <div className="mb-2 flex items-center justify-between"><div className="text-xs font-semibold uppercase tracking-wider text-gold">Première journée — {done}/12 étapes</div><button onClick={() => setHide(true)} className="text-xs text-ink-400">masquer</button></div>
    <div className="flex flex-wrap gap-1.5">{snap.tutorial.map((s) => <span key={s.id} className={`rounded px-2 py-0.5 text-[11px] ${s.done ? "bg-green-600/20 text-green-300 line-through" : "bg-ink-800 text-ink-200"}`}>{s.id}. {s.label}</span>)}</div>
  </div>;
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
      <Ticker snap={snap} />
      <div className="flex">
        <nav className={`${menu ? "block" : "hidden"} scroll-thin fixed inset-y-0 left-0 z-40 w-64 overflow-y-auto border-r border-ink-700 bg-ink-950 p-3 pt-4 lg:sticky lg:top-[88px] lg:block lg:h-[calc(100vh-88px)]`}>
          <div className="mb-3 rounded-lg bg-ink-850 p-3"><div className="text-sm font-semibold">{snap.player.name}</div><div className="text-xs text-ink-300">{snap.player.title}</div>{snap.player.bank && <div className="mt-1 text-[11px]" style={{ color: snap.player.bankColor }}>{snap.player.bank}</div>}</div>
          {NAV.map((g) => <div key={g.group} className="mb-3"><div className="mb-1 px-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-ink-500">{g.group}</div>{g.items.map(([href, label, icon]) => <Link key={href} href={href} className={`flex items-center gap-2 rounded-md px-2 py-1.5 text-[13px] ${path === href ? "bg-ink-700 text-white" : "text-ink-300 hover:bg-ink-800 hover:text-white"}`}><span className="w-5 text-center">{icon}</span>{label}</Link>)}</div>)}
          <Link href="/" className="mt-2 block px-2 text-xs text-ink-400 hover:text-white">← Menu principal</Link>
        </nav>
        {menu && <div className="fixed inset-0 z-30 bg-black/50 lg:hidden" onClick={() => setMenu(false)} />}
        <main className="min-w-0 flex-1 p-3 md:p-5">
          <Tutorial snap={snap} />
          {children}
          <div className="mt-8 border-t border-ink-800 pt-3"><Disclaimer /></div>
        </main>
      </div>
      <MeetingLauncher />
      <div className="fixed right-4 top-24 z-[60] space-y-2">{toasts.map((t) => <div key={t.id} onClick={() => dismiss(t.id)} className={`fade-in max-w-sm cursor-pointer rounded-lg border px-3 py-2 text-sm shadow-xl ${t.kind === "err" ? "border-red-500/40 bg-red-950/90 text-red-100" : t.kind === "ok" ? "border-green-500/40 bg-green-950/90 text-green-100" : "border-ink-600 bg-ink-850 text-ink-100"}`}>{t.text}</div>)}</div>
    </div>
  );
}
