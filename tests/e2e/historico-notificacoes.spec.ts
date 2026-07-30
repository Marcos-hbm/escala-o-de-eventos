import { test, expect, loginUI, prisma, novaEmpresa, novoTrabalhador, novoEvento, vincular, inscrever, uid } from "./fixtures";

/** RF12 (histórico) e RF15 (notificações internas). */

test.describe("Histórico e notificações", () => {
  test("RF12: histórico mostra participação como 'Escalado'", async ({ page }) => {
    const emp = await novaEmpresa();
    const trab = await novoTrabalhador();
    await vincular(trab.id, emp.id, "ATIVO");
    const ev = await novoEvento(emp.id, { nome: `Hist ${uid()}`, status: "FINALIZADO" });
    await inscrever(ev.id, trab.id, "ESCALADO");

    await loginUI(page, "TRABALHADOR", trab.email);
    await page.goto("/trabalhador/historico");
    const linha = page.locator("div.rounded-xl").filter({ hasText: ev.nome }).first();
    await expect(linha).toBeVisible();
    await expect(linha.getByText("Escalado")).toBeVisible();
  });

  test("RF15: novo evento gera notificação ao vinculado", async ({ page }) => {
    const emp = await novaEmpresa();
    const trab = await novoTrabalhador();
    await vincular(trab.id, emp.id, "ATIVO");

    // Empresa cria evento pela UI (dispara notificação em lote)
    const nome = `Notif ${uid()}`;
    await loginUI(page, "EMPRESA", emp.email);
    await page.getByRole("link", { name: /Novo evento/ }).click();
    await page.getByLabel("Nome do evento *").fill(nome);
    await page.getByLabel("Data *").fill("2026-12-01");
    await page.getByLabel("Vagas *").fill("3");
    await page.getByLabel(/Cachê/).fill("120");
    await page.getByRole("button", { name: "Salvar evento" }).click();
    await expect(page).toHaveURL(/\/empresa\/eventos$/);

    // Trabalhador vê a notificação
    await loginUI(page, "TRABALHADOR", trab.email);
    await page.goto("/trabalhador/notificacoes");
    await expect(page.getByText("Nova oportunidade de trabalho")).toBeVisible();
  });

  test("RF15: marcar todas as notificações como lidas", async ({ page }) => {
    const emp = await novaEmpresa();
    const trab = await novoTrabalhador();
    await prisma.notificacao.create({
      data: { userId: trab.id, tipo: "NOVO_EVENTO", titulo: "Aviso de teste", mensagem: `msg ${uid()}` },
    });

    await loginUI(page, "TRABALHADOR", trab.email);
    await page.goto("/trabalhador/notificacoes");
    await expect(page.getByText("1 não lida(s)")).toBeVisible();
    await page.getByRole("button", { name: "Marcar todas como lidas" }).click();
    await expect(page.getByText("0 não lida(s)")).toBeVisible();
  });
});
