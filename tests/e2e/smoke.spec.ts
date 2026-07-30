import { test, expect } from "@playwright/test";

/**
 * Smoke E2E — não requer banco de dados.
 * Verifica páginas públicas e o gating de rotas do middleware.
 */

test("landing carrega e leva ao cadastro", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Escalação de freelancers");
  await page.getByRole("link", { name: "Sou empresa" }).click();
  await expect(page).toHaveURL(/\/cadastro\/empresa/);
});

test("política de privacidade cita a LGPD", async ({ page }) => {
  await page.goto("/privacidade");
  await expect(page.getByText("13.709/2018")).toBeVisible();
});

test("rota protegida redireciona para login", async ({ page }) => {
  await page.goto("/trabalhador/eventos");
  await expect(page).toHaveURL(/\/login\?tipo=TRABALHADOR/);
});

test("tela de login permite alternar tipo de conta", async ({ page }) => {
  await page.goto("/login");
  await expect(page.getByRole("heading", { name: "Entrar" })).toBeVisible();
  await page.getByRole("button", { name: "Empresa" }).click();
});
