import { test, expect, type Page } from "@playwright/test";
const BASE = process.env.E2E_BASE ?? "";
const go = (page: Page, path: string) => page.goto(BASE + path);

test("vie privée : fiche de paie, factures, loisirs qui consomment le temps libre, négociation avec le responsable", async ({ page }) => {
  await go(page, "/");
  await page.getByTestId("new-career").click();
  await page.getByTestId("epoch-fictif").click();
  await page.getByTestId("next").click();
  await page.getByTestId("first-name").fill("Paul");
  await page.getByTestId("last-name").fill("Equilibre");
  for (let i = 0; i < 4; i++) await page.getByTestId("next").click();
  await page.getByTestId("create").click();
  await page.waitForURL(/\/play\/?$/);
  await expect(page.getByTestId("life-chip")).toBeVisible({ timeout: 15000 });
  await go(page, "/play/vie");
  await expect(page.getByTestId("life-bars")).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId("payslip")).toContainText("Impôt sur le revenu");
  await expect(page.getByTestId("bills")).toContainText("Loyer");
  // Les activités ne se font qu'en dehors des heures de travail : à 7 h, avant l'arrivée de 7 h 30, une journée en famille (6 h) est impossible
  await expect(page.getByTestId("act-famille")).toBeDisabled();
  const before = await page.getByTestId("free-hours").textContent();
  expect(before).toBeTruthy();
  await page.getByTestId("ask-raise").click();
  await expect(page.getByTestId("meeting-room")).toBeVisible({ timeout: 10000 });
  await expect(page.getByTestId("meeting-room")).toContainText("Négociation de votre rémunération");
});
