import { test, expect, loginUI, novaEmpresa, novoTrabalhador, vincular, uid } from "./fixtures";

/**
 * Jornada "golden path" ponta a ponta, autossuficiente:
 * empresa cria proposta → trabalhador vinculado se inscreve →
 * empresa escala e finaliza → baixa CSV → trabalhador vê no histórico.
 */
test.describe.serial("Jornada completa", () => {
  const nomeEvento = `Jornada ${uid()}`;
  let empEmail = "";
  let trabEmail = "";

  test.beforeAll(async () => {
    const emp = await novaEmpresa({ nome: `JornadaEmp-${uid()}` });
    const trab = await novoTrabalhador({ nome: `JornadaTrab-${uid()}` });
    await vincular(trab.id, emp.id, "ATIVO");
    empEmail = emp.email;
    trabEmail = trab.email;
  });

  test("1. empresa cria a proposta (RF05/RF08)", async ({ page }) => {
    await loginUI(page, "EMPRESA", empEmail);
    await page.getByRole("link", { name: /Novo evento/ }).click();
    await page.getByLabel("Nome do evento *").fill(nomeEvento);
    await page.getByLabel("Data *").fill("2026-12-20");
    await page.getByLabel("Vagas *").fill("5");
    await page.getByLabel("Funções").fill("Recepção, Apoio");
    await page.getByLabel(/Cachê/).fill("150");
    await page.getByRole("button", { name: "Salvar evento" }).click();
    await expect(page.getByRole("heading", { name: nomeEvento })).toBeVisible();
  });

  test("2. trabalhador se inscreve (RF09/RF13)", async ({ page }) => {
    await loginUI(page, "TRABALHADOR", trabEmail);
    const card = page.locator("div.rounded-xl").filter({ hasText: nomeEvento }).first();
    await card.getByRole("link", { name: /Ver detalhes/ }).click();
    await page.getByRole("button", { name: "Inscrever-se" }).click();
    await expect(page.getByText("Você está inscrito")).toBeVisible();
  });

  test("3. empresa escala, finaliza e baixa CSV (RF10/RF11)", async ({ page }) => {
    await loginUI(page, "EMPRESA", empEmail);
    const card = page.locator("div.rounded-xl").filter({ hasText: nomeEvento }).first();
    await card.getByRole("link", { name: /Escalar/ }).click();
    await page.getByRole("button", { name: "Selecionar todos" }).click();
    await page.getByRole("button", { name: "Escalar e finalizar evento" }).click();
    await expect(page.getByText(/trabalhador\(es\) escalado\(s\)/)).toBeVisible();

    const href = await page.getByRole("link", { name: /Baixar lista/ }).getAttribute("href");
    const resp = await page.request.get(href!);
    expect(resp.status()).toBe(200);
    expect(await resp.text()).toContain("ESCALADO");
  });

  test("4. trabalhador vê 'Escalado' no histórico (RF12/RF14)", async ({ page }) => {
    await loginUI(page, "TRABALHADOR", trabEmail);
    await page.getByRole("link", { name: "Histórico" }).click();
    const linha = page.locator("div.rounded-xl").filter({ hasText: nomeEvento }).first();
    await expect(linha.getByText("Escalado")).toBeVisible();
  });
});
