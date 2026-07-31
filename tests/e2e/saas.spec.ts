import {
  test,
  expect,
  prisma,
  loginUI,
  novaEmpresa,
  novoMembro,
  novoEvento,
  novoTrabalhador,
  vincular,
  definirPlano,
  uid,
  SENHA, irPara } from "./fixtures";

/**
 * v3 (SaaS) — multiusuário por empresa (Membro + RBAC) e gating por plano.
 *
 * Cada teste cria a própria empresa (com membro PROPRIETARIO e assinatura), então
 * os cenários de limite não interferem entre si.
 */

test.describe("v3 — Login por membro e RBAC", () => {
  test("membro COORDENADOR entra e vê a empresa + seu papel no menu", async ({ page }) => {
    const emp = await novaEmpresa({ nome: `RBAC Coord ${uid()}` });
    const coord = await novoMembro(emp.id, "COORDENADOR");

    await loginUI(page, "EMPRESA", coord.email);
    await expect(page).toHaveURL(/\/empresa\//);
    // Rodapé do menu mostra "<empresa> · <papel>" e o nome do membro logado.
    await expect(page.getByText(`${emp.nome} · Coordenador`)).toBeVisible();
    await expect(page.getByText(coord.nome, { exact: true })).toBeVisible();
  });

  test("COORDENADOR não vê Equipe no menu e é barrado na URL direta", async ({ page }) => {
    const emp = await novaEmpresa();
    const coord = await novoMembro(emp.id, "COORDENADOR");

    await loginUI(page, "EMPRESA", coord.email);
    await expect(page.getByRole("link", { name: "Equipe" })).toHaveCount(0);

    await irPara(page, "/empresa/equipe");
    await expect(page).toHaveURL(/\/empresa\/dashboard\?negado=equipe%3Agerenciar/);
    await expect(page.getByTestId("aviso-negado")).toContainText("Coordenador");
  });

  test("VISUALIZADOR é somente leitura: sem 'Novo evento' e sem criar por URL", async ({ page }) => {
    const emp = await novaEmpresa();
    const leitor = await novoMembro(emp.id, "VISUALIZADOR");
    await novoEvento(emp.id, { nome: `Leitura ${uid()}` });

    await loginUI(page, "EMPRESA", leitor.email);
    await irPara(page, "/empresa/eventos");
    await expect(page.getByRole("link", { name: /Novo evento/ })).toHaveCount(0);

    await irPara(page, "/empresa/eventos/novo");
    await expect(page).toHaveURL(/\/empresa\/dashboard\?negado=evento%3Acriar/);
    await expect(page.getByTestId("aviso-negado")).toContainText("não permite");
  });

  test("VISUALIZADOR vê a escala em modo leitura (sem escalar)", async ({ page }) => {
    const emp = await novaEmpresa();
    const leitor = await novoMembro(emp.id, "VISUALIZADOR");
    const trab = await novoTrabalhador();
    await vincular(trab.id, emp.id, "ATIVO");
    const ev = await novoEvento(emp.id);
    await prisma.inscricao.create({ data: { eventoId: ev.id, userId: trab.id, status: "INSCRITO" } });

    await loginUI(page, "EMPRESA", leitor.email);
    await irPara(page, `/empresa/eventos/${ev.id}/escalar`);
    await expect(page.getByText("somente leitura")).toBeVisible();
    await expect(page.getByRole("button", { name: /Escalar e finalizar/ })).toHaveCount(0);
  });

  test("acesso revogado durante a sessão derruba o membro no próximo acesso", async ({ page }) => {
    const emp = await novaEmpresa();
    const coord = await novoMembro(emp.id, "COORDENADOR");
    await loginUI(page, "EMPRESA", coord.email);

    // Revogação feita fora da sessão (como um ADMIN faria na tela de Equipe).
    await prisma.membro.update({ where: { id: coord.id }, data: { ativo: false } });

    await irPara(page, "/empresa/eventos");
    await expect(page).toHaveURL(/\/login\?tipo=EMPRESA&erro=acesso_revogado/);
    await expect(page.getByTestId("acesso-revogado")).toBeVisible();
  });
});

test.describe("v3 — Equipe (multiusuário)", () => {
  test("PROPRIETARIO adiciona membro com papel e ele passa a logar", async ({ page }) => {
    const emp = await novaEmpresa({ plano: "PROFESSIONAL" });
    const email = `novo_${uid()}@e2e.test`;

    await loginUI(page, "EMPRESA", emp.email);
    await irPara(page, "/empresa/equipe");
    await page.getByLabel("Nome *").fill("Coord Criado E2E");
    await page.getByLabel("E-mail *").fill(email);
    await page.getByLabel("Senha provisória *").fill(SENHA);
    await page.getByRole("button", { name: "Adicionar membro" }).click();
    await expect(page.getByText(/agora tem acesso como Coordenador/)).toBeVisible();

    const criado = await prisma.membro.findUnique({ where: { email } });
    expect(criado?.papel).toBe("COORDENADOR");
    expect(criado?.empresaId).toBe(emp.id);
  });

  test("PROPRIETARIO revoga o acesso de um membro", async ({ page }) => {
    const emp = await novaEmpresa({ plano: "PROFESSIONAL" });
    const coord = await novoMembro(emp.id, "COORDENADOR");

    await loginUI(page, "EMPRESA", emp.email);
    await irPara(page, "/empresa/equipe");
    await page.getByRole("button", { name: `Revogar acesso de ${coord.nome}` }).click();
    await expect(page.getByText(`Acesso de ${coord.nome} revogado.`)).toBeVisible();

    const depois = await prisma.membro.findUnique({ where: { id: coord.id } });
    expect(depois?.ativo).toBe(false);
  });

  test("cota de usuários do STARTER bloqueia o convite de mais membros", async ({ page }) => {
    // STARTER = 2 usuários; a empresa já nasce com o PROPRIETARIO.
    const emp = await novaEmpresa();
    await novoMembro(emp.id, "COORDENADOR");

    await loginUI(page, "EMPRESA", emp.email);
    await irPara(page, "/empresa/equipe");
    await expect(page.getByText("Cota de usuários esgotada")).toBeVisible();
    await expect(page.getByRole("button", { name: "Adicionar membro" })).toHaveCount(0);
  });
});

test.describe("v3 — Gating por plano", () => {
  test("STARTER bloqueia o 4º evento ativo e aponta o caminho do upgrade", async ({ page }) => {
    const emp = await novaEmpresa(); // STARTER = 3 eventos ativos
    for (let i = 0; i < 3; i++) await novoEvento(emp.id, { nome: `Cota ${i} ${uid()}` });

    await loginUI(page, "EMPRESA", emp.email);
    await irPara(page, "/empresa/eventos");
    await expect(page.getByText(/Limite do plano Starter atingido/)).toBeVisible();
    await expect(page.getByRole("link", { name: /Novo evento/ })).toHaveCount(0);
  });

  test("PROFESSIONAL cria além do limite do STARTER", async ({ page }) => {
    const emp = await novaEmpresa({ plano: "PROFESSIONAL" });
    for (let i = 0; i < 3; i++) await novoEvento(emp.id, { nome: `Pro ${i} ${uid()}` });
    const nome = `Quarto Evento ${uid()}`;

    await loginUI(page, "EMPRESA", emp.email);
    await irPara(page, "/empresa/eventos/novo");
    await page.getByLabel("Nome do evento *").fill(nome);
    await page.getByLabel("Data *").fill("2026-12-01");
    await page.getByLabel("Vagas *").fill("4");
    await page.getByLabel(/Cachê/).fill("150");
    await page.getByRole("button", { name: "Salvar evento" }).click();

    await expect(page).toHaveURL(/\/empresa\/eventos$/);
    await expect(page.getByRole("heading", { name: nome })).toBeVisible();
  });

  test("escalação inteligente só aparece no plano que a inclui", async ({ page }) => {
    const emp = await novaEmpresa();
    const trab = await novoTrabalhador();
    await vincular(trab.id, emp.id, "ATIVO");
    const ev = await novoEvento(emp.id);
    await prisma.inscricao.create({ data: { eventoId: ev.id, userId: trab.id, status: "INSCRITO" } });

    await loginUI(page, "EMPRESA", emp.email);
    await irPara(page, `/empresa/eventos/${ev.id}/escalar`);
    await expect(page.getByRole("button", { name: /Selecionar sugeridos/ })).toHaveCount(0);
    await expect(page.getByText(/está no plano Professional/)).toBeVisible();

    await definirPlano(emp.id, "PROFESSIONAL");
    await page.reload();
    await expect(page.getByRole("button", { name: /Selecionar sugeridos/ })).toBeVisible();
  });
});

test.describe("v3 — Plano e assinatura", () => {
  test("página de Plano mostra plano, situação e uso x limites", async ({ page }) => {
    const emp = await novaEmpresa();
    await novoEvento(emp.id);

    await loginUI(page, "EMPRESA", emp.email);
    await irPara(page, "/empresa/plano");
    await expect(page.getByRole("heading", { name: "Plano", exact: true })).toBeVisible();
    await expect(page.getByText("Starter", { exact: true }).first()).toBeVisible();
    await expect(page.getByText("1 de 3")).toBeVisible(); // eventos ativos
  });

  test("PROPRIETARIO troca de plano e a assinatura é persistida", async ({ page }) => {
    const emp = await novaEmpresa();

    await loginUI(page, "EMPRESA", emp.email);
    await irPara(page, "/empresa/plano");
    await page.getByRole("button", { name: "Mudar para Professional" }).click();

    // Asserção no resultado durável (o cartão do plano passa a ser o atual), e não
    // no toast: se o clique acontecer antes da hidratação, o Next executa a action
    // pelo caminho nativo do formulário — a troca ocorre, mas o toast, que depende
    // de efeito no cliente, não é exibido.
    await expect(page.getByTestId("plano-atual")).toHaveText("Professional");

    const ass = await prisma.assinatura.findUnique({ where: { empresaId: emp.id } });
    expect(ass?.plano).toBe("PROFESSIONAL");
    expect(ass?.status).toBe("ATIVA");
  });

  test("downgrade é bloqueado quando o uso excede o plano destino", async ({ page }) => {
    const emp = await novaEmpresa({ plano: "PROFESSIONAL" });
    // 4 eventos ativos > limite do STARTER (3).
    for (let i = 0; i < 4; i++) await novoEvento(emp.id, { nome: `Down ${i} ${uid()}` });

    await loginUI(page, "EMPRESA", emp.email);
    await irPara(page, "/empresa/plano");
    await page.getByRole("button", { name: "Mudar para Starter" }).click();
    await expect(page.getByText(/acima do limite em 4 eventos ativos/)).toBeVisible();

    const ass = await prisma.assinatura.findUnique({ where: { empresaId: emp.id } });
    expect(ass?.plano).toBe("PROFESSIONAL"); // nada mudou
  });

  test("membro sem permissão vê o plano, mas não troca", async ({ page }) => {
    const emp = await novaEmpresa({ plano: "PROFESSIONAL" });
    const coord = await novoMembro(emp.id, "COORDENADOR");

    await loginUI(page, "EMPRESA", coord.email);
    await irPara(page, "/empresa/plano");
    await expect(page.getByText("Somente o Proprietário da conta altera o plano.")).toBeVisible();
    await expect(page.getByRole("button", { name: /Mudar para/ })).toHaveCount(0);
  });
});
