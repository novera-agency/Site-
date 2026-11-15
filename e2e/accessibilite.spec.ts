import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const BASE = process.env.E2E_BASE ?? "";
const go = (page: Page, path: string) => page.goto(BASE + path);

async function newCareer(page: Page) {
  await page.getByTestId("new-career").click();
  await page.getByTestId("next").click();
  await page.getByTestId("first-name").fill("Alex");
  await page.getByTestId("last-name").fill("Martin");
  for (let i = 0; i < 4; i++) await page.getByTestId("next").click();
  await page.getByTestId("create").click();
  await page.waitForURL(/\/play\/?$/);
  await page.getByTestId("bottom-nav").waitFor();
}

test("visite guidée, interface en anglais, réglages d'accessibilité et audit sans erreur", async ({ page }) => {
  await page.addInitScript(() => { try { sessionStorage.setItem("fe_intro", "1"); } catch { /* */ } });
  await go(page, "/");
  // Langue : anglais pour les menus
  await page.getByTestId("lang-en").click();
  await expect(page.getByTestId("new-career")).toContainText("New career");
  await newCareer(page);
  await expect(page.getByTestId("cat-pro")).toContainText("Career");
  await expect(page.getByTestId("cat-perso")).toContainText("Personal");
  // Retour au français depuis les paramètres
  await go(page, "/play/parametres");
  await page.getByTestId("lang-select").selectOption("fr");
  await expect(page.getByTestId("cat-pro")).toContainText("Vie pro");

  // Visite guidée relancée depuis les paramètres : chaque étape met une zone en lumière
  await page.getByTestId("tour-start").click();
  const tour = page.getByTestId("tour");
  await expect(tour).toBeVisible();
  await expect(tour.getByRole("dialog")).toContainText("Bienvenue");
  const seen: string[] = [];
  for (let i = 0; i < 20 && (await tour.count()); i++) {
    seen.push((await tour.locator("#tour-title").textContent()) ?? "");
    await page.getByTestId("tour-next").click();
  }
  await expect(tour).toHaveCount(0);
  expect(seen).toEqual(expect.arrayContaining(["Le temps", "🏢 Bureau", "⚙️ Options", "À vous de jouer !"]));
  // Échap ferme la visite
  await page.getByTestId("tour-start").click();
  await expect(tour).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(tour).toHaveCount(0);

  // Texte agrandi, conservé après rechargement
  await page.getByTestId("a11y-big").check();
  await expect(page.locator("html")).toHaveClass(/a11y-big/);
  await page.reload();
  await expect(page.locator("html")).toHaveClass(/a11y-big/);
  await page.getByTestId("a11y-big").uncheck();
  await expect(page.locator("html")).not.toHaveClass(/a11y-big/);

  // Audit automatique WCAG A/AA sur trois écrans
  for (const path of ["/play", "/play/vie", "/play/recherche"]) {
    await go(page, path);
    await page.locator("main h1").first().waitFor();
    await page.waitForTimeout(400);
    const r = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
    expect(r.violations.map((v) => `${path} ${v.id} ×${v.nodes.length}`)).toEqual([]);
  }
});
