"use client";
import { useState } from "react";
import { useView } from "@/lib/hooks";
import { useGame } from "@/lib/store";
import { api } from "@/lib/api";
import { Card, PageTitle, Loading, Bar, Badge, Button, inputCls } from "@/components/ui";
import { fmtDateTime } from "@/engine/time";

export default function Reseau() {
  const { data, reload } = useView<any>("network", {}, 8000);
  const gameId = useGame((s) => s.gameId);
  const ai = useGame((s) => s.snap?.aiAvailable);
  const [sel, setSel] = useState<string | null>(null);
  const [msg, setMsg] = useState("");
  const [chat, setChat] = useState<Record<string, { me: boolean; text: string; meta?: string }[]>>({});
  const [busy, setBusy] = useState(false);
  if (!data) return <Loading />;
  const n = data.npcs.find((x: any) => x.id === sel) ?? data.npcs[0];
  const send = async () => {
    if (!msg.trim() || !n) return;
    setBusy(true);
    const text = msg; setMsg("");
    setChat((c) => ({ ...c, [n.id]: [...(c[n.id] ?? []), { me: true, text }] }));
    const r = await api<{ ok: boolean; reply?: string; source?: string; applied?: string[]; error?: string }>(`/api/game/${gameId}/ai`, { npcId: n.id, message: text });
    setChat((c) => ({ ...c, [n.id]: [...(c[n.id] ?? []), { me: false, text: r.reply ?? r.error ?? "…", meta: `${r.source === "ia" ? "IA" : "scénarisé"}${r.applied?.length ? " · " + r.applied.join(", ") : ""}` }] }));
    setBusy(false); reload();
  };
  return <>
    <PageTitle env="Relations professionnelles" title="Réseau et personnages" subtitle={`Chaque personnage a une personnalité, des objectifs, une mémoire et une opinion sur vous. Dialogue : ${ai ? "IA activée (côté serveur) — l'IA propose, le moteur valide." : "mode hors ligne scénarisé (aucune clé API configurée)."}`} />
    <div className="grid gap-4 xl:grid-cols-[360px_1fr]">
      <Card pad={false}><ul className="divide-y divide-ink-800">{data.npcs.map((x: any) => <li key={x.id}><button onClick={() => setSel(x.id)} className={`flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-ink-800 ${n?.id === x.id ? "bg-ink-800" : ""}`}><span className="text-2xl">{x.avatar}</span><div className="min-w-0 flex-1"><div className="truncate text-sm font-medium">{x.name}</div><div className="truncate text-[11px] text-ink-400">{x.role}</div><Bar value={x.trust} tone={x.trust < 35 ? "loss" : x.trust < 55 ? "warn" : "gain"} /></div></button></li>)}</ul></Card>
      {n && <div className="space-y-4">
        <Card title={`${n.avatar} ${n.name}`} right={<Badge>{n.relation}</Badge>}>
          <div className="text-sm text-ink-200">{n.role}</div><div className="mt-1 text-xs text-ink-300">{n.personality}</div>
          <div className="mt-2 grid grid-cols-3 gap-3 text-xs"><div>Confiance <b className="num">{Math.round(n.trust)}</b></div><div>Opinion : <b>{n.opinion}</b></div><div>Tolérance au risque <b className="num">{Math.round(n.riskTolerance * 100)}</b></div></div>
          <div className="mt-2 text-xs text-ink-400">Objectifs : {n.goals.join(" ; ")}</div>
          <div className="mt-3 text-[11px] uppercase text-ink-400">Mémoire</div><ul className="text-xs text-ink-300">{n.memory.length ? n.memory.slice(0, 8).map((m: any, i: number) => <li key={i}><span className="num text-ink-500">{fmtDateTime(m.t).slice(0, 10)}</span> {m.text} <span className={m.impact >= 0 ? "text-gain" : "text-loss"}>({m.impact >= 0 ? "+" : ""}{m.impact})</span></li>) : <li>Aucun souvenir marquant.</li>}</ul>
        </Card>
        <Card title="Conversation">
          <div className="scroll-thin mb-3 max-h-80 space-y-2 overflow-y-auto">{(chat[n.id] ?? []).map((m, i) => <div key={i} className={m.me ? "text-right" : ""}><div className={`inline-block max-w-[85%] rounded-lg px-3 py-2 text-sm ${m.me ? "bg-accent/20" : "bg-ink-800"}`}>{m.text}</div>{m.meta && <div className="text-[10px] text-ink-500">{m.meta}</div>}</div>)}</div>
          <div className="flex gap-2"><input value={msg} onChange={(e) => setMsg(e.target.value)} onKeyDown={(e) => e.key === "Enter" && send()} placeholder={`Écrire à ${n.name}… (ex. « Que pensez-vous de notre exposition aux taux ? »)`} className={inputCls} /><Button onClick={send} disabled={busy}>Envoyer</Button></div>
        </Card>
      </div>}
    </div>
  </>;
}
