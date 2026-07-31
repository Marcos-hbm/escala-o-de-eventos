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
  favoritar,
  bloquear,
  uid,
} from "./fixtures";

/**
 * v4 fase 4 — Favoritos (item 4) e bloqueio (item 5).
 *
 * O foco é o efeito **real** do bloqueio: além da tela, ele tem de valer nas
 * consultas — descoberta de vagas, acesso ao evento, candidatura e busca de
 * candidatos.
 */

async function cenario() {
  const emp = await novaEmpresa({ plano: "PROFESSIONAL" });
  const trab = await novoTrabalhador({ nome: `Rel ${uid()}` });
  await vincular(trab.id, emp.id, "ATIVO");
  const ev = await novoEvento(emp.id, { nome: `Rel ev ${uid()}` });
  return { emp, trab, ev };
}

test.describe("Favoritos", () => {
  test("favoritar na tela de pagamentos e ver na lista própria", async ({ page }) => {
    const { emp, trab } = await cenario();
    const evFinal = await novoEvento(emp.id, { status: "FINALIZADO", valorCache: 100 });
    await prisma.inscricao.create({ data: { eventoId: evFinal.id, userId: trab.id, status: "PRESENTE" } });

    await loginUI(page, "EMPRESA", emp.email);
    await irPara(page, `/empresa/eventos/${evFinal.id}/pagamentos`);
    await page.getByRole("button", { name: new RegExp(`Adicionar ${trab.nome} aos favoritos`) }).click();
    await expect(page.getByTestId("flash")).toContainText("adicionado aos favoritos");

    await irPara(page, "/empresa/relacionamento");
    const favorito = page.getByTestId("favorito").filter({ hasText: trab.nome });
    await expect(favorito).toBeVisible();

    expect(
      await prisma.trabalhadorFavorito.count({ where: { empresaId: emp.id, userId: trab.id } }),
    ).toBe(1);
  });

  test("o mesmo controle desfavorita (alterna)", async ({ page }) => {
    const { emp, trab } = await cenario();
    await favoritar(emp.id, trab.id);

    await loginUI(page, "EMPRESA", emp.email);
    await irPara(page, "/empresa/relacionamento");
    await page.getByRole("button", { name: new RegExp(`Remover ${trab.nome} dos favoritos`) }).click();
    await expect(page.getByTestId("flash")).toContainText("saiu dos favoritos");

    expect(await prisma.trabalhadorFavorito.count({ where: { empresaId: emp.id } })).toBe(0);
  });

  test("lista vazia explica para que serve", async ({ page }) => {
    const { emp } = await cenario();
    await loginUI(page, "EMPRESA", emp.email);
    await irPara(page, "/empresa/relacionamento");
    await expect(page.getByTestId("empty-state").first()).toContainText("Nenhum favorito ainda");
  });
});

test.describe("Bloqueio — efeitos reais", () => {
  test("bloquear exige motivo, desfaz vínculo e cancela inscrição futura", async ({ page }) => {
    const { emp, trab, ev } = await cenario();
    await prisma.inscricao.create({ data: { eventoId: ev.id, userId: trab.id, status: "INSCRITO" } });
    await favoritar(emp.id, trab.id);

    await loginUI(page, "EMPRESA", emp.email);
    await irPara(page, "/empresa/relacionamento");
    await page.getByRole("button", { name: new RegExp(`Bloquear ${trab.nome}`) }).click();
    await page.getByLabel(`Motivo do bloqueio de ${trab.nome}`).fill("Não compareceu ao evento sem avisar.");
    await page.getByRole("button", { name: "Confirmar bloqueio" }).click();

    await expect(page.getByTestId("flash")).toContainText("foi bloqueado");
    await expect(page.getByTestId("bloqueio")).toContainText("Não compareceu ao evento sem avisar.");

    // Estado coerente: vínculo desfeito, inscrição futura recusada, favorito removido.
    const vinculo = await prisma.vinculo.findFirstOrThrow({ where: { userId: trab.id, empresaId: emp.id } });
    expect(vinculo.status).toBe("DESVINCULADO");
    const insc = await prisma.inscricao.findFirstOrThrow({ where: { userId: trab.id, eventoId: ev.id } });
    expect(insc.status).toBe("RECUSADO_EMPRESA");
    expect(await prisma.trabalhadorFavorito.count({ where: { empresaId: emp.id, userId: trab.id } })).toBe(0);
    expect(
      await prisma.auditLog.count({ where: { acao: "TRABALHADOR_BLOQUEADO", entidadeId: trab.id } }),
    ).toBe(1);
  });

  test("bloqueado não vê vagas da empresa nem acessa o evento por URL", async ({ page }) => {
    const { emp, trab, ev } = await cenario();
    // Segunda empresa, sem bloqueio: as vagas dela continuam visíveis.
    const outra = await novaEmpresa();
    await vincular(trab.id, outra.id, "ATIVO");
    const evOutra = await novoEvento(outra.id, { nome: `Livre ${uid()}` });
    await bloquear(emp.id, trab.id, "Bloqueio de teste");

    await loginUI(page, "TRABALHADOR", trab.email);
    await irPara(page, "/trabalhador/eventos");
    await expect(page.getByRole("heading", { name: ev.nome })).toHaveCount(0);
    await expect(page.getByRole("heading", { name: evOutra.nome })).toBeVisible();

    const resp = await page.goto(`/trabalhador/eventos/${ev.id}`);
    expect(resp?.status()).toBe(404);
  });

  test("bloqueado não consegue se candidatar nem por requisição direta", async ({ page }) => {
    const { emp, trab, ev } = await cenario();
    await bloquear(emp.id, trab.id, "Bloqueio de teste");

    await loginUI(page, "TRABALHADOR", trab.email);
    // Sem passar pela tela: a action é que precisa recusar.
    const inscricoesAntes = await prisma.inscricao.count({ where: { userId: trab.id, eventoId: ev.id } });
    await page.evaluate(async (eventoId) => {
      const fd = new FormData();
      fd.set("eventoId", String(eventoId));
      await fetch(location.href, { method: "POST", body: fd }).catch(() => {});
    }, ev.id);

    expect(await prisma.inscricao.count({ where: { userId: trab.id, eventoId: ev.id } })).toBe(inscricoesAntes);
  });

  test("bloqueado não aparece na busca de trabalhadores para convidar", async ({ page }) => {
    const { emp, trab } = await cenario();
    await bloquear(emp.id, trab.id, "Bloqueio de teste");
    // Desvincula para o trabalhador voltar a ser "buscável" se não fosse o bloqueio.
    await prisma.vinculo.deleteMany({ where: { userId: trab.id, empresaId: emp.id } });

    await loginUI(page, "EMPRESA", emp.email);
    await irPara(page, "/empresa/vinculos");
    await page.getByPlaceholder("Início do nome do trabalhador").fill(trab.nome);
    await page.getByRole("button", { name: "Buscar" }).click();
    await expect(page.getByText("Nenhum trabalhador encontrado.")).toBeVisible();
  });
});

