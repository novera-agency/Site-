/**
 * SaveGameEngine — persistance serveur. Le serveur fait autorité : l'état de chaque partie vit en mémoire
 * (verrou logique : Node exécute chaque requête de façon atomique sur l'état), est sauvegardé automatiquement
 * sur disque (JSON compacté, écriture atomique via fichier temporaire + rename) et dans 3 emplacements manuels.
 */
import fs from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import type { GameState } from "@/engine/types";

export function dataDir() { return process.env.SAVE_DIR || path.join(process.cwd(), "data"); }
const savesDir = (uid: string) => path.join(dataDir(), "saves", uid.replace(/[^a-zA-Z0-9_-]/g, ""));

interface Runtime { state: GameState; lastTickReal: number; accMinutes: number; dirty: boolean; lastSaved: number; }
const g = globalThis as unknown as { __fe_games?: Map<string, Runtime> };
const games: Map<string, Runtime> = g.__fe_games ?? (g.__fe_games = new Map());

import { serialize, deserialize } from "@/engine/serialize";
export { serialize, deserialize };

function atomicWrite(file: string, content: string) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const tmp = `${file}.${process.pid}.tmp`;
  fs.writeFileSync(tmp, content);
  fs.renameSync(tmp, file);
}

export function registerGame(s: GameState) {
  s.id = s.id || randomUUID();
  games.set(s.id, { state: s, lastTickReal: Date.now(), accMinutes: 0, dirty: true, lastSaved: 0 });
  autosave(s.id, true);
  return s.id;
}
export function getRuntime(uid: string, gameId: string): Runtime | null {
  let rt = games.get(gameId);
  if (!rt) {
    const f = path.join(savesDir(uid), `game_${gameId.replace(/[^a-zA-Z0-9-]/g, "")}.json`);
    if (!fs.existsSync(f)) return null;
    const s = deserialize(fs.readFileSync(f, "utf8"));
    s.paused = true; s.pauseReason = "Partie reprise";
    rt = { state: s, lastTickReal: Date.now(), accMinutes: 0, dirty: false, lastSaved: Date.now() };
    games.set(gameId, rt);
  }
  if (rt.state.ownerId !== uid) return null; // autorisation : un joueur n'accède qu'à ses parties
  return rt;
}
export function autosave(gameId: string, force = false) {
  const rt = games.get(gameId);
  if (!rt) return;
  if (!force && (!rt.dirty || Date.now() - rt.lastSaved < 20000)) return;
  rt.state.updatedAt = new Date().toISOString();
  const f = path.join(savesDir(rt.state.ownerId), `game_${gameId}.json`);
  atomicWrite(f, serialize(rt.state));
  writeMeta(rt.state, f);
  rt.dirty = false; rt.lastSaved = Date.now();
}
export function markDirty(gameId: string) { const rt = games.get(gameId); if (rt) rt.dirty = true; }

export interface SaveMeta { gameId: string; name: string; mode: string; bank: string; t: number; updatedAt: string; slot?: number; difficulty: string; epochYear?: number; wealth?: number; rank?: string; }
function metaOf(s: GameState, slot?: number): SaveMeta { return { gameId: s.id, name: s.name, mode: s.mode, bank: s.career.bankId, t: s.t, epochYear: s.epochYear, updatedAt: s.updatedAt, slot, difficulty: s.difficulty, rank: s.career.employed ? `${s.career.track} · rang ${s.career.rank}` : s.company ? s.company.name : "—" }; }
export function listSaves(uid: string) {
  const dir = savesDir(uid);
  if (!fs.existsSync(dir)) return { games: [] as SaveMeta[], slots: [] as SaveMeta[] };
  const out: SaveMeta[] = [], slots: SaveMeta[] = [];
  for (const f of fs.readdirSync(dir)) {
    if (!f.endsWith(".json")) continue;
    const metaFile = path.join(dir, f.replace(".json", ".meta"));
    let meta: SaveMeta | null = null;
    if (fs.existsSync(metaFile)) { try { meta = JSON.parse(fs.readFileSync(metaFile, "utf8")); } catch { /* ignore */ } }
    if (!meta) { try { const s = deserialize(fs.readFileSync(path.join(dir, f), "utf8")); meta = metaOf(s); fs.writeFileSync(metaFile, JSON.stringify(meta)); } catch { continue; } }
    if (f.startsWith("slot_")) slots.push({ ...meta, slot: Number(f.slice(5, 6)) }); else out.push(meta);
  }
  // la mémoire est plus fraîche que le disque
  for (const m of out) { const rt = games.get(m.gameId); if (rt) Object.assign(m, metaOf(rt.state)); }
  out.sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
  return { games: out, slots: slots.sort((a, b) => (a.slot ?? 0) - (b.slot ?? 0)) };
}
export function writeMeta(s: GameState, file: string, slot?: number) { fs.writeFileSync(file.replace(".json", ".meta"), JSON.stringify(metaOf(s, slot))); }
export function saveToSlot(uid: string, gameId: string, slot: number) {
  const rt = getRuntime(uid, gameId);
  if (!rt || slot < 1 || slot > 3) return false;
  autosave(gameId, true);
  writeMeta(rt.state, path.join(savesDir(uid), `game_${gameId}.json`));
  const f = path.join(savesDir(uid), `slot_${slot}.json`);
  atomicWrite(f, serialize(rt.state));
  writeMeta(rt.state, f, slot);
  return true;
}
/** Restaure un emplacement : remplace l'état de la partie correspondante */
export function loadSlot(uid: string, slot: number): string | null {
  const f = path.join(savesDir(uid), `slot_${slot}.json`);
  if (!fs.existsSync(f)) return null;
  const s = deserialize(fs.readFileSync(f, "utf8"));
  if (s.ownerId !== uid) return null;
  s.paused = true; s.pauseReason = "Sauvegarde chargée";
  games.set(s.id, { state: s, lastTickReal: Date.now(), accMinutes: 0, dirty: true, lastSaved: 0 });
  autosave(s.id, true);
  return s.id;
}
export function deleteGame(uid: string, gameId: string) {
  const f = path.join(savesDir(uid), `game_${gameId.replace(/[^a-zA-Z0-9-]/g, "")}.json`);
  if (fs.existsSync(f)) fs.unlinkSync(f);
  const m = f.replace(".json", ".meta"); if (fs.existsSync(m)) fs.unlinkSync(m);
  games.delete(gameId);
}
export function exportGame(uid: string, gameId: string) { const rt = getRuntime(uid, gameId); return rt ? serialize(rt.state) : null; }
export function importGame(uid: string, txt: string) {
  const s = deserialize(txt);
  s.ownerId = uid; s.id = randomUUID(); s.paused = true;
  return registerGame(s);
}
/** Sauvegarde périodique de toutes les parties actives */
const tg = globalThis as unknown as { __fe_timer?: NodeJS.Timeout };
if (!tg.__fe_timer) {
  tg.__fe_timer = setInterval(() => { for (const id of games.keys()) { try { autosave(id); } catch (e) { console.error("autosave", e); } } }, 15000);
  tg.__fe_timer.unref?.();
}
