"use client";

import { useActionState } from "react";
import { avaliarTrabalhador } from "@/server/actions/avaliacoes";
import { initialActionState } from "@/lib/actions";
import { StarRating } from "@/components/star-rating";
import { Input } from "@/components/ui/field";
import { SubmitButton } from "@/components/submit-button";

export function AvaliarTrabalhador({
  eventoId,
  userId,
  notaAtual,
}: {
  eventoId: number;
  userId: number;
  notaAtual: number | null;
}) {
  const [state, formAction] = useActionState(avaliarTrabalhador, initialActionState);
  return (
    <form action={formAction} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="eventoId" value={eventoId} />
      <input type="hidden" name="userId" value={userId} />
      <StarRating name="nota" defaultValue={notaAtual ?? 0} />
      <Input name="comentario" placeholder="comentário (opcional)" className="h-8 w-44 text-xs" />
      <SubmitButton size="sm" variant="outline" pendingLabel="...">
        {notaAtual != null ? "Reavaliar" : "Avaliar"}
      </SubmitButton>
    </form>
  );
}
