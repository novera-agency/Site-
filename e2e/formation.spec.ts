import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const BASE = process.env.E2E_BASE ?? "";
const go = (page: Page, path: string) => page.goto(BASE + path);

/**
 * La séance de formation naît d'heures supplémentaires faites le soir. Pour l'e2e, le serveur de test (E2E_HOOKS) permet de lancer
 * directement la réunion : le N+1 pose les questions, corrige, conclut, puis la page Planning affiche le bilan et le carnet.
 */
test("séance de formation avec le N+1 : questions, corrections, bilan, carnet", async ({ page }) => {
  await page.addInitScript(() => { try { sessionStorage.setItem("fe_intro", "1"); } catch { /* */ } });
  await go(page, "/");
  await page.getByTestId("new-career").click();
  await page.getByTestId("next").click();
  await page.getByTestId("first-name").fill("Inès");
  await page.getByTestId("last-name").fill("Étude");
  for (let i = 0; i < 4; i++) await page.getByTestId("next").click();
  await page.getByTestId("create").click();
  await page.waitForURL(/\/play\/?$/);
  await go(page, "/play/planning");
  await expect(page.getByTestId("timeline")).toBeVisible();
  // Lancement de la séance (réunion avec le responsable)
  const started = await page.evaluate(async () => {
    const id = localStorage.getItem("fe_game");
    const r = await fetch(`/api/game/${id}/action`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type: "start_meeting", template: "formation_n1", params: { hours: "1", subject: "marches" } }) });
    return r.json();
  });
  expect(started.ok).toBe(true);
  const room = page.getByTestId("meeting-room");
  await expect(room).toBeVisible({ timeout: 20000 });
  await expect(room.getByText(/Séance de formation avec/).first()).toBeVisible();
  await room.getByTestId("mode-ecrit").click();
  const log = room.getByTestId("meeting-log");
  await expect(log).toContainText("vous restez tard");
  await expect(log).toContainText("Reprenons la notion");
  // Accessibilité de la réunion
  const ax = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(ax.violations.map((v) => `${v.id} ×${v.nodes.length}`)).toEqual([]);
  // Deux questions (1 h = 2 questions) : le responsable corrige à chaque réponse
  for (let q = 0; q < 2; q++) {
    await expect(room.getByTestId("choice-c0")).toBeVisible();
    const before = await log.locator("> *").count();
    await room.getByTestId("choice-c0").click();
    await expect.poll(async () => (await log.textContent()) ?? "", { timeout: 15000 }).toMatch(/✔|✘/);
    await expect.poll(async () => await log.locator("> *").count(), { timeout: 15000 }).toBeGreaterThan(before);
  }
  await expect(log).toContainText("Séance de formation :", { timeout: 15000 });
  // Bilan sur la page Planning, avec le carnet de formation
  await go(page, "/play/planning");
  await expect(page.getByTestId("tr-summary")).toContainText("/ 2", { timeout: 20000 });
  await expect(page.getByTestId("notebook")).toBeVisible();
  await page.getByTestId("tr-close").click();
  await expect(page.getByTestId("tr-summary")).toHaveCount(0);
});

test("séance interrompue : le responsable reprend là où on s'était arrêté", async ({ page }) => {
  await page.addInitScript(() => { try { sessionStorage.setItem("fe_intro", "1"); } catch { /* */ } });
  await go(page, "/");
  await page.getByTestId("new-career").click();
  await page.getByTestId("next").click();
  await page.getByTestId("first-name").fill("Léo");
  await page.getByTestId("last-name").fill("Reprise");
  for (let i = 0; i < 4; i++) await page.getByTestId("next").click();
  await page.getByTestId("create").click();
  await page.waitForURL(/\/play\/?$/);
  const post = (body: object) => page.evaluate(async (b) => { const id = localStorage.getItem("fe_game"); const r = await fetch(`/api/game/${id}/action`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }); return r.json(); }, body);
  expect((await post({ type: "start_meeting", template: "formation_n1", params: { hours: "1" } })).ok).toBe(true);
  const room = page.getByTestId("meeting-room");
  await expect(room).toBeVisible({ timeout: 20000 });
  await room.getByTestId("mode-ecrit").click();
  await room.getByTestId("choice-c0").click();
  await expect(room.getByTestId("meeting-log")).toContainText(/✔|✘/, { timeout: 15000 });
  // On quitte la réunion en cours de route
  expect((await post({ type: "leave_meeting" })).ok).toBe(true);
  await go(page, "/play/planning");
  await expect(page.getByTestId("training")).toBeVisible({ timeout: 20000 });
  await expect(page.getByText("1 / 2 questions")).toBeVisible();
  await page.getByTestId("tr-resume").click();
  await expect(page.getByTestId("meeting-room")).toBeVisible({ timeout: 20000 });
  await page.getByTestId("meeting-room").getByTestId("mode-ecrit").click();
  await expect(page.getByTestId("meeting-room").getByTestId("meeting-log")).toContainText(/Question|calcul|vocabulaire|culture|notion/, { timeout: 15000 });
});

