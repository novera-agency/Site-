import { test, expect, type Page } from "@playwright/test";
const BASE = process.env.E2E_BASE ?? "";
const go = (page: Page, path: string) => page.goto(BASE + path);

test("quiz d'économie : répondre, lire l'explication, enchaîner, changer de catégorie", async ({ page }) => {
  await page.addInitScript(() => { try { sessionStorage.setItem("fe_intro", "1"); } catch { /* */ } });
  await go(page, "/");
  await page.getByTestId("new-career").click();
  await page.getByTestId("next").click();
  await page.getByTestId("first-name").fill("Léa");
  await page.getByTestId("last-name").fill("Quiz");
  for (let i = 0; i < 4; i++) await page.getByTestId("next").click();
  await page.getByTestId("create").click();
  await page.waitForURL(/\/play\/?$/);
  // Accessible depuis Vie professionnelle
  await page.getByTestId("cat-pro").click();
  await page.getByTestId("hub").getByText("Quiz d'économie").click();
  await expect(page).toHaveURL(/culture/);
  await expect(page.getByTestId("quiz-stats")).toContainText("0 / 50");
  const q1 = await page.getByTestId("quiz-question").textContent();
  await page.getByTestId("quiz-opt-0").click();
  const result = page.getByTestId("quiz-result");
  await expect(result).toBeVisible();
  await expect(result).toContainText(/Bonne réponse|Pas tout à fait/);
  await expect(page.getByTestId("quiz-opt-1")).toBeDisabled();
  await page.getByTestId("quiz-next").click();
  await expect(page.getByTestId("quiz-question")).not.toHaveText(q1!);
  // Catégorie macro : les questions macro seulement
  await page.getByRole("button", { name: "Macro" }).click();
  await expect(page.getByText("Question 1 /")).toBeVisible();
  await expect(page.getByText("Macro", { exact: true }).first()).toBeVisible();
  // Réponses jusqu'à la fin de la série
  for (let i = 0; i < 5; i++) {
    if (!(await page.getByTestId("quiz-opt-0").count())) break;
    await page.getByTestId("quiz-opt-0").click();
    await page.getByTestId("quiz-next").click();
  }
  await expect(page.getByTestId("quiz-end")).toBeVisible();
});
