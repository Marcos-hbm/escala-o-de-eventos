"use client";

import { useActionState, useState } from "react";
import { entrar } from "@/server/actions/auth";
import { initialActionState } from "@/lib/actions";
import { Card } from "@/components/ui/card";
import { Label, Input, FieldError } from "@/components/ui/field";
import { SubmitButton } from "@/components/submit-button";
import { cn } from "@/lib/utils";

export function LoginForm({ tipoInicial, next }: { tipoInicial: "TRABALHADOR" | "EMPRESA"; next: string }) {
  const [state, formAction] = useActionState(entrar, initialActionState);
  const [tipo, setTipo] = useState<"TRABALHADOR" | "EMPRESA">(tipoInicial);

  return (
    <Card>
      <h1 className="mb-1 text-xl font-bold">Entrar</h1>
      <p className="mb-4 text-sm text-muted">Selecione o tipo de conta e informe suas credenciais.</p>

      {/* Seletor de tipo (RF03 — a tela permite escolher usuário ou empresa) */}
      <div className="mb-4 grid grid-cols-2 gap-2" role="tablist">
        {(["TRABALHADOR", "EMPRESA"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTipo(t)}
            className={cn(
              "rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
              tipo === t ? "border-brand-500 bg-brand-50 text-brand-700 dark:bg-brand-700/20" : "border-surface",
            )}
          >
            {t === "TRABALHADOR" ? "Trabalhador" : "Empresa"}
          </button>
        ))}
      </div>

      <form action={formAction} className="space-y-3">
        <input type="hidden" name="tipo" value={tipo} />
        <input type="hidden" name="next" value={next} />

        <div>
          <Label htmlFor="email">E-mail</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
          <FieldError errors={state.fieldErrors?.email} />
        </div>
        <div>
          <Label htmlFor="senha">Senha</Label>
          <Input id="senha" name="senha" type="password" autoComplete="current-password" required />
          <FieldError errors={state.fieldErrors?.senha} />
        </div>

        {state.message && <p className="text-sm text-red-600">{state.message}</p>}

        <SubmitButton className="w-full" pendingLabel="Entrando...">Entrar</SubmitButton>
      </form>
    </Card>
  );
}
