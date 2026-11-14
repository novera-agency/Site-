"use client";
import { create } from "zustand";
import type { Snapshot } from "@/server/views";

export interface Toast { id: number; kind: "ok" | "err" | "info"; text: string; }
interface S {
  gameId: string | null; snap: Snapshot | null; meetingOpen: string | null; setMeetingOpen: (id: string | null) => void;
  helpMission: string | null; helpMin: boolean; setHelp: (id: string | null, min?: boolean) => void; toasts: Toast[]; viewVersion: number;
  setGame: (id: string | null) => void; setSnap: (s: Snapshot) => void; toast: (kind: Toast["kind"], text: string) => void; dismiss: (id: number) => void; bump: () => void;
}
let tid = 0;
export const useGame = create<S>((set) => ({
  gameId: null, snap: null, toasts: [], viewVersion: 0, meetingOpen: null, setMeetingOpen: (id) => set({ meetingOpen: id }),
  helpMission: null, helpMin: false,
  setHelp: (id, min = false) => set((st) => { try { if (st.gameId) localStorage.setItem(`fe_help_${st.gameId}`, JSON.stringify({ id, min })); } catch { /* stockage indisponible */ } return { helpMission: id, helpMin: min }; }),
  setGame: (id) => { let help: { id: string | null; min: boolean } = { id: null, min: false }; try { if (id) help = JSON.parse(localStorage.getItem(`fe_help_${id}`) ?? "null") ?? help; } catch { /* */ } set({ gameId: id, helpMission: help.id, helpMin: help.min }); try { if (id) localStorage.setItem("fe_game", id); else localStorage.removeItem("fe_game"); } catch { /* stockage indisponible */ } },
  setSnap: (snap) => set({ snap }),
  toast: (kind, text) => { const id = ++tid; set((st) => ({ toasts: [...st.toasts.slice(-3), { id, kind, text }] })); setTimeout(() => set((st) => ({ toasts: st.toasts.filter((t) => t.id !== id) })), 5000); },
  dismiss: (id) => set((st) => ({ toasts: st.toasts.filter((t) => t.id !== id) })),
  bump: () => set((st) => ({ viewVersion: st.viewVersion + 1 })),
}));
