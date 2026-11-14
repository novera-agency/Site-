import { test, expect, type Page } from "@playwright/test";
const BASE = process.env.E2E_BASE ?? "";
const go = (page: Page, path: string) => page.goto(BASE + path);

/** Micro et haut-parleur simulés : le test « dit » une phrase via window.__nextSay ; les répliques prononcées vont dans window.__spoken */
const fakeVoice = (micAllowed: boolean) => `
  window.__spoken = []; window.__voices = []; window.__nextSay = null;
  class FakeRec { start() { setTimeout(() => { const say = window.__nextSay; if (say) { window.__nextSay = null; const r = [{ transcript: say }]; r.isFinal = true; this.onresult && this.onresult({ resultIndex: 0, results: [r] }); } this.onend && this.onend(); }, 300); } stop() {} abort() {} }
  window.SpeechRecognition = FakeRec; window.webkitSpeechRecognition = FakeRec;
  if (window.speechSynthesis) { window.speechSynthesis.speak = (u) => { window.__spoken.push(u.text); window.__voices.push(u.pitch + "/" + u.rate); setTimeout(() => u.onend && u.onend(), 30); }; window.speechSynthesis.cancel = () => {}; }
  navigator.mediaDevices.getUserMedia = async () => { if (!${micAllowed}) throw new DOMException("refus", "NotAllowedError"); return { getTracks: () => [{ stop() {} }] }; };
`;
type W = { __nextSay: string | null; __spoken: string[] };
/** Dit une phrase, attend qu'elle soit entendue ; si `reply`, attend aussi que le personnage réponde à voix haute */
async function say(page: Page, text: string, reply = true) {
  const before = await page.evaluate(() => (window as unknown as W).__spoken.length);
  await page.evaluate((t) => { (window as unknown as W).__nextSay = t; }, text);
  await page.waitForFunction(() => (window as unknown as W).__nextSay === null, null, { timeout: 15000 });
  if (reply) await page.waitForFunction((b) => (window as unknown as W).__spoken.length > b, before, { timeout: 15000 });
}

async function startCareerAndJoin(page: Page) {
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
  await expect(room.getByTestId("mode-chooser")).toBeVisible();
  return room;
}

test("mode oral : micro autorisé, voix distinctes, aucun historique affiché, réponses parlées, hors-sujet et silence sanctionnés", async ({ page }) => {
  test.setTimeout(120000);
  await page.addInitScript(fakeVoice(true));
  const room = await startCareerAndJoin(page);
  await room.getByTestId("mode-oral").click();
  await expect(room.getByTestId("oral-stage")).toBeVisible();
  // Pas d'historique ni de réponses écrites en mode oral
  await expect(room.getByTestId("meeting-log")).toHaveCount(0);
  await expect(room.getByText("Quelles sont exactement mes limites de risque ?")).toHaveCount(0);
  await expect(room.getByTestId("voice-listening")).toBeVisible({ timeout: 15000 });
  expect((await page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken)).some((t) => t.includes("Bienvenue"))).toBe(true);
  await say(page, "Je voudrais savoir quelles sont mes limites de risque");
  await expect(room.getByTestId("voice-listening")).toBeVisible({ timeout: 15000 });
  await say(page, "la première");
  await expect(room.getByTestId("voice-listening")).toBeVisible({ timeout: 15000 });
  await say(page, "bonjour bonjour", false);
  await expect(room.getByTestId("penalties")).toContainText("1/3", { timeout: 10000 }); // hors sujet : avertissement
  // Silence jusqu'au bout du temps (20 s en difficulté normale) → la réunion se termine sans vous
  await expect(room.getByText("Réunion terminée")).toBeVisible({ timeout: 40000 });
  // Plusieurs profils de voix ont été utilisés
  const voices = await page.evaluate(() => (window as unknown as { __voices: string[] }).__voices);
  expect(new Set(voices).size).toBeGreaterThan(1);
  // Le compte rendu écrit, consultable après la réunion, confirme ce qui a été compris
  await room.getByTestId("show-transcript").click();
  const log = room.getByTestId("meeting-log");
  await expect(log.getByText("« Je voudrais savoir quelles sont mes limites de risque »")).toBeVisible();
  await expect(log.getByText("(interprété comme : Quelles sont exactement mes limites de risque ?)")).toBeVisible();
  await expect(log.getByText("(interprété comme : Pourquoi distinguer si strictement les deux comptes ?)")).toBeVisible();
  await expect(log.getByText("(silence — vous n'avez pas répondu à temps)")).toBeVisible();
});

