"use client";

import { useActionState } from "react";
import { alterarPapel, alternarMembroAtivo, criarMembro } from "@/server/actions/equipe";
import { initialActionState } from "@/lib/actions";
import { Card, Badge } from "@/components/ui/card";
import { Label, Input, Select, FieldError } from "@/components/ui/field";
import { SubmitButton } from "@/components/submit-button";
import { rotuloPapel, type PapelId } from "@/lib/rbac";

export interface MembroView {
  id: number;
  nome: string;
  email: string;
  papel: PapelId;
  ativo: boolean;
  souEu: boolean;
}

/** Formulário de convite (criação) de membro. */
export function NovoMembroForm({ papeis }: { papeis: PapelId[] }) {
  const [state, formAction] = useActionState(criarMembro, initialActionState);
  const fe = state.fieldErrors ?? {};

  return (
    <Card>
      <h2 className="mb-3 font-semibold">Adicionar membro</h2>
      <form action={formAction} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="nome">Nome *</Label>
            <Input id="nome" name="nome" required />
            <FieldError errors={fe.nome} />
          </div>
          <div>
            <Label htmlFor="email">E-mail *</Label>
            <Input id="email" name="email" type="email" required />
            <FieldError errors={fe.email} />
          </div>
          <div>
            <Label htmlFor="senha">Senha provisória *</Label>
            <Input id="senha" name="senha" type="password" required />
            <FieldError errors={fe.senha} />
          </div>
          <div>
            <Label htmlFor="papel">Papel *</Label>
            <Select id="papel" name="papel" defaultValue="COORDENADOR">
              {papeis.map((p) => (
                <option key={p} value={p}>{rotuloPapel(p)}</option>
              ))}
            </Select>
            <FieldError errors={fe.papel} />
          </div>
        </div>
        <SubmitButton pendingLabel="Adicionando...">Adicionar membro</SubmitButton>
        {!state.ok && state.message && (
          <p className="text-sm text-red-600" role="alert">{state.message}</p>
        )}
      </form>
    </Card>
  );
}

/** Linha da lista de membros: troca de papel e revogação/reativação de acesso. */
export function MembroLinha({ membro, papeis }: { membro: MembroView; papeis: PapelId[] }) {
  const [statePapel, acaoPapel] = useActionState(alterarPapel, initialActionState);
  const [stateAtivo, acaoAtivo] = useActionState(alternarMembroAtivo, initialActionState);

  return (
    <Card className="space-y-2">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-medium">
            {membro.nome} {membro.souEu && <span className="text-xs text-muted">(você)</span>}
          </p>
          <p className="text-xs text-muted">{membro.email}</p>
        </div>
        <div className="flex items-center gap-2">
          <Badge tone={membro.ativo ? "success" : "neutral"}>{membro.ativo ? "Ativo" : "Acesso revogado"}</Badge>
          <Badge tone="info">{rotuloPapel(membro.papel)}</Badge>
        </div>
      </div>

      <div className="flex flex-wrap items-end gap-2">
        <form action={acaoPapel} className="flex items-end gap-2">
          <input type="hidden" name="membroId" value={membro.id} />
          <div>
            <Label htmlFor={`papel-${membro.id}`} className="text-xs">Papel</Label>
            <Select id={`papel-${membro.id}`} name="papel" defaultValue={membro.papel}>
              {papeis.map((p) => (
                <option key={p} value={p}>{rotuloPapel(p)}</option>
              ))}
            </Select>
          </div>
          <SubmitButton size="sm" variant="outline" pendingLabel="...">Salvar papel</SubmitButton>
        </form>

        {!statePapel.ok && statePapel.message && (
          <p className="w-full text-sm text-red-600" role="alert">{statePapel.message}</p>
        )}
        {!stateAtivo.ok && stateAtivo.message && (
          <p className="w-full text-sm text-red-600" role="alert">{stateAtivo.message}</p>
        )}
        {!membro.souEu && (
          <form action={acaoAtivo}>
            <input type="hidden" name="membroId" value={membro.id} />
            <SubmitButton
              size="sm"
              variant={membro.ativo ? "danger" : "secondary"}
              pendingLabel="..."
              aria-label={`${membro.ativo ? "Revogar" : "Reativar"} acesso de ${membro.nome}`}
            >
              {membro.ativo ? "Revogar acesso" : "Reativar acesso"}
            </SubmitButton>
          </form>
        )}
      </div>

    </Card>
  );
}
