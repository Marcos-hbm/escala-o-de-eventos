import Link from "next/link";
import { notFound } from "next/navigation";
import { papelDaSessao, requireEmpresa, sessaoPode } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  ROTULOS_PRESENCA,
  ROTULOS_STATUS_SOLICITACAO,
  STATUS_ABERTOS,
  TOM_STATUS_SOLICITACAO,
  definicaoTipo,
  estadoDoEvento,
  estadoPresenca,
  minutosEmTurno,
  motivoCanalIndisponivel,
  ordenarFila,
  transicoesPermitidas,
  type StatusSolicitacaoId,
  type TipoSolicitacaoId,
} from "@/lib/domain/comunicacao";
import { formatarDataCivil, formatarDuracao, formatarHora, formatarRelativo } from "@/lib/datetime";
import { Card, Badge } from "@/components/ui/card";
import { StatTile } from "@/components/ui/stat";
import { Input, Select, Textarea, Label } from "@/components/ui/field";
import { SubmitButton } from "@/components/submit-button";
import { EmptyState } from "@/components/ui/empty-state";
import { Flash } from "@/components/ui/flash";
import { AvisoNegado } from "@/components/aviso-negado";
import { AtualizacaoAutomatica } from "@/components/atualizacao-automatica";
import {
  enviarMensagemCoordenacao,
  registrarCheckIn,
  registrarCheckOut,
  responderSolicitacao,
} from "@/server/actions/comunicacao";
import { MessageSquare, Users, Clock, Megaphone, CircleAlert } from "lucide-react";

export const metadata = { title: "Painel do coordenador — Escala" };

/**
 * v4 — Painel do coordenador (item 8).
 *
 * Uma tela para conduzir o evento ao vivo: equipe escalada com presença e
 * check-in/check-out, fila de solicitações com resposta, e mensagens para a equipe.
 * A atualização periódica fica isolada em `AtualizacaoAutomatica`.
 *
 * O histórico permanece acessível depois do evento (a especificação pede que toda a
 * comunicação fique registrada) — o que fecha são as **ações**, não a leitura.
 */