test("mode écrit : historique avec les noms ; micro refusé → message clair", async ({ page }) => {
  await page.addInitScript(fakeVoice(false));
  const room = await startCareerAndJoin(page);
  await room.getByTestId("mode-oral").click();
  await expect(room.getByTestId("mic-error")).toContainText("micro");
  await expect(room.getByTestId("mode-chooser")).toBeVisible();
  await room.getByTestId("mode-ecrit").click();
  await expect(room.getByTestId("meeting-log")).toBeVisible();
  await expect(room.getByTestId("meeting-log").getByText(/Responsable du desk/).first()).toBeVisible();
  await room.locator(".grid.gap-2 > button").first().click();
  await expect(room.getByTestId("meeting-log").getByText("Quelles sont exactement mes limites de risque ?")).toBeVisible();
  // Rien n'est prononcé en mode écrit
  expect(await page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken.length)).toBe(0);
});

test("mode oral : « Qu'est-ce que la VaR ? » expliqué par celui qui l'a dit ; trois hors-sujet = réunion ratée", async ({ page }) => {
  test.setTimeout(120000);
  await page.addInitScript(fakeVoice(true));
  const room = await startCareerAndJoin(page);
  await room.getByTestId("mode-oral").click();
  await expect(room.getByTestId("voice-listening")).toBeVisible({ timeout: 15000 });
  await say(page, "Quelles sont mes limites de risque");
  await expect(room.getByTestId("voice-listening")).toBeVisible({ timeout: 15000 });
  const n = await page.evaluate(() => (window as unknown as W).__spoken.length);
  await say(page, "Qu'est-ce que la VaR ?");
  const spoken = await page.evaluate((k) => (window as unknown as W).__spoken.slice(k).join(" "), n);
  expect(spoken).toMatch(/99 %/);
  // Aucun avertissement pour une question de vocabulaire
  await expect(room.getByTestId("voice-listening")).toBeVisible({ timeout: 15000 });
  await expect(room.getByTestId("penalties")).toHaveCount(0);
  await say(page, "il fait vraiment beau aujourd'hui");
  await expect(room.getByTestId("penalties")).toContainText("1/3");
  await expect(room.getByTestId("voice-listening")).toBeVisible({ timeout: 15000 });
  await say(page, "mon chat adore les croquettes");
  await expect(room.getByTestId("penalties")).toContainText("2/3");
  await expect(room.getByTestId("voice-listening")).toBeVisible({ timeout: 15000 });
  await say(page, "le match de football était génial", false);
  await expect(room.getByText("Réunion ratée").first()).toBeVisible({ timeout: 15000 });
  await room.getByTestId("show-transcript").click();
  await expect(room.getByTestId("meeting-log").getByText(/réponse hors sujet/).first()).toBeVisible();
});

test("mode écrit : poser une question de vocabulaire ; l'avis des collaborateurs est affiché", async ({ page }) => {
  await page.addInitScript(fakeVoice(true));
  const room = await startCareerAndJoin(page);
  await room.getByTestId("mode-ecrit").click();
  await room.locator(".grid.gap-2 > button").first().click(); // « Quelles sont exactement mes limites de risque ? »
  await room.getByTestId("ask-term").locator("input").fill("Qu'est-ce que la VaR ?");
  await room.getByTestId("ask-term").getByRole("button").click();
  const log = room.getByTestId("meeting-log");
  await expect(log.getByText(/99 %/).last()).toBeVisible();
  // Réponse donnée par le responsable du desk, qui avait employé le terme
  const who = await log.locator("div.fade-in").last().locator("div").first().textContent();
  expect(who).toMatch(/Responsable du desk/);
  await page.keyboard.press("Escape");
  await room.getByRole("button", { name: /Quitter/ }).click();
  await go(page, "/play/reseau");
  await expect(page.getByTestId("relation-effect")).toContainText("Son avis sur vous");
});
