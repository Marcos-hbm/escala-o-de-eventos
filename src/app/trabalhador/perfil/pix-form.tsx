"use client";

import { useState } from "react";
import { salvarChavePix } from "@/server/actions/perfil";
import { Card } from "@/components/ui/card";
import { Label, Input, Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/submit-button";
import { EXEMPLOS_CHAVE_PIX, ROTULOS_CHAVE_PIX, TIPOS_CHAVE_PIX, type TipoChavePixId } from "@/lib/pix";
import { KeyRound, ShieldCheck } from "lucide-react";

/**
 * Cadastro da chave PIX pelo trabalhador.
 *
 * A chave atual aparece **mascarada** (vem do servidor já mascarada): a tela serve
 * para conferir qual está cadastrada, não para reexibir o dado.
 */
export function ChavePixForm({
  tipoAtual,
  mascaraAtual,
}: {
  tipoAtual: TipoChavePixId | null;
  mascaraAtual: string | null;
}) {
  const [tipo, setTipo] = useState<TipoChavePixId>(tipoAtual ?? "CPF");

  return (
    <Card>
      <h2 className="flex items-center gap-2 font-semibold">
        <KeyRound className="h-5 w-5 text-brand-600" /> Chave PIX para recebimento
      </h2>

      {mascaraAtual ? (
        <p className="mt-1 text-sm text-muted" data-testid="pix-atual">
          Cadastrada: <strong>{ROTULOS_CHAVE_PIX[tipoAtual!]}</strong> — {mascaraAtual}
        </p>
      ) : (
        <p className="mt-1 text-sm text-muted">
          Nenhuma chave cadastrada. Sem ela, a empresa precisa combinar outra forma de pagamento.
        </p>
      )}

      <form action={salvarChavePix} className="mt-3 space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <Label htmlFor="pix-tipo">Tipo de chave *</Label>
            <Select
              id="pix-tipo"
              name="tipo"
              value={tipo}
              onChange={(e) => setTipo(e.target.value as TipoChavePixId)}
            >
              {TIPOS_CHAVE_PIX.map((t) => (
                <option key={t} value={t}>{ROTULOS_CHAVE_PIX[t]}</option>
              ))}
            </Select>
          </div>
          <div>
            <Label htmlFor="pix-chave">Chave *</Label>
            <Input id="pix-chave" name="chave" placeholder={EXEMPLOS_CHAVE_PIX[tipo]} required />
          </div>
        </div>

        <p className="flex items-start gap-2 text-xs text-muted">
          <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-green-600" />
          A chave é guardada <strong>cifrada</strong> e fica visível apenas para empresas em que você foi escalado.
          Cada visualização pela empresa é registrada na trilha de auditoria.
        </p>

        <SubmitButton pendingLabel="Salvando...">
          {mascaraAtual ? "Atualizar chave PIX" : "Salvar chave PIX"}
        </SubmitButton>
      </form>
    </Card>
  );
}
