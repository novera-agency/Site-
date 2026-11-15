import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "./e2e",
  timeout: 240_000,
  expect: { timeout: 15_000 }, // marge pour le démarrage à froid du serveur et la charge de plusieurs tests en parallèle
  use: { baseURL: process.env.E2E_URL || "http://localhost:3100", trace: "off", viewport: { width: 1440, height: 900 } },
  webServer: { command: "npm run build && npx next start -p 3100", url: "http://localhost:3100", reuseExistingServer: true, timeout: 240_000, env: { SAVE_DIR: "./data/e2e", E2E_HOOKS: "1" } },
});
