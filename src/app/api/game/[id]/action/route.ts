import { withGame, json, err } from "@/server/http";
import { ActionSchema, applyAction } from "@/server/actions";
import { snapshot } from "@/server/views";

export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const body = await req.json().catch(() => null);
  const parsed = ActionSchema.safeParse(body);
  if (!parsed.success) return err("Action invalide : " + parsed.error.issues.slice(0, 3).map((i) => `${i.path.join(".")} ${i.message}`).join(" ; "));
  return withGame(id, (rt) => {
    const r = applyAction(rt.state, parsed.data);
    return json({ ...r, snapshot: snapshot(rt.state) }, r.ok ? 200 : 422);
  });
}
