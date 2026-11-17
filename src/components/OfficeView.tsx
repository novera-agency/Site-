"use client";
import { useEffect, useState, type ReactNode } from "react";
import type { Avatar } from "@/engine/avatar";
import { OfficeScene, type Room } from "./OfficeScene";
import { LobbyStage, webglOK } from "./Stage3D";

/** Le hall de la banque : en 3D (avec l'avatar du joueur) quand l'appareil le permet, sinon le plan 2D */
export function OfficeView({ rooms, avatar, arrival = false, selected, onArrive, label, onArrived, children }: {
  rooms: Room[]; avatar: Avatar; arrival?: boolean; selected?: string | null; onArrive: (id: string) => void; label: string; onArrived?: () => void; children?: ReactNode;
}) {
  const [mode, setMode] = useState<"?" | "3d" | "2d">("?");
  useEffect(() => { setMode(webglOK() ? "3d" : "2d"); }, []);
  useEffect(() => { if (mode === "2d") onArrived?.(); }, [mode]); // eslint-disable-line react-hooks/exhaustive-deps
  if (mode === "?") return <div className="mx-auto aspect-[16/9] w-full max-w-5xl rounded-2xl border border-gold/20 bg-[#0a0f1d]" aria-hidden />;
  if (mode === "2d") return <OfficeScene rooms={rooms} selected={selected} label={label} onArrive={onArrive}>{children}</OfficeScene>;
  return <LobbyStage rooms={rooms} avatar={avatar} arrival={arrival} selected={selected} label={label} onArrive={onArrive} onFail={() => setMode("2d")}>{children}</LobbyStage>;
}
