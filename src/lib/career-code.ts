/**
 * Code de carrière : toute la partie, compressée (gzip) puis écrite en texte (base64 « url-safe »), avec une somme de contrôle.
 * Format : `FE1.<somme de contrôle hexadécimale>.<données>`. Se copie / se colle, ou se transporte dans un fichier .txt.
 * Le code contient la partie entière (nom du personnage compris) : à ne partager avec personne.
 */
export const CODE_PREFIX = "FE1";

const crc32 = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) { let c = i; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; table[i] = c >>> 0; }
  return (bytes: Uint8Array) => { let c = 0xffffffff; for (let i = 0; i < bytes.length; i++) c = table[(c ^ bytes[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; };
})();

async function pipe(bytes: Uint8Array, stream: { writable: WritableStream<Uint8Array>; readable: ReadableStream<Uint8Array> }) {
  const w = stream.writable.getWriter(); void w.write(bytes as Uint8Array<ArrayBuffer>); void w.close();
  const chunks: Uint8Array[] = []; const r = stream.readable.getReader(); let n = 0;
  for (;;) { const { value, done } = await r.read(); if (done) break; chunks.push(value); n += value.length; }
  const out = new Uint8Array(n); let o = 0; for (const c of chunks) { out.set(c, o); o += c.length; }
  return out;
}
const toB64Url = (b: Uint8Array) => { let s = ""; const step = 0x8000; for (let i = 0; i < b.length; i += step) s += String.fromCharCode(...b.subarray(i, i + step)); return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, ""); };
const fromB64Url = (s: string) => { const b = atob(s.replace(/-/g, "+").replace(/_/g, "/")); const out = new Uint8Array(b.length); for (let i = 0; i < b.length; i++) out[i] = b.charCodeAt(i); return out; };

export const careerCodeSupported = () => typeof CompressionStream !== "undefined" && typeof DecompressionStream !== "undefined";

/** Transforme le texte JSON d'une partie en code de carrière */
export async function makeCareerCode(json: string): Promise<string> {
  const gz = await pipe(new TextEncoder().encode(json), new CompressionStream("gzip") as unknown as { writable: WritableStream<Uint8Array>; readable: ReadableStream<Uint8Array> });
  return `${CODE_PREFIX}.${crc32(gz).toString(16).padStart(8, "0")}.${toB64Url(gz)}`;
}

export class CareerCodeError extends Error {}
/** Relit un code : renvoie le JSON de la partie, ou lève une erreur explicite (code incomplet, modifié, d'un autre format) */
export async function readCareerCode(raw: string): Promise<string> {
  const code = raw.replace(/\s+/g, "");
  const m = /^(FE\d+)\.([0-9a-f]{8})\.([A-Za-z0-9_-]+)$/.exec(code);
  if (!m) throw new CareerCodeError("Ce texte n'est pas un code de carrière (il doit commencer par « FE1. »).");
  if (m[1] !== CODE_PREFIX) throw new CareerCodeError("Ce code vient d'une autre version du jeu.");
  let gz: Uint8Array;
  try { gz = fromB64Url(m[3]); } catch { throw new CareerCodeError("Code illisible : des caractères manquent ou ont été modifiés."); }
  if (crc32(gz).toString(16).padStart(8, "0") !== m[2]) throw new CareerCodeError("Code incomplet ou modifié : copiez-le en entier, sans rien ajouter ni retirer.");
  let json: string;
  try { json = new TextDecoder().decode(await pipe(gz, new DecompressionStream("gzip") as unknown as { writable: WritableStream<Uint8Array>; readable: ReadableStream<Uint8Array> })); } catch { throw new CareerCodeError("Code corrompu : impossible de le décompresser."); }
  if (!json.startsWith("{")) throw new CareerCodeError("Le code ne contient pas une partie valide.");
  return json;
}
