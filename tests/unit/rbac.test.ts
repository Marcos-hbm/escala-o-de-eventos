import { describe, it, expect } from "vitest";
import {
  MATRIZ_PERMISSOES,
  ORDEM_PAPEIS,
  checarPermissao,
  ehPermissaoFinanceira,
  mensagemFinanceiro,
  mensagemPermissao,
  papeisAtribuiveis,
  pode,
  podeFinanceiro,
  rotuloPapel,
} from "@/lib/rbac";

/** v3 (SaaS) — matriz de papéis dentro da empresa (pura, sem banco). */

describe("matriz de permissões", () => {
  it("PROPRIETARIO pode tudo o que qualquer outro papel pode", () => {
    for (const papel of ORDEM_PAPEIS) {
      for (const p of MATRIZ_PERMISSOES[papel]) {
        expect(pode("PROPRIETARIO", p)).toBe(true);
      }
    }
  });

  it("VISUALIZADOR é somente leitura (nenhuma escrita)", () => {
    expect(MATRIZ_PERMISSOES.VISUALIZADOR).toHaveLength(0);
    expect(pode("VISUALIZADOR", "evento:criar")).toBe(false);
    expect(pode("VISUALIZADOR", "escala:gerenciar")).toBe(false);
    expect(pode("VISUALIZADOR", "presenca:marcar")).toBe(false);
  });

  it("COORDENADOR opera eventos/escala/vínculos, mas não equipe nem plano", () => {
    expect(pode("COORDENADOR", "evento:criar")).toBe(true);
    expect(pode("COORDENADOR", "escala:gerenciar")).toBe(true);
    expect(pode("COORDENADOR", "vinculo:gerenciar")).toBe(true);
    expect(pode("COORDENADOR", "equipe:gerenciar")).toBe(false);
    expect(pode("COORDENADOR", "plano:gerenciar")).toBe(false);
    expect(pode("COORDENADOR", "evento:excluir")).toBe(false);
  });

  it("ADMIN gerencia equipe, mas plano e exclusão da conta são do PROPRIETARIO", () => {
    expect(pode("ADMIN", "equipe:gerenciar")).toBe(true);
    expect(pode("ADMIN", "evento:excluir")).toBe(true);
    expect(pode("ADMIN", "plano:gerenciar")).toBe(false);
    expect(pode("ADMIN", "conta:excluir")).toBe(false);
    expect(pode("PROPRIETARIO", "plano:gerenciar")).toBe(true);
    expect(pode("PROPRIETARIO", "conta:excluir")).toBe(true);
  });
});

describe("papeisAtribuiveis", () => {
  it("só o PROPRIETARIO atribui PROPRIETARIO", () => {
    expect(papeisAtribuiveis("PROPRIETARIO")).toContain("PROPRIETARIO");
    expect(papeisAtribuiveis("ADMIN")).not.toContain("PROPRIETARIO");
    expect(papeisAtribuiveis("ADMIN")).toContain("COORDENADOR");
  });

  it("quem não gerencia equipe não atribui papel nenhum", () => {
    expect(papeisAtribuiveis("COORDENADOR")).toEqual([]);
    expect(papeisAtribuiveis("VISUALIZADOR")).toEqual([]);
  });
});

describe("mensagens de negação", () => {
  it("dizem o papel atual e quem teria acesso", () => {
    const msg = mensagemPermissao("VISUALIZADOR", "evento:criar");
    expect(msg).toContain(rotuloPapel("VISUALIZADOR"));
    expect(msg).toContain(rotuloPapel("COORDENADOR"));
  });

  it("checarPermissao devolve null quando autorizado", () => {
    expect(checarPermissao("COORDENADOR", "evento:criar")).toBeNull();
    expect(checarPermissao("VISUALIZADOR", "evento:criar")).toBeTypeOf("string");
  });
});

/**
 * v4 — financeiro. Única família de permissão que não é decidida só pelo papel:
 * "coordenadores autorizados" da especificação.
 */
describe("permissões financeiras (v4)", () => {
  const FINANCEIRAS = ["financeiro:gerenciar", "financeiro:ver", "pix:ver"] as const;

  it("PROPRIETARIO e ADMIN têm acesso pelo papel", () => {
    for (const p of FINANCEIRAS) {
      expect(pode("PROPRIETARIO", p)).toBe(true);
      expect(pode("ADMIN", p)).toBe(true);
      expect(podeFinanceiro("PROPRIETARIO", p, false)).toBe(true);
      expect(podeFinanceiro("ADMIN", p, false)).toBe(true);
    }
  });

  it("COORDENADOR só com autorização explícita", () => {
    for (const p of FINANCEIRAS) {
      expect(pode("COORDENADOR", p)).toBe(false);
      expect(podeFinanceiro("COORDENADOR", p, false)).toBe(false);
      expect(podeFinanceiro("COORDENADOR", p, true)).toBe(true);
    }
  });

  it("VISUALIZADOR nunca acessa, nem com a flag ligada", () => {
    for (const p of FINANCEIRAS) {
      expect(podeFinanceiro("VISUALIZADOR", p, true)).toBe(false);
    }
  });

  it("a flag não afeta permissões não financeiras", () => {
    expect(podeFinanceiro("VISUALIZADOR", "evento:criar", true)).toBe(false);
    expect(podeFinanceiro("COORDENADOR", "equipe:gerenciar", true)).toBe(false);
    expect(podeFinanceiro("COORDENADOR", "evento:criar", false)).toBe(true);
  });

  it("classifica corretamente o que é permissão financeira", () => {
    expect(ehPermissaoFinanceira("pix:ver")).toBe(true);
    expect(ehPermissaoFinanceira("evento:criar")).toBe(false);
  });

  it("mensagem de negação diz ao coordenador como liberar", () => {
    expect(mensagemFinanceiro("COORDENADOR")).toMatch(/acesso financeiro.*Equipe/s);
    expect(mensagemFinanceiro("VISUALIZADOR")).toMatch(/Coordenador autorizado/);
  });
});

describe("operação inclui relacionamento e comunicação (v4)", () => {
  it("coordenador favorita, bloqueia e responde solicitações", () => {
    expect(pode("COORDENADOR", "relacionamento:gerenciar")).toBe(true);
    expect(pode("COORDENADOR", "comunicacao:responder")).toBe(true);
  });

  it("visualizador não", () => {
    expect(pode("VISUALIZADOR", "relacionamento:gerenciar")).toBe(false);
    expect(pode("VISUALIZADOR", "comunicacao:responder")).toBe(false);
  });
});
