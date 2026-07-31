"use client";

import { useState } from "react";
import { contestarPagamento } from "@/server/actions/pagamentos";
import { Label, Input, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/submit-button";
import { AlertTriangle } from "lucide-react";

/**
 * Contestação de pagamento pelo trabalhador (item 6).
 *
 * Fica fechado por padrão: contestar é exceção, e um formulário sempre aberto em
 * cada pagamento sugeriria que algo está errado. Anexo de comprovante é "futuramente"
 * na especificação — quando entrar, vira upload aqui.
 *
 * O componente é cliente apenas pelo abre/fecha; o envio usa server action simples,
 * com o resultado voltando como aviso renderizado no servidor (ADR 0004).
 */
export function ContestarPagamentoForm({ pagamentoId, evento }: { pagamentoId: number; evento: string }) {
  const [aberto, setAberto] = useState(false);

  if (!aberto) {
    return (
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => setAberto(true)}
        aria-label={`Contestar pagamento de ${evento}`}
      >
        <AlertTriangle className="h-4 w-4" /> Contestar pagamento
      </Button>
    );
  }

  return (
    <form action={contestarPagamento} className="mt-2 space-y-2 rounded-lg border border-surface p-3" data-testid="form-contestacao">
      <input type="hidden" name="pagamentoId" value={pagamentoId} />
      <div>
        <Label htmlFor={`motivo-${pagamentoId}`}>Qual o problema? *</Label>
        <Input
          id={`motivo-${pagamentoId}`}
          name="motivo"
          placeholder="Valor menor que o combinado"
          required
          minLength={3}
        />
      </div>
      <div>
        <Label htmlFor={`descricao-${pagamentoId}`}>Explique o que aconteceu *</Label>
        <Textarea
          id={`descricao-${pagamentoId}`}
          name="descricao"
          required
          minLength={20}
          placeholder="Descreva com detalhes: valor combinado, valor recebido, data e forma de pagamento."
        />
      </div>
      <div className="flex items-center gap-2">
        <SubmitButton size="sm" pendingLabel="Enviando...">Enviar contestação</SubmitButton>
        <Button type="button" size="sm" variant="ghost" onClick={() => setAberto(false)}>Cancelar</Button>
      </div>
    </form>
  );
}
