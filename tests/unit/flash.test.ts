import { describe, it, expect } from "vitest";
import { PARAM_ERRO, PARAM_OK, TAMANHO_MAX_FLASH, comFlash, lerFlash, semFlash } from "@/lib/flash";

/**
 * Mensagem de resultado transportada na URL (ADR 0004): precisa preservar filtros,
 * não acumular avisos e não virar canal de payload.
 */

describe("comFlash", () => {
  it("preserva filtros e paginação existentes", () => {
    expect(comFlash("/empresa/eventos?q=festival&pagina=2", "ok", "Evento excluído.")).toBe(
      `/empresa/eventos?q=festival&pagina=2&${PARAM_OK}=Evento+exclu%C3%ADdo.`,
    );
  });

  it("substitui aviso anterior em vez de acumular", () => {
    const primeiro = comFlash("/empresa/equipe", "ok", "Membro criado.");
    const segundo = comFlash(primeiro, "erro", "Cota esgotada.");
    expect(segundo).toBe(`/empresa/equipe?${PARAM_ERRO}=Cota+esgotada.`);
    expect(segundo).not.toContain(PARAM_OK);
  });

  it("normaliza espaços e limita o tamanho", () => {
    const longo = "x".repeat(TAMANHO_MAX_FLASH + 50);
    const url = comFlash("/x", "ok", longo);
    expect(new URL(url, "http://t").searchParams.get(PARAM_OK)).toHaveLength(TAMANHO_MAX_FLASH);
    expect(comFlash("/x", "ok", "  com   espaços \n extras ")).toBe(`/x?${PARAM_OK}=com+espa%C3%A7os+extras`);
  });

  it("texto vazio não gera parâmetro", () => {
    expect(comFlash("/x", "ok", "   ")).toBe("/x");
  });
});

describe("lerFlash", () => {
  it("lê sucesso e erro", () => {
    expect(lerFlash({ [PARAM_OK]: "Feito." })).toEqual({ tipo: "ok", texto: "Feito." });
    expect(lerFlash({ [PARAM_ERRO]: "Falhou." })).toEqual({ tipo: "erro", texto: "Falhou." });
  });

  it("erro tem precedência sobre sucesso", () => {
    expect(lerFlash({ [PARAM_OK]: "Feito.", [PARAM_ERRO]: "Falhou." })?.tipo).toBe("erro");
  });

  it("ausência ou vazio devolve null", () => {
    expect(lerFlash(undefined)).toBeNull();
    expect(lerFlash({})).toBeNull();
    expect(lerFlash({ [PARAM_OK]: "   " })).toBeNull();
  });
});

describe("semFlash", () => {
  it("remove só os parâmetros de aviso", () => {
    expect(semFlash(`/empresa/eventos?q=x&${PARAM_OK}=Feito.&pagina=3`)).toBe("/empresa/eventos?q=x&pagina=3");
    expect(semFlash(`/empresa/plano?${PARAM_ERRO}=Falhou.`)).toBe("/empresa/plano");
  });
});
