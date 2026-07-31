import { describe, it, expect } from "vitest";
import {
  INDICADOR_STATUS,
  aplicarLancamento,
  centavos,
  formatarValor,
  pendentesDeDecisao,
  resumirPagamentos,
  saldoRestante,
  statusDerivado,
} from "@/lib/domain/pagamento";

/** Regras de dinheiro: onde errar significa pagar valor errado a alguém. */

/**
 * `Intl.NumberFormat("pt-BR")` separa o símbolo do valor com espaço NÃO separável
 * (U+00A0), não com espaço comum. Comparar string formatada sem normalizar isso
 * gera falha que parece bug de cálculo e é só invisível na tela.
 */
const semNbsp = (s: string) => s.replace(/\u00a0/g, " ");

describe("centavos", () => {
  it("arredonda a 2 casas e neutraliza erro de ponto flutuante", () => {
    expect(centavos(0.1 + 0.2)).toBe(0.3);
    expect(centavos(1234.567)).toBe(1234.57);
    expect(centavos(Number.NaN)).toBe(0);
  });
});

describe("saldoRestante", () => {
  it("calcula o que falta e nunca devolve negativo", () => {
    expect(saldoRestante(180, 50)).toBe(130);
    expect(saldoRestante(180, 180)).toBe(0);
    expect(saldoRestante(180, 200)).toBe(0);
  });
});

describe("statusDerivado", () => {
  it("classifica pendente, parcial e pago", () => {
    expect(statusDerivado(180, 0)).toBe("PENDENTE");
    expect(statusDerivado(180, 90)).toBe("PARCIAL");
    expect(statusDerivado(180, 180)).toBe("PAGO");
  });
  it("centavos não deixam o pagamento 'quase pago'", () => {
    expect(statusDerivado(0.3, 0.1 + 0.2)).toBe("PAGO");
  });
});

describe("aplicarLancamento", () => {
  const base = { valorDevido: 180, valorPagoAtual: 0, status: "PENDENTE" as const };

  it("pagamento total quita", () => {
    expect(aplicarLancamento({ ...base, valorLancamento: 180 })).toMatchObject({
      ok: true,
      valorPago: 180,
      status: "PAGO",
      quitado: true,
    });
  });

  it("pagamento parcial acumula e mantém PARCIAL", () => {
    const primeiro = aplicarLancamento({ ...base, valorLancamento: 100 });
    expect(primeiro).toMatchObject({ ok: true, valorPago: 100, status: "PARCIAL", quitado: false });

    const segundo = aplicarLancamento({
      valorDevido: 180,
      valorPagoAtual: primeiro.valorPago!,
      status: primeiro.status!,
      valorLancamento: 80,
    });
    expect(segundo).toMatchObject({ ok: true, valorPago: 180, status: "PAGO", quitado: true });
  });

  it("recusa valor acima do saldo, dizendo quanto resta", () => {
    const r = aplicarLancamento({ valorDevido: 180, valorPagoAtual: 100, status: "PARCIAL", valorLancamento: 100 });
    expect(r.ok).toBe(false);
    expect(semNbsp(r.erro!)).toContain("R$ 80,00");
  });

  it("recusa valor zero ou negativo", () => {
    expect(aplicarLancamento({ ...base, valorLancamento: 0 }).erro).toMatch(/maior que zero/);
    expect(aplicarLancamento({ ...base, valorLancamento: -10 }).erro).toMatch(/maior que zero/);
  });

  it("recusa lançamento em pagamento cancelado", () => {
    const r = aplicarLancamento({ valorDevido: 180, valorPagoAtual: 0, status: "CANCELADO", valorLancamento: 50 });
    expect(r.erro).toMatch(/cancelado/i);
  });

  it("exige valor devido definido", () => {
    expect(aplicarLancamento({ valorDevido: 0, valorPagoAtual: 0, status: "PENDENTE", valorLancamento: 50 }).erro)
      .toMatch(/valor devido/i);
  });
});

describe("resumirPagamentos", () => {
  it("agrega totais, contagens e percentual", () => {
    const r = resumirPagamentos([
      { valorDevido: 180, valorPago: 180, status: "PAGO" },
      { valorDevido: 150, valorPago: 50, status: "PARCIAL" },
      { valorDevido: 200, valorPago: 0, status: "PENDENTE" },
    ]);
    expect(r).toMatchObject({
      total: 530,
      pago: 230,
      pendente: 300,
      quantidade: 3,
      quantidadePagos: 1,
      quantidadePendentes: 2,
    });
    expect(r.pctPago).toBe(43);
  });

  it("ignora cancelados e lida com lista vazia", () => {
    expect(resumirPagamentos([{ valorDevido: 100, valorPago: 0, status: "CANCELADO" }])).toMatchObject({
      total: 0,
      quantidade: 0,
      pctPago: 0,
    });
    expect(resumirPagamentos([]).total).toBe(0);
  });
});

describe("pendentesDeDecisao", () => {
  it("lista quem falta decidir no fechamento", () => {
    expect(
      pendentesDeDecisao([
        { nome: "Ana", decidido: true },
        { nome: "Bruno", decidido: false },
        { nome: "Carla", decidido: false },
      ]),
    ).toEqual(["Bruno", "Carla"]);
  });
});

describe("apresentação", () => {
  it("indicador do card cobre todos os status", () => {
    expect(INDICADOR_STATUS.PAGO).toContain("Pago");
    expect(INDICADOR_STATUS.PENDENTE).toContain("pendente");
  });
  it("formata em BRL", () => {
    expect(semNbsp(formatarValor(1234.5))).toBe("R$ 1.234,50");
  });
});
