import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const BASE = process.env.E2E_BASE ?? "";
const go = (page: Page, path: string) => page.goto(BASE + path);

async function newCareer(page: Page) {
  await page.addInitScript(() => { try { sessionStorage.setItem("fe_intro", "1"); } catch { /* */ } });
  await go(page, "/");
  await page.getByTestId("new-career").click();
  await page.getByTestId("next").click();
  await page.getByTestId("first-name").fill("Sam");
  await page.getByTestId("last-name").fill("Silence");
  for (let i = 0; i < 4; i++) await page.getByTestId("next").click();
  await page.getByTestId("create").click();
  await page.waitForURL(/\/play\/?$/);
}

test("paramètres : couper les bruits un par un ou tous d'un coup, bouton silence en haut, réglages conservés", async ({ page }) => {
  await newCareer(page);
  await go(page, "/play/parametres");
  const panel = page.getByTestId("sound-prefs");
  await expect(panel).toBeVisible();
  for (const k of ["notif", "call", "voices"]) await expect(page.getByTestId(`sound-${k}`)).toBeChecked();
  await page.getByTestId("sound-call").uncheck();
  await page.getByTestId("sound-notif").uncheck();
  // Le bip d'appel de test est désactivé quand il est coupé
  await expect(page.getByRole("button", { name: /bip d'appel/ })).toBeDisabled();
  await page.reload();
  await expect(page.getByTestId("sound-call")).not.toBeChecked();
  await expect(page.getByTestId("sound-notif")).not.toBeChecked();
  await expect(page.getByTestId("sound-voices")).toBeChecked();
  // Mode silencieux : bouton en haut de l'écran, reflété dans les paramètres, qui grise les autres choix
  const mute = page.getByTestId("mute-toggle");
  await expect(mute).toHaveAttribute("aria-pressed", "false");
  await mute.click();
  await expect(mute).toHaveAttribute("aria-pressed", "true");
  await expect(page.getByTestId("sound-master")).toBeChecked();
  await expect(page.getByTestId("sound-voices")).toBeDisabled();
  await expect(page.getByRole("button", { name: /Écouter deux voix/ })).toBeDisabled();
  await page.getByTestId("sound-master").uncheck();
  await expect(mute).toHaveAttribute("aria-pressed", "false");
  // Rétablir
  await page.getByTestId("sound-call").check();
  await page.getByTestId("sound-notif").check();
  await expect(page.getByRole("button", { name: /bip d'appel/ })).toBeEnabled();
  const ax = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(ax.violations.map((v) => `${v.id} ×${v.nodes.length}`)).toEqual([]);
});

test("le bip de test ne joue que si le bip d'appel est activé ; aucun bruit en mode silencieux", async ({ page }) => {
  await page.addInitScript(() => {
    const w = window as unknown as { __beeps: number };
    w.__beeps = 0;
    const AC = (window as unknown as { AudioContext?: typeof AudioContext }).AudioContext;
    if (AC) { const orig = AC.prototype.createOscillator; AC.prototype.createOscillator = function (this: AudioContext) { w.__beeps++; return orig.call(this); }; }
  });
  await newCareer(page);
  await go(page, "/play/parametres");
  const beeps = () => page.evaluate(() => (window as unknown as { __beeps: number }).__beeps);
  const test = page.getByRole("button", { name: /bip d'appel/ });
  const b0 = await beeps();
  await test.click();
  await expect.poll(beeps).toBe(b0 + 1);
  await page.getByTestId("mute-toggle").click(); // silence : le bouton de test est grisé
  await expect(test).toBeDisabled();
  await page.waitForTimeout(500);
  expect(await beeps()).toBe(b0 + 1);
});

test("voix coupées : le mode oral des réunions est indisponible, avec le lien pour les réactiver", async ({ page }) => {
  await newCareer(page);
  const post = (body: object) => page.evaluate(async (b) => { const id = localStorage.getItem("fe_game"); const r = await fetch(`/api/game/${id}/action`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }); return r.json(); }, body);
  await go(page, "/play/parametres");
  await page.getByTestId("sound-voices").uncheck();
  expect((await post({ type: "start_meeting", template: "culture_n1", params: {} })).ok).toBe(true);
  const room = page.getByTestId("meeting-room");
  await expect(room).toBeVisible({ timeout: 20000 });
  await expect(room.getByTestId("mode-oral")).toBeDisabled();
  await expect(room.getByTestId("oral-off")).toContainText("voix sont coupées");
  await expect(room.getByRole("link", { name: /Réactiver les voix/ })).toBeVisible();
  await room.getByTestId("mode-ecrit").click(); // le mode écrit reste possible
  await expect(room.getByTestId("meeting-log")).toContainText("Point culture du jour");
});

test("accueil : case « mode silencieux » dans les options", async ({ page }) => {
  await page.addInitScript(() => { try { sessionStorage.setItem("fe_intro", "1"); } catch { /* */ } });
  await go(page, "/");
  await page.getByTestId("menu-options").click();
  const box = page.getByTestId("home-mute");
  await expect(box).not.toBeChecked();
  await box.check();
  await page.reload();
  await page.getByTestId("menu-options").click();
  await expect(page.getByTestId("home-mute")).toBeChecked();
  const stored = await page.evaluate(() => localStorage.getItem("fe_sound"));
  expect(JSON.parse(stored!).muted).toBe(true);
});
