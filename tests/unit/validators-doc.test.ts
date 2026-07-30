import { describe, it, expect } from "vitest";
import { isValidCPF, isValidCNPJ, idade } from "@/lib/validators-doc";

describe("isValidCPF", () => {
  it("aceita CPFs válidos (com e sem máscara)", () => {
    expect(isValidCPF("52998224725")).toBe(true);
    expect(isValidCPF("529.982.247-25")).toBe(true);
  });
  it("rejeita dígitos verificadores errados", () => {
    expect(isValidCPF("52998224724")).toBe(false);
  });
  it("rejeita sequências repetidas e tamanho errado", () => {
    expect(isValidCPF("11111111111")).toBe(false);
    expect(isValidCPF("123")).toBe(false);
  });
});

describe("isValidCNPJ", () => {
  it("aceita CNPJs válidos (com e sem máscara)", () => {
    expect(isValidCNPJ("11222333000181")).toBe(true);
    expect(isValidCNPJ("11.222.333/0001-81")).toBe(true);
  });
  it("rejeita inválidos", () => {
    expect(isValidCNPJ("11222333000182")).toBe(false);
    expect(isValidCNPJ("00000000000000")).toBe(false);
  });
});

describe("idade", () => {
  it("calcula idade considerando mês/dia", () => {
    const hoje = new Date("2026-07-24");
    expect(idade(new Date("2000-07-24"), hoje)).toBe(26);
    expect(idade(new Date("2000-07-25"), hoje)).toBe(25);
    expect(idade(new Date("2010-01-01"), hoje)).toBe(16);
  });
});
