import {
  test,
  expect,
  prisma,
  loginUI,
  irPara,
  novaEmpresa,
  novoMembro,
  novoTrabalhador,
  novoEvento,
  vincular,
  novoPagamento,
  definirChavePix,
  uid,
} from "./fixtures";

/**
 * v4 fase 3 — Financeiro: pagamentos, fechamento de caixa, contestação, PIX e
 * histórico. Cada teste monta seu próprio cenário (empresa, trabalhador, evento
 * finalizado e escalação), então podem rodar em paralelo.
 */

/** Evento finalizado com um trabalhador escalado e pagamento pendente. */
async function cenarioPago(opts: { valor?: number; comPix?: boolean } = {}) {
  const emp = await novaEmpresa({ plano: "PROFESSIONAL" });
  const trab = await novoTrabalhador({ nome: `Fin ${uid()}` });
  await vincular(trab.id, emp.id, "ATIVO");
  const ev = await novoEvento(emp.id, { status: "FINALIZADO", valorCache: opts.valor ?? 200 });
  await prisma.inscricao.create({ data: { eventoId: ev.id, userId: trab.id, status: "PRESENTE" } });
  if (opts.comPix) await definirChavePix(trab.id, "EMAIL", `${trab.email}`);
  return { emp, trab, ev };
}

test.describe("Tela de pagamentos", () => {
  test("botão aparece no card do evento finalizado e a tela lista o escalado", async ({ page }) => {
    const { emp, trab, ev } = await cenarioPago();

    await loginUI(page, "EMPRESA", emp.email);
    await irPara(page, "/empresa/eventos");
    const card = page.locator("div.rounded-xl").filter({ hasText: ev.nome }).first();
    await card.getByRole("link", { name: /Finalizar pagamentos/ }).click();

    await expect(page).toHaveURL(new RegExp(`/empresa/eventos/${ev.id}/pagamentos`));
    await expect(page.getByRole("heading", { name: new RegExp(`Pagamentos — ${ev.nome}`) })).toBeVisible();
    // A linha do trabalhador é criada automaticamente com o cachê do evento.
    const linha = page.getByTestId("linha-pagamento").filter({ hasText: trab.nome });
    await expect(linha).toBeVisible();
    await expect(linha).toContainText("R$ 0,00 de R$ 200,00");
    await expect(linha).toContainText("Pagamento pendente");
  });

  test("registra pagamento total: status, notificação e histórico", async ({ page }) => {
    const { emp, trab, ev } = await cenarioPago();

    await loginUI(page, "EMPRESA", emp.email);
    await irPara(page, `/empresa/eventos/${ev.id}/pagamentos`);

    await page.getByLabel(`Valor a registrar para ${trab.nome}`).fill("200");
    await page.getByRole("button", { name: "Registrar pagamento" }).click();

    await expect(page.getByTestId("flash")).toContainText(`Pagamento de ${trab.nome} quitado`);
    const linha = page.getByTestId("linha-pagamento").filter({ hasText: trab.nome });
    await expect(linha).toContainText("✅ Pago");

    const pagamento = await prisma.pagamento.findFirstOrThrow({ where: { eventoId: ev.id, userId: trab.id } });
    expect(Number(pagamento.valorPago)).toBe(200);
    expect(pagamento.status).toBe("PAGO");
    expect(pagamento.quitadoEm).not.toBeNull();

    // Histórico financeiro (lançamento) e notificação ao trabalhador.
    expect(await prisma.pagamentoLancamento.count({ where: { pagamentoId: pagamento.id } })).toBe(1);
    const notif = await prisma.notificacao.findFirst({
      where: { userId: trab.id, tipo: "PAGAMENTO_REGISTRADO" },
    });
    expect(notif?.mensagem).toContain(ev.nome);

    // Auditoria da alteração financeira (item 13).
    const log = await prisma.auditLog.findFirst({
      where: { acao: "PAGAMENTO_QUITADO", entidadeId: pagamento.id },
    });
    expect(log?.detalhe).toContain(trab.nome);
  });

  test("pagamento parcial acumula e recusa valor acima do saldo", async ({ page }) => {
    const { emp, trab, ev } = await cenarioPago({ valor: 300 });

    await loginUI(page, "EMPRESA", emp.email);
    await irPara(page, `/empresa/eventos/${ev.id}/pagamentos`);

    await page.getByLabel(`Valor a registrar para ${trab.nome}`).fill("100");
    await page.getByRole("button", { name: "Registrar pagamento" }).click();
    await expect(page.getByTestId("flash")).toContainText("R$ 100,00 registrados");

    const linha = page.getByTestId("linha-pagamento").filter({ hasText: trab.nome });
    await expect(linha).toContainText("Pago parcialmente");
    await expect(linha).toContainText("falta R$ 200,00");

    // Acima do saldo: recusa com o valor restante na mensagem, sem gravar.
    await page.getByLabel(`Valor a registrar para ${trab.nome}`).fill("500");
    await page.getByRole("button", { name: "Registrar pagamento" }).click();
    await expect(page.getByRole("alert").filter({ hasText: "restam R$ 200,00" })).toBeVisible();

    const pagamento = await prisma.pagamento.findFirstOrThrow({ where: { eventoId: ev.id, userId: trab.id } });
    expect(Number(pagamento.valorPago)).toBe(100);
    expect(pagamento.status).toBe("PARCIAL");
  });

  test("estorno volta para pendente preservando o histórico de lançamentos", async ({ page }) => {
    const { emp, trab, ev } = await cenarioPago();
    const pagamento = await novoPagamento(ev.id, trab.id, emp.id, { valorDevido: 200, valorPago: 200, forma: "PIX" });
    await prisma.pagamentoLancamento.create({ data: { pagamentoId: pagamento.id, valor: 200, forma: "PIX" } });

    await loginUI(page, "EMPRESA", emp.email);
    await irPara(page, `/empresa/eventos/${ev.id}/pagamentos`);
    await page.getByRole("button", { name: "Marcar como pendente" }).click();

    await expect(page.getByTestId("flash")).toContainText("voltou para pendente");
    const depois = await prisma.pagamento.findUniqueOrThrow({ where: { id: pagamento.id } });
    expect(Number(depois.valorPago)).toBe(0);
    expect(depois.status).toBe("PENDENTE");
    // O lançamento continua: histórico financeiro não é apagado para "arrumar" a tela.
    expect(await prisma.pagamentoLancamento.count({ where: { pagamentoId: pagamento.id } })).toBe(1);
    expect(
      await prisma.auditLog.count({ where: { acao: "PAGAMENTO_ESTORNADO", entidadeId: pagamento.id } }),
    ).toBe(1);
  });
});

