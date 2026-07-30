"use client";

import Link from "next/link";
import { useActionState } from "react";
import { cadastrarEmpresa } from "@/server/actions/auth";
import { initialActionState } from "@/lib/actions";
import { Card } from "@/components/ui/card";
import { Label, Input, FieldError } from "@/components/ui/field";
import { SubmitButton } from "@/components/submit-button";

export function CadastroEmpresaForm() {
  const [state, formAction] = useActionState(cadastrarEmpresa, initialActionState);
  const fe = state.fieldErrors ?? {};

  return (
    <Card>
      <form action={formAction} className="space-y-3">
        <div>
          <Label htmlFor="nome">Razão social / Nome fantasia</Label>
          <Input id="nome" name="nome" required />
          <FieldError errors={fe.nome} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="cnpj">CNPJ</Label>
            <Input id="cnpj" name="cnpj" inputMode="numeric" placeholder="Somente números" required />
            <FieldError errors={fe.cnpj} />
          </div>
          <div>
            <Label htmlFor="telefone">Telefone</Label>
            <Input id="telefone" name="telefone" inputMode="numeric" placeholder="6133333333" required />
            <FieldError errors={fe.telefone} />
          </div>
        </div>
        <div>
          <Label htmlFor="email">E-mail corporativo</Label>
          <Input id="email" name="email" type="email" autoComplete="email" required />
          <FieldError errors={fe.email} />
        </div>
        <div>
          <Label htmlFor="senha">Senha</Label>
          <Input id="senha" name="senha" type="password" autoComplete="new-password" required />
          <FieldError errors={fe.senha} />
          <p className="mt-1 text-xs text-muted">Mínimo 8 caracteres, com letra e número.</p>
        </div>

        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="aceiteLgpd" className="mt-0.5" required />
          <span>
            Li e concordo com a{" "}
            <Link href="/privacidade" target="_blank" className="text-brand-600 hover:underline">
              Política de Privacidade (LGPD)
            </Link>.
          </span>
        </label>
        <FieldError errors={fe.aceiteLgpd} />

        {state.message && <p className="text-sm text-red-600">{state.message}</p>}
        <SubmitButton className="w-full" pendingLabel="Criando conta...">Criar conta</SubmitButton>
      </form>
    </Card>
  );
}
