"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { api } from "@/lib/api";
import { Button, Card, Empty, Badge } from "./ui";
import { fmtDateFor } from "@/engine/time";

interface Meta { gameId: string; name: string; mode: string; bank: string; t: number; updatedAt: string; slot?: number; difficulty: string; epochYear?: number; rank?: string; }
export function SavesManager({ currentGameId }: { currentGameId?: string | null }) {
  const router = useRouter();
  const [d, setD] = useState<{ games: Meta[]; slots: Meta[] } | null>(null);
  const [msg, setMsg] = useState("");
  const load = async () => { await api("/api/auth", { action: "guest" }); setD(await api("/api/saves")); };
  useEffect(() => { load(); }, []);
  const open = (id: string) => { try { localStorage.setItem("fe_game", id); } catch { /* */ } router.push("/play"); if (typeof window !== "undefined" && window.location.pathname.startsWith("/play")) window.location.reload(); };
  const post = async (body: Record<string, unknown>) => { const r = await api<{ ok: boolean; error?: string; message?: string; gameId?: string }>("/api/saves", body); setMsg(r.ok ? r.message ?? "OK" : r.error ?? "Erreur"); await load(); return r; };
  const exportGame = async (id: string) => { const r = await api<{ ok: boolean; data?: string; error?: string }>("/api/saves", { action: "export_json", gameId: id }); if (!r.ok || !r.data) { setMsg(r.error ?? "Export impossible"); return; } const blob = new Blob([r.data], { type: "application/json" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = `financial-empire-${id.slice(0, 8)}.json`; a.click(); };
  const importGame = async (f: File) => { const txt = await f.text(); const r = await post({ action: "import", data: txt }); if (r.ok && r.gameId) open(r.gameId); };
  if (!d) return <div className="text-sm text-ink-400">Chargement…</div>;
  return <div className="space-y-4">
    {msg && <div className="rounded-md bg-ink-800 px-3 py-2 text-sm">{msg}</div>}
    <Card title="Parties (sauvegarde automatique)" right={process.env.NEXT_PUBLIC_STATIC ? "Sauvegarde automatique dans ce navigateur (IndexedDB)" : "Sauvegarde automatique toutes les ~20 s de jeu actif"}>
      {d.games.length === 0 ? <Empty>Aucune partie.</Empty> : <div className="space-y-2">{d.games.map((g) => <div key={g.gameId} className="flex flex-wrap items-center justify-between gap-2 rounded-md bg-ink-900 px-3 py-2">
        <div><div className="font-medium">{g.name} {g.gameId === currentGameId && <Badge tone="info">en cours</Badge>}</div><div className="text-xs text-ink-400">{g.mode} · {g.difficulty} · {g.rank} · jeu : {fmtDateFor(g.t, g.epochYear, false)} · {new Date(g.updatedAt).toLocaleString("fr-FR")}</div></div>
        <div className="flex flex-wrap gap-1">{g.gameId !== currentGameId && <Button size="sm" data-testid="open-save" onClick={() => open(g.gameId)}>Reprendre</Button>}{[1, 2, 3].map((n) => <Button key={n} size="sm" variant="ghost" onClick={() => post({ action: "save_slot", gameId: g.gameId, slot: n })}>→ Empl. {n}</Button>)}<Button size="sm" variant="outline" onClick={() => exportGame(g.gameId)}>Exporter</Button>{g.gameId !== currentGameId && <Button size="sm" variant="danger" onClick={() => { if (confirm("Supprimer définitivement cette partie ?")) post({ action: "delete", gameId: g.gameId }); }}>Supprimer</Button>}</div>
      </div>)}</div>}
    </Card>
    <Card title="Emplacements manuels">
      <div className="grid gap-2 md:grid-cols-3">{[1, 2, 3].map((n) => { const s = d.slots.find((x) => x.slot === n); return <div key={n} className="rounded-md border border-ink-700 bg-ink-900 p-3"><div className="text-xs uppercase tracking-wider text-ink-400">Emplacement {n}</div>{s ? <><div className="font-medium">{s.name}</div><div className="text-xs text-ink-400">Jeu : {fmtDateFor(s.t, s.epochYear, false)}</div><Button size="sm" className="mt-2" onClick={async () => { const r = await post({ action: "load_slot", slot: n }); if (r.ok && r.gameId) open(r.gameId); }}>Charger</Button></> : <div className="text-sm text-ink-500">Vide</div>}</div>; })}</div>
    </Card>
    <Card title="Importer une sauvegarde"><input type="file" aria-label="Choisir un fichier de sauvegarde (.json)" accept="application/json" onChange={(e) => e.target.files?.[0] && importGame(e.target.files[0])} className="w-full max-w-full text-sm" /><p className="mt-1 text-xs text-ink-400">Les sauvegardes sont versionnées et migrées automatiquement vers la version courante du jeu.</p></Card>
  </div>;
}
