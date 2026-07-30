import { test, expect, prisma, loginUI, novaEmpresa, novoTrabalhador, vincular, novoEvento, inscrever, uid } from "./fixtures";

/** v2 — painéis, controle de presença e avaliação bidirecional. */

test.describe("v2 — Painéis (KPIs)", () => {
  test("empresa vê o painel com KPIs", async ({ page }) => {
    const emp = await novaEmpresa();
    await loginUI(page, "EMPRESA", emp.email);
    await page.goto("/empresa/dashboard");
    await expect(page.getByRole("heading", { name: "Painel" })).toBeVisible();
    await expect(page.getByText("Eventos", { exact: true })).toBeVisible();
    await expect(page.getByText("Reputação", { exact: true })).toBeVisible();
  });

  test("trabalhador vê o painel com KPIs", async ({ page }) => {
    const t = await novoTrabalhador();
    await loginUI(page, "TRABALHADOR", t.email);
    await page.goto("/trabalhador/dashboard");
    await expect(page.getByRole("heading", { name: "Painel" })).toBeVisible();
    await expect(page.getByText("Escalações", { exact: true })).toBeVisible();
  });
});

test.describe("v2 — Presença e avaliação", () => {
  async function cenarioFinalizado(nomeTrab: string) {
    const emp = await novaEmpresa();
    const trab = await novoTrabalhador({ nome: nomeTrab });
    await vincular(trab.id, emp.id, "ATIVO");
    const ev = await novoEvento(emp.id, { nome: `V2 ${uid()}`, status: "FINALIZADO" });
    const insc = await inscrever(ev.id, trab.id, "ESCALADO");
    return { emp, trab, ev, insc };
  }

  test("empresa marca presença de um escalado", async ({ page }) => {
    const nome = `PresTrab-${uid()}`;
    const { emp, ev } = await cenarioFinalizado(nome);
    await loginUI(page, "EMPRESA", emp.email);
    await page.goto(`/empresa/eventos/${ev.id}/escalar`);
    await page.getByRole("button", { name: `Presença de ${nome}` }).click();
    await expect(page.getByText("Presente", { exact: true })).toBeVisible();
  });

  test("empresa avalia um trabalhador (reputação)", async ({ page }) => {
    const nome = `AvalTrab-${uid()}`;
    const { emp, ev, trab } = await cenarioFinalizado(nome);
    await loginUI(page, "EMPRESA", emp.email);
    await page.goto(`/empresa/eventos/${ev.id}/escalar`);

    await page.getByRole("button", { name: "5 estrela(s)" }).click();
    await page.getByRole("button", { name: "Avaliar", exact: true }).click();
    await expect(page.getByText("Avaliação registrada.")).toBeVisible();

    // Confirma no banco
    const av = await prisma.avaliacao.findFirst({
      where: { eventoId: ev.id, userId: trab.id, autor: "EMPRESA" },
    });
    expect(av?.nota).toBe(5);
  });

  test("trabalhador avalia a empresa pelo histórico", async ({ page }) => {
    const { emp, ev, trab } = await cenarioFinalizado(`HistTrab-${uid()}`);
    await loginUI(page, "TRABALHADOR", trab.email);
    await page.goto("/trabalhador/historico");
    await page.getByRole("button", { name: "4 estrela(s)" }).first().click();
    await page.getByRole("button", { name: /Avaliar empresa/ }).first().click();
    await expect(page.getByText("Avaliação registrada.")).toBeVisible();

    const av = await prisma.avaliacao.findFirst({
      where: { eventoId: ev.id, empresaId: emp.id, autor: "TRABALHADOR" },
    });
    expect(av?.nota).toBe(4);
  });
});
