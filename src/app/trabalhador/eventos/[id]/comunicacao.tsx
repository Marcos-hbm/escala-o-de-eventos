import { prisma } from "@/lib/prisma";
import {
  ROTULOS_STATUS_SOLICITACAO,
  TIPOS_SOLICITACAO,
  TOM_STATUS_SOLICITACAO,
  definicaoTipo,
  estadoDoEvento,
  motivoCanalIndisponivel,
  type StatusSolicitacaoId,
  type TipoSolicitacaoId,
} from "@/lib/domain/comunicacao";
import { formatarRelativo, formatarDataHora } from "@/lib/datetime";
import { Card, Badge } from "@/components/ui/card";
import { Input, Label, Select } from "@/components/ui/field";
import { SubmitButton } from "@/components/submit-button";
import { AtualizacaoAutomatica } from "@/components/atualizacao-automatica";
import { criarSolicitacao } from "@/server/actions/comunicacao";
import { MessageSquare } from "lucide-react";

/**
 * Comunicação do evento, lado do trabalhador (item 7).
 *
 * Aparece só para quem está escalado. Com o evento em andamento, permite abrir
 * pedidos e acompanhar o status; fora da janela, mostra o histórico e explica por
 * que o canal está fechado.
 *
 * Componente de servidor: o formulário é simples e o resultado volta como aviso
 * renderizado no servidor (ADR 0004). A atualização periódica fica no componente
 * cliente dedicado.
 */
export async function ComunicacaoDoEvento({
  eventoId,
  userId,
  dataEvento,
  status,
  escalado,
}: {
  eventoId: number;
  userId: number;
  dataEvento: Date;
  status: string;
  escalado: boolean;
}) {
  if (!escalado) return null;

  const estado = estadoDoEvento(dataEvento, status);
  const fechado = motivoCanalIndisponivel(estado);

  const [solicitacoes, mensagens] = await Promise.all([
    prisma.solicitacaoEvento.findMany({
      where: { eventoId, userId },
      include: { respondidoPor: { select: { nome: true } } },
      orderBy: { createdAt: "desc" },
    }),
    prisma.mensagemCoordenador.findMany({
      where: { eventoId, OR: [{ userId }, { userId: null }] },
      include: { membro: { select: { nome: true } } },
      orderBy: { createdAt: "desc" },
      take: 10,
    }),
  ]);

  const abertas = new Set(
    solicitacoes
      .filter((s) => s.status === "EM_ANALISE" || s.status === "AGUARDANDO")
      .map((s) => s.tipo as TipoSolicitacaoId),
  );

  return (
    <Card className="mt-4 space-y-4" data-testid="comunicacao-evento">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="flex items-center gap-2 font-semibold">
          <MessageSquare className="h-5 w-5 text-brand-600" /> Comunicação com a coordenação
        </h2>
        {!fechado && <AtualizacaoAutomatica caminho={`/trabalhador/eventos/${eventoId}`} intervaloSegundos={15} />}
      </div>

      {fechado ? (
        <p className="text-sm text-muted" data-testid="canal-fechado">{fechado}</p>
      ) : (
        <form action={criarSolicitacao} className="space-y-2 rounded-lg border border-surface p-3">
          <input type="hidden" name="eventoId" value={eventoId} />
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <Label htmlFor="tipo-solicitacao">O que você precisa? *</Label>
              <Select id="tipo-solicitacao" name="tipo" defaultValue="INTERVALO">
                {TIPOS_SOLICITACAO.map((t) => (
                  <option key={t.id} value={t.id} disabled={abertas.has(t.id)}>
                    {t.rotulo}
                    {abertas.has(t.id) ? " (já em aberto)" : ""}
                  </option>
                ))}
              </Select>
            </div>
            <div>
              <Label htmlFor="mensagem-solicitacao">Detalhe (opcional)</Label>
              <Input
                id="mensagem-solicitacao"
                name="mensagem"
                placeholder="Ex.: preciso de 15 minutos às 19h"
                maxLength={500}
              />
            </div>
          </div>
          <SubmitButton size="sm" pendingLabel="Enviando...">Enviar à coordenação</SubmitButton>
          <p className="text-xs text-muted">
            A coordenação recebe na hora e você acompanha a resposta aqui mesmo.
          </p>
        </form>
      )}

      {/* Meus pedidos */}
      <div className="space-y-2">
        <h3 className="text-sm font-medium">Meus pedidos ({solicitacoes.length})</h3>
        {solicitacoes.length === 0 ? (
          <p className="text-sm text-muted">Você ainda não enviou pedidos neste evento.</p>
        ) : (
          solicitacoes.map((sol) => (
            <div
              key={sol.id}
              data-testid="minha-solicitacao"
              className="rounded-lg border border-surface p-3 text-sm"
            >
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-medium">{definicaoTipo(sol.tipo as TipoSolicitacaoId).rotulo}</span>
                <Badge tone={TOM_STATUS_SOLICITACAO[sol.status as StatusSolicitacaoId]}>
                  {ROTULOS_STATUS_SOLICITACAO[sol.status as StatusSolicitacaoId]}
                </Badge>
              </div>
              {sol.mensagem && <p className="mt-1 text-muted">{sol.mensagem}</p>}
              {sol.resposta && (
                <p className="mt-2 rounded bg-slate-50 p-2 dark:bg-slate-800/60">
                  <strong>Coordenação:</strong> {sol.resposta}
                  {sol.respondidoPor ? ` — ${sol.respondidoPor.nome}` : ""}
                </p>
              )}
              <p className="mt-1 text-xs text-muted" title={formatarDataHora(sol.createdAt)}>
                Enviado {formatarRelativo(sol.createdAt)}
                {sol.respondidoEm ? ` · respondido ${formatarRelativo(sol.respondidoEm)}` : ""}
              </p>
            </div>
          ))
        )}
      </div>

      {/* Recados da coordenação */}
      {mensagens.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Recados da coordenação</h3>
          {mensagens.map((m) => (
            <div key={m.id} data-testid="recado-coordenacao" className="rounded-lg border border-surface p-3 text-sm">
              <p>{m.texto}</p>
              <p className="mt-1 text-xs text-muted">
                {m.membro.nome} · {formatarRelativo(m.createdAt)}
                {m.userId ? " · só para você" : " · para toda a equipe"}
              </p>
            </div>
          ))}
        </div>
      )}
    </Card>
  );
}
