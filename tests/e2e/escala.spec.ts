import { test, expect, loginUI, novaEmpresa, novoTrabalhador, novoEvento, vincular, inscrever, uid, irPara } from "./fixtures";

/** RF10/RF11 — Escalação, seleção, finalização, CSV e reabertura. */

test.describe("Escalação (RF10/RF11)", () => {
  async function cenario(qtdInscritos = 2) {
    const emp = await novaEmpresa();
    const ev = await novoEvento(emp.id, { nome: `Escala ${uid()}`, funcoes: "Recepção, Apoio" });
    const trabs = [];
    for (let i = 0; i < qtdInscritos; i++) {
      const t = await novoTrabalhador({ nome: `EscTrab-${uid()}` });
      await vincular(t.id, emp.id, "ATIVO");
      await inscrever(ev.id, t.id, "INSCRITO");
      trabs.push(t);
    }
    return { emp, ev, trabs };
  }

  test("escalar todos, finalizar e baixar CSV com conteúdo correto", async ({ page }) => {
    const { emp, ev, trabs } = await cenario(2);
    await loginUI(page, "EMPRESA", emp.email);
    await irPara(page, `/empresa/eventos/${ev.id}/escalar`);

    await page.getByRole("button", { name: "Selecionar todos" }).click();
    await page.getByRole("button", { name: "Escalar e finalizar evento" }).click();
    await expect(page.getByText(/trabalhador\(es\) escalado\(s\)/)).toBeVisible();

    const href = await page.getByRole("link", { name: /Baixar lista/ }).getAttribute("href");
    const resp = await page.request.get(href!);
    expect(resp.status()).toBe(200);
    expect(resp.headers()["content-type"]).toContain("text/csv");
    const csv = await resp.text();
    expect(csv).toContain("Nome;CPF;Telefone;E-mail;Função;Status");
    for (const t of trabs) expect(csv).toContain(t.nome);
    expect(csv).toContain("ESCALADO");
    expect(csv).toContain('"Recepção, Apoio"'); // escape de campo com vírgula
  });

  test("botão finalizar desabilitado sem seleção", async ({ page }) => {
    const { emp, ev } = await cenario(1);
    await loginUI(page, "EMPRESA", emp.email);
    await irPara(page, `/empresa/eventos/${ev.id}/escalar`);
    await expect(page.getByRole("button", { name: "Escalar e finalizar evento" })).toBeDisabled();
  });

  test("selecionar todos e depois desmarcar todos", async ({ page }) => {
    const { emp, ev } = await cenario(2);
    await loginUI(page, "EMPRESA", emp.email);
    await irPara(page, `/empresa/eventos/${ev.id}/escalar`);
    await page.getByRole("button", { name: "Selecionar todos" }).click();
    await expect(page.getByRole("button", { name: "Escalar e finalizar evento" })).toBeEnabled();
    await page.getByRole("button", { name: "Desmarcar todos" }).click();
    await expect(page.getByRole("button", { name: "Escalar e finalizar evento" })).toBeDisabled();
  });

  test("evento sem inscritos mostra mensagem apropriada", async ({ page }) => {
    const emp = await novaEmpresa();
    const ev = await novoEvento(emp.id, { nome: `Vazio ${uid()}` });
    await loginUI(page, "EMPRESA", emp.email);
    await irPara(page, `/empresa/eventos/${ev.id}/escalar`);
    await expect(page.getByText("Nenhum trabalhador se inscreveu neste evento ainda.")).toBeVisible();
  });

  test("reabrir evento finalizado volta para escalação", async ({ page }) => {
    const emp = await novaEmpresa();
    const trab = await novoTrabalhador();
    await vincular(trab.id, emp.id, "ATIVO");
    const ev = await novoEvento(emp.id, { nome: `Reabrir ${uid()}`, status: "FINALIZADO" });
    await inscrever(ev.id, trab.id, "ESCALADO");

    await loginUI(page, "EMPRESA", emp.email);
    await irPara(page, `/empresa/eventos/${ev.id}/escalar`);
    await page.getByRole("button", { name: "Reabrir para reescalar" }).click();
    await expect(page.getByRole("button", { name: "Selecionar todos" })).toBeVisible();
  });
});
