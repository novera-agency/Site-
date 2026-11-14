"use client";
/** Client d'API. En édition navigateur (NEXT_PUBLIC_STATIC), les requêtes sont servies localement par le même moteur. */
export const STATIC = !!process.env.NEXT_PUBLIC_STATIC;
export async function api<T = unknown>(url: string, body?: unknown): Promise<T> {
  if (STATIC) {
    const { localApi } = await import("./local-backend");
    return (await localApi(url, body)) as T;
  }
  const res = await fetch(url, { method: body === undefined ? "GET" : "POST", headers: body === undefined ? undefined : { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body), cache: "no-store" });
  const data = await res.json().catch(() => ({ ok: false, error: "Réponse invalide du serveur." }));
  if (res.status === 401 && typeof window !== "undefined") window.location.href = "/";
  return data as T;
}
