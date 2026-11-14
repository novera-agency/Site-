import { test, expect, type Page } from "@playwright/test";

/** Gère toute réunion en attente/en cours : rejoindre, répondre (premier choix ou valeur chiffrée), quitter. */
async function handleMeetings(page: Page, answer = "0") {
  for (let guard = 0; guard < 4; guard++) {
    const join = page.getByRole("button", { name: "Rejoindre" }).first();
    const back = page.getByRole("button", { name: "Retourner en réunion" }).first();
    if (await join.isVisible().catch(() => false)) await join.click();
    else if (await back.isVisible().catch(() => false)) await back.click();
    else return;
    for (let i = 0; i < 20; i++) {
      const quit = page.getByRole("button", { name: "Quitter la salle" });
      if (await quit.isVisible().catch(() => false)) { await quit.click(); break; }
      const input = page.locator('input[placeholder^="Réponse"]');
      if (await input.isVisible().catch(() => false)) { await input.fill(answer); await page.getByRole("button", { name: "Répondre" }).click(); }
      else { const choice = page.locator(".fixed.inset-0 .grid.gap-2 > button").first(); if (await choice.isVisible().catch(() => false)) await choice.click(); }
      await page.waitForTimeout(400);
    }
    await page.waitForTimeout(500);
  }
}
async function runUntil(page: Page, cond: () => Promise<boolean>, maxMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < maxMs) {
    await handleMeetings(page);
    if (await cond()) return true;
    const pp = page.getByTestId("play-pause");
    if ((await pp.textContent())?.includes("▶")) await pp.click();
    await page.waitForTimeout(800);
  }
  return false;
}
const BASE = process.env.E2E_BASE ?? "";
const go = (page: Page, path: string) => page.goto(BASE + path);
const clock = async (page: Page) => (await page.locator(".num.text-lg").first().textContent())?.trim() ?? "";

test("parcours de validation end-to-end (20 étapes)", async ({ page, context }) => {
  // 1-4 : lancer, créer une carrière, choisir une banque, capital virtuel
  await go(page, "/");
  await page.getByTestId("new-career").click();
  await page.getByTestId("next").click();
  await page.getByTestId("first-name").fill("Camille");
  await page.getByTestId("last-name").fill("Testeur");
  await page.getByTestId("next").click();
  await page.getByTestId("track-trader").click();
  await page.getByTestId("next").click();
  await page.getByTestId("bank-lutece").click();
  await page.getByTestId("next").click();
  await page.getByTestId("next").click();
  await page.getByTestId("create").click();
  await page.waitForURL(/\/play\/?$/);
  await expect(page.getByText("Compte personnel").first()).toBeVisible();
  await expect(page.getByText("10 000,00 €").first()).toBeVisible();
  // 5-6 : marchés qui évoluent, accélération et pause
  await page.getByTestId("speed-100").click();
  const t0 = await clock(page);
  await runUntil(page, async () => (await clock(page)) >= "09:10", 90000);
  expect(await clock(page)).not.toBe(t0);
  await page.getByTestId("play-pause").click();
  const paused = await clock(page);
  await page.waitForTimeout(2500);
  expect(await clock(page)).toBe(paused);
  // 7-8 : acheter un instrument, solde qui diminue
  await go(page, "/play/actif/?id=XWLD");
  await page.getByTestId("order-qty").fill("20");
  await page.getByTestId("submit-order").click();
  await expect(page.getByText(/Ordre exécuté|Marché fermé|enregistré/).first()).toBeVisible();
  // 9-10 : position et variation de valeur
  await go(page, "/play/portefeuille");
  await expect(page.getByRole("link", { name: "XWLD" }).first()).toBeVisible({ timeout: 15000 });
  const v1 = await page.locator("text=Valeur totale").locator("..").locator(".num").first().textContent();
  expect(v1).not.toContain("10 000,00");
  await page.getByTestId("speed-25").click();
  await page.getByTestId("play-pause").click();
  await page.waitForTimeout(4000);
  await handleMeetings(page);
  // 11-12 : revendre, consulter le résultat
  await go(page, "/play/actif/?id=XWLD");
  await page.getByTestId("side-sell").click();
  await page.getByTestId("order-qty").fill("20");
  await page.getByTestId("submit-order").click();
  await expect(page.getByText(/Ordre exécuté|enregistré|fermé/).first()).toBeVisible();
  await go(page, "/play/transactions");
  await expect(page.getByText("Vente").first()).toBeVisible({ timeout: 15000 });
  await expect(page.getByText(/Balance de vérification équilibrée/)).toBeVisible();
  // 13-17 : réunions, mission, événement économique et conséquences, évaluation
  await go(page, "/play");
  await runUntil(page, async () => (await clock(page)) >= "18:05" || (await clock(page)) < "07:00", 120000);
  await go(page, "/play/reunions");
  await expect(page.getByText("Historique")).toBeVisible();
  await expect(page.locator("li b.text-sm").first()).toBeVisible();
  await go(page, "/play/missions");
  await page.getByRole("button", { name: "Terminées" }).click();
  await expect(page.getByText("Passer votre premier ordre")).toBeVisible();
  await go(page, "/play/actualites");
  await expect(page.getByText(/indicateur avancé/).first()).toBeVisible();
  await go(page, "/play/carriere");
  await expect(page.getByText(/Première journée|première journée/).first()).toBeVisible();
  // 18 : sauvegarder
  await go(page, "/play/sauvegardes");
  if ((await page.getByTestId("play-pause").textContent())?.includes("❚❚")) await page.getByTestId("play-pause").click();
  await page.waitForTimeout(1500);
  await page.getByRole("button", { name: "→ Empl. 1" }).first().click();
  await expect(page.getByText(/emplacement 1/)).toBeVisible();
  const savedClock = await clock(page);
  // 19-20 : fermer, reprendre
  const state = await context.storageState({ indexedDB: true });
  await page.close();
  const ctx2 = await context.browser()!.newContext({ storageState: state, baseURL: process.env.E2E_URL || "http://localhost:3100" });
  const p2 = await ctx2.newPage();
  await go(p2, "/");
  await p2.getByTestId("continue-last").click();
  await p2.waitForURL(/\/play\/?$/);
  await expect(p2.getByText("Compte personnel").first()).toBeVisible();
  expect(await clock(p2)).toBe(savedClock);
  await go(p2, "/play/transactions");
  await expect(p2.getByText("Vente").first()).toBeVisible();
  await ctx2.close();
});
