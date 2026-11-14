import { NextResponse } from "next/server";
import { getSession, rateLimit, type Session } from "./auth";
import { getRuntime, markDirty, autosave } from "./store";

export const json = (data: unknown, status = 200) => NextResponse.json(data, { status, headers: { "Cache-Control": "no-store" } });
export const err = (message: string, status = 400) => json({ ok: false, error: message }, status);

export async function requireSession(): Promise<Session | NextResponse> {
  const s = await getSession();
  if (!s) return err("Session expirée : reconnectez-vous.", 401);
  if (!rateLimit(s.uid)) return err("Trop de requêtes, ralentissez.", 429);
  return s;
}
/** Exécute une opération sur une partie, sérialisée (Node traite chaque handler de manière synchrone sur l'état) */
export async function withGame<T>(id: string, fn: (rt: NonNullable<ReturnType<typeof getRuntime>>, session: Session) => T | Promise<T>, mutate = true) {
  const session = await requireSession();
  if (session instanceof NextResponse) return session;
  const rt = getRuntime(session.uid, id);
  if (!rt) return err("Partie introuvable ou non autorisée.", 404);
  try {
    const out = await fn(rt, session);
    if (mutate) { markDirty(id); autosave(id); }
    return out;
  } catch (e) {
    console.error("[game]", id, e);
    return err("Erreur interne de simulation. La partie a été préservée.", 500);
  }
}
