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
  novoEventoHoje,
  novaMensagemCoordenacao,
  registrarPresenca,
  vincular,
  uid,
} from "./fixtures";

/**
 * v4 fase 5 — Comunicação do evento (item 7) e painel do coordenador (item 8).
 *
 * A janela do canal depende da data: os cenários usam `novoEventoHoje` para o evento
 * em andamento e `novoEvento` (data futura fixa) para verificar que o canal fica
 * fechado fora do dia.
 */

async function cenarioAoVivo(opts: { escalado?: boolean } = {}) {
  const emp = await novaEmpresa({ plano: "PROFESSIONAL" });
  const trab = await novoTrabalhador({ nome: `Com ${uid()}` });
  await vincular(trab.id, emp.id, "ATIVO");
  const ev = await novoEventoHoje(emp.id, { nome: `AoVivo ${uid()}` });
  const insc = await prisma.inscricao.create({
    data: { eventoId: ev.id, userId: trab.id, status: opts.escalado === false ? "INSCRITO" : "ESCALADO" },
  });
  return { emp, trab, ev, insc };
}

test.describe("Canal do trabalhador (item 7)", () => {
  test("escalado em evento de hoje abre pedido e a coordenação é notificada", async ({ page }) => {
    const { emp, trab, ev } = await cenarioAoVivo();

    await loginUI(page, "TRABALHADOR", trab.email);
    await irPara(page, `/trabalhador/eventos/${ev.id}`);
    await expect(page.getByTestId("comunicacao-evento")).toBeVisible();

    await page.getByLabel("O que você precisa? *").selectOption("INTERVALO");
    await page.getByLabel("Detalhe (opcional)").fill("15 minutos às 19h, por favor.");
    await page.getByRole("button", { name: "Enviar à coordenação" }).click();

    await expect(page.getByTestId("flash")).toContainText("Pedido enviado à coordenação");
    const minha = page.getByTestId("minha-solicitacao").first();
    await expect(minha).toContainText("Solicitar intervalo");
    await expect(minha).toContainText("Em análise");

    const sol = await prisma.solicitacaoEvento.findFirstOrThrow({ where: { eventoId: ev.id, userId: trab.id } });
    expect(sol.status).toBe("EM_ANALISE");
    expect(sol.mensagem).toContain("15 minutos");

    // A coordenação (membros da empresa) recebe notificação.
    const notif = await prisma.notificacao.findFirst({
      where: { membro: { empresaId: emp.id }, tipo: "SOLICITACAO_RECEBIDA" },
    });
    expect(notif?.mensagem).toContain(trab.nome);
  });

  test("pedido urgente é marcado como tal para a coordenação", async ({ page }) => {
    const { emp, trab, ev } = await cenarioAoVivo();

    await loginUI(page, "TRABALHADOR", trab.email);
    await irPara(page, `/trabalhador/eventos/${ev.id}`);
    await page.getByLabel("O que você precisa? *").selectOption("SUBSTITUICAO");
    await page.getByRole("button", { name: "Enviar à coordenação" }).click();
    await expect(page.getByTestId("flash")).toContainText("solicitar substituição");

    const notif = await prisma.notificacao.findFirstOrThrow({
      where: { membro: { empresaId: emp.id }, tipo: "SOLICITACAO_RECEBIDA" },
    });
    expect(notif.titulo).toContain("⚠");
  });

  test("segundo pedido do mesmo tipo em aberto é recusado nas duas camadas", async ({ page }) => {
    const { trab, ev } = await cenarioAoVivo();
    await prisma.solicitacaoEvento.create({ data: { eventoId: ev.id, userId: trab.id, tipo: "AJUDA" } });

    await loginUI(page, "TRABALHADOR", trab.email);
    await irPara(page, `/trabalhador/eventos/${ev.id}`);

    // Camada 1 — a tela desabilita a opção já em aberto.
    const opcaoAjuda = page.locator('#tipo-solicitacao option[value="AJUDA"]');
    await expect(opcaoAjuda).toBeDisabled();
    await expect(opcaoAjuda).toContainText("já em aberto");

    // Camada 2 — burlando a tela (removendo o disabled), o servidor recusa com motivo.
    await page.evaluate(() => {
      document
        .querySelectorAll<HTMLOptionElement>("#tipo-solicitacao option[disabled]")
        .forEach((o) => o.removeAttribute("disabled"));
    });
    await page.getByLabel("O que você precisa? *").selectOption("AJUDA");
    await page.getByRole("button", { name: "Enviar à coordenação" }).click();

    await expect(page.getByTestId("flash")).toContainText("já tem um pedido");
    expect(
      await prisma.solicitacaoEvento.count({ where: { eventoId: ev.id, userId: trab.id, tipo: "AJUDA" } }),
    ).toBe(1);
  });

  test("canal fechado antes do dia do evento, com histórico visível", async ({ page }) => {
    const emp = await novaEmpresa();
    const trab = await novoTrabalhador();
    await vincular(trab.id, emp.id, "ATIVO");
    // `novoEvento` usa data futura fixa (20/12/2026).
    const ev = await novoEvento(emp.id, { nome: `Futuro ${uid()}` });
    await prisma.inscricao.create({ data: { eventoId: ev.id, userId: trab.id, status: "ESCALADO" } });

    await loginUI(page, "TRABALHADOR", trab.email);
    await irPara(page, `/trabalhador/eventos/${ev.id}`);
    await expect(page.getByTestId("canal-fechado")).toContainText("abre no dia do evento");
    await expect(page.getByRole("button", { name: "Enviar à coordenação" })).toHaveCount(0);
  });

  test("quem não está escalado não vê o canal", async ({ page }) => {
    const { trab, ev } = await cenarioAoVivo({ escalado: false });

    await loginUI(page, "TRABALHADOR", trab.email);
    await irPara(page, `/trabalhador/eventos/${ev.id}`);
    await expect(page.getByTestId("comunicacao-evento")).toHaveCount(0);
  });
});

