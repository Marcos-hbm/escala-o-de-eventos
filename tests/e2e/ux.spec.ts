import { test, expect, prisma, loginUI, novaEmpresa, novoTrabalhador, novoEvento, uid, irPara } from "./fixtures";

/**
 * Fase 1 — padrão brasileiro de data/hora e fundação de UX (tema, paginação,
 * empty states, toasts, skeleton).
 */

test.describe("Datas no padrão brasileiro", () => {
  test("evento exibe a data como DD/MM/AAAA, sem deslocar o dia", async ({ page }) => {
    const emp = await novaEmpresa();
    // Data civil: 20/12/2026 deve aparecer assim, não 19/12 (fuso) nem 2026-12-20.
    await novoEvento(emp.id, { nome: `Data BR ${uid()}` });

    await loginUI(page, "EMPRESA", emp.email);
    await irPara(page, "/empresa/eventos");
    await expect(page.getByText("20/12/2026").first()).toBeVisible();
    await expect(page.getByText("2026-12-20")).toHaveCount(0);
  });

  test("notificação mostra tempo relativo e a data/hora completa no title", async ({ page }) => {
    const trab = await novoTrabalhador();
    await prisma.notificacao.create({
      data: {
        userId: trab.id,
        tipo: "NOVO_EVENTO",
        titulo: `Notif ${uid()}`,
        mensagem: "Teste de formatação de data e hora.",
      },
    });

    await loginUI(page, "TRABALHADOR", trab.email);
    await irPara(page, "/trabalhador/notificacoes");
    // Criada agora: o rótulo relativo é "agora".
    await expect(page.getByText("agora", { exact: true })).toBeVisible();
    // O title traz DD/MM/AAAA HH:mm (24h, fuso de Brasília).
    const carimbo = page.getByText("agora", { exact: true });
    await expect(carimbo).toHaveAttribute("title", /^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/);
  });

  test("CSV da escala sai em padrão BR (data e cachê)", async ({ page }) => {
    const emp = await novaEmpresa();
    const trab = await novoTrabalhador();
    const ev = await novoEvento(emp.id, { status: "FINALIZADO", valorCache: 1234.5 });
    await prisma.inscricao.create({ data: { eventoId: ev.id, userId: trab.id, status: "ESCALADO" } });

    await loginUI(page, "EMPRESA", emp.email);
    const resp = await page.request.get(`/empresa/eventos/${ev.id}/lista`);
    expect(resp.status()).toBe(200);
    const csv = await resp.text();
    expect(csv).toContain("Data;20/12/2026");
    expect(csv).toContain('Cachê (R$);"1.234,50"');
  });
});

test.describe("Tema claro/escuro", () => {
  test("toggle alterna, persiste no cookie e sobrevive ao recarregar", async ({ page }) => {
    const emp = await novaEmpresa();
    await loginUI(page, "EMPRESA", emp.email);

    const toggle = page.getByTestId("theme-toggle").first();
    await expect(toggle).toHaveAttribute("data-tema", "sistema");
    const html = page.locator("html");
    await expect(html).not.toHaveAttribute("data-theme", /.+/);

    await toggle.click(); // sistema → claro
    await expect(html).toHaveAttribute("data-theme", "light");

    await toggle.click(); // claro → escuro
    await expect(html).toHaveAttribute("data-theme", "dark");

    // Persistência: o servidor já devolve o HTML no tema escolhido.
    await page.reload();
    await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
    await expect(page.getByTestId("theme-toggle").first()).toHaveAttribute("data-tema", "escuro");

    const cookies = await page.context().cookies();
    expect(cookies.find((c) => c.name === "escala_tema")?.value).toBe("escuro");
  });
});

