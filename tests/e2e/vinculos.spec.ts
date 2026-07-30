import { test, expect, loginUI, novaEmpresa, novoTrabalhador, vincular, uid } from "./fixtures";

/** RF06/RF07 — Vínculos (convite, solicitação, aceite, recusa, desvínculo, favorito). */

test.describe("Vínculos (RF06/RF07)", () => {
  test("trabalhador solicita e empresa aceita → vínculo ativo", async ({ page }) => {
    const nomeEmp = `SolEmpresa-${uid()}`;
    const nomeTrab = `SolTrab-${uid()}`;
    const emp = await novaEmpresa({ nome: nomeEmp });
    const trab = await novoTrabalhador({ nome: nomeTrab });

    // Trabalhador busca e solicita
    await loginUI(page, "TRABALHADOR", trab.email);
    await page.goto("/trabalhador/vinculos");
    await page.getByPlaceholder("Digite o início do nome da empresa").fill(nomeEmp);
    await page.getByRole("button", { name: "Buscar" }).click();
    await page.getByRole("button", { name: "Solicitar vínculo" }).click();
    await expect(page.getByText("Aguardando resposta")).toBeVisible();

    // Empresa aceita
    await loginUI(page, "EMPRESA", emp.email);
    await page.goto("/empresa/vinculos");
    const pedido = page.locator("div.rounded-xl").filter({ hasText: nomeTrab }).first();
    await pedido.getByRole("button", { name: "Aceitar" }).click();
    const ativo = page.locator("div.rounded-xl").filter({ hasText: nomeTrab });
    await expect(ativo.getByText(nomeTrab)).toBeVisible();
  });

  test("empresa convida e trabalhador aceita → vínculo ativo", async ({ page }) => {
    const nomeEmp = `ConvEmpresa-${uid()}`;
    const nomeTrab = `ConvTrab-${uid()}`;
    const emp = await novaEmpresa({ nome: nomeEmp });
    const trab = await novoTrabalhador({ nome: nomeTrab });

    await loginUI(page, "EMPRESA", emp.email);
    await page.goto("/empresa/vinculos");
    await page.getByPlaceholder("Início do nome do trabalhador").fill(nomeTrab);
    await page.getByRole("button", { name: "Buscar" }).click();
    await page.getByRole("button", { name: "Convidar" }).click();
    await expect(page.getByText("Aguardando resposta")).toBeVisible();

    await loginUI(page, "TRABALHADOR", trab.email);
    await page.goto("/trabalhador/vinculos");
    const convite = page.locator("div.rounded-xl").filter({ hasText: nomeEmp }).first();
    await convite.getByRole("button", { name: "Aceitar" }).click();
    await expect(page.getByRole("heading", { name: "Vínculos ativos" })).toBeVisible();
    await expect(page.getByText(nomeEmp)).toBeVisible();
  });

  test("empresa recusa a solicitação do trabalhador", async ({ page }) => {
    const emp = await novaEmpresa();
    const trab = await novoTrabalhador({ nome: `RecTrab-${uid()}` });
    await vincular(trab.id, emp.id, "PENDENTE", "TRABALHADOR");

    await loginUI(page, "EMPRESA", emp.email);
    await page.goto("/empresa/vinculos");
    const pedido = page.locator("div.rounded-xl").filter({ hasText: trab.nome }).first();
    await pedido.getByRole("button", { name: "Recusar" }).click();
    // Some da lista de pendentes
    await expect(page.locator("div.rounded-xl").filter({ hasText: trab.nome })).toHaveCount(0);
  });

  test("favoritar e desfavoritar empresa vinculada", async ({ page }) => {
    const emp = await novaEmpresa({ nome: `FavEmpresa-${uid()}` });
    const trab = await novoTrabalhador();
    await vincular(trab.id, emp.id, "ATIVO");

    await loginUI(page, "TRABALHADOR", trab.email);
    await page.goto("/trabalhador/vinculos");
    const card = page.locator("div.rounded-xl").filter({ hasText: emp.nome }).first();
    await card.getByRole("button", { name: "Favoritar" }).click();
    await expect(page.locator("div.rounded-xl").filter({ hasText: emp.nome }).getByRole("button", { name: "Desfavoritar" })).toBeVisible();
  });

  test("desvincular remove o vínculo ativo", async ({ page }) => {
    const emp = await novaEmpresa({ nome: `DesvEmpresa-${uid()}` });
    const trab = await novoTrabalhador();
    await vincular(trab.id, emp.id, "ATIVO");

    await loginUI(page, "TRABALHADOR", trab.email);
    await page.goto("/trabalhador/vinculos");
    const card = page.locator("div.rounded-xl").filter({ hasText: emp.nome }).first();
    await card.getByRole("button", { name: "Desvincular" }).click();
    await expect(page.locator("div.rounded-xl").filter({ hasText: emp.nome })).toHaveCount(0);
  });

  test("busca sem correspondência informa 'nenhuma empresa encontrada'", async ({ page }) => {
    const trab = await novoTrabalhador();
    await loginUI(page, "TRABALHADOR", trab.email);
    await page.goto("/trabalhador/vinculos");
    await page.getByPlaceholder("Digite o início do nome da empresa").fill(`inexistente-${uid()}`);
    await page.getByRole("button", { name: "Buscar" }).click();
    await expect(page.getByText("Nenhuma empresa encontrada.")).toBeVisible();
  });
});
