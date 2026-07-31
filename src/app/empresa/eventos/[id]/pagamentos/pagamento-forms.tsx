import {
  ajustarPagamento,
  registrarItemFechamento,
  registrarPagamento,
  responderContestacao,
} from "@/server/actions/pagamentos";
import { Label, Input, Select, Textarea } from "@/components/ui/field";
import { SubmitButton } from "@/components/submit-button";
import { FORMAS_PAGAMENTO, ROTULOS_FORMA, type FormaPagamentoId } from "@/lib/domain/pagamento";

/**
 * Formulários financeiros — **componentes de servidor** (só o botão é cliente).
 *
 * O resultado (sucesso ou recusa, inclusive erro de validação) volta como aviso
 * renderizado no servidor. Medido: a versão com `useActionState` em client component
 * deixava a tela no estado anterior em boa parte dos cliques; esta, não (ADR 0004).
 * Em dinheiro, tela desatualizada é inaceitável — vale perder o "erro ao lado do
 * campo" nesses formulários curtos.
 */

/** Ajusta o combinado: valor devido, função, horário trabalhado e observações. */
export function AjustarPagamentoForm({
  pagamentoId,
  valorDevido,
  funcao,
  horaEntrada,
  horaSaida,
  observacoes,
}: {
  pagamentoId: number;
  valorDevido: string;
  funcao: string;
  horaEntrada: string;
  horaSaida: string;
  observacoes: string;
}) {
  return (
    <form action={ajustarPagamento} className="grid gap-3 sm:grid-cols-2">
      <input type="hidden" name="pagamentoId" value={pagamentoId} />
      <div>
        <Label htmlFor={`valor-${pagamentoId}`}>Valor combinado (R$) *</Label>
        <Input id={`valor-${pagamentoId}`} name="valorDevido" defaultValue={valorDevido} inputMode="decimal" required />
      </div>
      <div>
        <Label htmlFor={`funcao-${pagamentoId}`}>Função</Label>
        <Input id={`funcao-${pagamentoId}`} name="funcao" defaultValue={funcao} placeholder="Garçom, Segurança…" />
      </div>
      <div>
        <Label htmlFor={`entrada-${pagamentoId}`}>Entrada (HH:MM)</Label>
        <Input id={`entrada-${pagamentoId}`} name="horaEntrada" defaultValue={horaEntrada} placeholder="16:00" />
      </div>
      <div>
        <Label htmlFor={`saida-${pagamentoId}`}>Saída (HH:MM)</Label>
        <Input id={`saida-${pagamentoId}`} name="horaSaida" defaultValue={horaSaida} placeholder="23:30" />
      </div>
      <div className="sm:col-span-2">
        <Label htmlFor={`obs-${pagamentoId}`}>Observações</Label>
        <Input id={`obs-${pagamentoId}`} name="observacoes" defaultValue={observacoes} />
      </div>
      <div className="sm:col-span-2">
        <SubmitButton size="sm" variant="outline" pendingLabel="Salvando...">Salvar combinado</SubmitButton>
      </div>
    </form>
  );
}

/** Registra pagamento total ou parcial. */
export function RegistrarPagamentoForm({
  pagamentoId,
  restante,
  formaAtual,
  nome,
}: {
  pagamentoId: number;
  restante: string;
  formaAtual: FormaPagamentoId | null;
  nome: string;
}) {
  return (
    <form action={registrarPagamento} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="pagamentoId" value={pagamentoId} />
      <div>
        <Label htmlFor={`pago-${pagamentoId}`}>Valor a registrar (R$)</Label>
        <Input
          id={`pago-${pagamentoId}`}
          name="valor"
          defaultValue={restante}
          inputMode="decimal"
          className="w-32"
          required
          aria-label={`Valor a registrar para ${nome}`}
        />
      </div>
      <div>
        <Label htmlFor={`forma-${pagamentoId}`}>Forma</Label>
        <Select id={`forma-${pagamentoId}`} name="forma" defaultValue={formaAtual ?? "PIX"} className="w-40">
          {FORMAS_PAGAMENTO.map((f) => (
            <option key={f} value={f}>{ROTULOS_FORMA[f]}</option>
          ))}
        </Select>
      </div>
      <SubmitButton size="sm" pendingLabel="Registrando...">Registrar pagamento</SubmitButton>
    </form>
  );
}

/** Conferência do trabalhador no fechamento de caixa. */
export function ItemFechamentoForm({
  pagamentoId,
  valorSugerido,
  formaAtual,
  nome,
}: {
  pagamentoId: number;
  valorSugerido: string;
  formaAtual: FormaPagamentoId | null;
  nome: string;
}) {
  return (
    <form action={registrarItemFechamento} className="flex flex-wrap items-end gap-2" data-testid="form-fechamento">
      <input type="hidden" name="pagamentoId" value={pagamentoId} />
      <div>
        <Label htmlFor={`fech-valor-${pagamentoId}`}>Valor pago agora (R$)</Label>
        <Input
          id={`fech-valor-${pagamentoId}`}
          name="valorPago"
          defaultValue={valorSugerido}
          inputMode="decimal"
          className="w-32"
          required
          aria-label={`Valor pago a ${nome} no fechamento`}
        />
        <p className="mt-1 text-xs text-muted">0 = não pago agora (fica pendente para a empresa)</p>
      </div>
      <div>
        <Label htmlFor={`fech-forma-${pagamentoId}`}>Forma</Label>
        <Select id={`fech-forma-${pagamentoId}`} name="forma" defaultValue={formaAtual ?? "PIX"} className="w-40">
          {FORMAS_PAGAMENTO.map((f) => (
            <option key={f} value={f}>{ROTULOS_FORMA[f]}</option>
          ))}
        </Select>
      </div>
      <div>
        <Label htmlFor={`fech-obs-${pagamentoId}`}>Observação</Label>
        <Input id={`fech-obs-${pagamentoId}`} name="observacao" className="w-48" />
      </div>
      <SubmitButton size="sm" pendingLabel="Conferindo...">Conferir</SubmitButton>
    </form>
  );
}

/** Resposta da empresa a uma contestação. */
export function ResponderContestacaoForm({ contestacaoId }: { contestacaoId: number }) {
  return (
    <form action={responderContestacao} className="mt-3 space-y-2">
      <input type="hidden" name="contestacaoId" value={contestacaoId} />
      <div>
        <Label htmlFor={`resp-${contestacaoId}`}>Resposta ao trabalhador *</Label>
        <Textarea id={`resp-${contestacaoId}`} name="resposta" required minLength={10} />
      </div>
      <div className="flex flex-wrap items-end gap-2">
        <div>
          <Label htmlFor={`status-${contestacaoId}`}>Situação</Label>
          <Select id={`status-${contestacaoId}`} name="status" defaultValue="RESOLVIDA" className="w-44">
            <option value="RESOLVIDA">Resolvida</option>
            <option value="EM_ANALISE">Em análise</option>
            <option value="REJEITADA">Rejeitada</option>
          </Select>
        </div>
        <SubmitButton size="sm" pendingLabel="Enviando...">Responder</SubmitButton>
      </div>
    </form>
  );
}
