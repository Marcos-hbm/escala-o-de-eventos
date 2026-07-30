import { describe, it, expect } from "vitest";
import {
  ORDEM_PLANOS,
  PLANOS,
  cabeMais,
  ehUpgrade,
  limitesDoPlano,
  mensagemLimite,
  mensagemRecurso,
  pctUso,
  restante,
  rotuloLimite,
  rotuloPlano,
  temRecurso,
} from "@/lib/planos";

/** v3 (SaaS) — regras de limite/plano (puras, sem banco). */

describe("catálogo de planos", () => {
  it("todo plano da ordem existe no catálogo com rótulo e limites", () => {
    for (const id of ORDEM_PLANOS) {
      expect(PLANOS[id].id).toBe(id);
      expect(rotuloPlano(id).length).toBeGreaterThan(0);
      expect(limitesDoPlano(id)).toHaveProperty("maxMembros");
    }
  });

  it("limites crescem (ou ficam ilimitados) conforme o plano sobe", () => {
    const starter = limitesDoPlano("STARTER");
    const pro = limitesDoPlano("PROFESSIONAL");
    const ent = limitesDoPlano("ENTERPRISE");
    expect(pro.maxMembros as number).toBeGreaterThan(starter.maxMembros as number);
    expect(pro.maxEventosAtivos as number).toBeGreaterThan(starter.maxEventosAtivos as number);
    expect(ent.maxMembros).toBeNull();
    expect(ent.maxEventosAtivos).toBeNull();
    expect(ent.maxVinculosAtivos).toBeNull();
  });

  it("escalação inteligente é recurso pago (não está no STARTER)", () => {
    expect(temRecurso("STARTER", "escalacaoInteligente")).toBe(false);
    expect(temRecurso("PROFESSIONAL", "escalacaoInteligente")).toBe(true);
    expect(temRecurso("ENTERPRISE", "escalacaoInteligente")).toBe(true);
  });
});

describe("cabeMais", () => {
  it("bloqueia exatamente no limite", () => {
    expect(cabeMais(2, 3)).toBe(true);
    expect(cabeMais(3, 3)).toBe(false);
    expect(cabeMais(4, 3)).toBe(false);
  });
  it("limite null = ilimitado", () => {
    expect(cabeMais(9999, null)).toBe(true);
  });
});

describe("restante e pctUso", () => {
  it("restante nunca é negativo; null quando ilimitado", () => {
    expect(restante(1, 3)).toBe(2);
    expect(restante(5, 3)).toBe(0);
    expect(restante(5, null)).toBeNull();
  });
  it("pctUso satura em 100 e ignora ilimitado", () => {
    expect(pctUso(1, 4)).toBe(25);
    expect(pctUso(9, 4)).toBe(100);
    expect(pctUso(9, null)).toBe(0);
    expect(pctUso(0, 0)).toBe(0);
  });
});

describe("rótulos e mensagens", () => {
  it("rotuloLimite mostra Ilimitado para null", () => {
    expect(rotuloLimite(null)).toBe("Ilimitado");
    expect(rotuloLimite(3)).toBe("3");
  });

  it("mensagem de limite diz o plano, o teto e como liberar", () => {
    const msg = mensagemLimite("maxEventosAtivos", "STARTER");
    expect(msg).toContain("Starter");
    expect(msg).toContain(String(limitesDoPlano("STARTER").maxEventosAtivos));
    expect(msg).toMatch(/upgrade/i);
  });

  it("mensagem de recurso aponta o caminho do upgrade", () => {
    const msg = mensagemRecurso("escalacaoInteligente", "STARTER");
    expect(msg).toContain("Escalação inteligente");
    expect(msg).toMatch(/Plano/);
  });
});

describe("ehUpgrade", () => {
  it("compara pela ordem dos planos", () => {
    expect(ehUpgrade("STARTER", "PROFESSIONAL")).toBe(true);
    expect(ehUpgrade("PROFESSIONAL", "STARTER")).toBe(false);
    expect(ehUpgrade("STARTER", "STARTER")).toBe(false);
  });
});
