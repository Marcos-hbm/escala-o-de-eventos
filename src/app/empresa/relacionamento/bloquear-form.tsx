"use client";

import { useState } from "react";
import { bloquearTrabalhador } from "@/server/actions/relacionamento";
import { Label, Textarea } from "@/components/ui/field";
import { Button } from "@/components/ui/button";
import { SubmitButton } from "@/components/submit-button";
import { Ban } from "lucide-react";

/**
 * Bloqueio com motivo obrigatório (item 5).
 *
 * Fechado por padrão e exigindo justificativa por escrito: bloquear tira o
 * trabalhador das vagas da empresa, e o motivo é o que permite a um administrador
 * revisar a decisão depois.
 */
export function BloquearForm({ userId, nome }: { userId: number; nome: string }) {
  const [aberto, setAberto] = useState(false);

  if (!aberto) {
    return (
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => setAberto(true)}
        aria-label={`Bloquear ${nome}`}
      >
        <Ban className="h-4 w-4" /> Bloquear
      </Button>
    );
  }

  return (
    <form action={bloquearTrabalhador} className="w-full space-y-2 rounded-lg border border-surface p-3" data-testid="form-bloqueio">
      <input type="hidden" name="userId" value={userId} />
      <div>
        <Label htmlFor={`motivo-bloqueio-${userId}`}>Motivo do bloqueio *</Label>
        <Textarea
          id={`motivo-bloqueio-${userId}`}
          name="motivo"
          required
          minLength={10}
          placeholder="Ex.: não compareceu ao evento sem avisar, mesmo confirmado na escala."
          aria-label={`Motivo do bloqueio de ${nome}`}
        />
        <p className="mt-1 text-xs text-muted">
          O trabalhador deixa de ver vagas desta empresa e não pode se candidatar. Vínculo ativo e inscrições
          futuras são encerrados. Só Administrador ou Proprietário remove o bloqueio depois.
        </p>
      </div>
      <div className="flex gap-2">
        <SubmitButton size="sm" variant="danger" pendingLabel="Bloqueando...">Confirmar bloqueio</SubmitButton>
        <Button type="button" size="sm" variant="ghost" onClick={() => setAberto(false)}>Cancelar</Button>
      </div>
    </form>
  );
}
