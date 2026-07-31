/**
 * Formatação de dinheiro — ponto único, pelo mesmo motivo de `lib/datetime.ts`:
 * espalhado pelo código, um `toLocaleString` acaba com locale ou casas decimais
 * diferentes em uma das telas.
 *
 * Puro (sem I/O). Cálculo de valores fica em `lib/domain/pagamento.ts`; aqui é só
 * apresentação.
 */

export const LOCALE_BR = "pt-BR";

/** `R$ 1.234,50`. Aceita string/Decimal já convertido. */
export function formatarBRL(valor: number | string): string {
  const n = typeof valor === "string" ? Number(valor) : valor;
  if (!Number.isFinite(n)) return "—";
  return n.toLocaleString(LOCALE_BR, { style: "currency", currency: "BRL" });
}

/**
 * `1.234,50` — número em padrão brasileiro sem símbolo, para planilha (CSV) onde o
 * símbolo estorvaria a leitura como número pelo Excel.
 */
export function formatarNumeroBR(valor: number | string): string {
  const n = typeof valor === "string" ? Number(valor) : valor;
  if (!Number.isFinite(n)) return "";
  return n.toLocaleString(LOCALE_BR, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
