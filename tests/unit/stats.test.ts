import { describe, it, expect } from "vitest";
import { media, taxa, porcentagem, reputacao, scorePrioridade, estrelas } from "@/lib/stats";

describe("media", () => {
  it("calcula média arredondada a 1 casa", () => {
    expect(media([5, 4, 4])).toBeCloseTo(4.3, 5);
    expect(media([5, 5])).toBe(5);
  });
  it("null sem amostras", () => {
    expect(media([])).toBeNull();
  });
});

describe("taxa e porcentagem", () => {
  it("fração e % corretos", () => {
    expect(taxa(3, 4)).toBe(0.75);
    expect(porcentagem(3, 4)).toBe(75);
  });
  it("total 0 → 0 (sem divisão por zero)", () => {
    expect(taxa(1, 0)).toBe(0);
    expect(porcentagem(1, 0)).toBe(0);
  });
});

describe("reputacao", () => {
  it("agrega média e quantidade", () => {
    expect(reputacao([5, 4, 3])).toEqual({ media: 4, qtd: 3 });
    expect(reputacao([])).toEqual({ media: null, qtd: 0 });
  });
});

describe("scorePrioridade", () => {
  it("reputação máxima + presença perfeita ≈ 100", () => {
    expect(scorePrioridade({ reputacaoMedia: 5, presentes: 10, faltas: 0 })).toBe(100);
  });
  it("sem histórico = 0 (candidato neutro, ordenado por último)", () => {
    expect(scorePrioridade({ reputacaoMedia: null, presentes: 0, faltas: 0 })).toBe(0);
  });
  it("reputação melhor sobe o score (peso maior que presença)", () => {
    const bomRep = scorePrioridade({ reputacaoMedia: 5, presentes: 0, faltas: 0 });
    const boaPresenca = scorePrioridade({ reputacaoMedia: null, presentes: 10, faltas: 0 });
    expect(bomRep).toBeGreaterThan(boaPresenca);
  });
  it("faltas derrubam a componente de presença", () => {
    const perfeito = scorePrioridade({ reputacaoMedia: 4, presentes: 4, faltas: 0 });
    const comFaltas = scorePrioridade({ reputacaoMedia: 4, presentes: 2, faltas: 2 });
    expect(perfeito).toBeGreaterThan(comFaltas);
  });
});

describe("estrelas", () => {
  it("formata com meia estrela", () => {
    expect(estrelas(4.5)).toBe("★★★★½");
    expect(estrelas(3)).toBe("★★★☆☆");
    expect(estrelas(null)).toBe("—");
  });
});
