import { test, expect, loginUI, novaEmpresa, novoTrabalhador, SENHA } from "./fixtures";

/** RF03 — Autenticação e logout. */

test.describe("Login (RF03)", () => {
  test("sucesso: empresa autentica e vai para seus eventos", async ({ page }) => {
    const emp = await novaEmpresa();
    await loginUI(page, "EMPRESA", emp.email);
    await expect(page).toHaveURL(/\/empresa\/eventos/);
  });

  test("sucesso: trabalhador autentica e vai para descobrir eventos", async ({ page }) => {
    const t = await novoTrabalhador();
    await loginUI(page, "TRABALHADOR", t.email);
    await expect(page).toHaveURL(/\/trabalhador\/eventos/);
  });

  test("erro: senha incorreta", async ({ page }) => {
    const t = await novoTrabalhador();
    await loginUI(page, "TRABALHADOR", t.email, "SenhaErrada9", { esperarEntrar: false });
    await expect(page.getByText("E-mail ou senha incorretos.")).toBeVisible();
  });

  test("erro: tipo de conta errado (empresa tentando logar como trabalhador)", async ({ page }) => {
    const emp = await novaEmpresa();
    await loginUI(page, "TRABALHADOR", emp.email, SENHA, { esperarEntrar: false });
    await expect(page.getByText("E-mail ou senha incorretos.")).toBeVisible();
  });

  test("erro: e-mail inexistente", async ({ page }) => {
    await loginUI(page, "EMPRESA", "naoexiste@e2e.test", SENHA, { esperarEntrar: false });
    await expect(page.getByText("E-mail ou senha incorretos.")).toBeVisible();
  });

  test("logout encerra a sessão e bloqueia área protegida", async ({ page }) => {
    const emp = await novaEmpresa();
    await loginUI(page, "EMPRESA", emp.email);
    await expect(page).toHaveURL(/\/empresa\/eventos/);
    await page.getByRole("button", { name: "Sair" }).click();
    await expect(page).toHaveURL(/\/login/);
    await page.goto("/empresa/eventos");
    await expect(page).toHaveURL(/\/login\?tipo=EMPRESA/);
  });
});
