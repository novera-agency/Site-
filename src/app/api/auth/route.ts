import { z } from "zod";
import { getSession, setSession, clearSession, newGuest, register, login } from "@/server/auth";
import { json, err } from "@/server/http";

export async function GET() { const s = await getSession(); return json({ session: s ? { name: s.name, guest: s.guest } : null }); }
const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("guest") }),
  z.object({ action: z.literal("logout") }),
  z.object({ action: z.literal("register"), name: z.string().max(40), password: z.string().max(200) }),
  z.object({ action: z.literal("login"), name: z.string().max(40), password: z.string().max(200) }),
]);
export async function POST(req: Request) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return err("Requête invalide.");
  const b = parsed.data;
  if (b.action === "logout") { await clearSession(); return json({ ok: true }); }
  if (b.action === "guest") { const cur = await getSession(); const s = cur ?? newGuest(); await setSession(s); return json({ ok: true, session: { name: s.name, guest: s.guest } }); }
  const cur = await getSession();
  const r = b.action === "register" ? register(b.name, b.password, cur?.guest ? cur.uid : undefined) : login(b.name, b.password);
  if (typeof r === "string") return err(r, 400);
  await setSession(r);
  return json({ ok: true, session: { name: r.name, guest: false } });
}
