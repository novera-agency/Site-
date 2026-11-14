import { z } from "zod";
import { withGame, json, err } from "@/server/http";
import { npcChat } from "@/server/ai";

const Body = z.object({ npcId: z.string().max(64), message: z.string().min(1).max(1200) });
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return err("Message invalide.");
  return withGame(id, async (rt) => json({ ok: true, ...(await npcChat(rt.state, parsed.data.npcId, parsed.data.message)) }));
}
