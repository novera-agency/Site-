"use client";
import { SavesManager } from "@/components/SavesManager";
import { PageTitle } from "@/components/ui";
import { useGame } from "@/lib/store";
export default function Page() { const id = useGame((s) => s.gameId); return <><PageTitle title="Sauvegardes" subtitle="Le serveur conserve l'état complet : marchés, graines aléatoires, comptes, relations, missions." /><SavesManager currentGameId={id} /></>; }
