import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { caminhoInternoDoReferer } from "@/lib/navegacao";
import { comFlash, type TipoFlash } from "@/lib/flash";

/**
 * Volta para a página que disparou a action — preservando filtros e paginação —
 * forçando um render novo, opcionalmente com a mensagem de resultado na URL.
 *
 * Motivo de existir (medições e alternativas descartadas): `lib/navegacao.ts` e
 * ADR 0004. Resumo: confiar apenas em `revalidatePath` deixava, em parte das
 * execuções, o banco correto e a tela velha.
 *
 * Chamar como **última** instrução da action: `redirect()` interrompe o fluxo por
 * exceção, então nada depois dela executa.
 */
export async function voltarParaOrigem(
  fallback: string,
  flash?: { tipo: TipoFlash; texto: string },
): Promise<never> {
  const h = await headers();
  const destino = caminhoInternoDoReferer(h.get("referer"), h.get("origin")) ?? fallback;

  redirect(flash ? comFlash(destino, flash.tipo, flash.texto) : destino);
}

/** Atalho: sucesso. */
export async function voltarComSucesso(fallback: string, texto: string): Promise<never> {
  return voltarParaOrigem(fallback, { tipo: "ok", texto });
}

/**
 * Atalho: operação recusada por regra de negócio (limite, permissão, estado).
 *
 * IMPORTANTE: quando a recusa acontece **sem** nenhuma escrita no banco, chame
 * `revalidatePath` da rota de destino antes deste atalho. Sem invalidar, o cliente
 * serve a página do próprio cache, ignora a query nova e o aviso não aparece
 * (medido). Nas ações que escrevem, a revalidação que elas já fazem cobre isso.
 * (Revalidar dentro deste helper foi testado e atrapalha o redirect: a URL perde
 * o parâmetro do aviso.)
 */
export async function voltarComErro(fallback: string, texto: string): Promise<never> {
  return voltarParaOrigem(fallback, { tipo: "erro", texto });
}
