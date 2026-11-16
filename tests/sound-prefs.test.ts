import { describe, it, expect, beforeEach, vi } from "vitest";

/** localStorage minimal pour l'environnement de test */
const store = new Map<string, string>();
beforeEach(() => {
  store.clear();
  vi.resetModules();
  vi.stubGlobal("localStorage", { getItem: (k: string) => store.get(k) ?? null, setItem: (k: string, v: string) => void store.set(k, v), removeItem: (k: string) => void store.delete(k) });
});

describe("Réglages du son de l'appareil", () => {
  it("par défaut tout est activé ; le mode silencieux coupe tout, sans effacer les réglages détaillés", async () => {
    const m = await import("@/lib/sound-prefs");
    expect(m.getSoundPrefs()).toEqual({ muted: false, notif: true, call: true, voices: true });
    expect([m.notifOn(), m.callOn(), m.voicesOn()]).toEqual([true, true, true]);
    m.setSoundPrefs({ call: false });
    expect([m.notifOn(), m.callOn(), m.voicesOn()]).toEqual([true, false, true]);
    m.setSoundPrefs({ muted: true });
    expect([m.notifOn(), m.callOn(), m.voicesOn()]).toEqual([false, false, false]);
    m.setSoundPrefs({ muted: false });
    expect([m.notifOn(), m.callOn(), m.voicesOn()]).toEqual([true, false, true]); // le bip d'appel reste coupé
  });
  it("réglages conservés d'une visite à l'autre et valeurs abîmées ignorées", async () => {
    let m = await import("@/lib/sound-prefs");
    m.setSoundPrefs({ voices: false, notif: false });
    expect(JSON.parse(store.get("fe_sound")!)).toEqual({ muted: false, notif: false, call: true, voices: false });
    vi.resetModules();
    m = await import("@/lib/sound-prefs");
    expect(m.hasStoredSoundPrefs()).toBe(true);
    expect([m.notifOn(), m.callOn(), m.voicesOn()]).toEqual([false, true, false]);
    store.set("fe_sound", "{pas du json");
    vi.resetModules();
    m = await import("@/lib/sound-prefs");
    expect(m.getSoundPrefs()).toEqual({ muted: false, notif: true, call: true, voices: true });
  });
});
