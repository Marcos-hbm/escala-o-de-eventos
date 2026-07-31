/**
 * Regras de dinheiro do pagamento ao trabalhador — **funções puras**.
 *
 * Ficam separadas do I/O (as actions em `server/actions/pagamentos.ts` fazem
 * banco, auditoria e notificação) porque são as regras que precisam de teste
 * exaustivo e de leitura fácil: é a parte do sistema em que errar significa pagar
 * o valor errado a alguém.
 *
 * Convenções:
 * - valores chegam como `number` já convertidos do `Decimal` do Prisma;
 * - tudo é arredondado a 2 casas com `centavos()` antes de comparar, para não
 *   deixar `0.1 + 0.2 !== 0.3` decidir se um pagamento está quitado.
 */
import { formatarBRL } from "../dinheiro";

export type StatusPagamentoId = "PENDENTE" | "PARCIAL" | "PAGO" | "CANCELADO";
export type FormaPagamentoId = "PIX" | "DINHEIRO" | "CARTAO_CREDITO";

export const FORMAS_PAGAMENTO: FormaPagamentoId[] = ["PIX", "DINHEIRO", "CARTAO_CREDITO"];

export const ROTULOS_FORMA: Record<FormaPagamentoId, string> = {
  PIX: "PIX",
  DINHEIRO: "Dinheiro",
  CARTAO_CREDITO: "Cartão de crédito",
};

export const ROTULOS_STATUS_PAGAMENTO: Record<StatusPagamentoId, string> = {
  PENDENTE: "Pagamento pendente",
  PARCIAL: "Pagamento parcial",
  PAGO: "Pago",
  CANCELADO: "Cancelado",
};

/** Indicador curto para o card do evento (item 6 da especificação). */
export const INDICADOR_STATUS: Record<StatusPagamentoId, string> = {
  PENDENTE: "⏳ Pagamento pendente",
  PARCIAL: "⏳ Pago parcialmente",
  PAGO: "✅ Pago",
  CANCELADO: "— Cancelado",
};

/** Arredonda para centavos (2 casas), evitando erro de ponto flutuante. */
export function centavos(valor: number): number {
  return Math.round((Number.isFinite(valor) ? valor : 0) * 100) / 100;
}

/** Quanto ainda falta pagar. Nunca negativo. */
export function saldoRestante(valorDevido: number, valorPago: number): number {
  return Math.max(0, centavos(centavos(valorDevido) - centavos(valorPago)));
}

/**
 * Status derivado do par (devido, pago). Um pagamento CANCELADO não é recalculado —
 * cancelamento é decisão, não consequência de valor.
 */
export function statusDerivado(valorDevido: number, valorPago: number): StatusPagamentoId {
  const devido = centavos(valorDevido);
  const pago = centavos(valorPago);
  if (pago <= 0) return "PENDENTE";
  if (pago >= devido) return "PAGO";
  return "PARCIAL";
}

export interface ResultadoLancamento {
  ok: boolean;
  /** Mensagem com o que corrigir (quando `!ok`). */
  erro?: string;
  /** Estado do pagamento depois do lançamento (quando `ok`). */
  valorPago?: number;
  status?: StatusPagamentoId;
  quitado?: boolean;
}

/**
 * Aplica um lançamento (pagamento total ou parcial) sobre o pagamento atual.
 *
 * Regras, todas com mensagem de correção:
 * - valor precisa ser positivo (registrar R$ 0 não é pagamento);
 * - não se paga mais do que o devido (evita “troco” fantasma no histórico);
 * - pagamento cancelado não recebe lançamento.
 */
export function aplicarLancamento(params: {
  valorDevido: number;
  valorPagoAtual: number;
  status: StatusPagamentoId;
  valorLancamento: number;
}): ResultadoLancamento {
  const devido = centavos(params.valorDevido);
  const pagoAtual = centavos(params.valorPagoAtual);
  const lancamento = centavos(params.valorLancamento);

  if (params.status === "CANCELADO") {
    return { ok: false, erro: "Este pagamento está cancelado. Reabra o pagamento antes de registrar valores." };
  }
  if (!Number.isFinite(lancamento) || lancamento <= 0) {
    return { ok: false, erro: "Informe um valor maior que zero." };
  }
  if (devido <= 0) {
    return { ok: false, erro: "Defina o valor devido ao trabalhador antes de registrar o pagamento." };
  }
  const restante = saldoRestante(devido, pagoAtual);
  if (lancamento > restante) {
    return {
      ok: false,
      erro: `Valor acima do saldo devido (restam ${formatarValor(restante)}). Ajuste o valor ou o combinado do evento.`,
    };
  }

  const novoPago = centavos(pagoAtual + lancamento);
  const status = statusDerivado(devido, novoPago);
  return { ok: true, valorPago: novoPago, status, quitado: status === "PAGO" };
}

/** Formata em BRL (apresentação vem de `lib/dinheiro.ts`). */
export function formatarValor(valor: number): string {
  return formatarBRL(centavos(valor));
}

export interface ResumoFinanceiro {
  total: number;
  pago: number;
  pendente: number;
  quantidade: number;
  quantidadePagos: number;
  quantidadePendentes: number;
  /** 0..100 — para a barra de progresso do fechamento. */
  pctPago: number;
}

/** Agrega uma lista de pagamentos (tela de fechamento e históricos). */
export function resumirPagamentos(
  pagamentos: { valorDevido: number; valorPago: number; status: StatusPagamentoId }[],
): ResumoFinanceiro {
  const validos = pagamentos.filter((p) => p.status !== "CANCELADO");
  const total = centavos(validos.reduce((a, p) => a + centavos(p.valorDevido), 0));
  const pago = centavos(validos.reduce((a, p) => a + centavos(p.valorPago), 0));
  const quantidadePagos = validos.filter((p) => statusDerivado(p.valorDevido, p.valorPago) === "PAGO").length;
  return {
    total,
    pago,
    pendente: saldoRestante(total, pago),
    quantidade: validos.length,
    quantidadePagos,
    quantidadePendentes: validos.length - quantidadePagos,
    pctPago: total <= 0 ? 0 : Math.min(100, Math.round((pago / total) * 100)),
  };
}

/**
 * O fechamento de caixa só pode ser concluído quando todo trabalhador escalado
 * tiver uma decisão registrada (pago, parcial ou explicitamente pendente).
 * Devolve a lista de nomes pendentes de decisão, para a mensagem dizer quem falta.
 */
export function pendentesDeDecisao(
  itens: { nome: string; decidido: boolean }[],
): string[] {
  return itens.filter((i) => !i.decidido).map((i) => i.nome);
}
