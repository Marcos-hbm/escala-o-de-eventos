import * as React from "react";
import { cn } from "@/lib/utils";

/** Cartão de KPI para os painéis. */
export function StatTile({
  label,
  value,
  hint,
  icon,
  className,
}: {
  label: string;
  value: React.ReactNode;
  hint?: React.ReactNode;
  icon?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("rounded-xl border border-surface bg-surface p-4", className)}>
      <div className="flex items-center justify-between">
        <p className="text-xs font-medium uppercase tracking-wide text-muted">{label}</p>
        {icon && <span className="text-brand-600">{icon}</span>}
      </div>
      <p className="mt-2 text-2xl font-bold">{value}</p>
      {hint && <p className="mt-1 text-xs text-muted">{hint}</p>}
    </div>
  );
}

/** Barra horizontal simples (0..100), acessível, sem dependência externa. */
export function Bar({ label, pct, right }: { label: string; pct: number; right?: string }) {
  const clamped = Math.max(0, Math.min(100, Math.round(pct)));
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span>{label}</span>
        <span className="text-muted">{right ?? `${clamped}%`}</span>
      </div>
      <div
        className="h-2 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700"
        role="progressbar"
        aria-valuenow={clamped}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={label}
      >
        <div className="h-full rounded-full bg-brand-600" style={{ width: `${clamped}%` }} />
      </div>
    </div>
  );
}

/** Estrelas de reputação (exibição). */
export function Estrelas({ media, qtd }: { media: number | null; qtd?: number }) {
  if (media == null) return <span className="text-sm text-muted">sem avaliações</span>;
  const cheias = Math.round(media);
  return (
    <span className="inline-flex items-center gap-1 text-sm" title={`${media} de 5`}>
      <span className="text-amber-500">
        {"★".repeat(cheias)}
        <span className="text-slate-300 dark:text-slate-600">{"★".repeat(5 - cheias)}</span>
      </span>
      <span className="font-medium">{media.toFixed(1)}</span>
      {qtd != null && <span className="text-muted">({qtd})</span>}
    </span>
  );
}
