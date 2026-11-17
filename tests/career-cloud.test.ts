import { describe, it, expect, vi, beforeEach } from "vitest";

describe("Code de carrière court (base en ligne)", () => {
  beforeEach(() => { vi.resetModules(); vi.unstubAllEnvs(); vi.unstubAllGlobals(); });
  it("codes de 10 signes sans caractères ambigus, tolérants à la casse et au tiret", async () => {
    const { newShortCode, normalizeShortCode } = await import("@/lib/career-cloud");
    for (let i = 0; i < 200; i++) { const c = newShortCode(); expect(c).toMatch(/^[A-HJ-NP-Z2-9]{5}-[A-HJ-NP-Z2-9]{5}$/); expect(normalizeShortCode(c)).toBe(c.replace("-", "")); expect(normalizeShortCode(c.toLowerCase().replace("-", " "))).toBe(c.replace("-", "")); }
    expect(normalizeShortCode("abc")).toBeNull(); expect(normalizeShortCode("AAAAA-AAAA0")).toBeNull();
    expect(new Set(Array.from({ length: 500 }, () => newShortCode())).size).toBe(500);
  });
  it("non configuré : refuse proprement", async () => {
    const m = await import("@/lib/career-cloud");
    expect(m.cloudConfigured()).toBe(false);
    await expect(m.cloudPush("ABCDE-FGHJK", "x")).rejects.toThrow(/pas configurée/);
  });
  it("configuré : envoie et relit via les fonctions de la base, sans jamais viser la table", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://exemple.supabase.co/"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "cle-publique");
    const calls: { url: string; body: Record<string, string>; headers: Record<string, string> }[] = [];
    vi.stubGlobal("fetch", vi.fn(async (url: string, init: { body: string; headers: Record<string, string> }) => {
      const body = JSON.parse(init.body); calls.push({ url, body, headers: init.headers });
      return new Response(url.endsWith("career_get") ? JSON.stringify(body.p_code === "ABCDEFGHJK" ? "payload" : null) : null, { status: url.endsWith("career_get") ? 200 : 204 });
    }));
    const m = await import("@/lib/career-cloud");
    expect(m.cloudConfigured()).toBe(true);
    await m.cloudPush("abcde-fghjk", "payload");
    expect(calls[0].url).toBe("https://exemple.supabase.co/rest/v1/rpc/career_put");
    expect(calls[0].body).toEqual({ p_code: "ABCDEFGHJK", p_data: "payload" });
    expect(calls[0].headers.apikey).toBe("cle-publique");
    expect(await m.cloudPull("ABCDE-FGHJK")).toBe("payload");
    expect(await m.cloudPull("ZZZZZ-ZZZZZ")).toBeNull();
    await expect(m.cloudPull("trop court")).rejects.toThrow(/10 signes/);
  });
  it("base qui refuse : erreur claire", async () => {
    vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://exemple.supabase.co"); vi.stubEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY", "k");
    vi.stubGlobal("fetch", vi.fn(async () => new Response("{}", { status: 401 })));
    const m = await import("@/lib/career-cloud");
    await expect(m.cloudPull("ABCDE-FGHJK")).rejects.toThrow(/refusé/);
  });
});
