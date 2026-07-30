"use client";

import { useActionState } from "react";
import { avaliarEmpresa } from "@/server/actions/avaliacoes";
import { initialActionState } from "@/lib/actions";
import { StarRating } from "@/components/star-rating";
import { Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/submit-button";

export function AvaliarEmpresa({ eventoId, notaAtual }: { eventoId: number; notaAtual: number | null }) {
  const [state, formAction] = useActionState(avaliarEmpresa, initialActionState);
  return (
    <form action={formAction} className="mt-2 flex flex-wrap items-center gap-2">
      <input type="hidden" name="eventoId" value={eventoId} />
      <StarRating name="nota" defaultValue={notaAtual ?? 0} />
      <Input name="comentario" placeholder="comentário (opcional)" className="h-8 w-44 text-xs" />
      <SubmitButton size="sm" variant="outline" pendingLabel="...">
        {notaAtual != null ? "Reavaliar empresa" : "Avaliar empresa"}
      </SubmitButton>
      {state.message && (
        <span className={`text-xs ${state.ok ? "text-green-600" : "text-red-600"}`}>{state.message}</span>
      )}
    </form>
  );
}
