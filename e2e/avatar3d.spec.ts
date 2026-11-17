import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const BASE = process.env.E2E_BASE ?? "";
const intro = (page: Page) => page.addInitScript(() => { try { sessionStorage.setItem("fe_intro", "1"); localStorage.setItem("fe_tour", "1"); } catch { /* */ } });

/** Les parties automatisées restent en 2D (rapide) : ces tests forcent la 3D avec ?3d=1 */
test("accueil 3D : l'avatar arrive à la banque, on peut passer l'arrivée puis envoyer l'avatar dans une pièce", async ({ page }) => {
  test.setTimeout(240000);
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
  await page.waitForURL(/\/nouvelle/, { timeout: 170000 });
  expect(errors).toEqual([]);
});

test("avatar : créé en 3D, enregistré avec la partie, modifiable dans la garde-robe ; costumes prestigieux verrouillés", async ({ page }) => {
  test.setTimeout(240000);
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await intro(page);
  const glb = page.waitForResponse((r) => r.url().includes("/models/avatar.glb") && r.ok(), { timeout: 60000 });
  await page.goto(BASE + "/nouvelle?mode=carriere&3d=1");
  await page.getByTestId("next").click();
  await page.getByTestId("first-name").fill("Louis");
  await page.getByTestId("last-name").fill("Tailleur");
  await expect(page.getByTestId("creator-3d")).toBeVisible();
  await expect(page.getByTestId("creator-canvas")).toBeVisible();
  expect((await glb).status()).toBe(200); // le modèle humanoïde se charge réellement
  // vues, gestes, assise, marche : aucune erreur, boutons opérants
  await page.getByTestId("av-view-profile").click();
  await page.getByTestId("av-gesture-salut").click();
  await page.getByTestId("av-gesture-cravate").click();
  await page.getByTestId("av-walk").click();
  await page.getByTestId("av-run").click();
  await page.getByTestId("av-stop").click();
  await page.getByTestId("av-sit").click();
  await expect(page.getByTestId("av-sit")).toHaveAttribute("aria-pressed", "true");
  await page.getByTestId("av-reset").click();
  await expect(page.getByTestId("av-sit")).toHaveAttribute("aria-pressed", "false");
  await page.getByTestId("av-skin-4").click();
  await page.getByTestId("av-tab-cheveux").click();
  await page.getByTestId("av-hair-3").click();
  await page.getByTestId("av-beard-3").click();
  await page.getByTestId("av-tab-tenue").click();
  await expect(page.getByTestId("av-suit-7")).toBeDisabled(); // « Sable » : grade 5 requis
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

test("accueil 3D en plein écran : l'arrivée couvre tout l'écran, puis on choisit une porte et le détail s'ouvre par-dessus", async ({ page }) => {
  test.setTimeout(300000);
  await intro(page);
  await page.emulateMedia({ reducedMotion: "reduce" }); // l'avatar monte directement : l'animation complète est testée ci-dessus
  await page.setViewportSize({ width: 1000, height: 700 });
  await page.goto(BASE + "/?3d=1");
  const stage = page.getByTestId("office-3d");
  await expect(stage).toBeVisible();
  const box = await stage.boundingBox();
  expect(Math.round(box!.width)).toBe(1000); expect(Math.round(box!.height)).toBe(700); // plein écran
  await expect(page.locator("[inert]")).toHaveCount(1); // le menu classique, derrière, est inerte (ni clavier ni lecteur d'écran)
  await page.keyboard.press("Escape"); // passe l'arrivée
  await expect(page.getByTestId("zone-charger")).toBeVisible({ timeout: 20000 });
  await page.getByTestId("zone-charger").click();
  await expect(page.getByTestId("home-panel")).toBeVisible({ timeout: 170000 });
  await expect(page.getByTestId("home-panel")).toContainText("Charger une partie");
  await page.getByTestId("home-panel").getByText("Retour au hall").click();
  await expect(page.getByTestId("home-panel")).toHaveCount(0);
  await page.getByTestId("classic-menu").click(); // retour au menu classique
  await expect(page.getByTestId("new-career")).toBeVisible();
});
