import { z } from "zod";
import { NextResponse } from "next/server";
import { requireSession, json, err } from "@/server/http";
import { listSaves, saveToSlot, loadSlot, deleteGame, exportGame, importGame } from "@/server/store";

export async function GET() {
  const s = await requireSession();
  if (s instanceof NextResponse) return s;
  return json(listSaves(s.uid));
}
const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("save_slot"), gameId: z.string().max(64), slot: z.number().int().min(1).max(3) }),
  z.object({ action: z.literal("load_slot"), slot: z.number().int().min(1).max(3) }),
  z.object({ action: z.literal("delete"), gameId: z.string().max(64) }),
  z.object({ action: z.literal("export"), gameId: z.string().max(64) }),
  z.object({ action: z.literal("import"), data: z.string().max(40_000_000) }),
]);
export async function POST(req: Request) {
  const s = await requireSession();
  if (s instanceof NextResponse) return s;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return err("Requête invalide.");
  const b = parsed.data;
  try {
    switch (b.action) {
      case "save_slot": return saveToSlot(s.uid, b.gameId, b.slot) ? json({ ok: true, message: `Partie sauvegardée dans l'emplacement ${b.slot}.` }) : err("Sauvegarde impossible.");
      case "load_slot": { const id = loadSlot(s.uid, b.slot); return id ? json({ ok: true, gameId: id }) : err("Emplacement vide."); }
      case "delete": deleteGame(s.uid, b.gameId); return json({ ok: true });
      case "export": { const d = exportGame(s.uid, b.gameId); return d ? new NextResponse(d, { headers: { "Content-Type": "application/json", "Content-Disposition": `attachment; filename="financial-empire-${b.gameId.slice(0, 8)}.json"` } }) : err("Partie introuvable.", 404); }
      case "import": return json({ ok: true, gameId: importGame(s.uid, b.data) });
    }
  } catch (e) { console.error(e); return err("Fichier de sauvegarde invalide ou incompatible."); }
}
