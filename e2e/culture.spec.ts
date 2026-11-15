import { test, expect, type Page } from "@playwright/test";
const BASE = process.env.E2E_BASE ?? "";
const go = (page: Page, path: string) => page.goto(BASE + path);

test("quiz d'économie : deux questions du jour, explications, catégories, calculs ; ambiance sonore sans erreur", async ({ page }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
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
  await expect(page.getByTestId("quiz-stats")).toContainText(/0 \/ \d{3}/);
  await expect(page.getByTestId("daily-count")).toHaveText("0 / 2");
  const q1 = await page.getByTestId("quiz-question").textContent();
  await page.getByTestId("quiz-opt-0").click();
  const result = page.getByTestId("quiz-result");
  await expect(result).toBeVisible();
  await expect(result).toContainText(/Bonne réponse|Pas tout à fait/);
  await expect(page.getByTestId("quiz-opt-1")).toBeDisabled();
  await page.getByTestId("quiz-next").click();
  await expect(page.getByTestId("quiz-question")).not.toHaveText(q1!);
  // Deuxième question du jour, puis fin : les deux sont comptées
  await page.getByTestId("quiz-opt-1").click();
  await expect(page.getByTestId("quiz-result")).toBeVisible();
  await page.getByTestId("quiz-next").click();
  await expect(page.getByTestId("quiz-end")).toBeVisible();
  await expect(page.getByTestId("daily-count")).toHaveText("2 / 2");
  // Exercices de calcul : chiffres générés
  await page.getByRole("button", { name: "Calculs" }).click();
  await expect(page.getByTestId("quiz-question")).toBeVisible();
  await page.getByTestId("quiz-opt-2").click();
  await expect(page.getByTestId("quiz-result")).toContainText(/\d/);
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
  expect(errors).toEqual([]);
});
