import { test, expect, loginUI, novaEmpresa, novoTrabalhador, novoEvento, vincular, inscrever, uid } from "./fixtures";

/** RF09/RF13/RF14 — Inscrição, bloqueio por vínculo e status. */

test.describe("Inscrições (RF09/RF13/RF14)", () => {
  test("trabalhador vinculado se inscreve (RF09)", async ({ page }) => {
    const emp = await novaEmpresa();
    const trab = await novoTrabalhador();
    await vincular(trab.id, emp.id, "ATIVO");
    const ev = await novoEvento(emp.id, { nome: `Insc ${uid()}` });

    await loginUI(page, "TRABALHADOR", trab.email);
    await page.goto(`/trabalhador/eventos/${ev.id}`);
    await page.getByRole("button", { name: "Inscrever-se" }).click();
    await expect(page.getByText("Você está inscrito")).toBeVisible();
  });

  test("RF13: sem vínculo não pode se inscrever", async ({ page }) => {
    const emp = await novaEmpresa();
    const trab = await novoTrabalhador(); // sem vínculo
    const ev = await novoEvento(emp.id, { nome: `Bloq ${uid()}` });

    await loginUI(page, "TRABALHADOR", trab.email);
    await page.goto(`/trabalhador/eventos/${ev.id}`);
    await expect(page.getByText("Você precisa estar vinculado à empresa para se inscrever.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Inscrever-se" })).toHaveCount(0);
  });

  test("RF13: descoberta só mostra eventos de empresas vinculadas", async ({ page }) => {
    const emp = await novaEmpresa();
    const trab = await novoTrabalhador(); // sem vínculo
    const ev = await novoEvento(emp.id, { nome: `Oculto ${uid()}` });

    await loginUI(page, "TRABALHADOR", trab.email);
    await page.goto("/trabalhador/eventos");
    await expect(page.getByText("Você ainda não tem vínculos ativos.")).toBeVisible();
    await expect(page.getByRole("heading", { name: ev.nome })).toHaveCount(0);
  });

  test("evento de empresa vinculada aparece na descoberta", async ({ page }) => {
    const emp = await novaEmpresa();
    const trab = await novoTrabalhador();
    await vincular(trab.id, emp.id, "ATIVO");
    const ev = await novoEvento(emp.id, { nome: `Visivel ${uid()}` });

    await loginUI(page, "TRABALHADOR", trab.email);
    await page.goto("/trabalhador/eventos");
    await expect(page.getByRole("heading", { name: ev.nome })).toBeVisible();
  });

  test("RF14: cancelar inscrição permite reinscrever", async ({ page }) => {
    const emp = await novaEmpresa();
    const trab = await novoTrabalhador();
    await vincular(trab.id, emp.id, "ATIVO");
    const ev = await novoEvento(emp.id, { nome: `Cancela ${uid()}` });
    await inscrever(ev.id, trab.id, "INSCRITO");

    await loginUI(page, "TRABALHADOR", trab.email);
    await page.goto(`/trabalhador/eventos/${ev.id}`);
    await page.getByRole("button", { name: "Cancelar inscrição" }).click();
    await expect(page.getByRole("button", { name: "Inscrever-se" })).toBeVisible();
  });
});
