"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useGame } from "@/lib/store";
import { itemOf } from "./nav";
import type { Room } from "./OfficeScene";
import { OfficeView } from "./OfficeView";
import { defaultAvatar } from "@/engine/avatar";
import { tr } from "@/lib/i18n";

/** Les 7 pièces de la banque : chacune regroupe des écrans du jeu */
const ZONES: (Omit<Room, "badge"> & { hrefs: string[] })[] = [
  { id: "bureau", slot: 0, kind: "directeur", icon: "🏢", label: "Mon bureau", sub: "Journée et messages", hrefs: ["/play/missions", "/play/agenda", "/play/planning", "/play/reunions", "/play/messagerie", "/play/actualites", "/play/parcours"] },
  { id: "marches", slot: 1, kind: "marches", icon: "📈", label: "Salle des marchés", sub: "Cours et ordres", hrefs: ["/play/terminal", "/play/recherche", "/play/ordres", "/play/options", "/play/structures"] },
  { id: "coffre", slot: 2, kind: "conseil", icon: "🛡️", label: "Salle du conseil", sub: "Portefeuille et risques", hrefs: ["/play/portefeuille", "/play/transactions", "/play/risques", "/play/calendrier", "/play/macro"] },
  { id: "academie", slot: 3, kind: "archives", icon: "🎓", label: "Académie", sub: "Carrière et formation", hrefs: ["/play/carriere", "/play/competences", "/play/formation", "/play/culture", "/play/dictionnaire", "/play/entreprise"] },
  { id: "relations", slot: 4, kind: "openspace", icon: "👥", label: "Open space", sub: "Relations", hrefs: ["/play/reseau", "/play/clients", "/play/reputation", "/play/rh", "/play/banques"] },
  { id: "perso", slot: 5, kind: "honneur", icon: "🏠", label: "Suite privée", sub: "Vie personnelle", hrefs: ["/play/vie", "/play/remuneration", "/play/immobilier", "/play/patrimoine", "/play/garde-robe"] },
  { id: "options", slot: 6, kind: "conciergerie", icon: "⚙️", label: "Conciergerie", sub: "Options", hrefs: ["/play/parametres", "/play/sauvegardes", "/"] },
];

/** Hub du jeu : on touche une pièce, le personnage y marche, puis ses écrans s'affichent */
export function OfficeHub() {
  const snap = useGame((s) => s.snap);
  const [sel, setSel] = useState<string | null>(null);
  const [full, setFull] = useState(false);
  useEffect(() => { if (!full) return; const k = (e: KeyboardEvent) => { if (e.key === "Escape") setFull(false); }; window.addEventListener("keydown", k); return () => window.removeEventListener("keydown", k); }, [full]);
  const badges: Record<string, number> = snap ? { bureau: snap.unreadMsgs + snap.missionsActive } : {};
  const rooms: Room[] = ZONES.map((z) => ({ ...z, label: tr(z.label), sub: tr(z.sub ?? ""), badge: badges[z.id] || undefined }));
  const zone = ZONES.find((z) => z.id === sel);
  return <section className="mb-4" aria-label={tr("Plan de la banque")} data-testid="office-hub">
    <OfficeView rooms={rooms} avatar={snap?.player.avatar ?? defaultAvatar()} selected={sel} label={tr("Plan de la banque")} onArrive={setSel} fullscreen={full} onToggleFullscreen={() => setFull((f) => !f)}>
      <div className={full ? "pointer-events-auto absolute inset-x-3 bottom-14 max-h-[42vh] overflow-y-auto sm:bottom-4 sm:left-auto sm:right-4 sm:w-[min(520px,92vw)]" : "mt-3"} aria-live="polite">
        {zone ? <div className="rounded-xl border border-gold/40 bg-ink-850 p-3" data-testid="room-panel">
          <div className="mb-2 flex items-center justify-between gap-2"><h2 className="text-sm font-semibold text-gold">{zone.icon} {tr(zone.label)}</h2><button onClick={() => setSel(null)} className="text-xs text-ink-400 underline hover:text-white">{tr("Fermer")}</button></div>
          <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-3">{zone.hrefs.map((h) => { const it = itemOf(h); return it ? <Link key={h} href={h} className="flex items-center gap-3 rounded-lg border border-ink-700 bg-ink-900 px-3 py-2 hover:border-gold"><span className="text-xl" aria-hidden>{it.icon}</span><span className="min-w-0"><span className="block text-sm font-medium text-white">{tr(it.label)}</span><span className="block truncate text-[11px] text-ink-400">{tr(it.desc)}</span></span></Link> : null; })}</div>
        </div> : <p className="text-center text-xs text-ink-400">{tr("Touchez une pièce : votre personnage s'y rend et vous montre ses écrans.")}</p>}
      </div>
    </OfficeView>
  </section>;
}
