/** Tipo de retorno padrão das server actions, compatível com useActionState. */
export interface ActionState {
  ok: boolean;
  message?: string;
  fieldErrors?: Record<string, string[]>;
}

export const initialActionState: ActionState = { ok: false };

/** Converte erros de Zod (flatten) para o formato de ActionState. */
export function zodToFieldErrors(
  flattened: { fieldErrors: Record<string, string[] | undefined> },
): Record<string, string[]> {
  const out: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(flattened.fieldErrors)) {
    if (v && v.length) out[k] = v;
  }
  return out;
}
