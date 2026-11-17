import { describe, it, expect } from "vitest";
import { game } from "./helpers";
import { advance } from "@/engine/engine";
import { serialize, serializeCompact, deserialize } from "@/engine/serialize";
import { makeCareerCode, readCareerCode, CareerCodeError } from "@/lib/career-code";

describe("Code de carrière", () => {
  it("aller-retour : la partie retrouvée est identique (hors historique de cours très ancien)", async () => {
    const s = game("carriere", "code-1");
    s.life!.physique = 61.5; s.career.stress = 44;
    const json = serializeCompact(s);
    const code = await makeCareerCode(json);
    expect(code.startsWith("FE1.")).toBe(true);
    expect(code).toMatch(/^FE1\.[0-9a-f]{8}\.[A-Za-z0-9_-]+$/); // texte simple, sans espace ni caractère spécial
    const back = deserialize(await readCareerCode(code));
    expect(back.profile.firstName).toBe(s.profile.firstName);
    expect(back.life!.physique).toBe(61.5);
    expect(back.career.stress).toBe(44);
    expect(back.t).toBe(s.t);
    expect(back.accounts.perso.id).toBe(s.accounts.perso.id);
  });
  it("tolère les retours à la ligne et les espaces ajoutés par un message ou un éditeur de texte", async () => {
    const code = await makeCareerCode(serializeCompact(game("carriere", "code-2")));
    const wrapped = code.replace(/(.{60})/g, "$1\n  ");
    expect(JSON.parse(await readCareerCode(wrapped)).profile).toBeTruthy();
  });
  it("détecte un code tronqué, modifié ou d'un autre format", async () => {
    const code = await makeCareerCode(serializeCompact(game("carriere", "code-3")));
    await expect(readCareerCode(code.slice(0, -40))).rejects.toThrow(CareerCodeError);
    const i = code.length - 100;
    const altered = code.slice(0, i) + (code[i] === "A" ? "B" : "A") + code.slice(i + 1);
    await expect(readCareerCode(altered)).rejects.toThrow(/incomplet ou modifié/);
    await expect(readCareerCode("bonjour")).rejects.toThrow(/commencer par/);
    await expect(readCareerCode("FE9.00000000.abcd")).rejects.toThrow(/autre version/);
  });
  it("le code compact est nettement plus court que la sauvegarde complète", () => {
    const s = game("carriere", "code-4");
    expect(serializeCompact(s).length).toBeLessThan(serialize(s).length * 0.3);
  });
  it("code court : le code reste sous 80 000 caractères et la partie relue continue de tourner", async () => {
    const s = game("carriere", "code-5"); s.paused = false;
    for (let i = 0; i < 10; i++) advance(s, 1440);
    const code = await makeCareerCode(serializeCompact(s));
    expect(code.length).toBeLessThan(80_000);
    const back = deserialize(await readCareerCode(code)); back.paused = false;
    expect(Object.keys(back.quotes).length).toBe(Object.keys(s.quotes).length);
    expect(back.quotes["XWLD"].price).toBeCloseTo(s.quotes["XWLD"].price, 1);
    const t = back.t; advance(back, 1440 * 3);
    expect(back.t).toBeGreaterThan(t);
  });
});
