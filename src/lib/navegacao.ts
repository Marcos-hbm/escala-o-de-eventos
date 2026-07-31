/**
 * Navegação pós-mutação.
 *
 * ## Por que existe
 *
 * Server actions que retornam `void` (excluir evento, responder vínculo, marcar
 * presença…) dependiam só de `revalidatePath` para a tela refletir a mudança.
 * Medindo em loop contra o build de produção, isso falha de forma intermitente:
 * a mutação é gravada no banco e a tela continua mostrando o estado antigo
 * (observado 1 em 8 em `/empresa/vinculos` e 5 em 6 quando a lista estava sob
 * `<Suspense>`). Uma tela que mente sobre o que está no banco é pior que uma
 * tela lenta.
 *
 * A correção é tornar a atualização determinística: além de revalidar, a action
 * redireciona de volta para a página de origem, o que força um render novo.
 * O destino vem do header `Referer` — assim nenhum formulário precisa carregar
 * campo escondido — e é validado para nunca sair do próprio site.
 */

/**
 * Extrai `pathname + search` de um `Referer`, aceitando **apenas** caminhos
 * internos. Devolve `null` se o valor for de outra origem, malformado ou ausente
 * (proteção contra open redirect).
 *
 * Função pura: recebe o header e a origem esperada, não lê nada do ambiente.
 */
export function caminhoInternoDoReferer(referer: string | null | undefined, origemAtual?: string | null): string | null {
  if (!referer) return null;
  let url: URL;
  try {
    url = new URL(referer);
  } catch {
    return null;
  }
  if (origemAtual) {
    let origem: URL;
    try {
      origem = new URL(origemAtual);
    } catch {
      return null;
    }
    if (url.host !== origem.host) return null;
  }
  const caminho = `${url.pathname}${url.search}`;
  // `//host` seria interpretado como URL protocol-relative pelo navegador.
  if (!caminho.startsWith("/") || caminho.startsWith("//")) return null;
  return caminho;
}
