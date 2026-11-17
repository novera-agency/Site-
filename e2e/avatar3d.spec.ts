import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const BASE = process.env.E2E_BASE ?? "";
const intro = (page: Page) => page.addInitScript(() => { try { sessionStorage.setItem("fe_intro", "1"); localStorage.setItem("fe_tour", "1"); } catch { /* */ } });

/** Les parties automatisées restent en 2D (rapide) : ces tests forcent la 3D avec ?3d=1 */
test("accueil 3D : l'avatar arrive à la banque, on peut passer l'arrivée puis envoyer l'avatar dans une pièce", async ({ page }) => {
  test.setTimeout(180000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await intro(page);
  await page.goto(BASE + "/?3d=1");
  await expect(page.getByTestId("office-3d")).toBeVisible();
  await expect(page.getByTestId("stage-canvas")).toBeVisible();
  await expect(page.getByTestId("zone-nouvelle")).toBeDisabled(); // pendant l'arrivée
  await page.getByTestId("skip-arrival").click();
  await expect(page.getByTestId("zone-nouvelle")).toBeEnabled();
  await expect(page.getByTestId("zone-nouvelle")).toBeVisible({ timeout: 20000 }); // l'étiquette flotte au-dessus de la porte
  const ax = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(ax.violations.map((v) => `${v.id} ×${v.nodes.length}`)).toEqual([]);
  await page.getByTestId("zone-nouvelle").click();
  await page.waitForURL(/\/nouvelle/, { timeout: 90000 });
  expect(errors).toEqual([]);
});

test("avatar : créé en 3D, enregistré avec la partie, modifiable dans la garde-robe ; costumes prestigieux verrouillés", async ({ page }) => {
  test.setTimeout(240000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await intro(page);
  await page.goto(BASE + "/nouvelle?mode=carriere&3d=1");
  await page.getByTestId("next").click();
  await page.getByTestId("first-name").fill("Louis");
  await page.getByTestId("last-name").fill("Tailleur");
  await expect(page.getByTestId("creator-3d")).toBeVisible();
  await expect(page.getByTestId("creator-canvas")).toBeVisible();
  await page.getByTestId("av-skin-4").click();
  await page.getByTestId("av-tab-cheveux").click();
  await page.getByTestId("av-hair-3").click();
  await page.getByTestId("av-beard-3").click();
  await page.getByTestId("av-tab-tenue").click();
  await expect(page.getByTestId("av-suit-7")).toBeDisabled(); // « Sable » : grade 5 requis
  await expect(page.getByTestId("av-pocket")).toBeDisabled();
  await page.getByTestId("av-suit-1").click();
  for (let i = 0; i < 4; i++) await page.getByTestId("next").click();
  await page.getByTestId("create").click();
  await page.waitForURL(/\/play\/?$/);
  await page.goto(BASE + "/play/garde-robe");
  await page.getByTestId("av-tab-visage").click();
  await expect(page.getByTestId("av-skin-4")).toHaveAttribute("aria-pressed", "true");
  await page.getByTestId("av-tab-cheveux").click();
  await expect(page.getByTestId("av-hair-3")).toHaveAttribute("aria-pressed", "true");
  await page.getByTestId("av-hair-1").click();
  await page.getByTestId("avatar-save").click();
  await expect(page.getByRole("status").filter({ hasText: "Apparence enregistrée" })).toBeVisible();
  await page.reload();
  await page.getByTestId("av-tab-cheveux").click();
  await expect(page.getByTestId("av-hair-1")).toHaveAttribute("aria-pressed", "true");
  expect(errors).toEqual([]);
});
