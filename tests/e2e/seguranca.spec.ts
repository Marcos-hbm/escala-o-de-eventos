import { test, expect, loginUI, novaEmpresa, novoTrabalhador, novoEvento } from "./fixtures";

/** RNF03 — Controle de acesso: rotas protegidas, RBAC e IDOR. */

test.describe("Segurança e autorização", () => {
  test("rota do trabalhador sem sessão redireciona para login", async ({ page }) => {
    await page.goto("/trabalhador/vinculos");
    await expect(page).toHaveURL(/\/login\?tipo=TRABALHADOR/);
  });

  test("rota da empresa sem sessão redireciona para login", async ({ page }) => {
    await page.goto("/empresa/eventos");
    await expect(page).toHaveURL(/\/login\?tipo=EMPRESA/);
  });

  test("RBAC: trabalhador não acessa área da empresa", async ({ page }) => {
    const trab = await novoTrabalhador();
    await loginUI(page, "TRABALHADOR", trab.email);
    await page.goto("/empresa/eventos");
    await expect(page).toHaveURL(/\/trabalhador\/eventos/);
  });

  test("RBAC: empresa não acessa área do trabalhador", async ({ page }) => {
    const emp = await novaEmpresa();
    await loginUI(page, "EMPRESA", emp.email);
    await page.goto("/trabalhador/vinculos");
    await expect(page).toHaveURL(/\/empresa\/eventos/);
  });

  test("IDOR: empresa não escala evento de outra empresa (404)", async ({ page }) => {
    const dona = await novaEmpresa();
    const intrusa = await novaEmpresa();
    const ev = await novoEvento(dona.id);

    await loginUI(page, "EMPRESA", intrusa.email);
    const resp = await page.goto(`/empresa/eventos/${ev.id}/escalar`);
    expect(resp?.status()).toBe(404);
  });

  test("IDOR: empresa não baixa a lista (CSV) de evento alheio (404)", async ({ page }) => {
    const dona = await novaEmpresa();
    const intrusa = await novaEmpresa();
    const ev = await novoEvento(dona.id);

    await loginUI(page, "EMPRESA", intrusa.email);
    const resp = await page.request.get(`/empresa/eventos/${ev.id}/lista`);
    expect(resp.status()).toBe(404);
  });
});
