import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { genQuestion } from "../src/engine/quizGen";
const BASE = process.env.E2E_BASE ?? "";
const go = (page: Page, path: string) => page.goto(BASE + path);

/** Les 5 questions imposées par le serveur de test pour le point culture : on y répond toutes faux, volontairement */
const IDS = ["g:14:51", "g:5:7", "g:1:3", "g:9:12", "g:2:4"];
const Q = Object.fromEntries(IDS.map((id) => { const q = genQuestion(Number(id.split(":")[1]), Number(id.split(":")[2])); return [q.q, q]; }));

async function career(page: Page) {
  await page.addInitScript(() => { try { sessionStorage.setItem("fe_intro", "1"); } catch { /* */ } });
  await go(page, "/");
  await page.getByTestId("new-career").click();
  await page.getByTestId("next").click();
  await page.getByTestId("first-name").fill("Rémi");
  await page.getByTestId("last-name").fill("Révision");
  for (let i = 0; i < 4; i++) await page.getByTestId("next").click();
  await page.getByTestId("create").click();
  await page.waitForURL(/\/play\/?$/);
}
const post = (page: Page, body: object) => page.evaluate(async (b) => { const id = localStorage.getItem("fe_game"); const r = await fetch(`/api/game/${id}/action`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(b) }); return r.json(); }, body);

/** Cinq erreurs au point culture : le responsable pose les 5 questions imposées, on choisit chaque fois une mauvaise réponse */
async function makeMistakes(page: Page) {
  expect((await post(page, { type: "start_meeting", template: "culture_n1", params: { ids: IDS.join("|") } })).ok).toBe(true);
  const room = page.getByTestId("meeting-room");
  await expect(room).toBeVisible({ timeout: 20000 });
  await room.getByTestId("mode-ecrit").click();
  const log = room.getByTestId("meeting-log");
  for (let i = 0; i < 5; i++) {
    await expect(room.getByTestId("choice-c0")).toBeVisible();
    const text = (await log.textContent()) ?? "";
    const prompt = Object.keys(Q).find((p) => text.includes(p) && !text.includes(`${p}✘`) && Q[p]);
    // la dernière question posée est la dernière à apparaître dans le journal
    const asked = Object.keys(Q).filter((p) => text.includes(p)).sort((a, b) => text.lastIndexOf(a) - text.lastIndexOf(b)).pop() ?? prompt!;
    const q = Q[asked];
    const wrong = (q.correct + 1) % q.options.length;
    await room.getByTestId(`choice-c${wrong}`).click();
    await expect.poll(async () => ((await log.textContent()) ?? "").match(/✘/g)?.length ?? 0, { timeout: 15000 }).toBe(i + 1);
  }
  await expect(log).toContainText("Point culture :", { timeout: 15000 });
}

test("erreurs passées : fiches de révision intégrées, refaire la question, maîtrise", async ({ page }) => {
  await career(page);
  await makeMistakes(page);
  await go(page, "/play/planning");
  const rv = page.getByTestId("revision");
  await expect(rv).toBeVisible();
  await expect(page.getByTestId("rv-count")).toHaveText("5");
  await expect(page.getByTestId("rv-entry")).toHaveCount(5);
  // La fiche de révision s'ouvre dans la liste : réponse, bonne réponse, formule, calcul, exercice supplémentaire
  const first = page.getByTestId("rv-entry").first();
  await first.getByTestId("rv-toggle").click();
  const fiche = first.getByTestId("rv-fiche");
  await expect(fiche.getByTestId("recap-card")).toBeVisible();
  await expect(fiche.getByTestId("recap-title")).toContainText("Fiche de révision");
  await expect(fiche).toContainText("Votre réponse");
  await expect(fiche).toContainText("Bonne réponse");
  await expect(fiche.getByTestId("recap-formulas")).toBeVisible();
  await expect(fiche.getByTestId("recap-exercise")).toBeVisible();
  await expect(fiche.getByTestId("recap-png")).toBeVisible();
  const ax = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(ax.violations.map((v) => `${v.id} ×${v.nodes.length}`)).toEqual([]);
  // Refaire la question sans la correction : d'abord une mauvaise réponse, puis la bonne
  const prompt = (await fiche.getByTestId("rv-retry").locator("p").first().textContent())!.trim();
  const q = Q[prompt];
  expect(q, prompt).toBeTruthy();
  await fiche.getByTestId(`rv-opt-${(q.correct + 1) % q.options.length}`).click();
  await expect(fiche.getByTestId("rv-result")).toContainText("Pas encore");
  await fiche.getByRole("button", { name: "Réessayer" }).click();
  await fiche.getByTestId(`rv-opt-${q.correct}`).click();
  await expect(fiche.getByTestId("rv-result")).toContainText("question maîtrisée");
  await expect(page.getByTestId("rv-count")).toHaveText("4");
  // Maîtrisée : elle disparaît de « À revoir » mais reste dans « Toutes »
  await expect(page.getByTestId("rv-entry")).toHaveCount(4);
  await rv.getByRole("button", { name: "Toutes" }).click();
  await expect(page.getByTestId("rv-entry")).toHaveCount(5);
  await expect(rv.getByText("Maîtrisée").first()).toBeVisible();
  // La carte des heures supplémentaires propose la révision
  await expect(page.getByTestId("ot-errors-hint")).toHaveCount(0); // visible seulement avec l'objectif « me former »
  await page.getByTestId("ot-focus-formation").check();
  await expect(page.getByTestId("ot-errors-hint")).toContainText("4 erreurs passées à revoir");
  await expect(page.getByTestId("ot-subject").locator("option", { hasText: "Mes erreurs passées" })).toHaveCount(1);
});

test("séance « Mes erreurs passées » : le N+1 reprend les erreurs, le dit, et les erreurs réussies sont maîtrisées", async ({ page }) => {
  await career(page);
  await makeMistakes(page);
  await go(page, "/play/planning");
  expect((await post(page, { type: "start_meeting", template: "formation_n1", params: { hours: "2", subject: "erreurs" } })).ok).toBe(true);
  const room = page.getByTestId("meeting-room");
  await expect(room).toBeVisible({ timeout: 20000 });
  await room.getByTestId("mode-ecrit").click();
  const log = room.getByTestId("meeting-log");
  await expect(log).toContainText("reprenons vos erreurs passées");
  await expect(log).toContainText("Vous aviez déjà buté");
  // Il reprend d'abord les mêmes questions, que l'on réussit cette fois
  for (let i = 0; i < 3; i++) {
    await expect(room.getByTestId("choice-c0")).toBeVisible();
    const text = (await log.textContent()) ?? "";
    const asked = Object.keys(Q).filter((p) => text.includes(p)).sort((a, b) => text.lastIndexOf(a) - text.lastIndexOf(b)).pop()!;
    await room.getByTestId(`choice-c${Q[asked].correct}`).click();
    await expect.poll(async () => ((await log.textContent()) ?? "").match(/✔/g)?.length ?? 0, { timeout: 15000 }).toBe(i + 1);
  }
  await expect(log).toContainText("Séance de formation :", { timeout: 15000 });
  await go(page, "/play/planning");
  await expect(page.getByTestId("rv-count")).toHaveText("2"); // 3 des 5 erreurs sont maîtrisées
});
