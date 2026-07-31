import { describe, it, expect } from "vitest";
import {
  ROTULOS_CHAVE_PIX,
  TIPOS_CHAVE_PIX,
  formatarChavePix,
  mascararChavePix,
  normalizarChavePix,
} from "@/lib/pix";

/**
 * Chave PIX: a normalização é o que garante que a empresa copie algo que o banco
 * aceita — a mesma chave digitada de formas diferentes tem de virar um único valor.
 */

describe("normalizarChavePix — CPF e CNPJ", () => {
  it("aceita com máscara e grava só dígitos", () => {
    expect(normalizarChavePix("CPF", "529.982.247-25")).toEqual({ ok: true, valor: "52998224725" });
    expect(normalizarChavePix("CNPJ", "11.222.333/0001-81")).toEqual({ ok: true, valor: "11222333000181" });
  });

  it("recusa dígito verificador inválido", () => {
    const r = normalizarChavePix("CPF", "111.111.111-11");
    expect(r.ok).toBe(false);
    expect(r.erro).toMatch(/inválido/i);
  });

  it("recusa quantidade errada de dígitos", () => {
    expect(normalizarChavePix("CPF", "123").erro).toMatch(/11 dígitos/);
    expect(normalizarChavePix("CNPJ", "123").erro).toMatch(/14 dígitos/);
  });
});

describe("normalizarChavePix — e-mail", () => {
  it("normaliza para minúsculas", () => {
    expect(normalizarChavePix("EMAIL", "  Ana@Exemplo.COM ")).toEqual({ ok: true, valor: "ana@exemplo.com" });
  });

  it("recusa formato inválido e excesso de tamanho", () => {
    expect(normalizarChavePix("EMAIL", "ana@").ok).toBe(false);
    expect(normalizarChavePix("EMAIL", `${"a".repeat(70)}@exemplo.com`).erro).toMatch(/77/);
  });
});

describe("normalizarChavePix — telefone", () => {
  it("grava em E.164, aceitando máscara, com e sem código do país", () => {
    expect(normalizarChavePix("TELEFONE", "(61) 98888-0000")).toEqual({ ok: true, valor: "+5561988880000" });
    expect(normalizarChavePix("TELEFONE", "5561988880000")).toEqual({ ok: true, valor: "+5561988880000" });
    expect(normalizarChavePix("TELEFONE", "6133334444")).toEqual({ ok: true, valor: "+556133334444" });
  });

  it("recusa número sem DDD", () => {
    expect(normalizarChavePix("TELEFONE", "98888000").erro).toMatch(/DDD/);
  });
});

describe("normalizarChavePix — aleatória", () => {
  it("aceita UUID e normaliza caixa", () => {
    const uuid = "F47AC10B-58CC-4372-A567-0E02B2C3D479";
    expect(normalizarChavePix("ALEATORIA", uuid)).toEqual({ ok: true, valor: uuid.toLowerCase() });
  });

  it("recusa texto que não é UUID", () => {
    expect(normalizarChavePix("ALEATORIA", "minha-chave").erro).toMatch(/UUID/);
  });
});

describe("chave vazia", () => {
  it("pede a chave em qualquer tipo", () => {
    for (const tipo of TIPOS_CHAVE_PIX) {
      expect(normalizarChavePix(tipo, "   ").erro).toMatch(/Informe a chave/);
    }
  });
});

describe("exibição", () => {
  it("mascara para o trabalhador confirmar sem expor o valor", () => {
    expect(mascararChavePix("CPF", "52998224725")).toBe("***.982.247-**");
    expect(mascararChavePix("EMAIL", "ana@exemplo.com")).toBe("an*@exemplo.com");
    expect(mascararChavePix("TELEFONE", "+5561988880000")).toBe("+55 (61) *****-0000");
    expect(mascararChavePix("ALEATORIA", "f47ac10b-58cc-4372-a567-0e02b2c3d479")).toBe("f47ac10b…d479");
  });

  it("formata a chave completa para a empresa copiar", () => {
    expect(formatarChavePix("CPF", "52998224725")).toBe("529.982.247-25");
    expect(formatarChavePix("CNPJ", "11222333000181")).toBe("11.222.333/0001-81");
    expect(formatarChavePix("TELEFONE", "+5561988880000")).toBe("+55 (61) 98888-0000");
    expect(formatarChavePix("TELEFONE", "+556133334444")).toBe("+55 (61) 3333-4444");
  });

  it("todo tipo tem rótulo em português", () => {
    for (const tipo of TIPOS_CHAVE_PIX) expect(ROTULOS_CHAVE_PIX[tipo].length).toBeGreaterThan(0);
  });
});
