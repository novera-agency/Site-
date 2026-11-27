/**
 * Code de carrière COURT (ex. « K7M2P-9XQ4T ») : la partie est enregistrée dans une base en ligne (Supabase) et le code n'en est que la clé.
 * Configuration (clé « anon » publique par conception) : NEXT_PUBLIC_SUPABASE_URL et NEXT_PUBLIC_SUPABASE_ANON_KEY. Voir supabase/careers.sql.
 * Le code donne accès à la partie : à ne partager avec personne.
 */
const URL_ = (process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").replace(/\/+$/, "");
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "";
export const cloudConfigured = () => !!URL_ && !!KEY;

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // 32 signes, sans I, O, 0, 1 (ambigus)
/** Nouveau code aléatoire de 10 signes (32^10 ≈ 10^15 possibilités), affiché « XXXXX-XXXXX » */
export function newShortCode(): string {
  const b = new Uint8Array(10); crypto.getRandomValues(b);
  const c = Array.from(b, (x) => ALPHABET[x & 31]).join("");
  return `${c.slice(0, 5)}-${c.slice(5)}`;
}
/** Remet un code saisi à la forme stockée : majuscules, sans tiret ni espace. Renvoie null s'il est invalide. */
export function normalizeShortCode(raw: string): string | null {
  const c = raw.toUpperCase().replace(/[\s-]+/g, "");
  return /^[A-HJ-NP-Z2-9]{10}$/.test(c) ? c : null;
}
export const formatShortCode = (c: string) => `${c.slice(0, 5)}-${c.slice(5)}`;

export class CloudError extends Error {}
async function rpc(fn: string, body: Record<string, string>): Promise<unknown> {
  if (!cloudConfigured()) throw new CloudError("La base en ligne n'est pas configurée sur ce site.");
  let res: Response;
  try { res = await fetch(`${URL_}/rest/v1/rpc/${fn}`, { method: "POST", headers: { "Content-Type": "application/json", apikey: KEY, Authorization: `Bearer ${KEY}` }, body: JSON.stringify(body) }); }
  catch { throw new CloudError("Base injoignable : vérifiez la connexion."); }
  if (!res.ok) throw new CloudError(`La base a refusé la demande (${res.status}).`);
  return res.status === 204 ? null : res.json().catch(() => null);
}
/** Enregistre (ou met à jour) la partie sous ce code */
export async function cloudPush(code: string, payload: string) {
  const c = normalizeShortCode(code); if (!c) throw new CloudError("Code invalide.");
  await rpc("career_put", { p_code: c, p_data: payload });
}
/** Récupère la partie enregistrée sous ce code (null si le code n'existe pas) */
export async function cloudPull(code: string): Promise<string | null> {
  const c = normalizeShortCode(code); if (!c) throw new CloudError("Ce code n'est pas valide : il comporte 10 signes (lettres et chiffres), par exemple K7M2P-9XQ4T.");
  const r = await rpc("career_get", { p_code: c });
  return typeof r === "string" && r ? r : null;
}

/* ── Lien partie ↔ code (sur cet appareil) ── */
const LK = "fe_cc_";
export const linkedCode = (gameId: string): string | null => { try { return localStorage.getItem(LK + gameId); } catch { return null; } };
export const linkCode = (gameId: string, code: string) => { try { localStorage.setItem(LK + gameId, code); } catch { /* */ } };

/** Envoie un retour de joueur (anonyme : aucune donnée de la partie n'est jointe) */
export async function cloudFeedback(kind: "bug" | "comprehension" | "idee", body: string) {
  const text = body.trim();
  if (text.length < 5) throw new CloudError("Écrivez au moins quelques mots.");
  if (text.length > 1500) throw new CloudError("Message trop long (1 500 caractères au maximum).");
  await rpc("feedback_put", { p_kind: kind, p_body: text });
}
