/**
 * Avaliação por critérios (v4, item 3) — **funções puras**.
 *
 * A empresa avalia cinco dimensões; a **nota geral** (`Avaliacao.nota`) passa a ser
 * a média delas. Isso preserva tudo que já existia: `lib/reputacao.ts`, o score da
 * escalação inteligente e as avaliações gravadas antes da v4 (que só têm a nota
 * geral) continuam funcionando sem reescrita — ver ADR 0006.
 */

export type CriterioId =
  | "pontualidade"
  | "comunicacao"
  | "trabalhoEquipe"
  | "qualidade"
  | "comprometimento";

export interface DefinicaoCriterio {
  id: CriterioId;
  rotulo: string;
  /** Explica o que a nota mede — evita "5 para todos" por falta de critério. */
  ajuda: string;
}

/** Ordem de exibição fixa: mesma sequência em todas as telas e relatórios. */
export const CRITERIOS: DefinicaoCriterio[] = [
  { id: "pontualidade", rotulo: "Pontualidade", ajuda: "Chegou no horário combinado e cumpriu a escala." },
  { id: "comunicacao", rotulo: "Comunicação", ajuda: "Avisou imprevistos, entendeu e repassou instruções." },
  { id: "trabalhoEquipe", rotulo: "Trabalho em equipe", ajuda: "Colaborou com colegas e com a coordenação." },
  { id: "qualidade", rotulo: "Qualidade", ajuda: "Executou o serviço no padrão esperado." },
  { id: "comprometimento", rotulo: "Comprometimento", ajuda: "Assumiu responsabilidade e foi até o fim da tarefa." },
];

export type NotasCriterios = Partial<Record<CriterioId, number | null | undefined>>;

const NOTA_MIN = 1;
const NOTA_MAX = 5;

/** Nota válida é inteiro de 1 a 5. */
export function notaValida(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= NOTA_MIN && n <= NOTA_MAX;
}

/** Somente as notas preenchidas e válidas. */
export function notasPreenchidas(notas: NotasCriterios): number[] {
  return CRITERIOS.map((c) => notas[c.id]).filter(notaValida);
}

/**
 * Média dos critérios preenchidos, arredondada ao inteiro mais próximo.
 *
 * Arredonda para inteiro (e não 1 casa) porque a nota geral alimenta colunas e
 * cálculos que sempre trataram nota como 1..5 inteiro; a média fracionária
 * continua disponível em `mediaExata` para exibição.
 */
export function notaGeralDerivada(notas: NotasCriterios): number | null {
  const valores = notasPreenchidas(notas);
  if (valores.length === 0) return null;
  return Math.round(valores.reduce((a, b) => a + b, 0) / valores.length);
}

/** Média com uma casa decimal, para exibir "4,4" na tela. */
export function mediaExata(notas: NotasCriterios): number | null {
  const valores = notasPreenchidas(notas);
  if (valores.length === 0) return null;
  return Math.round((valores.reduce((a, b) => a + b, 0) / valores.length) * 10) / 10;
}

export interface ResultadoAvaliacao {
  ok: boolean;
  erro?: string;
  /** Nota geral a gravar (média dos critérios). */
  notaGeral?: number;
}

/**
 * Valida o conjunto: pelo menos um critério precisa vir preenchido, e toda nota
 * informada precisa estar em 1..5 (o banco também garante isso, mas a mensagem
 * daqui é a que o usuário lê).
 */
export function validarAvaliacaoPorCriterios(notas: NotasCriterios): ResultadoAvaliacao {
  const informadas = CRITERIOS.map((c) => ({ c, v: notas[c.id] })).filter(
    ({ v }) => v !== null && v !== undefined && v !== ("" as unknown),
  );
  if (informadas.length === 0) {
    return { ok: false, erro: "Dê nota em pelo menos um critério (de 1 a 5)." };
  }
  const invalida = informadas.find(({ v }) => !notaValida(v));
  if (invalida) {
    return { ok: false, erro: `Nota inválida em ${invalida.c.rotulo}: use um número de 1 a 5.` };
  }
  return { ok: true, notaGeral: notaGeralDerivada(notas)! };
}

export interface LinhaResumoCriterio {
  id: CriterioId;
  rotulo: string;
  media: number | null;
  quantidade: number;
}

/**
 * Média por critério em um conjunto de avaliações — o "histórico do trabalhador"
 * do item 3, e a base para as recomendações por IA citadas como trabalho futuro.
 */
export function resumirCriterios(avaliacoes: NotasCriterios[]): LinhaResumoCriterio[] {
  return CRITERIOS.map((c) => {
    const valores = avaliacoes.map((a) => a[c.id]).filter(notaValida);
    return {
      id: c.id,
      rotulo: c.rotulo,
      media: valores.length ? Math.round((valores.reduce((a, b) => a + b, 0) / valores.length) * 10) / 10 : null,
      quantidade: valores.length,
    };
  });
}

/** Critério mais forte e mais fraco (quando há dados suficientes para comparar). */
export function destaques(resumo: LinhaResumoCriterio[]): { melhor?: LinhaResumoCriterio; pior?: LinhaResumoCriterio } {
  const comDados = resumo.filter((r) => r.media !== null);
  if (comDados.length < 2) return {};
  const ordenado = [...comDados].sort((a, b) => (b.media ?? 0) - (a.media ?? 0));
  const melhor = ordenado[0];
  const pior = ordenado[ordenado.length - 1];
  // Sem diferença entre o melhor e o pior, destacar qualquer um seria ruído.
  return melhor.media === pior.media ? {} : { melhor, pior };
}
