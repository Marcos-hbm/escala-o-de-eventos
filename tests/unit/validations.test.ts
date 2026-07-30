import { describe, it, expect } from "vitest";
import {
  cadastroTrabalhadorSchema,
  cadastroEmpresaSchema,
  eventoSchema,
  loginSchema,
} from "@/lib/validations";

describe("cadastroTrabalhadorSchema", () => {
  const base = {
    nome: "Ana Souza",
    email: "ANA@Exemplo.com",
    cpf: "529.982.247-25",
    dataNascimento: "1998-05-12",
    telefone: "(61) 98888-0001",
    genero: "FEMININO",
    senha: "Senha@123",
    aceiteLgpd: true,
  };

  it("normaliza e-mail, cpf e telefone; aceita dados válidos", () => {
    const r = cadastroTrabalhadorSchema.safeParse(base);
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.email).toBe("ana@exemplo.com");
      expect(r.data.cpf).toBe("52998224725");
      expect(r.data.telefone).toBe("61988880001");
    }
  });

  it("exige aceite da LGPD", () => {
    const r = cadastroTrabalhadorSchema.safeParse({ ...base, aceiteLgpd: false });
    expect(r.success).toBe(false);
  });

  it("rejeita CPF inválido", () => {
    const r = cadastroTrabalhadorSchema.safeParse({ ...base, cpf: "11111111111" });
    expect(r.success).toBe(false);
  });

  it("rejeita menor de 16 anos", () => {
    const r = cadastroTrabalhadorSchema.safeParse({ ...base, dataNascimento: "2020-01-01" });
    expect(r.success).toBe(false);
  });

  it("rejeita senha fraca", () => {
    const r = cadastroTrabalhadorSchema.safeParse({ ...base, senha: "abcdefgh" });
    expect(r.success).toBe(false);
  });
});

describe("cadastroEmpresaSchema", () => {
  it("aceita CNPJ válido e rejeita inválido", () => {
    const ok = cadastroEmpresaSchema.safeParse({
      nome: "Produtora X",
      cnpj: "11.222.333/0001-81",
      email: "x@x.com",
      telefone: "6133334444",
      senha: "Senha@123",
      aceiteLgpd: true,
    });
    expect(ok.success).toBe(true);

    const bad = cadastroEmpresaSchema.safeParse({
      nome: "Produtora X",
      cnpj: "11222333000182",
      email: "x@x.com",
      telefone: "6133334444",
      senha: "Senha@123",
      aceiteLgpd: true,
    });
    expect(bad.success).toBe(false);
  });
});

describe("eventoSchema", () => {
  it("coage vagas e valor; valida horário", () => {
    const r = eventoSchema.safeParse({
      nome: "Festival",
      descricao: "",
      dataEvento: "2026-08-15",
      local: "Parque",
      horaInicio: "16:00",
      vagas: "20",
      funcoes: "Garçom",
      valorCache: "180.50",
      observacoes: "",
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.vagas).toBe(20);
      expect(r.data.valorCache).toBe(180.5);
    }
  });

  it("rejeita horário e vagas inválidos", () => {
    expect(eventoSchema.safeParse({ nome: "X", dataEvento: "2026-08-15", horaInicio: "25:99", vagas: 1, valorCache: 0 }).success).toBe(false);
    expect(eventoSchema.safeParse({ nome: "X", dataEvento: "2026-08-15", vagas: 0, valorCache: 0 }).success).toBe(false);
  });
});

describe("loginSchema", () => {
  it("exige tipo válido", () => {
    expect(loginSchema.safeParse({ tipo: "TRABALHADOR", email: "a@a.com", senha: "x" }).success).toBe(true);
    expect(loginSchema.safeParse({ tipo: "ADMIN", email: "a@a.com", senha: "x" }).success).toBe(false);
  });
});
