import { test, expect, type Page } from "@playwright/test";
const BASE = process.env.E2E_BASE ?? "";
const go = (page: Page, path: string) => page.goto(BASE + path);

/** Micro et haut-parleur simulés : le test « dit » une phrase via window.__nextSay ; les répliques prononcées sont enregistrées dans window.__spoken */
const FAKE_VOICE = `
  window.__spoken = []; window.__nextSay = null;
  class FakeRec { start() { setTimeout(() => { const say = window.__nextSay; if (say) { window.__nextSay = null; const r = [{ transcript: say }]; r.isFinal = true; this.onresult && this.onresult({ resultIndex: 0, results: [r] }); } this.onend && this.onend(); }, 300); } stop() {} abort() {} }
  window.SpeechRecognition = FakeRec; window.webkitSpeechRecognition = FakeRec;
  if (window.speechSynthesis) { window.speechSynthesis.speak = (u) => { window.__spoken.push(u.text); setTimeout(() => u.onend && u.onend(), 30); }; window.speechSynthesis.cancel = () => {}; }
`;

test("réunion vocale : les personnages parlent, le joueur répond à voix haute, le silence est sanctionné", async ({ page }) => {
  test.setTimeout(120000);
  await page.addInitScript(FAKE_VOICE);
  await go(page, "/");
  await page.getByTestId("new-career").click();
  await page.getByTestId("next").click();
  await page.getByTestId("first-name").fill("Inès");
  await page.getByTestId("last-name").fill("Vocale");
  for (let i = 0; i < 4; i++) await page.getByTestId("next").click();
  await page.getByTestId("create").click();
  await page.waitForURL(/\/play\/?$/);
  await page.getByTestId("speed-100").click();
  await page.waitForTimeout(1500);
  if ((await page.getByTestId("play-pause").textContent())?.includes("▶")) await page.getByTestId("play-pause").click();
  await page.getByRole("button", { name: "Rejoindre la réunion" }).first().click();
  const room = page.getByTestId("meeting-room");
  // Le responsable parle (synthèse vocale), puis le micro s'ouvre avec un compte à rebours
  await expect(room.getByTestId("voice-listening")).toBeVisible({ timeout: 15000 });
  expect(((await page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken)) as string[]).some((t) => t.includes("Bienvenue"))).toBe(true);
  // Réponse libre, rapprochée de la bonne option
  await page.evaluate(() => { (window as unknown as { __nextSay: string }).__nextSay = "Je voudrais savoir quelles sont mes limites de risque"; });
  await expect(room.getByText("« Je voudrais savoir quelles sont mes limites de risque »")).toBeVisible({ timeout: 10000 });
  await expect(room.getByText("(interprété comme : Quelles sont exactement mes limites de risque ?)")).toBeVisible();
  // Réponse par ordinal
  await expect(room.getByTestId("voice-listening")).toBeVisible({ timeout: 15000 });
  await page.evaluate(() => { (window as unknown as { __nextSay: string }).__nextSay = "la première"; });
  await expect(room.getByText("(interprété comme : Pourquoi distinguer si strictement les deux comptes ?)")).toBeVisible({ timeout: 10000 });
  // Phrase incompréhensible : le jeu demande de reformuler sans valider
  await expect(room.getByTestId("voice-listening")).toBeVisible({ timeout: 15000 });
  await page.evaluate(() => { (window as unknown as { __nextSay: string }).__nextSay = "bonjour bonjour"; });
  await expect(room.getByText(/Pas sûr d'avoir compris/)).toBeVisible({ timeout: 10000 });
  // Silence jusqu'à la fin du temps imparti (20 s en difficulté normale)
  await expect(room.getByText("(silence — vous n'avez pas répondu à temps)")).toBeVisible({ timeout: 30000 });
  await expect(room.getByText("Réunion terminée")).toBeVisible({ timeout: 15000 });
});
