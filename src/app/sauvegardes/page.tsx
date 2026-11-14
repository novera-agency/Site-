import Link from "next/link";
import { SavesManager } from "@/components/SavesManager";
export default function Page() { return <div className="grid-bg min-h-screen"><div className="mx-auto max-w-4xl space-y-4 px-4 py-8"><Link href="/" className="text-sm text-ink-400">← Menu</Link><h1 className="text-2xl font-semibold">Continuer une carrière</h1><SavesManager /></div></div>; }
