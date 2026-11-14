"use client";
import { use } from "react";
import { AssetPanel } from "@/components/AssetPanel";
export default function Page({ params }: { params: Promise<{ id: string }> }) { const { id } = use(params); return <AssetPanel id={decodeURIComponent(id)} />; }
