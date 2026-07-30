/**
 * Métricas e agregações (v2) — funções puras, sem I/O, testáveis offline.
 * Usadas nos painéis (KPIs), na reputação e na ordenação inteligente da escala.
 */

/** Média aritmética arredondada a 1 casa; null se não há amostras. */
export function media(nums: number[]): number | null {
  if (!nums.length) return null;
  const soma = nums.reduce((a, b) => a + b, 0);
  return Math.round((soma / nums.length) * 10) / 10;
}

/** Fração 0..1 (0 quando total é 0). */
export function taxa(parte: number, total: number): number {
  if (total <= 0) return 0;
  return parte / total;
}

/** Porcentagem inteira 0..100. */
export function porcentagem(parte: number, total: number): number {
  return Math.round(taxa(parte, total) * 100);
}

export interface Reputacao {
  media: number | null; // 1..5
  qtd: number;
}

/** Reputação a partir de uma lista de notas (1..5). */
export function reputacao(notas: number[]): Reputacao {
  return { media: media(notas), qtd: notas.length };
}

/**
 * Score de priorização para a escalação inteligente.
 * Combina reputação (peso maior) e taxa de presença. Sem histórico, retorna 0
 * (candidato "neutro", ordenado após quem tem bom histórico).
 * Faixa aproximada: 0..100.
 */
export function scorePrioridade(params: {
  reputacaoMedia: number | null; // 1..5
  presentes: number;
  faltas: number;
}): number {
  const rep = params.reputacaoMedia ?? 0; // 0 = sem avaliação
  const repNorm = (rep / 5) * 70; // até 70 pontos
  const totalPresenca = params.presentes + params.faltas;
  const presNorm = totalPresenca > 0 ? taxa(params.presentes, totalPresenca) * 30 : 0; // até 30
  return Math.round((repNorm + presNorm) * 10) / 10;
}

/** Estrelas cheias/meia para exibição (ex.: 4.5 -> "★★★★½"). */
export function estrelas(mediaNota: number | null): string {
  if (mediaNota == null) return "—";
  const cheias = Math.floor(mediaNota);
  const meia = mediaNota - cheias >= 0.5;
  return "★".repeat(cheias) + (meia ? "½" : "") + "☆".repeat(5 - cheias - (meia ? 1 : 0));
}
