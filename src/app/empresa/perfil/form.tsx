"use client";

import { useActionState } from "react";
import { editarPerfilEmpresa } from "@/server/actions/perfil";
import { initialActionState } from "@/lib/actions";
import { Card } from "@/components/ui/card";
import { Label, Input, FieldError } from "@/components/ui/field";
import { SubmitButton } from "@/components/submit-button";
import { formatCNPJ } from "@/lib/utils";

interface EmpresaData {
  nome: string;
  email: string;
  cnpj: string;
  telefone: string;
  fotoPath: string | null;
}

export function PerfilEmpresaForm({ empresa }: { empresa: EmpresaData }) {
  const [state, formAction] = useActionState(editarPerfilEmpresa, initialActionState);
  const fe = state.fieldErrors ?? {};

  return (
    <Card>
      <form action={formAction} className="space-y-3" encType="multipart/form-data">
        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={empresa.fotoPath ?? "/avatar-placeholder.svg"}
            alt="Logo da empresa"
            className="h-16 w-16 rounded-lg border border-surface object-cover"
          />
          <div className="flex-1">
            <Label htmlFor="foto">Logo</Label>
            <Input id="foto" name="foto" type="file" accept="image/png,image/jpeg,image/webp" />
            <FieldError errors={fe.foto} />
          </div>
        </div>

        <div>
          <Label htmlFor="nome">Razão social / Nome</Label>
          <Input id="nome" name="nome" defaultValue={empresa.nome} required />
          <FieldError errors={fe.nome} />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>E-mail</Label>
            <Input value={empresa.email} disabled />
          </div>
          <div>
            <Label>CNPJ</Label>
            <Input value={formatCNPJ(empresa.cnpj)} disabled />
          </div>
        </div>

        <div>
          <Label htmlFor="telefone">Telefone</Label>
          <Input id="telefone" name="telefone" defaultValue={empresa.telefone} required />
          <FieldError errors={fe.telefone} />
        </div>

        {state.ok && state.message && <p className="text-sm text-green-600">{state.message}</p>}
        <SubmitButton pendingLabel="Salvando...">Salvar alterações</SubmitButton>
      </form>
    </Card>
  );
}
