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

/**
 * Primeira mensagem de erro de um `ZodError`, para telas cujo resultado volta por
 * aviso na URL (não há campo para pendurar o erro). Ver ADR 0004.
 */
export function primeiroErroZod(erro: { issues: { message: string; path: (string | number)[] }[] }): string {
  const issue = erro.issues[0];
  if (!issue) return "Dados inválidos.";
  return issue.path.length > 0 ? `${issue.message} (campo: ${issue.path.join(".")})` : issue.message;
}
