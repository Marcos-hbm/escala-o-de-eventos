import { cn } from "@/lib/utils";

/**
 * Placeholders de carregamento usados pelos `loading.tsx` das rotas (streaming do
 * App Router). São marcados com `aria-hidden` e a região que os contém anuncia
 * "Carregando" uma única vez — repetir cada barra no leitor de tela é ruído.
 */

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden="true"
      className={cn("animate-pulse rounded-md bg-slate-200 dark:bg-slate-700", className)}
    />
  );
}

/** Envolve um bloco de skeletons anunciando o carregamento. */
export function SkeletonRegiao({ children, rotulo = "Carregando" }: { children: React.ReactNode; rotulo?: string }) {
  return (
    <div role="status" aria-busy="true" aria-label={rotulo} data-testid="skeleton">
      <span className="sr-only">{rotulo}</span>
      {children}
    </div>
  );
}

/** Cabeçalho de página (título + subtítulo). */
export function SkeletonTitulo() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-7 w-56" />
      <Skeleton className="h-4 w-80 max-w-full" />
    </div>
  );
}

/** Lista de cartões — a forma mais comum nas telas de eventos/vínculos/equipe. */
export function SkeletonCards({ quantidade = 3 }: { quantidade?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: quantidade }).map((_, i) => (
        <div key={i} className="rounded-xl border border-surface bg-surface p-5">
          <div className="flex items-center justify-between gap-4">
            <div className="flex-1 space-y-2">
              <Skeleton className="h-5 w-1/3" />
              <Skeleton className="h-3 w-2/3" />
            </div>
            <Skeleton className="h-8 w-24" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Faixa de KPIs dos painéis. */
export function SkeletonKpis({ quantidade = 4 }: { quantidade?: number }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: quantidade }).map((_, i) => (
        <div key={i} className="rounded-xl border border-surface bg-surface p-4">
          <Skeleton className="h-3 w-20" />
          <Skeleton className="mt-3 h-7 w-16" />
          <Skeleton className="mt-2 h-3 w-28" />
        </div>
      ))}
    </div>
  );
}

/** Tabela (escala, pagamentos, históricos). */
export function SkeletonTabela({ linhas = 5, colunas = 4 }: { linhas?: number; colunas?: number }) {
  return (
    <div className="overflow-hidden rounded-lg border border-surface">
      <div className="flex gap-4 border-b border-surface bg-slate-50 p-3 dark:bg-slate-800">
        {Array.from({ length: colunas }).map((_, i) => (
          <Skeleton key={i} className="h-4 flex-1" />
        ))}
      </div>
      {Array.from({ length: linhas }).map((_, l) => (
        <div key={l} className="flex gap-4 border-b border-surface p-3 last:border-b-0">
          {Array.from({ length: colunas }).map((_, c) => (
            <Skeleton key={c} className="h-4 flex-1" />
          ))}
        </div>
      ))}
    </div>
  );
}
