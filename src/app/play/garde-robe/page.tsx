"use client";
import { useEffect, useState } from "react";
import { useGame } from "@/lib/store";
import { useAction } from "@/lib/hooks";
import { Button, Card, Loading, PageTitle } from "@/components/ui";
import { AvatarEditor } from "@/components/AvatarEditor";
import { type Avatar, lockedParts } from "@/engine/avatar";

export default function GardeRobe() {
  const snap = useGame((s) => s.snap);
  const act = useAction();
  const [draft, setDraft] = useState<Avatar | null>(null);
  const [msg, setMsg] = useState("");
  useEffect(() => { if (snap && !draft) setDraft(snap.player.avatar); }, [snap, draft]);
  if (!snap || !draft) return <Loading />;
  const rank = snap.player.rank;
  const locked = lockedParts(draft, rank);
  const dirty = JSON.stringify(draft) !== JSON.stringify(snap.player.avatar);
  const save = async () => { const r = await act({ type: "set_avatar", avatar: draft as unknown as Record<string, number | boolean> }); setMsg(r?.ok === false ? (r.error ?? "Impossible d'enregistrer.") : "Apparence enregistrée : elle apparaît dans le hall, les réunions et les messages."); };
  return <>
    <PageTitle env="Vie personnelle" title="Garde-robe" subtitle="Votre apparence. Costumes, montres et accessoires plus prestigieux se débloquent en montant en grade." />
    <Card>
      <AvatarEditor avatar={draft} onChange={(a) => { setDraft(a); setMsg(""); }} rank={rank} />
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Button data-testid="avatar-save" disabled={!dirty || locked.length > 0} onClick={save}>Enregistrer l&apos;apparence</Button>
        {dirty && <Button variant="ghost" onClick={() => setDraft(snap.player.avatar)}>Annuler</Button>}
        {locked.length > 0 && <span className="text-xs text-amber-300">Pas encore débloqué : {locked.join(", ")}.</span>}
        {msg && <span role="status" className="text-xs text-gold">{msg}</span>}
      </div>
    </Card>
  </>;
}
