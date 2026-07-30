import { defineConfig, devices } from "@playwright/test";

/**
 * E2E com Playwright (mesma ferramenta de UI usada no padrão de QA).
 *
 * - Sem E2E_BASE_URL: sobe o servidor automaticamente (`npm run dev`).
 * - Com E2E_BASE_URL (ex.: apontando para `npm start`): reaproveita o servidor
 *   já em execução — recomendado, pois o build de produção não sofre atraso de
 *   compilação sob demanda e deixa os testes bem mais estáveis.
 *
 * Todos os testes (exceto smoke) precisam de um PostgreSQL migrado
 * (`npm run db:up` ou `docker compose up -d`). Os dados são criados isoladamente
 * por teste (ver tests/e2e/fixtures.ts).
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  workers: process.env.CI ? 1 : 2,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never" }]],
  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:3000",
    navigationTimeout: 30_000,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: process.env.E2E_BASE_URL
    ? undefined
    : {
        command: "npm run dev",
        url: "http://localhost:3000",
        reuseExistingServer: !process.env.CI,
        timeout: 120_000,
      },
});
