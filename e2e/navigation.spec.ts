import { test, expect, type Page } from "@playwright/test";

/** Vérifie chaque onglet : affichage, absence d'erreur, défilement à la molette (y compris au-dessus d'un graphique), barre du bas. */
const BASE = process.env.E2E_BASE ?? "";
const go = (page: Page, path: string) => page.goto(BASE + path);
const PAGES = ["/play", "/play/agenda", "/play/messagerie", "/play/reunions", "/play/terminal", "/play/recherche", "/play/ordres", "/play/options", "/play/structures", "/play/portefeuille", "/play/transactions", "/play/risques", "/play/patrimoine", "/play/actualites", "/play/calendrier", "/play/macro", "/play/carriere", "/play/clients", "/play/missions", "/play/competences", "/play/reputation", "/play/reseau", "/play/rh", "/play/remuneration", "/play/banques", "/play/entreprise", "/play/formation", "/play/dictionnaire", "/play/parametres", "/play/sauvegardes", "/play/vie", "/play/actif/?id=MAIS", "/play/actif/?id=DE10Y"];

async function newCareer(page: Page) {
  await go(page, "/");
  await page.getByTestId("new-career").click();
  await page.getByTestId("next").click();
  await page.getByTestId("first-name").fill("Nina");
  await page.getByTestId("last-name").fill("Scroll");
  for (let i = 0; i < 4; i++) await page.getByTestId("next").click();
  await page.getByTestId("create").click();
  await page.waitForURL(/\/play\/?$/);
  await expect(page.getByTestId("bottom-nav")).toBeVisible({ timeout: 20000 });
}

for (const vp of [{ name: "ordinateur", width: 1440, height: 900 }, { name: "mobile", width: 390, height: 844 }]) {
  test(`tous les onglets s'affichent et défilent (${vp.name})`, async ({ page }) => {
    await page.setViewportSize({ width: vp.width, height: vp.height });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(`${page.url()} : ${e.message}`));
    page.on("console", (m) => { if (m.type() === "error" && !m.text().includes("favicon")) errors.push(`${page.url()} : ${m.text()}`); });
    await newCareer(page);
    for (const p of PAGES) {
      await go(page, p);
      await expect(page.locator("main h1").first(), `titre absent sur ${p}`).toBeVisible({ timeout: 15000 });
      await page.waitForTimeout(700);
      const [sh, ih] = await page.evaluate(() => [document.documentElement.scrollHeight, window.innerHeight]);
      if (sh > ih + 80) {
        await page.evaluate(() => window.scrollTo(0, 0));
        // molette au centre de l'écran (souvent au-dessus d'un graphique ou d'un tableau)
        await page.mouse.move(vp.width / 2, vp.height / 2);
        await page.mouse.wheel(0, 700);
        await page.waitForTimeout(400);
        const y = await page.evaluate(() => window.scrollY);
        expect(y, `défilement bloqué sur ${p}`).toBeGreaterThanOrEqual(Math.min(100, sh - ih - 2));
      }
      await expect(page.getByTestId("bottom-nav")).toBeVisible();
    }
    // Navigation par la barre du bas et le menu « Plus »
    await go(page, "/play");
    await page.getByTestId("bottom-nav").getByText("Portefeuille").click();
    await expect(page).toHaveURL(/portefeuille/);
    await page.getByTestId("more-button").click();
    await expect(page.getByTestId("more-sheet")).toBeVisible();
    await page.getByTestId("more-sheet").getByText("Centre de formation").click();
    await expect(page).toHaveURL(/formation/);
    // La salle de réunion défile sur petit écran et les choix sont atteignables
    await page.getByTestId("speed-100").click();
    await page.waitForTimeout(2000);
    if ((await page.getByTestId("play-pause").textContent())?.includes("▶")) await page.getByTestId("play-pause").click();
    const join = page.getByRole("button", { name: "Rejoindre la réunion" }).first();
    await join.waitFor({ timeout: 60000 });
    await join.click();
    const room = page.getByTestId("meeting-room");
    await expect(room).toBeVisible();
    await expect(room.getByTestId("mode-chooser")).toBeVisible();
    await room.getByTestId("mode-ecrit").click();
    const choice = room.locator(".grid.gap-2 > button").first();
    await choice.scrollIntoViewIfNeeded();
    await expect(choice).toBeInViewport();
    await choice.click();
    expect(errors, errors.join("\n")).toEqual([]);
  });
}
