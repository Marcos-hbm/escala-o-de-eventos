"use client";

import { useActionState } from "react";
import { trocarPlano } from "@/server/actions/plano";
import { initialActionState } from "@/lib/actions";
import { SubmitButton } from "@/components/submit-button";
import { rotuloPlano, type PlanoId } from "@/lib/planos";

/**
 * Troca de plano (sem cobrança — ver `server/actions/plano.ts`). Só é renderizado
 * para quem tem a permissão `plano:gerenciar`.
 */
export function TrocarPlanoForm({ destino, atual }: { destino: PlanoId; atual: PlanoId }) {
  const [state, formAction] = useActionState(trocarPlano, initialActionState);
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
      {state.message && (
        <p className={`mt-2 text-sm ${state.ok ? "text-green-600" : "text-red-600"}`}>{state.message}</p>
      )}
    </form>
  );
}
