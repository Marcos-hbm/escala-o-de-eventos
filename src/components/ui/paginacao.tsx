import Link from "next/link";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { rotuloPagina, urlDaPagina, type Pagina } from "@/lib/paginacao";
import { cn } from "@/lib/utils";

/**
 * Navegação de páginas server-side: links reais (`<a href>`), então funciona sem
 * JavaScript, é indexável e permite abrir a página 3 em outra aba.
 *
 * Acessibilidade: `<nav aria-label>`, página atual com `aria-current="page"` e
 * limites desabilitados como `<span>` (link desabilitado não existe em HTML).
 */
export function Paginacao<T>({
  pagina,
  base,
  filtros,
  singular,
  plural,
}: {
  pagina: Pagina<T>;
  /** Caminho da rota, ex.: "/empresa/eventos". */
  base: string;
  /** Filtros atuais da URL, preservados nos links (busca, data...). */
  filtros: Record<string, string | undefined>;
  singular: string;
  plural?: string;
}) {
  const { pagina: atual, totalPaginas, temAnterior, temProxima, tamanho } = pagina;
  const paginas = janelaDePaginas(atual, totalPaginas);

  return (
    <nav
      aria-label="Paginação"
      data-testid="paginacao"
      className="mt-4 flex flex-wrap items-center justify-between gap-3"
    >
      <p className="text-xs text-muted" data-testid="paginacao-status">
        {rotuloPagina(pagina, singular, plural)}
      </p>

      {totalPaginas > 1 && (
        <ul className="flex items-center gap-1">
          <li>
            <Limite
              href={urlDaPagina(base, filtros, atual - 1, tamanho)}
              ativo={temAnterior}
              rotulo="Página anterior"
            >
              <ChevronLeft className="h-4 w-4" />
            </Limite>
          </li>
          {paginas.map((p, i) =>
            p === "…" ? (
              <li key={`gap-${i}`} className="px-1 text-sm text-muted" aria-hidden="true">
                …
              </li>
            ) : (
              <li key={p}>
                <Link
                  href={urlDaPagina(base, filtros, p, tamanho)}
                  aria-label={`Página ${p}`}
                  aria-current={p === atual ? "page" : undefined}
                  className={cn(
                    "inline-flex h-8 min-w-8 items-center justify-center rounded-lg border px-2 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500",
                    p === atual
                      ? "border-brand-600 bg-brand-600 font-medium text-white"
                      : "border-surface hover:bg-slate-100 dark:hover:bg-slate-800",
                  )}
                >
                  {p}
                </Link>
              </li>
            ),
          )}
          <li>
            <Limite
              href={urlDaPagina(base, filtros, atual + 1, tamanho)}
              ativo={temProxima}
              rotulo="Próxima página"
            >
              <ChevronRight className="h-4 w-4" />
            </Limite>
          </li>
        </ul>
      )}
    </nav>
  );
}

function Limite({
  href,
  ativo,
  rotulo,
  children,
}: {
  href: string;
  ativo: boolean;
  rotulo: string;
  children: React.ReactNode;
}) {
  const classe =
    "inline-flex h-8 min-w-8 items-center justify-center rounded-lg border border-surface px-2 text-sm";
  if (!ativo) {
    return (
      <span aria-disabled="true" className={cn(classe, "cursor-not-allowed opacity-40")} aria-label={rotulo}>
        {children}
      </span>
    );
  }
  return (
    <Link
      href={href}
      aria-label={rotulo}
      className={cn(classe, "hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:hover:bg-slate-800")}
    >
      {children}
    </Link>
  );
}

/**
 * Janela de páginas com elipse: 1 … 4 5 6 … 12. Mantém no máximo 7 slots para
 * não estourar a largura no mobile.
 */
export function janelaDePaginas(atual: number, total: number): (number | "…")[] {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const set = new Set<number>([1, total, atual, atual - 1, atual + 1]);
  if (atual <= 3) [2, 3, 4].forEach((n) => set.add(n));
  if (atual >= total - 2) [total - 1, total - 2, total - 3].forEach((n) => set.add(n));

  const ordenadas = [...set].filter((n) => n >= 1 && n <= total).sort((a, b) => a - b);
  const saida: (number | "…")[] = [];
  let anterior = 0;
  for (const n of ordenadas) {
    if (anterior && n - anterior > 1) saida.push("…");
    saida.push(n);
    anterior = n;
  }
  return saida;
}
