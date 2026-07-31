import { describe, it, expect } from "vitest";
import {
  CRITERIOS,
  destaques,
  mediaExata,
  notaGeralDerivada,
  notaValida,
  notasPreenchidas,
  resumirCriterios,
  validarAvaliacaoPorCriterios,
} from "@/lib/domain/avaliacao";

/**
 * Avaliação por critérios. O ponto sensível é a nota geral derivada: ela alimenta a
 * reputação e o score da escalação, que existiam antes da v4.
 */

describe("catálogo de critérios", () => {
  it("tem os cinco critérios da especificação, com rótulo e ajuda", () => {
    expect(CRITERIOS.map((c) => c.id)).toEqual([
      "pontualidade",
      "comunicacao",
      "trabalhoEquipe",
      "qualidade",
      "comprometimento",
    ]);
    for (const c of CRITERIOS) {
      expect(c.rotulo.length).toBeGreaterThan(0);
      expect(c.ajuda.length).toBeGreaterThan(10);
    }
  });
});

describe("notaValida", () => {
  it("aceita apenas inteiros de 1 a 5", () => {
    expect(notaValida(1)).toBe(true);
    expect(notaValida(5)).toBe(true);
    expect(notaValida(0)).toBe(false);
    expect(notaValida(6)).toBe(false);
    expect(notaValida(4.5)).toBe(false);
    expect(notaValida("5")).toBe(false);
    expect(notaValida(null)).toBe(false);
  });
});

describe("nota geral derivada", () => {
  it("é a média arredondada dos critérios preenchidos", () => {
    expect(
      notaGeralDerivada({
        pontualidade: 5,
        comunicacao: 4,
        trabalhoEquipe: 5,
        qualidade: 5,
        comprometimento: 4,
      }),
    ).toBe(5); // média 4,6 -> 5
    expect(notaGeralDerivada({ pontualidade: 4, comunicacao: 4 })).toBe(4);
    expect(notaGeralDerivada({ pontualidade: 3, comunicacao: 4 })).toBe(4); // 3,5 -> 4
  });

  it("ignora critérios não preenchidos", () => {
    expect(notasPreenchidas({ pontualidade: 5, comunicacao: null, qualidade: undefined })).toEqual([5]);
    expect(notaGeralDerivada({ pontualidade: 5, comunicacao: null })).toBe(5);
  });

  it("sem nenhuma nota, não há nota geral", () => {
    expect(notaGeralDerivada({})).toBeNull();
    expect(mediaExata({})).toBeNull();
  });

  it("média exata mantém uma casa para exibição", () => {
    expect(mediaExata({ pontualidade: 5, comunicacao: 4 })).toBe(4.5);
    expect(mediaExata({ pontualidade: 5, comunicacao: 4, trabalhoEquipe: 4 })).toBe(4.3);
  });
});

describe("validarAvaliacaoPorCriterios", () => {
  it("exige pelo menos um critério", () => {
    const r = validarAvaliacaoPorCriterios({});
    expect(r.ok).toBe(false);
    expect(r.erro).toMatch(/pelo menos um critério/);
  });

  it("aponta o critério com nota inválida pelo nome", () => {
    const r = validarAvaliacaoPorCriterios({ pontualidade: 5, qualidade: 9 });
    expect(r.ok).toBe(false);
    expect(r.erro).toContain("Qualidade");
  });

  it("devolve a nota geral quando válido", () => {
    expect(validarAvaliacaoPorCriterios({ pontualidade: 5, comunicacao: 5 })).toEqual({ ok: true, notaGeral: 5 });
  });
});

describe("resumirCriterios", () => {
  it("calcula média e quantidade por critério", () => {
    const resumo = resumirCriterios([
      { pontualidade: 5, comunicacao: 3, qualidade: 4 },
      { pontualidade: 4, comunicacao: 3 },
    ]);
    const porId = Object.fromEntries(resumo.map((r) => [r.id, r]));
    expect(porId.pontualidade).toMatchObject({ media: 4.5, quantidade: 2 });
    expect(porId.comunicacao).toMatchObject({ media: 3, quantidade: 2 });
    expect(porId.qualidade).toMatchObject({ media: 4, quantidade: 1 });
    expect(porId.comprometimento).toMatchObject({ media: null, quantidade: 0 });
  });

  it("lista vazia devolve todos os critérios sem média", () => {
    const resumo = resumirCriterios([]);
    expect(resumo).toHaveLength(5);
    expect(resumo.every((r) => r.media === null)).toBe(true);
  });
});

describe("destaques", () => {
  it("aponta o critério mais forte e o mais fraco", () => {
    const resumo = resumirCriterios([{ pontualidade: 5, comunicacao: 2, qualidade: 4 }]);
    const { melhor, pior } = destaques(resumo);
    expect(melhor?.id).toBe("pontualidade");
    expect(pior?.id).toBe("comunicacao");
  });

  it("não destaca nada quando todas as médias são iguais (evita ruído)", () => {
    const resumo = resumirCriterios([{ pontualidade: 4, comunicacao: 4 }]);
    expect(destaques(resumo)).toEqual({});
  });

  it("não destaca com dados de um único critério", () => {
    expect(destaques(resumirCriterios([{ pontualidade: 5 }]))).toEqual({});
  });
});
