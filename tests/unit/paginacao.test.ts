import { describe, it, expect } from "vitest";
import {
  TAMANHO_PAGINA_MAX,
  TAMANHO_PAGINA_PADRAO,
  lerParametrosPagina,
  montarPagina,
  rotuloPagina,
  urlDaPagina,
} from "@/lib/paginacao";
import { janelaDePaginas } from "@/components/ui/paginacao";

/** Paginação server-side: os parâmetros vêm da URL, logo do usuário — clamp é regra, não detalhe. */

describe("lerParametrosPagina", () => {
  it("usa padrões quando não há query", () => {
    expect(lerParametrosPagina()).toEqual({
      pagina: 1,
      tamanho: TAMANHO_PAGINA_PADRAO,
      skip: 0,
      take: TAMANHO_PAGINA_PADRAO,
    });
  });

  it("calcula skip/take a partir da página", () => {
    const p = lerParametrosPagina({ pagina: "3", tamanho: "20" });
    expect(p).toMatchObject({ pagina: 3, tamanho: 20, skip: 40, take: 20 });
  });

  it("ignora entrada hostil (negativa, texto, fracionada)", () => {
    expect(lerParametrosPagina({ pagina: "-5" }).pagina).toBe(1);
    expect(lerParametrosPagina({ pagina: "abc" }).pagina).toBe(1);
    expect(lerParametrosPagina({ pagina: "1.5" }).pagina).toBe(1);
    expect(lerParametrosPagina({ tamanho: "0" }).tamanho).toBe(TAMANHO_PAGINA_PADRAO);
  });

  it("limita o tamanho para não permitir dump da tabela por URL", () => {
    expect(lerParametrosPagina({ tamanho: "99999" }).tamanho).toBe(TAMANHO_PAGINA_MAX);
  });
});

describe("montarPagina", () => {
  const params = lerParametrosPagina({ pagina: "2", tamanho: "10" });

  it("calcula metadados de navegação", () => {
    const p = montarPagina(Array.from({ length: 10 }, (_, i) => i), 57, params);
    expect(p).toMatchObject({
      pagina: 2,
      total: 57,
      totalPaginas: 6,
      temAnterior: true,
      temProxima: true,
      de: 11,
      ate: 20,
    });
  });

  it("página além do fim é ajustada para a última", () => {
    const p = montarPagina([], 5, lerParametrosPagina({ pagina: "99", tamanho: "10" }));
    expect(p.pagina).toBe(1);
    expect(p.temProxima).toBe(false);
  });

  it("lista vazia não gera '1–0 de 0'", () => {
    const p = montarPagina([], 0, params);
    expect(p).toMatchObject({ total: 0, totalPaginas: 1, de: 0, ate: 0, temProxima: false });
  });
});

describe("rotuloPagina", () => {
  const params = lerParametrosPagina({ tamanho: "10" });
  it("descreve o intervalo, o total e o caso vazio", () => {
    expect(rotuloPagina(montarPagina([], 0, params), "evento")).toBe("Nenhum evento");
    expect(rotuloPagina(montarPagina([1], 1, params), "evento")).toBe("1 evento");
    expect(rotuloPagina(montarPagina([1, 2], 2, params), "evento")).toBe("2 eventos");
    expect(rotuloPagina(montarPagina([], 57, lerParametrosPagina({ pagina: "2", tamanho: "10" })), "evento")).toBe(
      "11–20 de 57 eventos",
    );
  });

  it("aceita plural irregular", () => {
    expect(rotuloPagina(montarPagina([1, 2], 2, params), "notificação", "notificações")).toBe("2 notificações");
  });
});

describe("urlDaPagina", () => {
  it("preserva filtros e omite pagina=1", () => {
    expect(urlDaPagina("/empresa/eventos", { q: "festival" }, 1)).toBe("/empresa/eventos?q=festival");
    expect(urlDaPagina("/empresa/eventos", { q: "festival" }, 3)).toBe("/empresa/eventos?q=festival&pagina=3");
  });

  it("descarta filtros vazios e não duplica pagina/tamanho", () => {
    expect(urlDaPagina("/empresa/eventos", { q: "", data: undefined, pagina: "9" }, 2)).toBe(
      "/empresa/eventos?pagina=2",
    );
  });

  it("mantém tamanho só quando difere do padrão", () => {
    expect(urlDaPagina("/x", {}, 2, TAMANHO_PAGINA_PADRAO)).toBe("/x?pagina=2");
    expect(urlDaPagina("/x", {}, 2, 50)).toBe("/x?pagina=2&tamanho=50");
  });
});

describe("janelaDePaginas", () => {
  it("mostra tudo quando cabe", () => {
    expect(janelaDePaginas(1, 5)).toEqual([1, 2, 3, 4, 5]);
  });

  it("usa elipse no meio e mantía os limites", () => {
    expect(janelaDePaginas(6, 12)).toEqual([1, "…", 5, 6, 7, "…", 12]);
    expect(janelaDePaginas(1, 12)).toEqual([1, 2, 3, 4, "…", 12]);
    expect(janelaDePaginas(12, 12)).toEqual([1, "…", 9, 10, 11, 12]);
  });
});