test.describe("Chave PIX", () => {
  test("trabalhador cadastra e vê mascarada; empresa vê completa com auditoria", async ({ page }) => {
    const { emp, trab, ev } = await cenarioPago();

    // 1) Trabalhador cadastra a chave.
    await loginUI(page, "TRABALHADOR", trab.email);
    await irPara(page, "/trabalhador/perfil");
    await page.getByLabel("Tipo de chave *").selectOption("EMAIL");
    // `getByLabel` casa por substring: "Chave *" também casaria com "Tipo de chave *".
    await page.getByLabel("Chave *", { exact: true }).fill("pix.teste@exemplo.com");
    await page.getByRole("button", { name: /chave PIX/ }).click();
    await expect(page.getByTestId("flash")).toContainText("cifrada");
    // Na tela, só mascarada.
    // "pix.teste" tem 9 caracteres: 2 visíveis + 7 asteriscos.
    await expect(page.getByTestId("pix-atual")).toContainText("pi*******@exemplo.com");

    // O banco guarda cifrado.
    const noBanco = await prisma.user.findUniqueOrThrow({
      where: { id: trab.id },
      select: { pixChaveCifrada: true, pixTipo: true },
    });
    expect(noBanco.pixTipo).toBe("EMAIL");
    expect(noBanco.pixChaveCifrada).not.toContain("pix.teste@exemplo.com");

    // 2) Empresa abre a chave na tela de pagamentos — e isso é auditado.
    const antes = await prisma.auditLog.count({ where: { acao: "PIX_VISUALIZADO", entidadeId: trab.id } });
    await loginUI(page, "EMPRESA", emp.email);
    await irPara(page, `/empresa/eventos/${ev.id}/pagamentos`);
    await page.getByRole("link", { name: /Ver chave PIX/ }).click();

    await expect(page.getByTestId("chave-pix")).toHaveText("pix.teste@exemplo.com");
    await expect(page.getByTestId("copiar-pix")).toBeVisible();
    expect(await prisma.auditLog.count({ where: { acao: "PIX_VISUALIZADO", entidadeId: trab.id } })).toBe(antes + 1);
  });
});

