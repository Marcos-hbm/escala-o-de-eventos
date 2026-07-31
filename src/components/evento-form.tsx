"use client";

import { useActionState } from "react";
import { initialActionState, type ActionState } from "@/lib/actions";
import { Card } from "@/components/ui/card";
import { Label, Input, Textarea, FieldError } from "@/components/ui/field";
import { SubmitButton } from "@/components/submit-button";

type Acao = (prev: ActionState, formData: FormData) => Promise<ActionState>;

export interface EventoInicial {
  id?: number;
  nome?: string;
  descricao?: string | null;
  dataEvento?: string; // yyyy-mm-dd
  local?: string | null;
  horaInicio?: string | null;
  vagas?: number;
  funcoes?: string | null;
  valorCache?: number;
  observacoes?: string | null;
}

export function EventoForm({ action, inicial, textoBotao }: { action: Acao; inicial?: EventoInicial; textoBotao: string }) {
  const [state, formAction] = useActionState(action, initialActionState);
  const fe = state.fieldErrors ?? {};
  const v = inicial ?? {};

  return (
    <Card>
      <form action={formAction} className="space-y-3">
        {v.id && <input type="hidden" name="eventoId" value={v.id} />}

        <div>
          <Label htmlFor="nome">Nome do evento *</Label>
          <Input id="nome" name="nome" defaultValue={v.nome} required />
          <FieldError errors={fe.nome} />
        </div>

        <div>
          <Label htmlFor="descricao">Descrição</Label>
          <Textarea id="descricao" name="descricao" defaultValue={v.descricao ?? ""} />
          <FieldError errors={fe.descricao} />
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <div>
            <Label htmlFor="dataEvento">Data *</Label>
            <Input id="dataEvento" name="dataEvento" type="date" defaultValue={v.dataEvento} required />
            <FieldError errors={fe.dataEvento} />
          </div>
          <div>
            <Label htmlFor="horaInicio">Horário</Label>
            <Input id="horaInicio" name="horaInicio" type="time" defaultValue={v.horaInicio ?? ""} />
            <FieldError errors={fe.horaInicio} />
          </div>
          <div>
            <Label htmlFor="vagas">Vagas *</Label>
            <Input id="vagas" name="vagas" type="number" min={1} defaultValue={v.vagas ?? 1} required />
            <FieldError errors={fe.vagas} />
          </div>
        </div>

        <div>
          <Label htmlFor="local">Local</Label>
          <Input id="local" name="local" defaultValue={v.local ?? ""} placeholder="Ex.: Parque da Cidade, Brasília/DF" />
          <FieldError errors={fe.local} />
        </div>

        <div>
          <Label htmlFor="funcoes">Funções</Label>
          <Input id="funcoes" name="funcoes" defaultValue={v.funcoes ?? ""} placeholder="Ex.: Garçom, Bilheteiro, Segurança" />
          <FieldError errors={fe.funcoes} />
        </div>

        <div>
          <Label htmlFor="valorCache">Cachê por trabalhador (R$) *</Label>
          <Input id="valorCache" name="valorCache" type="number" step="0.01" min={0} defaultValue={v.valorCache ?? 0} required />
          <FieldError errors={fe.valorCache} />
        </div>

        <div>
          <Label htmlFor="observacoes">Observações</Label>
          <Textarea id="observacoes" name="observacoes" defaultValue={v.observacoes ?? ""} />
          <FieldError errors={fe.observacoes} />
        </div>

        <SubmitButton pendingLabel="Salvando...">{textoBotao}</SubmitButton>
      </form>
    </Card>
  );
}
