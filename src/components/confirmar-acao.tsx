"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/submit-button";
import { AlertTriangle } from "lucide-react";

/**
 * Confirmação em duas etapas para ação destrutiva (item 12 da especificação).
 *
 * Não usa `window.confirm`: o diálogo nativo não é estilizável, é bloqueante e, em
 * alguns navegadores móveis, aparece sem contexto do que será apagado. Aqui a
 * pergunta fica ao lado do próprio item, dizendo **o que** será excluído.
 *
 * A ação continua sendo um `<form action={serverAction}>` — o clique final é um
 * submit de verdade, não um handler de cliente.
 */
export function ConfirmarAcao({
  acao,
  campos,
  rotulo,
  rotuloConfirmar = "Confirmar",
  pergunta,
  icone,
  variante = "danger",
  rotuloAcessivel,
}: {
  acao: (formData: FormData) => void | Promise<void>;
  /** Campos escondidos enviados na confirmação (ex.: `{ eventoId: 12 }`). */
  campos: Record<string, string | number>;
  rotulo: React.ReactNode;
  rotuloConfirmar?: string;
  pergunta: string;
  icone?: React.ReactNode;
  variante?: "danger" | "outline" | "ghost";
  rotuloAcessivel: string;
}) {
  const [confirmando, setConfirmando] = useState(false);

  if (!confirmando) {
    return (
      <Button
        type="button"
        size="sm"
        variant={variante === "danger" ? "ghost" : variante}
        onClick={() => setConfirmando(true)}
        aria-label={rotuloAcessivel}
      >
        {icone} {rotulo}
      </Button>
    );
  }

  return (
    <div
      role="group"
      aria-label={pergunta}
      data-testid="confirmacao"
      className="flex flex-wrap items-center gap-2 rounded-lg border border-red-300 bg-red-50 p-2 text-sm dark:border-red-900/50 dark:bg-red-950/30"
    >
      <span className="flex items-center gap-1 text-red-800 dark:text-red-300">
        <AlertTriangle className="h-4 w-4 shrink-0" /> {pergunta}
      </span>
      <form action={acao}>
        {Object.entries(campos).map(([nome, valor]) => (
          <input key={nome} type="hidden" name={nome} value={valor} />
        ))}
        <SubmitButton size="sm" variant="danger" pendingLabel="..." aria-label={`${rotuloConfirmar}: ${rotuloAcessivel}`}>
          {rotuloConfirmar}
        </SubmitButton>
      </form>
      <Button type="button" size="sm" variant="ghost" onClick={() => setConfirmando(false)}>
        Cancelar
      </Button>
    </div>
  );
}