test.describe("Fechamento de caixa", () => {
  test("iniciar notifica os escalados; conferir registra e concluir fecha", async ({ page }) => {
    const { emp, trab, ev } = await cenarioPago({ valor: 150 });

    await loginUI(page, "EMPRESA", emp.email);
    await irPara(page, `/empresa/eventos/${ev.id}/pagamentos`);

    await page.getByRole("button", { name: "Iniciar fechamento de caixa" }).click();
    await expect(page.getByTestId("flash")).toContainText("1 trabalhador(es) notificados");

    const aviso = await prisma.notificacao.findFirst({ where: { userId: trab.id, tipo: "FECHAMENTO_INICIADO" } });
    expect(aviso?.mensagem).toContain("fechamento de caixa");

    // Conferência do trabalhador: paga metade em dinheiro.
    await page.getByLabel(`Valor pago a ${trab.nome} no fechamento`).fill("75");
    await page.getByTestId("form-fechamento").getByLabel("Forma").selectOption("DINHEIRO");
    await page.getByRole("button", { name: "Conferir" }).click();
    await expect(page.getByTestId("flash")).toContainText("R$ 75,00 conferidos");

    const pagamento = await prisma.pagamento.findFirstOrThrow({ where: { eventoId: ev.id, userId: trab.id } });
    expect(Number(pagamento.valorPago)).toBe(75);
    expect(pagamento.status).toBe("PARCIAL");
    expect(pagamento.forma).toBe("DINHEIRO");

    // Concluir: agora que todos foram conferidos, o botão funciona.
    await page.getByRole("button", { name: "Concluir fechamento" }).click();
    await expect(page.getByTestId("flash")).toContainText("Fechamento de caixa concluído");
    const fechamento = await prisma.fechamentoCaixa.findUniqueOrThrow({ where: { eventoId: ev.id } });
    expect(fechamento.status).toBe("CONCLUIDO");
    expect(fechamento.concluidoEm).not.toBeNull();
  });
});

test.describe("Contestação de pagamento", () => {
  test("trabalhador contesta, empresa é notificada e responde", async ({ page }) => {
    const { emp, trab, ev } = await cenarioPago({ valor: 200 });
    const pagamento = await novoPagamento(ev.id, trab.id, emp.id, { valorDevido: 200, valorPago: 100, forma: "PIX" });

    // 1) Trabalhador vê o indicador e contesta.
    await loginUI(page, "TRABALHADOR", trab.email);
    await irPara(page, "/trabalhador/financeiro");
    const linha = page.getByTestId("pagamento-trabalhador").filter({ hasText: ev.nome });
    await expect(linha.getByTestId("indicador-pagamento")).toContainText("Pago parcialmente");

    await linha.getByRole("button", { name: /Contestar pagamento/ }).click();
    await page.getByLabel("Qual o problema? *").fill("Valor menor que o combinado");
    await page.getByLabel("Explique o que aconteceu *").fill(
      "Recebi apenas metade do combinado e não houve aviso sobre o restante.",
    );
    await page.getByRole("button", { name: "Enviar contestação" }).click();
    await expect(page.getByTestId("flash")).toContainText("Contestação registrada");

    const contestacao = await prisma.contestacaoPagamento.findFirstOrThrow({ where: { pagamentoId: pagamento.id } });
    expect(contestacao.status).toBe("ABERTA");

    // A empresa (responsáveis do financeiro) foi notificada.
    const notifMembro = await prisma.notificacao.findFirst({
      where: { membro: { empresaId: emp.id }, tipo: "CONTESTACAO_ABERTA" },
    });
    expect(notifMembro?.mensagem).toContain("contestou o pagamento");

    // 2) Empresa responde.
    await loginUI(page, "EMPRESA", emp.email);
    await irPara(page, `/empresa/eventos/${ev.id}/pagamentos`);
    await expect(page.getByTestId("contestacao")).toContainText("Valor menor que o combinado");
    await page.getByLabel("Resposta ao trabalhador *").fill("Confirmado: o restante entra no próximo fechamento.");
    await page.getByRole("button", { name: "Responder" }).click();
    await expect(page.getByTestId("flash")).toContainText("Contestação respondida");

    const depois = await prisma.contestacaoPagamento.findUniqueOrThrow({ where: { id: contestacao.id } });
    expect(depois.status).toBe("RESOLVIDA");
    expect(depois.resposta).toContain("próximo fechamento");
    const notifTrab = await prisma.notificacao.findFirst({
      where: { userId: trab.id, tipo: "CONTESTACAO_RESPONDIDA" },
    });
    expect(notifTrab).not.toBeNull();
  });

  test("bloqueia segunda contestação em aberto para o mesmo pagamento", async ({ page }) => {
    const { emp, trab, ev } = await cenarioPago();
    const pagamento = await novoPagamento(ev.id, trab.id, emp.id, { valorDevido: 200, valorPago: 0 });
    await prisma.contestacaoPagamento.create({
      data: { pagamentoId: pagamento.id, userId: trab.id, motivo: "Já aberta", descricao: "Contestação existente." },
    });

    await loginUI(page, "TRABALHADOR", trab.email);
    await irPara(page, "/trabalhador/financeiro");
    // Com contestação em aberto, o botão de contestar não aparece.
    await expect(page.getByRole("button", { name: /Contestar pagamento/ })).toHaveCount(0);
    await expect(page.getByTestId("minha-contestacao")).toContainText("ABERTA");
  });
});