test.describe("Paginação e empty states", () => {
  test("lista de eventos pagina no banco e navega preservando o filtro", async ({ page }) => {
    const emp = await novaEmpresa({ plano: "PROFESSIONAL" });
    const marca = `Pag${uid()}`;
    for (let i = 1; i <= 12; i++) await novoEvento(emp.id, { nome: `${marca} ${String(i).padStart(2, "0")}` });

    await loginUI(page, "EMPRESA", emp.email);
    await irPara(page, "/empresa/eventos");
    // 12 eventos, 10 por página.
    await expect(page.getByTestId("paginacao-status")).toHaveText("1–10 de 12 eventos");
    await expect(page.locator("h2")).toHaveCount(10);

    await page.getByRole("link", { name: "Página 2" }).click();
    await expect(page).toHaveURL(/pagina=2/);
    await expect(page.getByTestId("paginacao-status")).toHaveText("11–12 de 12 eventos");
    await expect(page.locator("h2")).toHaveCount(2);

    // Filtro + paginação convivem: a busca reduz o total e a URL mantém o q.
    await irPara(page, "/empresa/eventos");
    await page.getByPlaceholder("Buscar por nome").fill(`${marca} 0`);
    await page.getByRole("button", { name: "Filtrar" }).click();
    await expect(page.getByTestId("paginacao-status")).toHaveText("9 eventos");
  });

  test("empresa sem eventos vê empty state com ação de criar", async ({ page }) => {
    const emp = await novaEmpresa();
    await loginUI(page, "EMPRESA", emp.email);
    await irPara(page, "/empresa/eventos");

    const vazio = page.getByTestId("empty-state");
    await expect(vazio).toContainText("Você ainda não criou eventos");
    await expect(vazio.getByRole("link", { name: "Criar primeiro evento" })).toBeVisible();
  });

  test("busca sem resultado oferece limpar filtros", async ({ page }) => {
    const emp = await novaEmpresa();
    await novoEvento(emp.id);
    await loginUI(page, "EMPRESA", emp.email);
    await irPara(page, `/empresa/eventos?q=${uid()}zzz`);

    const vazio = page.getByTestId("empty-state");
    await expect(vazio).toContainText("Nenhum evento encontrado");
    await vazio.getByRole("link", { name: "Limpar filtros" }).click();
    await expect(page).toHaveURL(/\/empresa\/eventos$/);
  });

  test("trabalhador sem vínculo vê empty state apontando para Vínculos", async ({ page }) => {
    const trab = await novoTrabalhador();
    await loginUI(page, "TRABALHADOR", trab.email);
    await irPara(page, "/trabalhador/eventos");

    const vazio = page.getByTestId("empty-state");
    await expect(vazio).toContainText("Você ainda não tem vínculos ativos");
    await vazio.getByRole("link", { name: "Buscar empresas" }).click();
    await expect(page).toHaveURL(/\/trabalhador\/vinculos$/);
  });
});

test.describe("Aviso de resultado (flash renderizado no servidor)", () => {
  test("ação de equipe confirma no servidor, com aviso fechável e sem depender do cliente", async ({ page }) => {
    const emp = await novaEmpresa({ plano: "PROFESSIONAL" });
    await loginUI(page, "EMPRESA", emp.email);
    await irPara(page, "/empresa/equipe");

    await page.getByLabel("Nome *").fill("Membro Flash");
    await page.getByLabel("E-mail *").fill(`flash_${uid()}@e2e.test`);
    await page.getByLabel("Senha provisória *").fill("Senha@123");
    await page.getByRole("button", { name: "Adicionar membro" }).click();

    // A mensagem viaja na URL e é renderizada pelo servidor no mesmo render que
    // traz os dados novos: dado atualizado e aviso não podem divergir (ADR 0004).
    await expect(page).toHaveURL(/aviso=/);
    const flash = page.getByTestId("flash");
    await expect(flash).toBeVisible();
    await expect(flash).toHaveAttribute("data-tipo", "ok");
    await expect(flash).toContainText("agora tem acesso como Coordenador");
    await expect(page.getByText("Membro Flash", { exact: true })).toBeVisible(); // linha na lista

    // Fechar é um link (funciona sem JavaScript) e preserva o resto da URL.
    await flash.getByRole("link", { name: "Fechar aviso" }).click();
    await expect(page).not.toHaveURL(/aviso=/);
    await expect(page.getByTestId("flash")).toHaveCount(0);
  });

  test("operação recusada aparece junto do formulário e nada é alterado", async ({ page }) => {
    const emp = await novaEmpresa({ plano: "PROFESSIONAL" });
    for (let i = 0; i < 4; i++) await novoEvento(emp.id, { nome: `Down ${i} ${uid()}` });

    await loginUI(page, "EMPRESA", emp.email);
    await irPara(page, "/empresa/plano");
    await page.getByRole("button", { name: "Mudar para Starter" }).click();

    // Recusa não escreve no banco, então não redireciona: a mensagem fica no
    // próprio formulário (ver ADR 0004 — sucesso usa flash do servidor porque aí
    // a tela precisa mostrar dado novo).
    await expect(page.getByRole("alert").filter({ hasText: "acima do limite em 4 eventos ativos" })).toBeVisible();
    await expect(page.getByTestId("plano-atual")).toHaveText("Professional");
    const ass = await prisma.assinatura.findUnique({ where: { empresaId: emp.id } });
    expect(ass?.plano).toBe("PROFESSIONAL");
  });
});
