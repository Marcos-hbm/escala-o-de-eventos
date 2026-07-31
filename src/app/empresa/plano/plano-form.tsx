"use client";

import { useActionState } from "react";
import { trocarPlano } from "@/server/actions/plano";
import { initialActionState } from "@/lib/actions";
import { SubmitButton } from "@/components/submit-button";
import { rotuloPlano, type PlanoId } from "@/lib/planos";
import { useActionToast } from "@/components/use-action-toast";

/**
 * Troca de plano (sem cobrança — ver `server/actions/plano.ts`). Só é renderizado
 * para quem tem a permissão `plano:gerenciar`.
 */
export function TrocarPlanoForm({ destino, atual }: { destino: PlanoId; atual: PlanoId }) {
  const [state, formAction] = useActionState(trocarPlano, initialActionState);
  useActionToast(state);
  const ehAtual = destino === atual;

  return (
    <form action={formAction} className="mt-4">
      <input type="hidden" name="plano" value={destino} />
      <SubmitButton
        size="sm"
        variant={ehAtual ? "secondary" : "primary"}
        disabled={ehAtual}
        pendingLabel="Alterando..."
      >
        {ehAtual ? "Plano atual" : `Mudar para ${rotuloPlano(destino)}`}
      </SubmitButton>
    </form>
  );
}
