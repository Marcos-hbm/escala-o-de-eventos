import { test, expect, prisma, loginUI, novaEmpresa, novoTrabalhador, vincular, novoEvento, inscrever, uid, irPara } from "./fixtures";

/** v2 — painéis, controle de presença e avaliação bidirecional. */

test.describe("v2 — Painéis (KPIs)", () => {
  test("empresa vê o painel com KPIs", async ({ page }) => {
    const emp = await novaEmpresa();
    await loginUI(page, "EMPRESA", emp.email);
    await irPara(page, "/empresa/dashboard");
    await expect(page.getByRole("heading", { name: "Painel" })).toBeVisible();
    await expect(page.getByText("Eventos", { exact: true })).toBeVisible();
    await expect(page.getByText("Reputação", { exact: true })).toBeVisible();
  });

  test("trabalhador vê o painel com KPIs", async ({ page }) => {
    const t = await novoTrabalhador();
    await loginUI(page, "TRABALHADOR", t.email);
    await irPara(page, "/trabalhador/dashboard");
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
    await irPara(page, `/empresa/eventos/${ev.id}/escalar`);
    await page.getByRole("button", { name: `Presença de ${nome}` }).click();
    await expect(page.getByText("Presente", { exact: true })).toBeVisible();
  });

  test("empresa avalia um trabalhador por critérios (v4) e a nota geral é a média", async ({ page }) => {
    const nome = `AvalTrab-${uid()}`;
    const { emp, ev, trab } = await cenarioFinalizado(nome);
    await loginUI(page, "EMPRESA", emp.email);
    await irPara(page, `/empresa/eventos/${ev.id}/escalar`);

    // v4: o formulário abre por linha e traz os cinco critérios.
    await page.getByRole("button", { name: "Avaliar", exact: true }).click();
    await page.getByRole("button", { name: "Pontualidade: 5 estrela(s)" }).click();
    await page.getByRole("button", { name: "Comunicação: 4 estrela(s)" }).click();
    await page.getByRole("button", { name: "Trabalho em equipe: 5 estrela(s)" }).click();
    await page.getByRole("button", { name: "Qualidade: 5 estrela(s)" }).click();
    await page.getByRole("button", { name: "Comprometimento: 4 estrela(s)" }).click();
    // Prévia da nota geral antes de salvar: média 4,6.
    await expect(page.getByTestId("previa-nota")).toContainText("4,6");

    await page.getByRole("button", { name: "Salvar avaliação" }).click();
    await expect(page.getByTestId("flash")).toContainText("Avaliação registrada.");

    const av = await prisma.avaliacao.findFirstOrThrow({
      where: { eventoId: ev.id, userId: trab.id, autor: "EMPRESA" },
    });
    // Nota geral = média arredondada dos critérios (4,6 -> 5), preservando a coluna
    // que reputação e score já usavam.
    expect(av.nota).toBe(5);
    expect(av.notaPontualidade).toBe(5);
    expect(av.notaComunicacao).toBe(4);
    expect(av.notaComprometimento).toBe(4);

    // O trabalhador é avisado da avaliação recebida.
    const notif = await prisma.notificacao.findFirst({
      where: { userId: trab.id, tipo: "AVALIACAO_RECEBIDA" },
    });
    expect(notif?.mensagem).toContain("nota geral 5");
  });

  test("trabalhador avalia a empresa pelo histórico", async ({ page }) => {
    const { emp, ev, trab } = await cenarioFinalizado(`HistTrab-${uid()}`);
    await loginUI(page, "TRABALHADOR", trab.email);
    await irPara(page, "/trabalhador/historico");
    await page.getByRole("button", { name: "4 estrela(s)" }).first().click();
    await page.getByRole("button", { name: /Avaliar empresa/ }).first().click();
    await expect(page.getByText("Avaliação registrada.")).toBeVisible();

    const av = await prisma.avaliacao.findFirst({
      where: { eventoId: ev.id, empresaId: emp.id, autor: "TRABALHADOR" },
    });
    expect(av?.nota).toBe(4);
  });
});
