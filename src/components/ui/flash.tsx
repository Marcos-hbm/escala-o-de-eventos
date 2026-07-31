import Link from "next/link";
import { CheckCircle2, XCircle, X } from "lucide-react";
import { lerFlash, semFlash, PARAM_ERRO, PARAM_OK } from "@/lib/flash";
import { cn } from "@/lib/utils";

/**
 * Faixa de resultado da operação, renderizada **no servidor** a partir da URL.
 *
 * Como vem do mesmo render que traz os dados atualizados, não existe o caso de
 * "dado novo sem aviso" nem "aviso sem dado novo" (ADR 0004). Funciona sem JS,
 * inclusive o fechar, que é um link para a mesma URL sem o parâmetro.
 *
 * Acessibilidade: sucesso usa `role="status"` (anúncio educado); erro usa
 * `role="alert"`, que interrompe o leitor de tela — é informação que o usuário
 * precisa saber antes de continuar.
 */
export function Flash({
  searchParams,
  caminho,
}: {
  searchParams: { [PARAM_OK]?: string; [PARAM_ERRO]?: string } & Record<string, string | undefined>;
  /** Caminho da página, para o link de fechar preservar os filtros atuais. */
  caminho: string;
}) {
  const flash = lerFlash(searchParams);
  if (!flash) return null;

  const ok = flash.tipo === "ok";
  const query = new URLSearchParams(
    Object.entries(searchParams).filter(([, v]) => typeof v === "string" && v !== "") as [string, string][],
  ).toString();

  return (
    <div
      role={ok ? "status" : "alert"}
      data-testid="flash"
      data-tipo={flash.tipo}
      className={cn(
        "flex items-start gap-2 rounded-lg border p-3 text-sm",
        ok
          ? "border-green-300 bg-green-50 text-green-900 dark:border-green-900/50 dark:bg-green-900/20 dark:text-green-200"
          : "border-red-300 bg-red-50 text-red-900 dark:border-red-900/50 dark:bg-red-900/20 dark:text-red-200",
      )}
    >
      {ok ? (
        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      ) : (
        <XCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      )}
      <span className="flex-1">{flash.texto}</span>
      <Link
        href={semFlash(query ? `${caminho}?${query}` : caminho)}
        aria-label="Fechar aviso"
        className="shrink-0 rounded p-0.5 opacity-70 hover:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500"
      >
        <X className="h-4 w-4" />
      </Link>
    </div>
  );
}