export default async function PainelCoordenador({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ aviso?: string; erro_op?: string; negado?: string }>;
}) {
  const s = await requireEmpresa();
  const { id } = await params;
  const sp = await searchParams;
  const eventoId = Number(id);
  const caminho = `/empresa/eventos/${eventoId}/painel`;

  if (!sessaoPode(s, "comunicacao:responder")) {
    return (
      <div className="space-y-6">
        <AvisoNegado negado="comunicacao:responder" papel={papelDaSessao(s)} />
        <EmptyState
          icone={<MessageSquare className="h-6 w-6" />}
          titulo="Painel restrito à coordenação"
          descricao="Somente Proprietário, Administrador ou Coordenador conduz a comunicação do evento."
          acao={{ href: "/empresa/eventos", rotulo: "Voltar aos eventos" }}
        />
      </div>
    );
  }

  const evento = await prisma.evento.findFirst({
    where: { id: eventoId, empresaId: s.sub },
    select: { id: true, nome: true, dataEvento: true, status: true, horaInicio: true, local: true },
  });
  if (!evento) notFound();

  const [inscricoes, solicitacoes, mensagens] = await Promise.all([
    prisma.inscricao.findMany({
      where: { eventoId, status: { in: ["ESCALADO", "PRESENTE", "FALTA"] } },
      include: {
        user: { select: { id: true, nome: true, fotoPath: true, telefone: true } },
        presenca: true,
      },
      orderBy: { user: { nome: "asc" } },
    }),
    prisma.solicitacaoEvento.findMany({
      where: { eventoId },
      include: {
        user: { select: { id: true, nome: true } },
        respondidoPor: { select: { nome: true } },
      },
    }),
    prisma.mensagemCoordenador.findMany({
      where: { eventoId },
      include: { membro: { select: { nome: true } }, user: { select: { nome: true } } },
      orderBy: { createdAt: "desc" },
      take: 20,
    }),
  ]);

  const estado = estadoDoEvento(evento.dataEvento, evento.status);
  const canalFechado = motivoCanalIndisponivel(estado);
  const fila = ordenarFila(
    solicitacoes.map((s) => ({ ...s, tipo: s.tipo as TipoSolicitacaoId, status: s.status as StatusSolicitacaoId })),
  );
  const abertas = fila.filter((f) => STATUS_ABERTOS.includes(f.status));
  const emTurno = inscricoes.filter((i) => estadoPresenca(i.presenca?.checkInEm ?? null, i.presenca?.checkOutEm ?? null) === "EM_TURNO");
  const semCheckIn = inscricoes.filter((i) => !i.presenca?.checkInEm);

  return (
    <div className="space-y-6">
      <Flash searchParams={sp} caminho={caminho} />
      <AvisoNegado negado={sp.negado} papel={papelDaSessao(s)} />

      <div>
        <Link href="/empresa/eventos" className="text-sm text-brand-600 hover:underline">← Meus eventos</Link>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold">Painel — {evento.nome}</h1>
          <Badge tone={estado === "EM_ANDAMENTO" ? "success" : estado === "FUTURO" ? "info" : "neutral"}>
            {estado === "EM_ANDAMENTO" ? "Em andamento" : estado === "FUTURO" ? "Ainda não começou" : "Encerrado"}
          </Badge>
        </div>
        <p className="text-sm text-muted">
          {formatarDataCivil(evento.dataEvento)}
          {evento.horaInicio ? ` · início ${evento.horaInicio}` : ""}
          {evento.local ? ` · ${evento.local}` : ""}
        </p>
        <div className="mt-2">
          <AtualizacaoAutomatica caminho={caminho} intervaloSegundos={15} />
        </div>
      </div>

      {canalFechado && (
        <Card className="border-amber-300 bg-amber-50 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-900/20 dark:text-amber-200">
          {canalFechado} As ações de resposta e mensagem ficam disponíveis no dia do evento; o histórico abaixo continua
          acessível.
        </Card>
      )}

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Equipe escalada" value={inscricoes.length} hint={`${emTurno.length} em turno`} icon={<Users className="h-5 w-5" />} />
        <StatTile label="Sem check-in" value={semCheckIn.length} hint="aguardando chegada" icon={<Clock className="h-5 w-5" />} />
        <StatTile label="Pedidos abertos" value={abertas.length} hint="esperando resposta" icon={<CircleAlert className="h-5 w-5" />} />
        <StatTile label="Mensagens enviadas" value={mensagens.length} hint="últimas 20" icon={<Megaphone className="h-5 w-5" />} />
      </div>

      {/* ---------------------- Solicitações (itens 7 e 8) ---------------------- */}
      <section className="space-y-3">
        <h2 className="font-semibold">Solicitações da equipe ({fila.length})</h2>

        {fila.length === 0 ? (
          <EmptyState
            icone={<MessageSquare className="h-6 w-6" />}
            titulo="Nenhuma solicitação"
            descricao="Durante o evento, os pedidos da equipe (intervalo, ajuda, substituição…) aparecem aqui em ordem de urgência."
          />
        ) : (
          fila.map((sol) => {
            const def = definicaoTipo(sol.tipo);
            const proximos = transicoesPermitidas(sol.status);
            return (
              <Card key={sol.id} data-testid="solicitacao" className="space-y-2">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-medium">
                      {def.urgente && <span title="Pedido urgente">⚠ </span>}
                      {def.rotulo} — {sol.user.nome}
                    </p>
                    {sol.mensagem && <p className="mt-1 text-sm">{sol.mensagem}</p>}
                    <p className="mt-1 text-xs text-muted" title={def.descricao}>
                      {formatarRelativo(sol.createdAt)}
                      {sol.respondidoEm ? ` · respondida ${formatarRelativo(sol.respondidoEm)}` : ""}
                      {sol.respondidoPor ? ` por ${sol.respondidoPor.nome}` : ""}
                    </p>
                    {sol.resposta && (
                      <p className="mt-2 rounded bg-slate-50 p-2 text-sm dark:bg-slate-800/60">
                        <strong>Resposta:</strong> {sol.resposta}
                      </p>
                    )}
                  </div>
                  <Badge tone={TOM_STATUS_SOLICITACAO[sol.status]}>{ROTULOS_STATUS_SOLICITACAO[sol.status]}</Badge>
                </div>

                {proximos.length > 0 && !canalFechado && (
                  <form action={responderSolicitacao} className="flex flex-wrap items-end gap-2 border-t border-surface pt-2">
                    <input type="hidden" name="solicitacaoId" value={sol.id} />
                    <div>
                      <Label htmlFor={`status-${sol.id}`}>Resolver como</Label>
                      <Select id={`status-${sol.id}`} name="status" defaultValue={proximos[0]} className="w-40">
                        {proximos.map((p) => (
                          <option key={p} value={p}>{ROTULOS_STATUS_SOLICITACAO[p]}</option>
                        ))}
                      </Select>
                    </div>
                    <div className="flex-1">
                      <Label htmlFor={`resposta-${sol.id}`}>Resposta (opcional)</Label>
                      <Input
                        id={`resposta-${sol.id}`}
                        name="resposta"
                        placeholder="Ex.: pode ir às 19h, 15 minutos."
                        aria-label={`Resposta para ${sol.user.nome}`}
                      />
                    </div>
                    <SubmitButton size="sm" pendingLabel="Enviando..." aria-label={`Responder ${def.rotulo} de ${sol.user.nome}`}>
                      Responder
                    </SubmitButton>
                  </form>
                )}
              </Card>
            );
          })
        )}
      </section>

      {/* ---------------------- Equipe e presença (item 8) ---------------------- */}
      <section className="space-y-3">
        <h2 className="font-semibold">Equipe e presença ({inscricoes.length})</h2>

        {inscricoes.length === 0 ? (
          <EmptyState
            icone={<Users className="h-6 w-6" />}
            titulo="Ninguém escalado"
            descricao="Escale a equipe para acompanhar presença e receber solicitações."
            acao={{ href: `/empresa/eventos/${eventoId}/escalar`, rotulo: "Ir para a escala" }}
          />
        ) : (
          inscricoes.map((i) => {
            const presenca = i.presenca;
            const estadoP = estadoPresenca(presenca?.checkInEm ?? null, presenca?.checkOutEm ?? null);
            const minutos = minutosEmTurno(presenca?.checkInEm ?? null, presenca?.checkOutEm ?? null);

            return (
              <Card key={i.id} data-testid="linha-equipe" className="flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={i.user.fotoPath ?? "/avatar-placeholder.svg"}
                    alt={`Foto de ${i.user.nome}`}
                    className="h-10 w-10 rounded-full border border-surface object-cover"
                  />
                  <div>
                    <p className="font-medium">{i.user.nome}</p>
                    <p className="text-xs text-muted">
                      {i.user.telefone}
                      {presenca?.checkInEm ? ` · entrada ${formatarHora(presenca.checkInEm)}` : ""}
                      {presenca?.checkOutEm ? ` · saída ${formatarHora(presenca.checkOutEm)}` : ""}
                      {minutos !== null ? ` · ${formatarDuracao(minutos)}` : ""}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <Badge
                    tone={estadoP === "EM_TURNO" ? "success" : estadoP === "TURNO_ENCERRADO" ? "neutral" : "warning"}
                    data-testid="estado-presenca"
                  >
                    {ROTULOS_PRESENCA[estadoP]}
                  </Badge>

                  {!canalFechado && sessaoPode(s, "presenca:marcar") && (
                    <>
                      {estadoP === "AGUARDANDO_CHECKIN" && (
                        <form action={registrarCheckIn}>
                          <input type="hidden" name="inscricaoId" value={i.id} />
                          <SubmitButton size="sm" pendingLabel="..." aria-label={`Check-in de ${i.user.nome}`}>
                            Check-in
                          </SubmitButton>
                        </form>
                      )}
                      {estadoP === "EM_TURNO" && (
                        <form action={registrarCheckOut}>
                          <input type="hidden" name="inscricaoId" value={i.id} />
                          <SubmitButton size="sm" variant="outline" pendingLabel="..." aria-label={`Check-out de ${i.user.nome}`}>
                            Check-out
                          </SubmitButton>
                        </form>
                      )}
                    </>
                  )}

                  {!canalFechado && (
                    <details className="w-full sm:w-auto">
                      <summary className="cursor-pointer text-xs text-brand-600 hover:underline">
                        Mensagem individual
                      </summary>
                      <form action={enviarMensagemCoordenacao} className="mt-2 flex flex-wrap items-end gap-2">
                        <input type="hidden" name="eventoId" value={eventoId} />
                        <input type="hidden" name="userId" value={i.user.id} />
                        <Input
                          name="texto"
                          required
                          minLength={2}
                          className="w-64"
                          placeholder="Recado para este trabalhador"
                          aria-label={`Mensagem para ${i.user.nome}`}
                        />
                        <SubmitButton size="sm" variant="outline" pendingLabel="...">Enviar</SubmitButton>
                      </form>
                    </details>
                  )}
                </div>
              </Card>
            );
          })
        )}
      </section>

      {/* ---------------------- Mensagens para a equipe ---------------------- */}
      <section className="space-y-3">
        <h2 className="font-semibold">Mensagens da coordenação</h2>

        {!canalFechado && (
          <Card>
            <form action={enviarMensagemCoordenacao} className="space-y-2">
              <input type="hidden" name="eventoId" value={eventoId} />
              <div>
                <Label htmlFor="texto-equipe">Recado para toda a equipe escalada *</Label>
                <Textarea
                  id="texto-equipe"
                  name="texto"
                  required
                  minLength={2}
                  placeholder="Ex.: ponto de encontro às 15h30 no portão B."
                />
              </div>
              <SubmitButton size="sm" pendingLabel="Enviando...">Enviar para a equipe</SubmitButton>
            </form>
          </Card>
        )}

        {mensagens.length === 0 ? (
          <p className="text-sm text-muted">Nenhuma mensagem enviada neste evento.</p>
        ) : (
          <div className="space-y-2">
            {mensagens.map((m) => (
              <Card key={m.id} data-testid="mensagem-coordenacao" className="text-sm">
                <p>{m.texto}</p>
                <p className="mt-1 text-xs text-muted">
                  {m.membro.nome} · {formatarRelativo(m.createdAt)} ·{" "}
                  {m.user ? `individual para ${m.user.nome}` : "toda a equipe"}
                </p>
              </Card>
            ))}
          </div>
        )}
      </section>

      <Card className="text-xs text-muted">
        Solicitações, respostas, mensagens e check-in/check-out ficam registrados no histórico deste evento e na trilha
        de auditoria.
      </Card>
    </div>
  );
}
