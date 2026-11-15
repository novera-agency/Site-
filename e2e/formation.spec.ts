import { test, expect, type Page } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
const BASE = process.env.E2E_BASE ?? "";
const go = (page: Page, path: string) => page.goto(BASE + path);

/**
 * La séance de formation naît d'heures supplémentaires faites le soir ; on injecte donc une séance dans la vue « planning »
 * et on simule les réponses du serveur pour vérifier tout le parcours de l'écran (fiche, QCM, numérique, corrections, bilan, fermeture).
 */
test("séance de formation : fiche, QCM, question numérique, corrections, bilan et fermeture", async ({ page }) => {
  await page.addInitScript(() => { try { sessionStorage.setItem("fe_intro", "1"); } catch { /* */ } });
  await go(page, "/");
  await page.getByTestId("new-career").click();
  await page.getByTestId("next").click();
  await page.getByTestId("first-name").fill("Inès");
  await page.getByTestId("last-name").fill("Étude");
  for (let i = 0; i < 4; i++) await page.getByTestId("next").click();
  await page.getByTestId("create").click();
  await page.waitForURL(/\/play\/?$/);

  const items = [
    { i: 0, label: "Fiche et exercice", kind: "qcm", prompt: "Quel coupon annuel pour une obligation de nominal 1 000 € à 4 % ?", options: ["4 €", "40 €", "400 €", "0,4 €"], unit: null, branch: "marches", card: { term: "Coupon", definition: "Intérêt périodique versé par une obligation.", simple: "Le loyer de l'argent prêté.", example: "4 % sur 1 000 € = 40 €.", application: "Mesurer le revenu d'une obligation.", level: 1 }, answer: 1, explain: "1 000 € × 4 % = 40 € par an." },
    { i: 1, label: "Calcul", kind: "num", prompt: "Une action cote 24 € avec un bénéfice de 3 € par action. Quel est son PER ?", options: null, unit: "", branch: "maths", card: null, answer: 8, tolerance: 0.01, explain: "PER = cours ÷ bénéfice par action = 24 ÷ 3 = 8." },
    { i: 2, label: "Définition", kind: "qcm", prompt: "Quel terme correspond à : « Intérêt périodique versé par une obligation » ?", options: ["Nominal", "Coupon", "Liquidité", "Sous-jacent"], unit: null, card: null, branch: "marches", answer: 1, explain: "Coupon : intérêt périodique versé par une obligation." },
  ];
  const answers: ({ ok: boolean; value: number } | null)[] = [null, null, null];
  let closed = false;
  const training = () => {
    const answered = answers.filter(Boolean).length;
    const correct = answers.filter((a) => a?.ok).length;
    return closed ? null : {
      id: "train-test", hours: 1, subject: "marches", count: 3, answered,
      done: answered === 3 ? { correct, total: 3, bonusXp: correct >= 3 * 0.8 ? 6 : 0, trust: 0 } : null,
      items: items.map((it, k) => ({ i: it.i, label: it.label, kind: it.kind, prompt: it.prompt, options: it.options, unit: it.unit, card: it.card, branch: it.branch, result: answers[k] ? { ok: answers[k]!.ok, value: answers[k]!.value, answer: it.answer, explain: it.explain } : null })),
    };
  };
  await page.route("**/api/game/*/view?name=planning*", async (route) => {
    const r = await route.fetch();
    const json = await r.json();
    await route.fulfill({ response: r, json: { ...json, training: training() } });
  });
  await page.route("**/api/game/*/action", async (route) => {
    const body = route.request().postDataJSON();
    if (body.type === "training_answer") {
      const it = items[body.index];
      const value = body.choice ?? body.value;
      const ok = it.kind === "qcm" ? value === it.answer : Math.abs(value - it.answer) <= (it.tolerance ?? 0);
      answers[body.index] = { ok, value };
      await route.fulfill({ json: { ok: true, data: { ok } } });
    } else if (body.type === "training_close") { closed = true; await route.fulfill({ json: { ok: true } }); }
    else await route.continue();
  });

  await go(page, "/play/planning");
  await expect(page.getByTestId("training")).toBeVisible({ timeout: 15000 });
  // 1. Fiche de cours + QCM (on se trompe volontairement)
  await expect(page.getByTestId("tr-card")).toContainText("Coupon");
  await expect(page.getByTestId("tr-card")).toContainText("À quoi ça sert");
  // Accessibilité de la séance (contrastes, libellés)
  const ax = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa"]).analyze();
  expect(ax.violations.map((v) => `${v.id} ×${v.nodes.length}`)).toEqual([]);
  await page.getByTestId("tr-opt-0").click();
  await expect(page.getByTestId("tr-result")).toContainText("Pas tout à fait", { timeout: 15000 });
  await expect(page.getByTestId("tr-result")).toContainText("40 € par an");
  await expect(page.getByTestId("tr-opt-1")).toBeDisabled();
  await page.getByTestId("tr-next").click();
  // 2. Question numérique (virgule décimale acceptée)
  await expect(page.getByTestId("tr-prompt")).toContainText("PER");
  await expect(page.getByTestId("tr-card")).toHaveCount(0);
  await page.getByTestId("tr-num").fill("8");
  await page.getByTestId("tr-submit").click();
  await expect(page.getByTestId("tr-result")).toContainText("Bonne réponse", { timeout: 15000 });
  await page.getByTestId("tr-next").click();
  // 3. Définition
  await page.getByTestId("tr-opt-1").click();
  await expect(page.getByTestId("tr-result")).toContainText("Bonne réponse", { timeout: 15000 });
  await page.getByTestId("tr-end").click();
  // Bilan : 2 / 3, la question ratée est rappelée avec sa correction
  await expect(page.getByTestId("tr-summary")).toContainText("2 / 3");
  await expect(page.getByTestId("tr-summary")).toContainText("40 € par an");
  await expect(page.getByTestId("tr-summary")).toContainText("Sous 80 %");
  await page.getByTestId("tr-close").click();
  await expect(page.getByTestId("training")).toHaveCount(0, { timeout: 15000 });
  await expect(page.getByTestId("notebook")).toBeVisible();
});
