import { test, expect, loginUI, novaEmpresa, novoTrabalhador, definirChavePix, irPara } from "./fixtures";

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

  test("export descreve a chave PIX de forma legível, sem o criptograma", async ({ page }) => {
    const trab = await novoTrabalhador();
    await definirChavePix(trab.id, "EMAIL", "pix.titular@exemplo.com");

    await loginUI(page, "TRABALHADOR", trab.email);
    const body = await (await page.request.get("/api/lgpd/export")).json();

    // O texto cifrado (pacote `v1.iv.tag.dados`) não vai no pacote exportado.
    const bruto = JSON.stringify(body);
    expect(bruto).not.toContain("pixChaveCifrada");
    expect(bruto).not.toContain("v1.");
    // Nem a chave completa em claro: o arquivo circula fora do sistema.
    expect(bruto).not.toContain("pix.titular@exemplo.com");

    expect(body.dadosPessoais.chavePix.cadastrada).toBe(true);
    expect(body.dadosPessoais.chavePix.tipo).toBe("EMAIL");
    expect(body.dadosPessoais.chavePix.mascarada).toMatch(/\*/);
    expect(body.dadosPessoais.chavePix.atualizadaEm).not.toBeNull();
  });

  test("export de quem não cadastrou PIX informa 'não cadastrada'", async ({ page }) => {
    const trab = await novoTrabalhador();
    await loginUI(page, "TRABALHADOR", trab.email);
    const body = await (await page.request.get("/api/lgpd/export")).json();

    expect(body.dadosPessoais.chavePix).toEqual({
      cadastrada: false,
      tipo: null,
      mascarada: null,
      atualizadaEm: null,
    });
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
