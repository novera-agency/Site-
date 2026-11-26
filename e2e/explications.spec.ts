import { test, expect, type Page } from "@playwright/test";
const BASE = process.env.E2E_BASE ?? "";
const prep = (page: Page) => page.addInitScript(() => { try { sessionStorage.setItem("fe_intro", "1"); localStorage.setItem("fe_tour", "1"); } catch { /* */ } });

test("explications : les mots de métier s'expliquent au toucher, « Je ne comprends pas » détaille la question, la formation aussi", async ({ page }) => {
  test.setTimeout(240000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await prep(page);
  await page.goto(BASE + "/nouvelle");
  await page.getByTestId("next").click();
  await page.getByTestId("first-name").fill("Camille");
  await page.getByTestId("last-name").fill("Explique");
  for (let i = 0; i < 4; i++) await page.getByTestId("next").click();
  await page.getByTestId("create").click();
  await page.waitForURL(/\/play\/?$/, { timeout: 90000 });

  // Missions : un mot souligné s'ouvre avec sa définition et un exemple
  await page.goto(BASE + "/play/missions");
  const term = page.getByTestId("term").first();
  await expect(term).toBeVisible({ timeout: 60000 });
  await term.click();
  const card = page.getByTestId("term-card").first();
  await expect(card).toBeVisible();
  await expect(card).toContainText("Exemple");
  await card.getByRole("button", { name: /Fermer l'explication/ }).click();
  await expect(page.getByTestId("term-card")).toHaveCount(0);

  // « Je ne comprends pas » : les mots de la question, la méthode, la recherche d'un mot
  const help = page.getByTestId("help-me").first();
  await expect(help).toBeVisible();
  await help.click();
  const panel = page.getByTestId("help-me-panel").first();
  await expect(panel).toBeVisible();
  await expect(panel).toContainText("Les mots de la question");
  await panel.getByTestId("help-word").fill("bêta");
  await expect(panel).toContainText("sensibilité");
  await help.click();
  await expect(page.getByTestId("help-me-panel")).toHaveCount(0);

  // Formation : l'exercice commence par les mots à comprendre
  await page.goto(BASE + "/play/formation");
  await expect(page.getByTestId("help-me").first()).toBeVisible({ timeout: 60000 });
  await page.getByTestId("help-me").first().click();
  await expect(page.getByTestId("help-me-panel").first()).toContainText("Un exemple résolu");
  expect(errors).toEqual([]);
});
