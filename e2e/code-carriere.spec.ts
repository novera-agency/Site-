import { test, expect, type Page } from "@playwright/test";
const BASE = process.env.E2E_BASE ?? "";
const intro = (page: Page) => page.addInitScript(() => { try { sessionStorage.setItem("fe_intro", "1"); localStorage.setItem("fe_tour", "1"); } catch { /* */ } });

test("code de carrière : généré sur un appareil, repris sur un autre (autre session) avec la même carrière", async ({ browser }) => {
  test.setTimeout(240000);
  // Appareil A : création d'une carrière, génération du code dans les paramètres
  const a = await (await browser.newContext()).newPage();
  await intro(a);
  await a.goto(BASE + "/");
  await a.getByTestId("new-career").click();
  await a.getByTestId("next").click();
  await a.getByTestId("first-name").fill("Camille");
  await a.getByTestId("last-name").fill("Transfert");
  for (let i = 0; i < 4; i++) await a.getByTestId("next").click();
  await a.getByTestId("create").click();
  await a.waitForURL(/\/play\/?$/);
  await a.goto(BASE + "/play/parametres");
  await a.getByTestId("cc-generate").click();
  const area = a.getByTestId("cc-code");
  await expect(area).toBeVisible({ timeout: 60000 });
  const code = await area.inputValue();
  expect(code).toMatch(/^FE1\.[0-9a-f]{8}\./);
  await expect(a.getByTestId("cc-copy")).toBeVisible();

  // Appareil B : navigateur vierge, session différente
  const b = await (await browser.newContext()).newPage();
  await intro(b);
  await b.goto(BASE + "/");
  await b.getByTestId("menu-charger").click();
  await b.getByTestId("home-career-code").locator("summary").click();
  // code abîmé : message clair
  await b.getByTestId("cc-input").fill(code.slice(0, -50));
  await b.getByTestId("cc-restore").click();
  await expect(b.getByTestId("cc-msg")).toContainText(/incomplet|modifié/);
  // bon code : la carrière est retrouvée
  await b.getByTestId("cc-input").fill(code);
  await b.getByTestId("cc-restore").click();
  await b.waitForURL(/\/play\/?$/, { timeout: 90000 });
  await expect(b.getByText("Camille Transfert").first()).toBeVisible({ timeout: 30000 });
});
