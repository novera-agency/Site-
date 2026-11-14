import { withGame, json } from "@/server/http";
import { buildView } from "@/server/views";

export async function GET(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const { id } = await ctx.params;
  const url = new URL(req.url);
  const name = url.searchParams.get("name") ?? "dashboard";
  const params = Object.fromEntries(url.searchParams.entries());
  return withGame(id, (rt) => json(buildView(rt.state, name, params)), false);
}
