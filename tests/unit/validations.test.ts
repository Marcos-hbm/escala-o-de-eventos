import { describe, it, expect } from "vitest";
import {
  cadastroTrabalhadorSchema,
  cadastroEmpresaSchema,
  eventoSchema,
  loginSchema,
  registrarPagamentoSchema,
  itemFechamentoSchema,
  contestacaoSchema,
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

/**
 * v4 — dinheiro digitado por humano e campos opcionais ausentes.
 *
 * `formData.get()` devolve null para campo que não existe no formulário; um
 * `.optional()` cru rejeitaria isso com "Invalid input" e a operação seria recusada
 * sem explicação. Este bloco existe porque foi exatamente o que aconteceu.
 */
describe("registrarPagamentoSchema (v4)", () => {
  it("aceita valor em padrão brasileiro e inglês", () => {
    expect(registrarPagamentoSchema.parse({ pagamentoId: 1, valor: "1.234,50", forma: "PIX" }).valor).toBe(1234.5);
    expect(registrarPagamentoSchema.parse({ pagamentoId: 1, valor: "1234.50", forma: "PIX" }).valor).toBe(1234.5);
    expect(registrarPagamentoSchema.parse({ pagamentoId: 1, valor: "R$ 200", forma: "PIX" }).valor).toBe(200);
  });

  it("aceita observação ausente (null vindo do FormData)", () => {
    const r = registrarPagamentoSchema.safeParse({ pagamentoId: 1, valor: "200", forma: "PIX", observacao: null });
    expect(r.success).toBe(true);
    if (r.success) expect(r.data.observacao).toBeUndefined();
  });

  it("recusa valor zero, negativo e forma inválida", () => {
    expect(registrarPagamentoSchema.safeParse({ pagamentoId: 1, valor: "0", forma: "PIX" }).success).toBe(false);
    expect(registrarPagamentoSchema.safeParse({ pagamentoId: 1, valor: "-5", forma: "PIX" }).success).toBe(false);
    expect(registrarPagamentoSchema.safeParse({ pagamentoId: 1, valor: "10", forma: "BOLETO" }).success).toBe(false);
  });
});

describe("itemFechamentoSchema (v4)", () => {
  it("aceita zero — no fechamento significa 'não pago'", () => {
    expect(itemFechamentoSchema.parse({ pagamentoId: 1, valorPago: "0", forma: "DINHEIRO" }).valorPago).toBe(0);
  });
});

describe("contestacaoSchema (v4)", () => {
  it("exige descrição com contexto suficiente", () => {
    const curta = contestacaoSchema.safeParse({ pagamentoId: 1, motivo: "Valor", descricao: "menos" });
    expect(curta.success).toBe(false);
    const ok = contestacaoSchema.safeParse({
      pagamentoId: 1,
      motivo: "Valor menor",
      descricao: "Recebi metade do combinado e não houve aviso sobre o restante.",
    });
    expect(ok.success).toBe(true);
  });
});
