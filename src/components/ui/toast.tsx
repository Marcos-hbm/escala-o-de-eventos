"use client";

import * as React from "react";
import { CheckCircle2, XCircle, Info, X } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Toasts sem dependência externa.
 *
 * ESCOPO: confirmações puramente de **cliente**, que não têm ida ao servidor —
 * por exemplo "chave PIX copiada" (fase 3). Resultado de server action NÃO usa
 * toast: vai por `lib/flash.ts` + `components/ui/flash.tsx`, renderizado no
 * servidor, porque o toast dependia de o cliente aplicar a resposta da action e
 * isso falhava em parte das execuções (ADR 0004).
 *
 * Acessibilidade: a região é `aria-live="polite"` + `role="status"` para erro/aviso
 * não roubarem o foco do usuário no meio de um formulário; o leitor de tela anuncia
 * quando ele terminar a frase atual. Cada toast tem botão de fechar com nome
 * acessível, e o auto-dismiss é pausado ao passar o mouse ou focar (WCAG 2.2.1:
 * conteúdo temporizado precisa ser controlável).
 */

export type TomToast = "sucesso" | "erro" | "info";

export interface Toast {
  id: number;
  tom: TomToast;
  titulo: string;
  descricao?: string;
  /** ms; 0 = não fecha sozinho. */
  duracao: number;
}

interface ContextoToast {
  mostrar: (t: { tom?: TomToast; titulo: string; descricao?: string; duracao?: number }) => void;
  sucesso: (titulo: string, descricao?: string) => void;
  erro: (titulo: string, descricao?: string) => void;
}

const Ctx = React.createContext<ContextoToast | null>(null);

/** Hook de uso: `const { sucesso, erro } = useToast()`. */
export function useToast(): ContextoToast {
  const ctx = React.useContext(Ctx);
  if (!ctx) {
    throw new Error(
      "useToast foi chamado fora do ToastProvider. As áreas autenticadas já são envolvidas por ele em components/shell.tsx.",
    );
  }
  return ctx;
}

const ICONES: Record<TomToast, React.ReactNode> = {
  sucesso: <CheckCircle2 className="h-5 w-5 text-green-600" />,
  erro: <XCircle className="h-5 w-5 text-red-600" />,
  info: <Info className="h-5 w-5 text-brand-600" />,
};

const BORDAS: Record<TomToast, string> = {
  sucesso: "border-l-green-600",
  erro: "border-l-red-600",
  info: "border-l-brand-600",
};

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [itens, setItens] = React.useState<Toast[]>([]);
  const proximoId = React.useRef(1);

  const fechar = React.useCallback((id: number) => {
    setItens((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const mostrar = React.useCallback<ContextoToast["mostrar"]>((t) => {
    const id = proximoId.current++;
    setItens((prev) => [
      ...prev,
      { id, tom: t.tom ?? "info", titulo: t.titulo, descricao: t.descricao, duracao: t.duracao ?? 5000 },
    ]);
  }, []);

  const valor = React.useMemo<ContextoToast>(
    () => ({
      mostrar,
      sucesso: (titulo, descricao) => mostrar({ tom: "sucesso", titulo, descricao }),
      erro: (titulo, descricao) => mostrar({ tom: "erro", titulo, descricao, duracao: 8000 }),
    }),
    [mostrar],
  );

  return (
    <Ctx.Provider value={valor}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-50 flex flex-col items-center gap-2 p-4 sm:items-end"
        data-testid="toast-region"
      >
        {itens.map((t) => (
          <ToastItem key={t.id} toast={t} onFechar={() => fechar(t.id)} />
        ))}
      </div>
    </Ctx.Provider>
  );
}

function ToastItem({ toast, onFechar }: { toast: Toast; onFechar: () => void }) {
  const [pausado, setPausado] = React.useState(false);

  React.useEffect(() => {
    if (toast.duracao <= 0 || pausado) return;
    const t = setTimeout(onFechar, toast.duracao);
    return () => clearTimeout(t);
  }, [toast.duracao, pausado, onFechar]);

  return (
    <div
      role="status"
      data-testid="toast"
      data-tom={toast.tom}
      onMouseEnter={() => setPausado(true)}
      onMouseLeave={() => setPausado(false)}
      onFocus={() => setPausado(true)}
      onBlur={() => setPausado(false)}
      className={cn(
        "pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border border-surface border-l-4 bg-surface p-3 shadow-lg",
        BORDAS[toast.tom],
      )}
    >
      <span className="mt-0.5 shrink-0">{ICONES[toast.tom]}</span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">{toast.titulo}</p>
        {toast.descricao && <p className="mt-0.5 text-xs text-muted">{toast.descricao}</p>}
      </div>
      <button
        type="button"
        onClick={onFechar}
        aria-label={`Fechar aviso: ${toast.titulo}`}
        className="shrink-0 rounded p-1 text-muted hover:bg-slate-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-500 dark:hover:bg-slate-800"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
