import { test, expect, type Page } from "@playwright/test";
const BASE = process.env.E2E_BASE ?? "";
const go = (page: Page, path: string) => page.goto(BASE + path);

/** Appareil simulé avec plusieurs voix françaises de qualités différentes */
const fakeVoices = `
  const mk = (name, local) => ({ name, lang: "fr-FR", localService: local, voiceURI: name, default: false });
  const list = [mk("Eddy (Français (France))", true), mk("Thomas", true), mk("Google français", false), mk("Microsoft Denise Online (Natural) - French (France)", false), mk("Microsoft Henri Online (Natural) - French (France)", false)];
  window.__spoken = [];
  window.SpeechSynthesisUtterance = class { constructor(t) { this.text = t; this.lang = ""; this.voice = null; this.pitch = 1; this.rate = 1; this.volume = 1; } };
  if (window.speechSynthesis) {
    window.speechSynthesis.getVoices = () => list;
    window.speechSynthesis.speak = (u) => { window.__spoken.push((u.voice ? u.voice.name : "défaut") + "|" + u.text); setTimeout(() => u.onstart && u.onstart(), 5); setTimeout(() => u.onend && u.onend(), 30); };
    window.speechSynthesis.cancel = () => {};
  }
  try { sessionStorage.setItem("fe_intro", "1"); } catch {}
`;

test("voix naturelles utilisées en priorité, choix des voix dans les paramètres", async ({ page }) => {
  await page.addInitScript(fakeVoices);
  await go(page, "/");
  await page.getByTestId("new-career").click();
  await page.getByTestId("epoch-fictif").click();
  await page.getByTestId("next").click();
  await page.getByTestId("first-name").fill("Vic");
  await page.getByTestId("last-name").fill("Toire");
  for (let i = 0; i < 4; i++) await page.getByTestId("next").click();
  await page.getByTestId("create").click();
  await page.waitForURL(/\/play\/?$/);
  await go(page, "/play/parametres");
  const list = page.getByTestId("voice-list");
  await expect(list).toBeVisible({ timeout: 15000 });
  const first = list.locator(":scope > div > div").first();
  await expect(first).toContainText("Natural");
  await expect(first).toContainText("naturelle");
  // Le test du son utilise les deux voix naturelles, une par personnage
  await page.getByTestId("sound-test-run").click();
  await page.waitForFunction(() => (window as unknown as { __spoken: string[] }).__spoken.filter((x) => x.includes("Vous m'entendez") || x.includes("autre voix")).length >= 2);
  const spoken = await page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken.filter((x) => x.includes("Vous m'entendez") || x.includes("autre voix")));
  expect(spoken[0]).toMatch(/Natural/);
  expect(spoken[1]).toMatch(/Natural/);
  expect(spoken[0].split("|")[0]).not.toBe(spoken[1].split("|")[0]);
  // Choix manuel : seule la voix Thomas
  await list.getByLabel("Utiliser Thomas").check();
  await page.getByTestId("sound-test-run").click();
  await page.waitForFunction(() => (window as unknown as { __spoken: string[] }).__spoken.filter((x) => x.startsWith("Thomas|")).length >= 1);
  await page.reload();
  await expect(page.getByTestId("voice-list").getByLabel("Utiliser Thomas")).toBeChecked();
});
