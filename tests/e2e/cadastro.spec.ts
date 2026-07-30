import { test, expect, gerarCpf, gerarCnpj, uid, novoTrabalhador, novaEmpresa } from "./fixtures";

/**
 * RF01/RF02 — Cadastro de trabalhador e empresa.
 * Casos: sucesso, documento inválido, duplicidade, idade mínima, senha fraca,
 * consentimento LGPD obrigatório.
 */

test.describe("Cadastro de trabalhador (RF01)", () => {
  async function preencher(page: import("@playwright/test").Page, over: Record<string, string> = {}) {
    const u = uid();
    const dados = {
      nome: `Fulano ${u}`,
      cpf: gerarCpf(),
      dataNascimento: "1998-05-12",
      telefone: "61988887777",
      email: `trab_${u}@e2e.test`,
      senha: "Senha@123",
      ...over,
    };
    await page.goto("/cadastro/trabalhador");
    await page.getByLabel("Nome completo").fill(dados.nome);
    await page.getByLabel("CPF").fill(dados.cpf);
    await page.getByLabel("Data de nascimento").fill(dados.dataNascimento);
    await page.getByLabel("Telefone (DDD + número)").fill(dados.telefone);
    await page.getByLabel("E-mail").fill(dados.email);
    await page.getByLabel("Senha").fill(dados.senha);
    return dados;
  }

  test("sucesso: cria conta e entra na área do trabalhador", async ({ page }) => {
    await preencher(page);
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Criar conta" }).click();
    await expect(page).toHaveURL(/\/trabalhador\/eventos/);
  });

  test("erro: CPF inválido", async ({ page }) => {
    await preencher(page, { cpf: "11111111111" });
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Criar conta" }).click();
    await expect(page.getByText("CPF inválido")).toBeVisible();
  });

  test("erro: menor de 16 anos", async ({ page }) => {
    await preencher(page, { dataNascimento: "2020-01-01" });
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Criar conta" }).click();
    await expect(page.getByText(/ao menos 16 anos/)).toBeVisible();
  });

  test("erro: senha fraca (sem número)", async ({ page }) => {
    await preencher(page, { senha: "abcdefgh" });
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Criar conta" }).click();
    await expect(page.getByText(/senha deve conter ao menos um número/)).toBeVisible();
  });

  test("erro: e-mail já cadastrado", async ({ page }) => {
    const existente = await novoTrabalhador();
    await preencher(page, { email: existente.email });
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Criar conta" }).click();
    await expect(page.getByText("E-mail já cadastrado")).toBeVisible();
  });

  test("bloqueio: sem aceitar a LGPD não envia (campo obrigatório)", async ({ page }) => {
    await preencher(page);
    // não marca o checkbox
    await page.getByRole("button", { name: "Criar conta" }).click();
    await expect(page).toHaveURL(/\/cadastro\/trabalhador/); // permanece na página
  });
});

test.describe("Cadastro de empresa (RF02)", () => {
  async function preencher(page: import("@playwright/test").Page, over: Record<string, string> = {}) {
    const u = uid();
    const dados = {
      nome: `Empresa ${u}`,
      cnpj: gerarCnpj(),
      telefone: "6133334444",
      email: `emp_${u}@e2e.test`,
      senha: "Senha@123",
      ...over,
    };
    await page.goto("/cadastro/empresa");
    await page.getByLabel("Razão social / Nome fantasia").fill(dados.nome);
    await page.getByLabel("CNPJ").fill(dados.cnpj);
    await page.getByLabel("Telefone").fill(dados.telefone);
    await page.getByLabel("E-mail corporativo").fill(dados.email);
    await page.getByLabel("Senha").fill(dados.senha);
    return dados;
  }

  test("sucesso: cria conta e entra na área da empresa", async ({ page }) => {
    await preencher(page);
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Criar conta" }).click();
    await expect(page).toHaveURL(/\/empresa\/eventos/);
  });

  test("erro: CNPJ inválido", async ({ page }) => {
    await preencher(page, { cnpj: "11222333000182" });
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Criar conta" }).click();
    await expect(page.getByText("CNPJ inválido")).toBeVisible();
  });

  test("erro: CNPJ já cadastrado", async ({ page }) => {
    const existente = await novaEmpresa();
    await preencher(page, { cnpj: existente.cnpj });
    await page.getByRole("checkbox").check();
    await page.getByRole("button", { name: "Criar conta" }).click();
    await expect(page.getByText("CNPJ já cadastrado")).toBeVisible();
  });
});