test.describe("RBAC financeiro", () => {
  test("coordenador sem autorização não vê Financeiro nem a tela de pagamentos", async ({ page }) => {
    const { emp, ev } = await cenarioPago();
    const coord = await novoMembro(emp.id, "COORDENADOR");

    await loginUI(page, "EMPRESA", coord.email);
    await expect(page.getByRole("link", { name: "Financeiro" })).toHaveCount(0);

    await irPara(page, `/empresa/eventos/${ev.id}/pagamentos`);
    await expect(page.getByTestId("empty-state")).toContainText("Área financeira restrita");
    await expect(page.getByTestId("aviso-negado")).toContainText("autorização");
    await expect(page.getByTestId("linha-pagamento")).toHaveCount(0);
  });

  test("coordenador autorizado acessa e registra pagamento", async ({ page }) => {
    const { emp, trab, ev } = await cenarioPago({ valor: 120 });
    const coord = await novoMembro(emp.id, "COORDENADOR", { autorizadoFinanceiro: true });

    await loginUI(page, "EMPRESA", coord.email);
    await expect(page.getByRole("link", { name: "Financeiro" })).toBeVisible();

    await irPara(page, `/empresa/eventos/${ev.id}/pagamentos`);
    await page.getByLabel(`Valor a registrar para ${trab.nome}`).fill("120");
    await page.getByRole("button", { name: "Registrar pagamento" }).click();
    await expect(page.getByTestId("flash")).toContainText("quitado");

    // O lançamento fica atribuído ao membro que registrou.
    const pagamento = await prisma.pagamento.findFirstOrThrow({ where: { eventoId: ev.id, userId: trab.id } });
    expect(pagamento.registradoPorMembroId).toBe(coord.id);
  });

  test("visualizador não acessa o financeiro nem por URL", async ({ page }) => {
    const { emp } = await cenarioPago();
    const leitor = await novoMembro(emp.id, "VISUALIZADOR", { autorizadoFinanceiro: true });

    await loginUI(page, "EMPRESA", leitor.email);
    await irPara(page, "/empresa/financeiro");
    // Nem com a flag ligada: visualizador é somente leitura por papel.
    await expect(page.getByTestId("empty-state")).toContainText("Área financeira restrita");
  });
});

test.describe("Históricos financeiros", () => {
  test("empresa filtra o histórico por situação e busca por nome", async ({ page }) => {
    const { emp, trab, ev } = await cenarioPago();
    await novoPagamento(ev.id, trab.id, emp.id, { valorDevido: 200, valorPago: 200, forma: "PIX" });

    const outro = await novoTrabalhador({ nome: `Pendente ${uid()}` });
    await vincular(outro.id, emp.id, "ATIVO");
    await prisma.inscricao.create({ data: { eventoId: ev.id, userId: outro.id, status: "ESCALADO" } });
    await novoPagamento(ev.id, outro.id, emp.id, { valorDevido: 150, valorPago: 0 });

    await loginUI(page, "EMPRESA", emp.email);
    await irPara(page, "/empresa/financeiro");
    await expect(page.getByTestId("linha-financeiro")).toHaveCount(2);

    await page.getByLabel("Situação").selectOption("PAGO");
    await page.getByRole("button", { name: "Filtrar" }).click();
    await expect(page.getByTestId("linha-financeiro")).toHaveCount(1);
    await expect(page.getByTestId("linha-financeiro").first()).toContainText(trab.nome);

    await irPara(page, "/empresa/financeiro");
    await page.getByPlaceholder("Buscar por nome").fill(outro.nome);
    await page.getByRole("button", { name: "Filtrar" }).click();
    await expect(page.getByTestId("linha-financeiro")).toHaveCount(1);
    await expect(page.getByTestId("linha-financeiro").first()).toContainText("Pagamento pendente");
  });

  test("trabalhador vê o indicador de pagamento no histórico de participações", async ({ page }) => {
    const { emp, trab, ev } = await cenarioPago();
    await novoPagamento(ev.id, trab.id, emp.id, { valorDevido: 200, valorPago: 200, forma: "PIX" });

    await loginUI(page, "TRABALHADOR", trab.email);
    await irPara(page, "/trabalhador/historico");
    const card = page.locator("div.rounded-xl").filter({ hasText: ev.nome }).first();
    await expect(card.getByTestId("indicador-pagamento-historico")).toContainText("✅ Pago");
  });
});
