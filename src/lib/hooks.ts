"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { useGame } from "./store";
import { api } from "./api";
import type { Snapshot } from "@/server/views";

/** Charge une vue serveur et la rafraîchit quand le temps simulé avance (au plus toutes les `minMs`). */
export function useView<T = any>(name: string, params: Record<string, string | number | undefined> = {}, minMs = 1500, enabled = true) {
  const gameId = useGame((s) => s.gameId);
  const t = useGame((s) => s.snap?.t);
  const version = useGame((s) => s.viewVersion);
  const [data, setData] = useState<T | null>(null);
  const last = useRef(0);
  const key = JSON.stringify(params);
  const load = useCallback(async () => {
    if (!gameId || !enabled) return;
    const qs = new URLSearchParams({ name, ...Object.fromEntries(Object.entries(params).filter(([, v]) => v !== undefined).map(([k, v]) => [k, String(v)])) });
    last.current = Date.now();
    const d = await api<T>(`/api/game/${gameId}/view?${qs}`);
    setData(d);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameId, name, key, enabled]);
  useEffect(() => { setData(null); load(); }, [load]);
  useEffect(() => { if (Date.now() - last.current >= minMs) load(); }, [t, load, minMs]);
  // Après une action du joueur : rechargement immédiat (même en pause, même si la dernière lecture est récente)
  const seenVersion = useRef(version);
  useEffect(() => { if (version !== seenVersion.current) { seenVersion.current = version; load(); } }, [version, load]);
  return { data, reload: load };
}

export function useAction() {
  const gameId = useGame((s) => s.gameId);
  const setSnap = useGame((s) => s.setSnap);
  const toast = useGame((s) => s.toast);
  const bump = useGame((s) => s.bump);
  return useCallback(async (action: Record<string, unknown>, opts: { silent?: boolean } = {}) => {
    if (!gameId) return { ok: false, error: "Aucune partie" } as { ok: boolean; error?: string; message?: string; data?: any };
    const r = await api<{ ok: boolean; error?: string; message?: string; data?: any; snapshot?: Snapshot }>(`/api/game/${gameId}/action`, action);
    if (r.snapshot) setSnap(r.snapshot);
    if (!opts.silent) { if (!r.ok) toast("err", r.error ?? "Erreur"); else if (r.message) toast("ok", r.message); }
    bump();
    return r;
  }, [gameId, setSnap, toast, bump]);
}
