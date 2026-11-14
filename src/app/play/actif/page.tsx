"use client";
import { Suspense } from "react";
import { useSearchParams } from "next/navigation";
import { AssetPanel } from "@/components/AssetPanel";
function Inner() { const id = useSearchParams().get("id") ?? "XWLD"; return <AssetPanel key={id} id={id} />; }
export default function Page() { return <Suspense><Inner /></Suspense>; }
