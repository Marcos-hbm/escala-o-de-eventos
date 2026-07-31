/**
 * Mensagens de resultado de operação ("flash") transportadas na URL.
 *
 * ## Por que na URL
 *
 * O feedback antes vivia no estado da server action (`ActionState`) e era exibido
 * no cliente. Medindo contra o build de produção, em parte das execuções o cliente
 * não aplicava a resposta da action: o banco ficava correto, e a tela — e o aviso —
 * não mudavam (ver ADR 0004). Passando a mensagem pela URL, quem renderiza é o
 * servidor, no mesmo render que já traz os dados novos: se o dado atualizou, o
 * aviso apareceu. Também funciona sem JavaScript.
 *
 * Erros de **validação de campo** continuam em `ActionState`, inline junto do
 * input: navegar para mostrar "e-mail inválido" perderia o que o usuário digitou.
 *
 * Funções puras — sem I/O, testáveis offline.
 */

export type TipoFlash = "ok" | "erro";

/** Chaves usadas na query string. */
export const PARAM_OK = "aviso";
export const PARAM_ERRO = "erro_op";

/** Teto de tamanho: mensagem é para humano, não para carregar payload em URL. */
export const TAMANHO_MAX_FLASH = 200;

export interface Flash {
  tipo: TipoFlash;
  texto: string;
}

function limpar(texto: string): string {
  // Sem quebras de linha (URL) e sem exagero de tamanho.
  return texto.replace(/\s+/g, " ").trim().slice(0, TAMANHO_MAX_FLASH);
}

/**
 * Acrescenta o aviso a um caminho interno, preservando os parâmetros existentes
 * (filtros, paginação) e substituindo qualquer flash anterior — para a mensagem
 * não acumular a cada ação.
 */
export function comFlash(caminho: string, tipo: TipoFlash, texto: string): string {
  const [base, queryAtual = ""] = caminho.split("?");
  const q = new URLSearchParams(queryAtual);
  q.delete(PARAM_OK);
  q.delete(PARAM_ERRO);
  const limpo = limpar(texto);
  if (limpo) q.set(tipo === "ok" ? PARAM_OK : PARAM_ERRO, limpo);
  const s = q.toString();
  return s ? `${base}?${s}` : base;
}

/** Lê o flash dos `searchParams` da página. `null` quando não há mensagem. */
export function lerFlash(params: { [PARAM_OK]?: string; [PARAM_ERRO]?: string } | undefined): Flash | null {
  if (!params) return null;
  const erro = params[PARAM_ERRO];
  if (typeof erro === "string" && erro.trim()) return { tipo: "erro", texto: limpar(erro) };
  const ok = params[PARAM_OK];
  if (typeof ok === "string" && ok.trim()) return { tipo: "ok", texto: limpar(ok) };
  return null;
}

/** Mesmo caminho sem o flash — usado pelo botão de fechar (um link, sem JS). */
export function semFlash(caminho: string): string {
  const [base, queryAtual = ""] = caminho.split("?");
  const q = new URLSearchParams(queryAtual);
  q.delete(PARAM_OK);
  q.delete(PARAM_ERRO);
  const s = q.toString();
  return s ? `${base}?${s}` : base;
}
