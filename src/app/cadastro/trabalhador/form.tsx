"use client";

import Link from "next/link";
import { useActionState } from "react";
import { cadastrarTrabalhador } from "@/server/actions/auth";
import { initialActionState } from "@/lib/actions";
import { Card } from "@/components/ui/card";
import { Label, Input, Select, FieldError } from "@/components/ui/field";
import { SubmitButton } from "@/components/submit-button";

export function CadastroTrabalhadorForm() {
  const [state, formAction] = useActionState(cadastrarTrabalhador, initialActionState);
  const fe = state.fieldErrors ?? {};

  return (
    <Card>
      <form action={formAction} className="space-y-3">
        <div>
          <Label htmlFor="nome">Nome completo</Label>
          <Input id="nome" name="nome" required />
          <FieldError errors={fe.nome} />
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="cpf">CPF</Label>
            <Input id="cpf" name="cpf" inputMode="numeric" placeholder="Somente números" required />
            <FieldError errors={fe.cpf} />
          </div>
          <div>
            <Label htmlFor="dataNascimento">Data de nascimento</Label>
            <Input id="dataNascimento" name="dataNascimento" type="date" required />
            <FieldError errors={fe.dataNascimento} />
          </div>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="telefone">Telefone (DDD + número)</Label>
            <Input id="telefone" name="telefone" inputMode="numeric" placeholder="61999999999" required />
            <FieldError errors={fe.telefone} />
          </div>
          <div>
            <Label htmlFor="genero">Gênero (opcional)</Label>
            <Select id="genero" name="genero" defaultValue="NAO_INFORMADO">
              <option value="NAO_INFORMADO">Prefiro não informar</option>
              <option value="FEMININO">Feminino</option>
              <option value="MASCULINO">Masculino</option>
              <option value="OUTRO">Outro</option>
            </Select>
          </div>
        </div>
        <div>
          <Label htmlFor="email">E-mail</Label>
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