test.describe("Painel do coordenador (item 8)", () => {
  test("responde solicitação: status muda, trabalhador é notificado e vê a resposta", async ({ page }) => {
    const { emp, trab, ev } = await cenarioAoVivo();
    const sol = await prisma.solicitacaoEvento.create({
      data: { eventoId: ev.id, userId: trab.id, tipo: "INTERVALO", mensagem: "Posso sair 15 min?" },
    });

    await loginUI(page, "EMPRESA", emp.email);
    await irPara(page, `/empresa/eventos/${ev.id}/painel`);
    await expect(page.getByTestId("solicitacao")).toContainText("Posso sair 15 min?");

    await page.getByLabel(`Resposta para ${trab.nome}`).fill("Pode ir às 19h, 15 minutos.");
    await page.getByRole("button", { name: new RegExp(`Responder Solicitar intervalo de ${trab.nome}`) }).click();
    await expect(page.getByTestId("flash")).toContainText("aprovada");

    const depois = await prisma.solicitacaoEvento.findUniqueOrThrow({ where: { id: sol.id } });
    expect(depois.status).toBe("APROVADA");
    expect(depois.resposta).toContain("15 minutos");
    expect(depois.respondidoEm).not.toBeNull();

    const notif = await prisma.notificacao.findFirst({
      where: { userId: trab.id, tipo: "SOLICITACAO_RESPONDIDA" },
    });
    expect(notif?.titulo).toContain("aprovada");

    // O trabalhador acompanha na própria tela.
    await loginUI(page, "TRABALHADOR", trab.email);
    await irPara(page, `/trabalhador/eventos/${ev.id}`);
    const minha = page.getByTestId("minha-solicitacao").first();
    await expect(minha).toContainText("Aprovada");
    await expect(minha).toContainText("Pode ir às 19h");
  });

  test("transição inválida é recusada com explicação", async ({ page }) => {
    const { emp, trab, ev } = await cenarioAoVivo();
    const sol = await prisma.solicitacaoEvento.create({
      data: { eventoId: ev.id, userId: trab.id, tipo: "AJUDA", status: "FINALIZADA" },
    });

    await loginUI(page, "EMPRESA", emp.email);
    await irPara(page, `/empresa/eventos/${ev.id}/painel`);
    // Terminal: o painel não oferece formulário de resposta.
    await expect(page.getByTestId("solicitacao")).toContainText("Finalizada");
    await expect(page.getByRole("button", { name: /Responder Pedir ajuda/ })).toHaveCount(0);
    expect((await prisma.solicitacaoEvento.findUniqueOrThrow({ where: { id: sol.id } })).status).toBe("FINALIZADA");
  });

  test("check-in e check-out registram horário e marcam presença", async ({ page }) => {
    const { emp, trab, ev, insc } = await cenarioAoVivo();

    await loginUI(page, "EMPRESA", emp.email);
    await irPara(page, `/empresa/eventos/${ev.id}/painel`);
    const linha = page.getByTestId("linha-equipe").filter({ hasText: trab.nome });
    await expect(linha.getByTestId("estado-presenca")).toContainText("Aguardando check-in");

    await page.getByRole("button", { name: `Check-in de ${trab.nome}` }).click();
    await expect(page.getByTestId("flash")).toContainText("Check-in");
    await expect(page.getByTestId("linha-equipe").filter({ hasText: trab.nome }).getByTestId("estado-presenca")).toContainText("Em turno");

    // Check-in confirma presença (resumo usado pela reputação) e grava o horário.
    const presenca = await prisma.registroPresenca.findUniqueOrThrow({ where: { inscricaoId: insc.id } });
    expect(presenca.checkInEm).not.toBeNull();
    expect((await prisma.inscricao.findUniqueOrThrow({ where: { id: insc.id } })).status).toBe("PRESENTE");

    await page.getByRole("button", { name: `Check-out de ${trab.nome}` }).click();
    await expect(page.getByTestId("flash")).toContainText("Check-out");
    await expect(page.getByTestId("linha-equipe").filter({ hasText: trab.nome }).getByTestId("estado-presenca")).toContainText("Turno encerrado");
    expect((await prisma.registroPresenca.findUniqueOrThrow({ where: { inscricaoId: insc.id } })).checkOutEm).not.toBeNull();
  });

  test("check-out sem check-in é recusado", async ({ page }) => {
    const { emp, trab, ev, insc } = await cenarioAoVivo();
    await registrarPresenca(insc.id); // registro vazio, sem check-in

    await loginUI(page, "EMPRESA", emp.email);
    await irPara(page, `/empresa/eventos/${ev.id}/painel`);
    // Sem check-in, o painel nem oferece o botão de check-out.
    await expect(page.getByRole("button", { name: `Check-out de ${trab.nome}` })).toHaveCount(0);
    await expect(page.getByRole("button", { name: `Check-in de ${trab.nome}` })).toBeVisible();
  });

  test("mensagem para a equipe notifica os escalados e aparece nos dois lados", async ({ page }) => {
    const { emp, trab, ev } = await cenarioAoVivo();

    await loginUI(page, "EMPRESA", emp.email);
    await irPara(page, `/empresa/eventos/${ev.id}/painel`);
    await page.getByLabel("Recado para toda a equipe escalada *").fill("Ponto de encontro às 15h30 no portão B.");
    await page.getByRole("button", { name: "Enviar para a equipe" }).click();
    await expect(page.getByTestId("flash")).toContainText("Mensagem enviada");
    await expect(page.getByTestId("mensagem-coordenacao").first()).toContainText("portão B");

    const notif = await prisma.notificacao.findFirst({
      where: { userId: trab.id, tipo: "MENSAGEM_COORDENACAO" },
    });
    expect(notif?.mensagem).toContain("portão B");

    await loginUI(page, "TRABALHADOR", trab.email);
    await irPara(page, `/trabalhador/eventos/${ev.id}`);
    await expect(page.getByTestId("recado-coordenacao").first()).toContainText("portão B");
  });

  test("atualização periódica existe e o link de atualizar traz o pedido novo", async ({ page }) => {
    const { emp, trab, ev } = await cenarioAoVivo();

    await loginUI(page, "EMPRESA", emp.email);
    await irPara(page, `/empresa/eventos/${ev.id}/painel`);
    // O polling é declarado com intervalo visível — assim o teste não depende do timer.
    const atualizacao = page.getByTestId("atualizacao-automatica");
    await expect(atualizacao).toHaveAttribute("data-intervalo", "15");
    await expect(atualizacao).toHaveAttribute("data-ativo", "true");
    await expect(page.getByTestId("solicitacao")).toHaveCount(0);

    // Pedido criado "por fora" (como faria o trabalhador no celular).
    await prisma.solicitacaoEvento.create({
      data: { eventoId: ev.id, userId: trab.id, tipo: "PROBLEMA", mensagem: "Faltou material no posto." },
    });

    await page.getByTestId("atualizar-agora").click();
    await expect(page.getByTestId("solicitacao")).toContainText("Faltou material no posto.");
  });

  test("visualizador não acessa o painel", async ({ page }) => {
    const { emp, ev } = await cenarioAoVivo();
    const leitor = await novoMembro(emp.id, "VISUALIZADOR");

    await loginUI(page, "EMPRESA", leitor.email);
    await irPara(page, `/empresa/eventos/${ev.id}/painel`);
    await expect(page.getByTestId("empty-state")).toContainText("Painel restrito à coordenação");
    await expect(page.getByTestId("linha-equipe")).toHaveCount(0);
  });

  test("histórico continua acessível depois do evento, sem ações", async ({ page }) => {
    const emp = await novaEmpresa();
    const trab = await novoTrabalhador();
    await vincular(trab.id, emp.id, "ATIVO");
    const ev = await novoEvento(emp.id, { status: "FINALIZADO" });
    const insc = await prisma.inscricao.create({ data: { eventoId: ev.id, userId: trab.id, status: "PRESENTE" } });
    await prisma.solicitacaoEvento.create({
      data: { eventoId: ev.id, userId: trab.id, tipo: "INTERVALO", status: "FINALIZADA", mensagem: "Pedido antigo" },
    });
    const membro = await prisma.membro.findFirstOrThrow({ where: { empresaId: emp.id } });
    await novaMensagemCoordenacao(ev.id, membro.id, "Recado histórico do evento");
    await registrarPresenca(insc.id, new Date("2026-12-20T19:00:00.000Z"), new Date("2026-12-21T02:00:00.000Z"));

    await loginUI(page, "EMPRESA", emp.email);
    await irPara(page, `/empresa/eventos/${ev.id}/painel`);
    await expect(page.getByTestId("solicitacao")).toContainText("Pedido antigo");
    await expect(page.getByTestId("mensagem-coordenacao").first()).toContainText("Recado histórico");
    await expect(page.getByTestId("linha-equipe").getByTestId("estado-presenca")).toContainText("Turno encerrado");
    // Ações fechadas: nada de responder, mensagem ou ponto.
    await expect(page.getByRole("button", { name: "Enviar para a equipe" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: /Check-in de/ })).toHaveCount(0);
  });
});
