"use client";

import { useActionState } from "react";
import { editarPerfilTrabalhador } from "@/server/actions/perfil";
import { initialActionState } from "@/lib/actions";
import { Card } from "@/components/ui/card";
import { Label, Input, Textarea, Select, FieldError } from "@/components/ui/field";
import { SubmitButton } from "@/components/submit-button";
import { formatCPF } from "@/lib/utils";

interface UserData {
  nome: string;
  email: string;
  cpf: string;
  telefone: string;
  genero: string;
  fotoPath: string | null;
  cidade: string | null;
  bio: string | null;
  habilidades: string | null;
}

export function PerfilTrabalhadorForm({ user }: { user: UserData }) {
  const [state, formAction] = useActionState(editarPerfilTrabalhador, initialActionState);
  const fe = state.fieldErrors ?? {};

  return (
    <Card>
      <form action={formAction} className="space-y-3" encType="multipart/form-data">
        <div className="flex items-center gap-4">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={user.fotoPath ?? "/avatar-placeholder.svg"}
            alt="Foto de perfil"
            className="h-16 w-16 rounded-full border border-surface object-cover"
          />
          <div className="flex-1">
            <Label htmlFor="foto">Foto de perfil</Label>
            <Input id="foto" name="foto" type="file" accept="image/png,image/jpeg,image/webp" />
            <FieldError errors={fe.foto} />
          </div>
        </div>

        <div>
          <Label htmlFor="nome">Nome completo</Label>
          <Input id="nome" name="nome" defaultValue={user.nome} required />
          <FieldError errors={fe.nome} />
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label>E-mail</Label>
            <Input value={user.email} disabled />
          </div>
          <div>
            <Label>CPF</Label>
            <Input value={formatCPF(user.cpf)} disabled />
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="telefone">Telefone</Label>
            <Input id="telefone" name="telefone" defaultValue={user.telefone} required />
            <FieldError errors={fe.telefone} />
          </div>
          <div>
            <Label htmlFor="genero">Gênero</Label>
            <Select id="genero" name="genero" defaultValue={user.genero}>
              <option value="NAO_INFORMADO">Prefiro não informar</option>
              <option value="FEMININO">Feminino</option>
              <option value="MASCULINO">Masculino</option>
              <option value="OUTRO">Outro</option>
            </Select>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="cidade">Cidade</Label>
            <Input id="cidade" name="cidade" defaultValue={user.cidade ?? ""} placeholder="Ex.: Brasília/DF" />
            <FieldError errors={fe.cidade} />
          </div>
          <div>
            <Label htmlFor="habilidades">Habilidades (separadas por vírgula)</Label>
            <Input id="habilidades" name="habilidades" defaultValue={user.habilidades ?? ""} placeholder="Garçom, Bar, Segurança" />
            <FieldError errors={fe.habilidades} />
          </div>
        </div>

        <div>
          <Label htmlFor="bio">Sobre você</Label>
          <Textarea id="bio" name="bio" defaultValue={user.bio ?? ""} placeholder="Experiência, disponibilidade, etc." />
          <FieldError errors={fe.bio} />
        </div>

        <SubmitButton pendingLabel="Salvando...">Salvar alterações</SubmitButton>
      </form>
    </Card>
  );
}
