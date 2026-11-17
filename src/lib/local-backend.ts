"use client";
/**
 * Édition navigateur (GitHub Pages) : implémentation locale des routes /api/* avec le même moteur,
 * les mêmes validations (Zod) et les mêmes vues. Persistance dans IndexedDB.
 * Limite assumée : sans serveur, l'état réside dans le navigateur du joueur (pas d'autorité serveur).
 */
import { createGame, advanceBudget, restartLegacyGame, SAVE_GEN } from "@/engine/engine";
import { serialize, serializeCompact, deserialize } from "@/engine/serialize";
import { STEP_MIN } from "@/engine/time";
import { BANK_BY_ID } from "@/engine/data/banks";
import { scriptedReply } from "@/engine/dialogue";
import { ActionSchema, applyAction } from "@/server/actions";
import { snapshot, buildView } from "@/server/views";
import type { GameState } from "@/engine/types";

const DB = "financial-empire", STORE = "saves", OWNER = "local";
function db(): Promise<IDBDatabase> {
  return new Promise((res, rej) => { const r = indexedDB.open(DB, 1); r.onupgradeneeded = () => r.result.createObjectStore(STORE); r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
}
async function idb<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest): Promise<T> {
  const d = await db();
  return new Promise((res, rej) => { const tx = d.transaction(STORE, mode); const rq = fn(tx.objectStore(STORE)); rq.onsuccess = () => res(rq.result as T); rq.onerror = () => rej(rq.error); });
}
const put = (k: string, v: unknown) => idb<void>("readwrite", (s) => s.put(v, k));
const get = <T>(k: string) => idb<T | undefined>("readonly", (s) => s.get(k));
const del = (k: string) => idb<void>("readwrite", (s) => s.delete(k));
const keys = () => idb<string[]>("readonly", (s) => s.getAllKeys());

interface Meta { gameId: string; name: string; mode: string; bank: string; t: number; updatedAt: string; slot?: number; difficulty: string; epochYear?: number; rank?: string; }
const metaOf = (s: GameState, slot?: number): Meta => ({ gameId: s.id, name: s.name, mode: s.mode, bank: s.career.bankId, t: s.t, epochYear: s.epochYear, updatedAt: s.updatedAt, slot, difficulty: s.difficulty, rank: s.career.employed ? `${s.career.track} · rang ${s.career.rank}` : s.company ? s.company.name : "—" });

interface Runtime { state: GameState; lastTickReal: number; accMinutes: number; dirty: boolean; lastSaved: number; }
const games = new Map<string, Runtime>();
async function save(rt: Runtime) { rt.state.updatedAt = new Date().toISOString(); await put(`game:${rt.state.id}`, serialize(rt.state)); await put(`meta:${rt.state.id}`, metaOf(rt.state)); rt.dirty = false; rt.lastSaved = Date.now(); }
async function runtime(id: string): Promise<Runtime | null> {
  let rt = games.get(id);
  if (!rt) {
    const txt = await get<string>(`game:${id}`);
    if (!txt) return null;
    let s = deserialize(txt); s.paused = true; s.pauseReason = "Partie reprise";
    // Partie créée avec une ancienne version : recommencée une fois au 3 janvier 2000 (mode historique)
    const fresh = restartLegacyGame(s);
    if (fresh) { await put(`legacy:${id}`, txt); /* copie de secours de l'ancienne partie */ s = fresh; s.paused = true; s.pauseReason = "Partie recommencée en 2000"; }
    rt = { state: s, lastTickReal: Date.now(), accMinutes: 0, dirty: !!fresh, lastSaved: Date.now() };
    games.set(id, rt);
    if (fresh) await save(rt);
  }
  return rt;
}
if (typeof window !== "undefined") {
  setInterval(() => { for (const rt of games.values()) if (rt.dirty && Date.now() - rt.lastSaved > 10000) save(rt).catch(console.error); }, 5000);
  document.addEventListener("visibilitychange", () => { if (document.visibilityState === "hidden") for (const rt of games.values()) if (rt.dirty) save(rt).catch(console.error); });
}
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`);

export async function localApi(url: string, body?: any): Promise<unknown> {
  const path = url.split("?")[0];
  const qs = new URLSearchParams(url.split("?")[1] ?? "");
  try {
    if (path === "/api/auth") return body ? { ok: true, session: { name: "Joueur local", guest: true } } : { session: { name: "Joueur local", guest: true } };
    if (path === "/api/saves") {
      if (!body) {
        const all = await keys();
        const metas = await Promise.all(all.filter((k) => k.startsWith("meta:") || k.startsWith("slotmeta:")).map(async (k) => [k, await get<Meta>(k)] as const));
        const gamesM = metas.filter(([k]) => k.startsWith("meta:")).map(([, m]) => m!).map((m) => (games.get(m.gameId) ? metaOf(games.get(m.gameId)!.state) : m)).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        return { games: gamesM, slots: metas.filter(([k]) => k.startsWith("slotmeta:")).map(([, m]) => m!).sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0)) };
      }
      switch (body.action) {
        case "save_slot": { const rt = await runtime(body.gameId); if (!rt || body.slot < 1 || body.slot > 3) return { ok: false, error: "Sauvegarde impossible." }; await save(rt); await put(`slot:${body.slot}`, serialize(rt.state)); await put(`slotmeta:${body.slot}`, metaOf(rt.state, body.slot)); return { ok: true, message: `Partie sauvegardée dans l'emplacement ${body.slot}.` }; }
        case "load_slot": { const txt = await get<string>(`slot:${body.slot}`); if (!txt) return { ok: false, error: "Emplacement vide." }; const s = deserialize(txt); s.flags["gen"] = Math.max(Number(s.flags["gen"] ?? 0), SAVE_GEN); /* une sauvegarde chargée volontairement n'est jamais remise à zéro */ s.paused = true; s.pauseReason = "Sauvegarde chargée"; const rt = { state: s, lastTickReal: Date.now(), accMinutes: 0, dirty: true, lastSaved: 0 }; games.set(s.id, rt); await save(rt); return { ok: true, gameId: s.id }; }
        case "delete": games.delete(body.gameId); await del(`game:${body.gameId}`); await del(`meta:${body.gameId}`); return { ok: true };
        case "export_code": { const rt = await runtime(body.gameId); return rt ? { ok: true, data: serializeCompact(rt.state) } : { ok: false, error: "Partie introuvable." }; }
        case "export_json": { const rt = await runtime(body.gameId); return rt ? { ok: true, data: serialize(rt.state) } : { ok: false, error: "Partie introuvable." }; }
        case "import": { const s = deserialize(body.data); s.flags["gen"] = Math.max(Number(s.flags["gen"] ?? 0), SAVE_GEN); s.ownerId = OWNER; s.id = uuid(); s.paused = true; const rt = { state: s, lastTickReal: Date.now(), accMinutes: 0, dirty: true, lastSaved: 0 }; games.set(s.id, rt); await save(rt); return { ok: true, gameId: s.id }; }
      }
      return { ok: false, error: "Requête invalide." };
    }
    if (path === "/api/game/new") {
      const b = body;
      const bank = BANK_BY_ID[b.bankId];
      if (!bank) return { ok: false, error: "Banque inconnue." };
      if (b.mode === "carriere" && !bank.tracks.includes(b.track)) return { ok: false, error: `${bank.name} ne recrute pas ce métier.` };
      const capital = b.mode === "carriere" ? (b.startingCapital === 10000 || b.difficulty === "debutant" ? 10000 : b.startingCapital) : b.startingCapital;
      const s = createGame({ ownerId: OWNER, mode: b.mode, difficulty: b.difficulty, profile: b.profile, bankId: bank.id, track: b.track, startingCapital: capital, seed: b.seed, challengeId: b.challengeId, settings: b.minutesPerSecond ? { minutesPerSecond: b.minutesPerSecond } : undefined, historical: !!b.historical });
      s.id = uuid();
      const rt = { state: s, lastTickReal: Date.now(), accMinutes: 0, dirty: true, lastSaved: 0 };
      games.set(s.id, rt); await save(rt);
      return { ok: true, gameId: s.id };
    }
    const m = path.match(/^\/api\/game\/([^/]+)\/(tick|action|view|ai)$/);
    if (!m) return { ok: false, error: "Route inconnue." };
    const rt = await runtime(m[1]);
    if (!rt) return { ok: false, error: "Partie introuvable." };
    const s = rt.state;
    if (m[2] === "tick") {
      const now = Date.now();
      const elapsed = Math.min(3000, Math.max(0, now - rt.lastTickReal));
      rt.lastTickReal = now;
      if (!s.paused && s.speed > 0) {
        rt.accMinutes += (elapsed / 1000) * s.speed * s.settings.minutesPerSecond;
        const steps = Math.min(600, Math.floor(rt.accMinutes / STEP_MIN));
        let lag = false;
        // Calcul limité à ~150 ms par seconde : sur un téléphone lent, le temps ralentit au lieu de figer l'écran
        if (steps > 0) { const done = advanceBudget(s, steps * STEP_MIN, 150); rt.accMinutes -= done * STEP_MIN; rt.dirty = true; lag = done < steps && !s.paused; rt.accMinutes = Math.min(rt.accMinutes, 36 * STEP_MIN); }
        if (s.paused) rt.accMinutes = 0;
        if (rt.dirty && Date.now() - rt.lastSaved > 4000) await save(rt);
        return { ...snapshot(s, false), lag };
      } else rt.accMinutes = 0;
      if (rt.dirty && Date.now() - rt.lastSaved > 4000) await save(rt);
      return snapshot(s, false);
    }
    if (m[2] === "view") return buildView(s, qs.get("name") ?? "dashboard", Object.fromEntries(qs.entries()));
    if (m[2] === "action") {
      const parsed = ActionSchema.safeParse(body);
      if (!parsed.success) return { ok: false, error: "Action invalide : " + parsed.error.issues.slice(0, 3).map((i) => `${i.path.join(".")} ${i.message}`).join(" ; ") };
      const r = applyAction(s, parsed.data);
      rt.dirty = true;
      if (parsed.data.type !== "read" && parsed.data.type !== "tutorial_visit") await save(rt); // une action validée est immédiatement persistée
      return { ...r, snapshot: snapshot(s, false) };
    }
    const npc = s.npcs[body?.npcId];
    if (!npc) return { ok: false, error: "Interlocuteur introuvable." };
    const msg = String(body.message ?? "").slice(0, 1200);
    const key = `chat:${npc.id}:${Math.floor(s.t / 60)}`;
    s.eventCooldowns[key] = (s.eventCooldowns[key] ?? 0) + 1;
    rt.dirty = true;
    return { ok: true, ...scriptedReply(s, npc, msg, s.eventCooldowns[key]) };
  } catch (e) {
    console.error(e);
    return { ok: false, error: "Erreur interne de simulation." };
  }
}
