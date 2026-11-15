import { test, expect, type Page } from "@playwright/test";
const BASE = process.env.E2E_BASE ?? "";
const go = (page: Page, path: string) => page.goto(BASE + path);

async function create(page: Page, epoch: "epoch-hist" | "epoch-fictif") {
  await go(page, "/");
  await page.getByTestId("new-career").click();
  await expect(page.getByTestId("epoch-hist")).toBeVisible();
  await page.getByTestId(epoch).click();
  await page.getByTestId("next").click();
  await page.getByTestId("first-name").fill("Marie");
  await page.getByTestId("last-name").fill("Histoire");
  for (let i = 0; i < 4; i++) await page.getByTestId("next").click();
  await page.getByTestId("create").click();
  await page.waitForURL(/\/play\/?$/);
}

test("mode historique : départ le 3 janvier 2000, événements réels dans les actualités", async ({ page }) => {
  await create(page, "epoch-hist");
  await expect(page.getByText("lundi 3 janvier 2000").first()).toBeVisible({ timeout: 15000 });
  await go(page, "/play/actualites");
  await expect(page.getByText(/nouveau millénaire/).first()).toBeVisible({ timeout: 15000 });
  await go(page, "/play/macro");
  await expect(page.getByText("Réserve fédérale américaine").first()).toBeVisible({ timeout: 15000 });
  // La partie apparaît avec sa date de jeu dans le menu
  await go(page, "/");
  await expect(page.getByText(/3 janvier 2000/).first()).toBeVisible({ timeout: 15000 });
});

test("monde imaginaire : départ le 4 janvier 2027", async ({ page }) => {
  await create(page, "epoch-fictif");
  await expect(page.getByText("lundi 4 janvier 2027").first()).toBeVisible({ timeout: 15000 });
});
