import { test, expect, loginUI, novaEmpresa, novoTrabalhador, irPara } from "./fixtures";

/** LGPD (Lei 13.709/2018) — acesso/portabilidade, eliminação, consentimento. */

test.describe("LGPD", () => {
  test("exportar meus dados retorna JSON sem a senha (Art. 18 II/V)", async ({ page }) => {
    const trab = await novoTrabalhador();
    await loginUI(page, "TRABALHADOR", trab.email);
    const resp = await page.request.get("/api/lgpd/export");
    expect(resp.status()).toBe(200);
    const body = await resp.json();
    expect(body.dadosPessoais.email).toBe(trab.email);
    expect(JSON.stringify(body)).not.toContain("senhaHash");
  });

  test("exportar sem sessão é negado (401)", async ({ page }) => {
    const resp = await page.request.get("/api/lgpd/export");
    expect(resp.status()).toBe(401);
  });

  test("excluir conta anonimiza e impede novo login (Art. 18 VI)", async ({ page }) => {
    const emp = await novaEmpresa();
    await loginUI(page, "EMPRESA", emp.email);
    await irPara(page, "/empresa/perfil");
    await page.getByRole("button", { name: "Excluir minha conta" }).click();
    await page.getByRole("button", { name: "Confirmar exclusão" }).click();
    await expect(page).toHaveURL(/conta=excluida/);

    // Login com as credenciais antigas deve falhar.
    await loginUI(page, "EMPRESA", emp.email, undefined, { esperarEntrar: false });
    await expect(page.getByText("E-mail ou senha incorretos.")).toBeVisible();
  });

  test("política de privacidade é pública e cita a LGPD e o DPO", async ({ page }) => {
    await irPara(page, "/privacidade");
    await expect(page.getByText("13.709/2018")).toBeVisible();
    await expect(page.getByRole("heading", { name: /Encarregado/ })).toBeVisible();
  });
});
