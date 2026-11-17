import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const BASE = process.env.E2E_BASE ?? "";
const intro = (page: Page) => page.addInitScript(() => { try { sessionStorage.setItem("fe_intro", "1"); localStorage.setItem("fe_tour", "1"); } catch { /* */ } });

test("accueil : le personnage marche jusqu'à la pièce touchée, puis ouvre l'écran", async ({ page }) => {
  await intro(page);
  await page.goto(BASE + "/");
  const scene = page.getByTestId("office-scene");
  await expect(scene).toBeVisible();
  const st = page.getByTestId("walker-state");
  const pos = async () => ({ x: Number(await st.getAttribute("data-x")), y: Number(await st.getAttribute("data-y")) });
  await expect.poll(async () => st.getAttribute("data-moving"), { timeout: 10000 }).toBe("0"); // arrivée dans le couloir
  const start = await pos();
  await page.getByTestId("zone-honneur").click();
  await expect.poll(async () => (await pos()).y, { timeout: 10000 }).toBeGreaterThan(35); // il est entré dans la pièce du bas
  await expect(page.getByRole("heading", { name: "Tableau d'honneur" })).toBeVisible(); // arrivé : le panneau s'ouvre
  expect(Math.abs((await pos()).x - start.x)).toBeGreaterThan(5); // il a bien marché le long du couloir
  const ax = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(ax.violations.map((v) => `${v.id} ×${v.nodes.length}`)).toEqual([]);
  // Une partie à reprendre n'existe pas encore : la pièce du directeur est fermée
  await expect(page.getByTestId("zone-continuer")).toBeDisabled();
  await page.getByTestId("zone-nouvelle").click();
  await page.waitForURL(/\/nouvelle/, { timeout: 15000 });
});

test("en jeu : les pièces de la banque mènent aux écrans, au clavier comme au toucher", async ({ page }) => {
  await intro(page);
  await page.goto(BASE + "/");
  await page.getByTestId("new-career").click();
  await page.getByTestId("next").click();
  await page.getByTestId("first-name").fill("Ines");
  await page.getByTestId("last-name").fill("Scene");
  for (let i = 0; i < 4; i++) await page.getByTestId("next").click();
  await page.getByTestId("create").click();
  await page.waitForURL(/\/play\/?$/);
  await expect(page.getByTestId("office-hub")).toBeVisible();
  await page.getByTestId("zone-marches").focus();
  await page.keyboard.press("Enter");
  const panel = page.getByTestId("room-panel");
  await expect(panel).toBeVisible({ timeout: 10000 });
  await panel.getByRole("link", { name: /Rechercher un titre/ }).click();
  await page.waitForURL(/\/play\/recherche/);
});
