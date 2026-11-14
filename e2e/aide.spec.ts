import { test, expect, type Page } from "@playwright/test";
const BASE = process.env.E2E_BASE ?? "";
const go = (page: Page, path: string) => page.goto(BASE + path);

test("aide de mission : activée par le joueur, visible partout, réductible et fermable", async ({ page }) => {
  await go(page, "/");
  await page.getByTestId("new-career").click();
  await page.getByTestId("next").click();
  await page.getByTestId("first-name").fill("Hugo");
  await page.getByTestId("last-name").fill("Aide");
  for (let i = 0; i < 4; i++) await page.getByTestId("next").click();
  await page.getByTestId("create").click();
  await page.waitForURL(/\/play\/?$/);
  await go(page, "/play/missions");
  // Aucune aide affichée tant que le joueur ne l'active pas
  await expect(page.getByText("Passer votre premier ordre").first()).toBeVisible();
  await expect(page.getByTestId("help-panel")).toHaveCount(0);
  const card = page.locator("section", { hasText: "Passer votre premier ordre" }).first();
  await card.getByRole("button", { name: "💡 Activer l'aide" }).click();
  const panel = page.getByTestId("help-panel");
  await expect(panel).toBeVisible();
  await expect(panel.getByText("Étapes")).toBeVisible();
  await expect(panel.getByText("Pour réussir")).toBeVisible();
  // Toujours visible sur un autre onglet, et le lien mène au bon écran
  await page.getByTestId("bottom-nav").getByText("Marchés").click();
  await expect(page).toHaveURL(/terminal/);
  await expect(panel).toBeVisible();
  // Réduire puis rouvrir
  await page.getByTestId("help-min").click();
  await expect(page.getByTestId("help-pill")).toBeVisible();
  await expect(panel).toHaveCount(0);
  await page.getByTestId("help-pill").click();
  await expect(page.getByTestId("help-panel")).toBeVisible();
  // Conservée après rechargement de la page
  await page.reload();
  await expect(page.getByTestId("help-panel")).toBeVisible({ timeout: 15000 });
  // Le lien de l'aide ouvre l'écran d'action
  await page.getByTestId("help-panel").getByRole("link", { name: /Ouvrir XWLD/ }).click();
  await expect(page).toHaveURL(/actif\/?\?id=XWLD/);
  // Fermer
  await page.getByTestId("help-close").click();
  await expect(page.getByTestId("help-panel")).toHaveCount(0);
  await expect(page.getByTestId("help-pill")).toHaveCount(0);
});
