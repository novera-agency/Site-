import { test, expect, type Page } from "@playwright/test";
const BASE = process.env.E2E_BASE ?? "";
const go = (page: Page, path: string) => page.goto(BASE + path);

test("planning : horaires de travail, réveil, sommeil et heures supplémentaires verrouillés pendant le travail", async ({ page }) => {
  await page.addInitScript(() => { try { sessionStorage.setItem("fe_intro", "1"); } catch { /* */ } });
  await go(page, "/");
  await page.getByTestId("new-career").click();
  await page.getByTestId("next").click();
  await page.getByTestId("first-name").fill("Nora");
  await page.getByTestId("last-name").fill("Planning");
  for (let i = 0; i < 4; i++) await page.getByTestId("next").click();
  await page.getByTestId("create").click();
  await page.waitForURL(/\/play\/?$/);
  // Accessible depuis Bureau
  await page.getByTestId("cat-bureau").click();
  await page.getByTestId("hub").getByText("Planning et sommeil").click();
  await expect(page).toHaveURL(/planning/);
  await expect(page.getByTestId("timeline")).toBeVisible();
  await expect(page.getByTestId("plan-summary")).toContainText("9,5 h");
  // Changer l'arrivée et le départ : la journée nette et l'effet se mettent à jour
  await page.getByTestId("plan-start").selectOption("570"); // 9 h 30
  await page.getByTestId("plan-end").selectOption("1020"); // 17 h
  await page.getByTestId("plan-wake").selectOption("480"); // 8 h
  await expect(page.getByTestId("plan-summary")).toContainText("6,5 h", { timeout: 20000 });
  await expect(page.getByTestId("plan-summary")).toContainText("plus courte", { timeout: 20000 });
  // Réveil trop tardif par rapport à l'arrivée : refusé, la valeur reste
  await page.getByTestId("plan-wake").selectOption("540");
  await expect(page.getByText(/au plus tard à/)).toBeVisible({ timeout: 15000 });
  await expect(page.getByTestId("plan-wake")).toHaveValue("480", { timeout: 15000 });
  // Dormir et heures supplémentaires sont verrouillés au bureau le matin
  await expect(page.getByTestId("sleep-btn")).toBeDisabled();
  await expect(page.getByTestId("sleep-block")).toBeVisible();
  await expect(page.getByTestId("ot-btn")).toBeDisabled();
  await expect(page.getByTestId("ot-block")).toContainText(/horaire de fin|encore au travail|Trop tard|Trop tôt/, { timeout: 15000 });
  await expect(page.getByTestId("ahead")).toContainText("0 h");
  // Les activités tiennent compte du nouvel horaire : à 7 h, avant l'arrivée à 9 h 30, une course d'1 h est possible, une journée en famille non
  await go(page, "/play/vie");
  await expect(page.getByTestId("activities")).toBeVisible();
  await expect(page.getByTestId("act-course")).toBeEnabled();
  await expect(page.getByTestId("act-famille")).toBeDisabled();
});
