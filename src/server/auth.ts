/** Authentification : comptes locaux (scrypt) ou invité, session dans un cookie signé HMAC (httpOnly, SameSite=Lax). */
import { createHmac, randomBytes, scryptSync, timingSafeEqual, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { cookies } from "next/headers";
import { dataDir } from "./store";

const COOKIE = "fe_session";
function secret() {
  const s = process.env.SESSION_SECRET;
  if (s && s !== "change-me-in-production") return s;
  // Secret local persistant (dev) : généré une fois, jamais exposé au client
  const f = path.join(dataDir(), ".session_secret");
  if (!fs.existsSync(f)) { fs.mkdirSync(path.dirname(f), { recursive: true }); fs.writeFileSync(f, randomBytes(32).toString("hex"), { mode: 0o600 }); }
  return fs.readFileSync(f, "utf8");
}
function sign(payload: string) { return createHmac("sha256", secret()).update(payload).digest("base64url"); }
export interface Session { uid: string; name: string; guest: boolean; exp: number; }
export function encodeSession(s: Session) { const p = Buffer.from(JSON.stringify(s)).toString("base64url"); return `${p}.${sign(p)}`; }
export function decodeSession(v: string | undefined): Session | null {
  if (!v) return null;
  const [p, sig] = v.split(".");
  if (!p || !sig) return null;
  const exp = sign(p);
  if (exp.length !== sig.length || !timingSafeEqual(Buffer.from(exp), Buffer.from(sig))) return null;
  try { const s = JSON.parse(Buffer.from(p, "base64url").toString()) as Session; return s.exp > Date.now() ? s : null; } catch { return null; }
}
export async function getSession(): Promise<Session | null> { const c = await cookies(); return decodeSession(c.get(COOKIE)?.value); }
export async function setSession(s: Session) {
  const c = await cookies();
  c.set(COOKIE, encodeSession(s), { httpOnly: true, sameSite: "lax", secure: process.env.NODE_ENV === "production", path: "/", maxAge: 60 * 60 * 24 * 30 });
}
export async function clearSession() { const c = await cookies(); c.delete(COOKIE); }
export function newGuest(): Session { return { uid: `g_${randomUUID()}`, name: "Invité", guest: true, exp: Date.now() + 30 * 864e5 }; }

interface UserRec { uid: string; name: string; salt: string; hash: string; createdAt: string; }
const usersFile = () => path.join(dataDir(), "users.json");
function readUsers(): Record<string, UserRec> { try { return JSON.parse(fs.readFileSync(usersFile(), "utf8")); } catch { return {}; } }
function writeUsers(u: Record<string, UserRec>) { fs.mkdirSync(dataDir(), { recursive: true }); fs.writeFileSync(usersFile(), JSON.stringify(u, null, 1), { mode: 0o600 }); }
export function register(name: string, password: string, adoptUid?: string): Session | string {
  const key = name.trim().toLowerCase();
  if (!/^[a-z0-9_.-]{3,24}$/.test(key)) return "Identifiant : 3 à 24 caractères (lettres, chiffres, . _ -).";
  if (password.length < 8) return "Mot de passe : 8 caractères minimum.";
  const users = readUsers();
  if (users[key]) return "Cet identifiant existe déjà.";
  const salt = randomBytes(16).toString("hex");
  const hash = scryptSync(password, salt, 64).toString("hex");
  const uid = adoptUid ?? `u_${randomUUID()}`;
  users[key] = { uid, name: name.trim(), salt, hash, createdAt: new Date().toISOString() };
  writeUsers(users);
  return { uid, name: name.trim(), guest: false, exp: Date.now() + 30 * 864e5 };
}
export function login(name: string, password: string): Session | string {
  const u = readUsers()[name.trim().toLowerCase()];
  if (!u) return "Identifiants invalides.";
  const h = scryptSync(password, u.salt, 64);
  if (!timingSafeEqual(h, Buffer.from(u.hash, "hex"))) return "Identifiants invalides.";
  return { uid: u.uid, name: u.name, guest: false, exp: Date.now() + 30 * 864e5 };
}

/** Limitation de débit simple (seau à jetons en mémoire, par session) */
const buckets = new Map<string, { tokens: number; t: number }>();
export function rateLimit(key: string, perSec = 25, burst = 60) {
  const now = Date.now();
  const b = buckets.get(key) ?? { tokens: burst, t: now };
  b.tokens = Math.min(burst, b.tokens + ((now - b.t) / 1000) * perSec);
  b.t = now;
  if (b.tokens < 1) { buckets.set(key, b); return false; }
  b.tokens -= 1; buckets.set(key, b);
  return true;
}