test.describe("Bloqueio — remoção", () => {
  test("coordenador não remove; administrador remove e o histórico fica", async ({ page }) => {
    const { emp, trab } = await cenario();
    await bloquear(emp.id, trab.id, "Motivo original do bloqueio");
    const coord = await novoMembro(emp.id, "COORDENADOR");

    // 1) Coordenador vê o bloqueio, mas não tem o controle de remover.
    await loginUI(page, "EMPRESA", coord.email);
    await irPara(page, "/empresa/relacionamento");
    await expect(page.getByTestId("bloqueio")).toContainText("Motivo original do bloqueio");
    await expect(page.getByRole("button", { name: new RegExp(`Desbloquear ${trab.nome}`) })).toHaveCount(0);
    await expect(page.getByText("Somente Administrador ou Proprietário remove bloqueio.")).toBeVisible();

    // 2) Proprietário remove, com motivo.
    await loginUI(page, "EMPRESA", emp.email);
    await irPara(page, "/empresa/relacionamento");
    await page.getByLabel(`Motivo para desbloquear ${trab.nome}`).fill("Conversado, liberado para novos eventos.");
    await page.getByRole("button", { name: new RegExp(`Desbloquear ${trab.nome}`) }).click();
    await expect(page.getByTestId("flash")).toContainText("desbloqueado");

    const linhas = await prisma.trabalhadorBloqueio.findMany({ where: { empresaId: emp.id, userId: trab.id } });
    expect(linhas).toHaveLength(1);
    expect(linhas[0].removidoEm).not.toBeNull();
    expect(linhas[0].motivoRemocao).toContain("liberado");
    // A linha histórica permanece — bloqueio removido não é bloqueio apagado.
    await expect(page.getByText("Bloqueios já removidos (1)")).toBeVisible();
  });

  test("depois de desbloqueado, o trabalhador volta a ver as vagas", async ({ page }) => {
    const { emp, trab, ev } = await cenario();
    const b = await bloquear(emp.id, trab.id, "Bloqueio temporário");

    await loginUI(page, "TRABALHADOR", trab.email);
    await irPara(page, "/trabalhador/eventos");
    await expect(page.getByRole("heading", { name: ev.nome })).toHaveCount(0);

    // Remoção do bloqueio (como o administrador faria) e o vínculo restabelecido.
    await prisma.trabalhadorBloqueio.update({ where: { id: b.id }, data: { removidoEm: new Date() } });
    await prisma.vinculo.updateMany({ where: { userId: trab.id, empresaId: emp.id }, data: { status: "ATIVO" } });

    await irPara(page, "/trabalhador/eventos");
    await expect(page.getByRole("heading", { name: ev.nome })).toBeVisible();
  });
});

test.describe("Avaliação por critérios — histórico", () => {
  test("favorito mostra destaque e ponto a melhorar a partir dos critérios", async ({ page }) => {
    const { emp, trab } = await cenario();
    const ev = await novoEvento(emp.id, { status: "FINALIZADO" });
    await prisma.inscricao.create({ data: { eventoId: ev.id, userId: trab.id, status: "PRESENTE" } });
    await favoritar(emp.id, trab.id);
    await prisma.avaliacao.create({
      data: {
        eventoId: ev.id,
        empresaId: emp.id,
        userId: trab.id,
        autor: "EMPRESA",
        nota: 4,
        notaPontualidade: 5,
        notaComunicacao: 2,
        notaTrabalhoEquipe: 4,
        notaQualidade: 4,
        notaComprometimento: 5,
      },
    });

    await loginUI(page, "EMPRESA", emp.email);
    await irPara(page, "/empresa/relacionamento");
    const favorito = page.getByTestId("favorito").filter({ hasText: trab.nome });
    await expect(favorito).toContainText("Destaque: Pontualidade");
    await expect(favorito).toContainText("a melhorar: Comunicação");
  });
});
