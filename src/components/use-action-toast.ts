"use client";

import * as React from "react";
import { useToast } from "@/components/ui/toast";
import type { ActionState } from "@/lib/actions";

/**
 * Emite toast quando uma server action responde com `message`.
 *
 * Erros de campo (`fieldErrors`) continuam inline, ao lado do input — mover
 * validação de formulário para toast piora a correção do erro (o usuário perde
 * a referência de qual campo falhou). O toast fica para o resultado da operação.
 */
export function useActionToast(state: ActionState): void {
  const { sucesso, erro } = useToast();
  const anterior = React.useRef<ActionState | null>(null);

  React.useEffect(() => {
    if (anterior.current === state || !state.message) {
      anterior.current = state;
      return;
    }
    anterior.current = state;
    if (state.ok) sucesso(state.message);
    else erro(state.message);
  }, [state, sucesso, erro]);
}
