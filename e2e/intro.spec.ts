import { test, expect, type Page } from "@playwright/test";
const BASE = process.env.E2E_BASE ?? "";
const go = (page: Page, path: string) => page.goto(BASE + path);

test("écran d'accueil à l'arrivée : bouton Entrer, puis plus affiché pendant la session", async ({ page }) => {
  await go(page, "/");
  const intro = page.getByTestId("intro");
  await expect(intro).toBeVisible();
  await expect(intro).toContainText("FINANCIAL");
  await page.getByTestId("intro-enter").click();
  await expect(intro).toHaveCount(0);
  await expect(page.getByTestId("new-career")).toBeVisible();
  await page.reload();
  await expect(page.getByTestId("new-career")).toBeVisible();
  await expect(page.getByTestId("intro")).toHaveCount(0);
});

test("l'écran d'accueil se ferme tout seul après quelques secondes", async ({ page }) => {
  await go(page, "/");
  await expect(page.getByTestId("intro")).toBeVisible();
  await expect(page.getByTestId("intro")).toHaveCount(0, { timeout: 10000 });
});
