import { test, expect, type Page } from "@playwright/test";
const BASE = process.env.E2E_BASE ?? "";
const go = (page: Page, path: string) => page.goto(BASE + path);

test("croix de retour et investissement immobilier : achat à crédit à Saint-Étienne, mise en location", async ({ page }) => {
  await go(page, "/");
  await page.getByTestId("new-career").click();
  await page.getByTestId("epoch-fictif").click();
  await page.getByTestId("next").click();
  await page.getByTestId("first-name").fill("Ines");
  await page.getByTestId("last-name").fill("Pierre");
  for (let i = 0; i < 4; i++) await page.getByTestId("next").click();
  await page.getByTestId("create").click();
  await page.waitForURL(/\/play\/?$/);
  await expect(page.getByTestId("bottom-nav")).toBeVisible({ timeout: 20000 });
  // Croix : sous-page → page de la catégorie → bureau
  await expect(page.getByTestId("back-x")).toHaveCount(0);
  await go(page, "/play/portefeuille");
  await page.getByTestId("back-x").click();
  await expect(page).toHaveURL(/\/play\/pro\/?$/);
  await page.getByTestId("back-x").click();
  await expect(page).toHaveURL(/\/play\/?$/);
  // Immobilier
  await page.getByTestId("cat-perso").click();
  await page.getByTestId("hub").getByText("Investissement immobilier").click();
  await expect(page).toHaveURL(/immobilier/);
  await page.getByTestId("cities").getByText("Saint-Étienne").click();
  // Le bien le moins cher (hors passoire thermique), finançable avec 10 000 € d'apport
  const cards = page.getByTestId("listings").locator(":scope > div").filter({ hasNotText: "DPE G" });
  await expect(cards.first()).toBeVisible({ timeout: 15000 });
  const prices = await cards.evaluateAll((els) => els.map((e) => Number((e.querySelector(".num")?.textContent ?? "").replace(/\D/g, ""))));
  const cheapest = prices.indexOf(Math.min(...prices));
  await cards.nth(cheapest).locator("[data-testid^=buy-credit-]").click();
  const mine = page.getByTestId("my-properties");
  await expect(mine).toContainText("Saint-Étienne", { timeout: 15000 });
  await mine.locator("[data-testid^=do-rent-]").first().click();
  await expect(mine).toContainText("chances de signer", { timeout: 15000 });
  await page.getByTestId("back-x").click();
  await expect(page).toHaveURL(/\/play\/perso\/?$/);
});