/** Micro et haut-parleur simulés (même principe que vocal.spec) */
const fakeVoice = `
  window.__spoken = []; window.__nextSay = null;
  class FakeRec { start() { setTimeout(() => { const say = window.__nextSay; if (say) { window.__nextSay = null; const r = [{ transcript: say }]; r.isFinal = true; this.onresult && this.onresult({ resultIndex: 0, results: [r] }); } this.onend && this.onend(); }, 150); } stop() { this.onend && this.onend(); } abort() {} }
  window.SpeechRecognition = FakeRec; window.webkitSpeechRecognition = FakeRec;
  if (window.speechSynthesis) { window.speechSynthesis.speak = (u) => { window.__spoken.push(u.text); setTimeout(() => u.onend && u.onend(), 30); }; window.speechSynthesis.cancel = () => {}; }
  navigator.mediaDevices.getUserMedia = async () => ({ getTracks: () => [{ stop() {} }] });
`;
test("séance de formation à l'oral : le responsable lit la question puis les réponses possibles ; on répond « la deuxième »", async ({ page }) => {
  test.setTimeout(120000);
  await page.addInitScript(fakeVoice);
  await page.addInitScript(() => { try { sessionStorage.setItem("fe_intro", "1"); } catch { /* */ } });
  await go(page, "/");
  await page.getByTestId("new-career").click();
  await page.getByTestId("next").click();
  await page.getByTestId("first-name").fill("Mia");
  await page.getByTestId("last-name").fill("Oral");
  for (let i = 0; i < 4; i++) await page.getByTestId("next").click();
  await page.getByTestId("create").click();
  await page.waitForURL(/\/play\/?$/);
  const started = await page.evaluate(async () => { const id = localStorage.getItem("fe_game"); const r = await fetch(`/api/game/${id}/action`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type: "start_meeting", template: "formation_n1", params: { hours: "1", subject: "maths" } }) }); return r.json(); });
  expect(started.ok).toBe(true);
  const room = page.getByTestId("meeting-room");
  await expect(room).toBeVisible({ timeout: 20000 });
  await room.getByTestId("mode-oral").click();
  await expect(room.getByTestId("voice-listening")).toBeVisible({ timeout: 20000 });
  const spoken = () => page.evaluate(() => (window as unknown as { __spoken: string[] }).__spoken);
  const s1 = (await spoken()).join(" ");
  expect(s1).toMatch(/vous restez tard/);
  expect(s1).toMatch(/Première réponse/);
  expect(s1).toMatch(/Deuxième réponse/);
  const n = (await spoken()).length;
  await page.evaluate(() => { (window as unknown as { __nextSay: string }).__nextSay = "la deuxième"; });
  await page.waitForFunction(() => (window as unknown as { __nextSay: string | null }).__nextSay === null, null, { timeout: 15000 });
  await page.waitForFunction((k) => (window as unknown as { __spoken: string[] }).__spoken.length > k + 1, n, { timeout: 20000 }); // correction, puis question suivante
  await expect(room.getByTestId("voice-listening")).toBeVisible({ timeout: 20000 });
  await room.getByTestId("show-transcript").click();
  await expect(room.getByTestId("meeting-log")).toContainText("interprété comme", { timeout: 10000 });
  await expect(room.getByTestId("meeting-log")).toContainText(/✔|✘/);
});

test("point culture quotidien : le N+1 pose 2 à 5 questions, corrige, et les questions du jour sont comptées", async ({ page }) => {
  await page.addInitScript(() => { try { sessionStorage.setItem("fe_intro", "1"); } catch { /* */ } });
  await go(page, "/");
  await page.getByTestId("new-career").click();
  await page.getByTestId("next").click();
  await page.getByTestId("first-name").fill("Zoé");
  await page.getByTestId("last-name").fill("Culture");
  for (let i = 0; i < 4; i++) await page.getByTestId("next").click();
  await page.getByTestId("create").click();
  await page.waitForURL(/\/play\/?$/);
  const started = await page.evaluate(async () => { const id = localStorage.getItem("fe_game"); const r = await fetch(`/api/game/${id}/action`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ type: "start_meeting", template: "culture_n1", params: {} }) }); return r.json(); });
  expect(started.ok).toBe(true);
  const room = page.getByTestId("meeting-room");
  await expect(room).toBeVisible({ timeout: 20000 });
  await expect(room.getByText(/Point culture avec/).first()).toBeVisible();
  await room.getByTestId("mode-ecrit").click();
  const log = room.getByTestId("meeting-log");
  await expect(log).toContainText("Point culture du jour");
  // Il pose entre 2 et 5 questions, selon vos réponses
  let asked = 0;
  for (; asked < 5; asked++) {
    if (!(await room.getByTestId("choice-c0").count())) break;
    await room.getByTestId("choice-c0").click();
    await expect.poll(async () => ((await log.textContent()) ?? "").match(/[✔✘]/g)?.length ?? 0, { timeout: 15000 }).toBeGreaterThan(asked);
  }
  expect(asked).toBeGreaterThanOrEqual(2);
  expect(asked).toBeLessThanOrEqual(5);
  await expect(log).toContainText("Point culture :", { timeout: 15000 });
  // Les deux questions du jour sont comptées dans le quiz d'économie
  await go(page, "/play/culture");
  await expect(page.getByTestId("daily-count")).toHaveText("2 / 2", { timeout: 20000 });
});
