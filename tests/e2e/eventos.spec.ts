import { test, expect, loginUI, novaEmpresa, novoEvento, uid, irPara } from "./fixtures";

/** RF05 — CRUD de eventos + filtro. */

test.describe("Eventos (RF05)", () => {
  test("criar evento válido aparece na lista (RF05/RF08)", async ({ page }) => {
    const emp = await novaEmpresa();
    const nome = `Novo Evento ${uid()}`;
    await loginUI(page, "EMPRESA", emp.email);
    await page.getByRole("link", { name: /Novo evento/ }).click();

    await page.getByLabel("Nome do evento *").fill(nome);
    await page.getByLabel("Data *").fill("2026-11-30");
    await page.getByLabel("Vagas *").fill("8");
    await page.getByLabel("Funções").fill("Garçom, Segurança");
    await page.getByLabel(/Cachê/).fill("200");
    await page.getByRole("button", { name: "Salvar evento" }).click();

    await expect(page).toHaveURL(/\/empresa\/eventos$/);
    await expect(page.getByRole("heading", { name: nome })).toBeVisible();
  });

  test("editar evento altera os dados", async ({ page }) => {
    const emp = await novaEmpresa();
    const ev = await novoEvento(emp.id, { nome: `Editar ${uid()}` });
    const novoNome = `Editado ${uid()}`;

    await loginUI(page, "EMPRESA", emp.email);
    await irPara(page, "/empresa/eventos");
    const card = page.locator("div.rounded-xl").filter({ hasText: ev.nome }).first();
    await card.getByRole("link", { name: /Editar/ }).click();

    await page.getByLabel("Nome do evento *").fill(novoNome);
    await page.getByRole("button", { name: "Salvar alterações" }).click();
    await expect(page.getByRole("heading", { name: novoNome })).toBeVisible();
  });

  test("excluir evento remove da lista", async ({ page }) => {
    const emp = await novaEmpresa();
    const ev = await novoEvento(emp.id, { nome: `Excluir ${uid()}` });

    await loginUI(page, "EMPRESA", emp.email);
    await irPara(page, "/empresa/eventos");
    // v4 item 12: exclusão pede confirmação, dizendo o que será apagado.
    await page.getByRole("button", { name: `Excluir ${ev.nome}` }).click();
    await expect(page.getByTestId("confirmacao")).toContainText(`Excluir "${ev.nome}"?`);
    await page.getByRole("button", { name: `Excluir evento: Excluir ${ev.nome}` }).click();
    await expect(page.getByRole("heading", { name: ev.nome })).toHaveCount(0);
  });

  test("filtrar eventos por nome", async ({ page }) => {
    const emp = await novaEmpresa();
    const alvo = `Alvo ${uid()}`;
    await novoEvento(emp.id, { nome: alvo });
    await novoEvento(emp.id, { nome: `Outro ${uid()}` });

    await loginUI(page, "EMPRESA", emp.email);
    await irPara(page, "/empresa/eventos");
    await page.getByPlaceholder("Buscar por nome").fill(alvo);
    await page.getByRole("button", { name: "Filtrar" }).click();
    await expect(page.getByRole("heading", { name: alvo })).toBeVisible();
    await expect(page.getByRole("heading", { name: /^Outro / })).toHaveCount(0);
  });

  test("evento recém-criado nasce como PUBLICADO", async ({ page }) => {
    const emp = await novaEmpresa();
    const ev = await novoEvento(emp.id, { nome: `Pub ${uid()}` });
    await loginUI(page, "EMPRESA", emp.email);
    await irPara(page, "/empresa/eventos");
    const card = page.locator("div.rounded-xl").filter({ hasText: ev.nome }).first();
    await expect(card.getByText("PUBLICADO")).toBeVisible();
  });
});
