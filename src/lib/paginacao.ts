/**
 * Paginação server-side — funções puras (sem I/O), reaproveitadas por qualquer
 * listagem.
 *
 * Motivo: as listagens faziam `findMany` sem `take`, o que funciona com o seed e
 * quebra quando uma empresa tiver milhares de eventos ou inscrições — a consulta
 * cresce sem limite e a página renderiza tudo. Aqui centralizamos a leitura dos
 * parâmetros de URL (com clamp defensivo, porque `?pagina=-3` ou `?tamanho=99999`
 * vêm do usuário) e o cálculo de `skip`/`take` para o Prisma.
 *
 * Optamos por offset (`skip`/`take`) e não cursor: as telas precisam de "página 3
 * de 12" e de links diretos, o volume por tenant é moderado e há índice nas
 * colunas de ordenação. Se alguma listagem passar a escanear páginas muito
 * profundas, a troca para cursor fica isolada aqui.
 */

export const TAMANHO_PAGINA_PADRAO = 10;
export const TAMANHO_PAGINA_MAX = 100;

export interface ParametrosPagina {
  pagina: number; // 1-based
  tamanho: number;
  /** Para o Prisma. */
  skip: number;
  take: number;
}

/** Lê `?pagina`/`?tamanho` (strings de URL) e devolve valores seguros. */
export function lerParametrosPagina(
  entrada: { pagina?: string; tamanho?: string } = {},
  tamanhoPadrao = TAMANHO_PAGINA_PADRAO,
): ParametrosPagina {
  const pagina = clampInteiro(entrada.pagina, 1, Number.MAX_SAFE_INTEGER, 1);
  const tamanho = clampInteiro(entrada.tamanho, 1, TAMANHO_PAGINA_MAX, tamanhoPadrao);
  return { pagina, tamanho, skip: (pagina - 1) * tamanho, take: tamanho };
}

/**
 * Abaixo do mínimo (`?tamanho=0`, `?pagina=-3`) o valor é tratado como ausente e
 * cai no padrão — 1 item por página seria uma leitura literal e inútil do input.
 * Acima do máximo, satura: quem pede `?tamanho=99999` quer "muitos", e o teto
 * evita virar um dump da tabela por URL.
 */
function clampInteiro(valor: string | undefined, min: number, max: number, padrao: number): number {
  const n = Number(valor);
  if (!Number.isInteger(n) || n < min) return padrao;
  return Math.min(max, n);
}

export interface Pagina<T> {
  itens: T[];
  pagina: number;
  tamanho: number;
  total: number;
  totalPaginas: number;
  temAnterior: boolean;
  temProxima: boolean;
  /** Índices 1-based do primeiro e do último item exibidos (para "11–20 de 57"). */
  de: number;
  ate: number;
}

/** Monta os metadados da página a partir do total contado no banco. */
export function montarPagina<T>(itens: T[], total: number, params: ParametrosPagina): Pagina<T> {
  const totalPaginas = total === 0 ? 1 : Math.ceil(total / params.tamanho);
  const pagina = Math.min(params.pagina, totalPaginas);
  const de = total === 0 ? 0 : (pagina - 1) * params.tamanho + 1;
  const ate = total === 0 ? 0 : Math.min(total, pagina * params.tamanho);
  return {
    itens,
    pagina,
    tamanho: params.tamanho,
    total,
    totalPaginas,
    temAnterior: pagina > 1,
    temProxima: pagina < totalPaginas,
    de,
    ate,
  };
}

/** Rótulo de status: `11–20 de 57 eventos` (ou `Nenhum evento`). */
export function rotuloPagina(p: Pagina<unknown>, singular: string, plural = `${singular}s`): string {
  if (p.total === 0) return `Nenhum ${singular}`;
  if (p.total <= p.tamanho) return `${p.total} ${p.total === 1 ? singular : plural}`;
  return `${p.de}–${p.ate} de ${p.total} ${plural}`;
}

/**
 * URL da página `destino` preservando os filtros já aplicados (busca, data...).
 * `pagina=1` sai da query para a URL canônica ficar limpa.
 */
export function urlDaPagina(
  base: string,
  filtros: Record<string, string | undefined>,
  destino: number,
  tamanho?: number,
): string {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(filtros)) {
    if (v !== undefined && v !== "" && k !== "pagina" && k !== "tamanho") q.set(k, v);
  }
  if (destino > 1) q.set("pagina", String(destino));
  if (tamanho && tamanho !== TAMANHO_PAGINA_PADRAO) q.set("tamanho", String(tamanho));
  const s = q.toString();
  return s ? `${base}?${s}` : base;
}
