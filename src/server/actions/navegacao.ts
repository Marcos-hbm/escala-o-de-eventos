import "server-only";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { caminhoInternoDoReferer } from "@/lib/navegacao";

/**
 * Volta para a página que disparou a action (preservando filtros e paginação da
 * URL), forçando um render novo — ver o motivo em `lib/navegacao.ts`.
 *
 * Chamar como **última** instrução da action: `redirect()` interrompe o fluxo por
 * exceção, então nada depois dela executa.
 */
export async function voltarParaOrigem(fallback: string): Promise<never> {
  const h = await headers();
  const destino = caminhoInternoDoReferer(h.get("referer"), h.get("origin")) ?? fallback;
  redirect(destino);
}
