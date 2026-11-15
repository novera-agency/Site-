import { test, expect, devices } from "@playwright/test";
const BASE = process.env.E2E_BASE ?? "";

test.use({ ...devices["iPhone 13"], defaultBrowserType: "chromium" });

test("mobile : aucun champ ni menu déroulant sous 16 px (pas de zoom automatique), échelle remise à 100 % en quittant un champ", async ({ page }) => {
  await page.addInitScript(() => { try { sessionStorage.setItem("fe_intro", "1"); } catch { /* */ } });
  await page.goto(BASE + "/");
  await page.getByTestId("new-career").click();
  const small = async (label: string) => {
    const bad = await page.evaluate(() => [...document.querySelectorAll("input, select, textarea")].filter((e) => { const i = e as HTMLInputElement; if (i.type === "checkbox" || i.type === "radio" || i.type === "range" || i.type === "hidden" || i.type === "file") return false; const r = e.getBoundingClientRect(); return r.width > 0 && parseFloat(getComputedStyle(e).fontSize) < 16; }).map((e) => `${e.tagName}${(e as HTMLInputElement).name ? "." + (e as HTMLInputElement).name : ""}`));
    expect(bad, label).toEqual([]);
  };
  await small("création de personnage");
  await page.getByTestId("next").click();
  await page.getByTestId("first-name").fill("Zoé");
  await page.getByTestId("last-name").fill("Zoom");
  await small("nom du personnage");
  // Verrouillage de l'échelle pendant la saisie, puis rétablissement
  const viewport = () => page.evaluate(() => (document.querySelector('meta[name="viewport"]') as HTMLMetaElement).content);
  const base = await viewport();
  await page.getByTestId("first-name").focus();
  expect(await viewport()).toContain("maximum-scale=1");
  await page.getByTestId("first-name").blur();
  await expect.poll(viewport, { timeout: 3000 }).toBe(base);
  for (let i = 0; i < 4; i++) await page.getByTestId("next").click();
  await page.getByTestId("create").click();
  await page.waitForURL(/\/play\/?$/);
  for (const path of ["/play/parametres", "/play/recherche", "/play/ordres", "/play/clients", "/play/vie", "/play/immobilier", "/play/portefeuille", "/play/transactions"]) {
    await page.goto(BASE + path);
    await page.locator("main h1").first().waitFor();
    await page.waitForTimeout(300);
    await small(path);
  }
});
