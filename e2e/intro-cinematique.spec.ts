import { test, expect, type Page } from "@playwright/test";
const BASE = process.env.E2E_BASE ?? "";
const prep = (page: Page, force3d: boolean) => page.addInitScript((f) => { try { sessionStorage.setItem("fe_intro", "1"); localStorage.setItem("fe_tour", "1"); if (f) localStorage.setItem("fe_3d", "1"); } catch { /* */ } }, force3d);
async function createCareer(page: Page) {
  await page.goto(BASE + "/nouvelle");
  await page.getByTestId("next").click();
  await page.getByTestId("first-name").fill("Camille");
  await page.getByTestId("last-name").fill("Cinema");
  for (let i = 0; i < 4; i++) await page.getByTestId("next").click();
  await page.getByTestId("create").click();
}

test("introduction cinématographique : jouée à la création d'une partie (3D), passable, jamais rejouée", async ({ page }) => {
  test.setTimeout(240000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await prep(page, true);
  await createCareer(page);
  await page.waitForURL(/\/play\/?$/, { timeout: 90000 });
  await expect(page.getByTestId("intro-cinematic")).toBeVisible({ timeout: 30000 });
  await expect(page.getByTestId("intro-canvas")).toBeVisible();
  await expect(page.getByTestId("intro-skip")).toBeVisible();
  await expect(page.getByTestId("intro-mute")).toBeVisible();
  await page.keyboard.press("Escape"); // passer
  await expect(page.getByTestId("intro-cinematic")).toBeHidden({ timeout: 30000 });
  await expect(page.getByText("Bonjour Camille")).toBeVisible({ timeout: 30000 }); // le jeu est immédiatement jouable
  // pas de répétition : la clé est consommée dès le départ, un rechargement ne rejoue rien
  expect(await page.evaluate(() => localStorage.getItem("fe_intro_new"))).toBeNull();
  await page.reload();
  await page.waitForTimeout(6000);
  await expect(page.getByTestId("intro-cinematic")).toHaveCount(0);
  expect(errors).toEqual([]);
});

test("introduction : sans 3D (navigateur automatisé par défaut), la partie démarre directement et la clé est consommée", async ({ page }) => {
  test.setTimeout(240000);
  await prep(page, false);
  await createCareer(page);
  await page.waitForURL(/\/play\/?$/, { timeout: 90000 });
  await expect(page.getByText("Bonjour Camille")).toBeVisible({ timeout: 150000 });
  await expect(page.getByTestId("intro-cinematic")).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("fe_intro_new"))).toBeNull();
});
