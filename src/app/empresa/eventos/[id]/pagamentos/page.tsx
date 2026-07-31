import Link from "next/link";
import { notFound } from "next/navigation";
import { papelDaSessao, requireEmpresa, sessaoPode } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { lerChavePixParaEmpresa } from "@/lib/pix-leitura";
import {
  INDICADOR_STATUS,
  ROTULOS_FORMA,
  centavos,
  resumirPagamentos,
  saldoRestante,
  type FormaPagamentoId,
  type StatusPagamentoId,
} from "@/lib/domain/pagamento";
import { formatarDataCivil, formatarDataHora, formatarPeriodo } from "@/lib/datetime";
import { formatarBRL } from "@/lib/dinheiro";
import { Card, Badge } from "@/components/ui/card";
import { StatTile, Bar } from "@/components/ui/stat";
import { SubmitButton } from "@/components/submit-button";
import { EmptyState } from "@/components/ui/empty-state";
import { Flash } from "@/components/ui/flash";
import { AvisoNegado } from "@/components/aviso-negado";
import {
  alterarFormaPagamento,
  concluirFechamentoCaixa,
  estornarPagamento,
  iniciarFechamentoCaixa,
  sincronizarPagamentosDoEvento,
} from "@/server/actions/pagamentos";
import {
  AjustarPagamentoForm,
  ItemFechamentoForm,
  RegistrarPagamentoForm,
  ResponderContestacaoForm,
} from "./pagamento-forms";
import { CopiarPix } from "./copiar-pix";
import { BloquearForm } from "@/app/empresa/relacionamento/bloquear-form";
import { favoritarTrabalhador } from "@/server/actions/relacionamento";
import { KeyRound, Users, Wallet, CircleAlert, Star, ListChecks } from "lucide-react";

export const metadata = { title: "Pagamentos do evento — Escala" };

const TOM_STATUS: Record<StatusPagamentoId, "success" | "warning" | "neutral" | "danger"> = {
  PAGO: "success",
  PARCIAL: "warning",
  PENDENTE: "neutral",
  CANCELADO: "danger",
};

/**
 * v4 — "Finalizar Pagamentos" (itens 2, 6 e 9 da especificação).
 *
 * Uma tela só para dinheiro: o que é devido a cada trabalhador escalado, o que já
 * foi pago, a forma, a chave PIX (visível sob permissão e com auditoria), as
 * contestações e o fechamento de caixa. Acesso exige permissão financeira —
 * Proprietário, Administrador ou Coordenador autorizado (ADR 0005).
 */
export default async function PagamentosDoEvento({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ aviso?: string; erro_op?: string; pix?: string; negado?: string }>;
}) {
  const s = await requireEmpresa();
  const { id } = await params;
  const sp = await searchParams;
  const eventoId = Number(id);
  const caminho = `/empresa/eventos/${eventoId}/pagamentos`;

  // Gate de acesso da tela: sem permissão financeira, nem lista aparece.
  if (!sessaoPode(s, "financeiro:ver")) {
    return (
      <div className="space-y-6">
        <AvisoNegado negado="financeiro:ver" papel={papelDaSessao(s)} />
        <EmptyState
          icone={<Wallet className="h-6 w-6" />}
          titulo="Área financeira restrita"
          descricao="Somente Proprietário, Administrador ou Coordenador com acesso financeiro pode ver os pagamentos deste evento."
          acao={{ href: "/empresa/eventos", rotulo: "Voltar aos eventos" }}
        />
      </div>
    );
  }

  const eventoBase = await prisma.evento.findFirst({
    where: { id: eventoId, empresaId: s.sub },
    select: { id: true, nome: true, dataEvento: true, status: true, valorCache: true, horaInicio: true },
  });
  if (!eventoBase) notFound();

  // Cria as linhas de pagamento dos escalados que ainda não têm (idempotente).
  await sincronizarPagamentosDoEvento(eventoId, s.sub);

  const [pagamentos, fechamento, contestacoes] = await Promise.all([
    prisma.pagamento.findMany({
      where: { eventoId },
      include: {
        user: { select: { id: true, nome: true, fotoPath: true, telefone: true, pixTipo: true } },
        lancamentos: { orderBy: { createdAt: "desc" } },
      },
      orderBy: { user: { nome: "asc" } },
    }),
    prisma.fechamentoCaixa.findUnique({
      where: { eventoId },
      include: { itens: true, iniciadoPor: { select: { nome: true } } },
    }),
    prisma.contestacaoPagamento.findMany({
      where: { pagamento: { eventoId } },
      include: { user: { select: { nome: true } } },
      orderBy: [{ status: "asc" }, { createdAt: "desc" }],
    }),
  ]);

  // Presença (check-in/out) por trabalhador, para o horário trabalhado.
  const presencas = await prisma.registroPresenca.findMany({
    where: { inscricao: { eventoId } },
    include: { inscricao: { select: { userId: true } } },
  });
  const presencaPorUser = new Map(presencas.map((p) => [p.inscricao.userId, p]));

  // v4 item 4/5: favoritar e bloquear direto na tela de pagamentos.
  const [favoritos, bloqueios] = await Promise.all([
    prisma.trabalhadorFavorito.findMany({ where: { empresaId: s.sub }, select: { userId: true } }),
    prisma.trabalhadorBloqueio.findMany({ where: { empresaId: s.sub, removidoEm: null }, select: { userId: true } }),
  ]);
  const ehFavorito = new Set(favoritos.map((f) => f.userId));
  const ehBloqueado = new Set(bloqueios.map((b) => b.userId));

  const resumo = resumirPagamentos(
    pagamentos.map((p) => ({
      valorDevido: Number(p.valorDevido),
      valorPago: Number(p.valorPago),
      status: p.status,
    })),
  );

  const podeGerenciar = sessaoPode(s, "financeiro:gerenciar");
  const podeRelacionamento = sessaoPode(s, "relacionamento:gerenciar");
  const podeVerPix = sessaoPode(s, "pix:ver");
  const fechamentoAberto = fechamento?.status === "EM_ANDAMENTO";
  const conferidos = new Set(fechamento?.itens.map((i) => i.pagamentoId) ?? []);

  // Visualização da chave PIX: acontece por navegação (?pix=<userId>), então cada
  // leitura é um request — e cada request gera um registro de auditoria.
  const pixSolicitado = Number(sp.pix ?? "");
  const chavePix =
    podeVerPix && Number.isInteger(pixSolicitado) && pixSolicitado > 0
      ? await lerChavePixParaEmpresa({
          empresaId: s.sub,
          userId: pixSolicitado,
          membroId: s.membroId,
          membroNome: s.membroNome,
          eventoId,
        })
      : null;

  return (
    <div className="space-y-6">
      <Flash searchParams={sp} caminho={caminho} />

      <div>
        <Link href="/empresa/eventos" className="text-sm text-brand-600 hover:underline">← Meus eventos</Link>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-bold">Pagamentos — {eventoBase.nome}</h1>
          <Badge tone={eventoBase.status === "FINALIZADO" ? "neutral" : "success"}>{eventoBase.status}</Badge>
        </div>
        <p className="text-sm text-muted">
          {formatarDataCivil(eventoBase.dataEvento)} · combinado do evento: {formatarBRL(Number(eventoBase.valorCache))}
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Total devido" value={formatarBRL(resumo.total)} hint={`${resumo.quantidade} trabalhador(es)`} icon={<Users className="h-5 w-5" />} />
        <StatTile label="Pago" value={formatarBRL(resumo.pago)} hint={`${resumo.quantidadePagos} quitado(s)`} icon={<Wallet className="h-5 w-5" />} />
        <StatTile label="Pendente" value={formatarBRL(resumo.pendente)} hint={`${resumo.quantidadePendentes} em aberto`} icon={<CircleAlert className="h-5 w-5" />} />
        <StatTile label="Progresso" value={`${resumo.pctPago}%`} hint="do valor devido já pago" />
      </div>

      <Card>
        <Bar label="Pagamentos do evento" pct={resumo.pctPago} right={`${formatarBRL(resumo.pago)} de ${formatarBRL(resumo.total)}`} />
      </Card>

      {/* -------------------- Fechamento de caixa (item 9) -------------------- */}
      <Card className={fechamentoAberto ? "border-brand-500" : undefined}>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="font-semibold">Fechamento de caixa</h2>
            {fechamento ? (
              <p className="mt-1 text-sm text-muted">
                {fechamento.status === "EM_ANDAMENTO"
                  ? `Em andamento desde ${formatarDataHora(fechamento.iniciadoEm)}`
                  : `Concluído em ${formatarDataHora(fechamento.concluidoEm ?? fechamento.updatedAt)}`}
                {fechamento.iniciadoPor ? ` · iniciado por ${fechamento.iniciadoPor.nome}` : ""}
                {` · ${fechamento.itens.length} de ${resumo.quantidade} conferido(s)`}
              </p>
            ) : (
              <p className="mt-1 text-sm text-muted">
                Ao iniciar, todos os trabalhadores escalados são notificados de que o fechamento financeiro começou.
              </p>
            )}
          </div>

          {podeGerenciar && (
            <div className="flex flex-wrap gap-2">
              {!fechamentoAberto && (
                <form action={iniciarFechamentoCaixa}>
                  <input type="hidden" name="eventoId" value={eventoId} />
                  <SubmitButton size="sm" pendingLabel="Iniciando...">
                    {fechamento ? "Reabrir fechamento" : "Iniciar fechamento de caixa"}
                  </SubmitButton>
                </form>
              )}
              {fechamentoAberto && (
                <form action={concluirFechamentoCaixa}>
                  <input type="hidden" name="eventoId" value={eventoId} />
                  <SubmitButton
                    size="sm"
                    variant="outline"
                    pendingLabel="Concluindo..."
                    disabled={fechamento.itens.length < resumo.quantidade}
                  >
                    Concluir fechamento
                  </SubmitButton>
                </form>
              )}
            </div>
          )}
        </div>
        {fechamentoAberto && fechamento.itens.length < resumo.quantidade && (
          <p className="mt-3 text-xs text-muted">
            Para concluir, registre a decisão de cada trabalhador (pago, parcial ou não pago).
          </p>
        )}
      </Card>

      {/* -------------------- Linhas por trabalhador -------------------- */}
      {pagamentos.length === 0 ? (
        <EmptyState
          icone={<ListChecks className="h-6 w-6" />}
          titulo="Ninguém escalado neste evento"
          descricao="Os pagamentos aparecem aqui depois que você escalar os trabalhadores."
          acao={{ href: `/empresa/eventos/${eventoId}/escalar`, rotulo: "Ir para a escala" }}
        />
      ) : (
        <section className="space-y-3">
          <h2 className="font-semibold">Trabalhadores escalados ({pagamentos.length})</h2>

          {pagamentos.map((p) => {
            const devido = Number(p.valorDevido);
            const pago = Number(p.valorPago);
            const restante = saldoRestante(devido, pago);
            const presenca = presencaPorUser.get(p.user.id);
            const contestacoesDoPagamento = contestacoes.filter((c) => c.pagamentoId === p.id);
            const emAberto = contestacoesDoPagamento.some((c) => c.status === "ABERTA" || c.status === "EM_ANALISE");

            return (
              <Card key={p.id} data-testid="linha-pagamento" className="space-y-3">
                {/* Identificação + situação */}
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="flex items-start gap-3">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={p.user.fotoPath ?? "/avatar-placeholder.svg"}
                      alt={`Foto de ${p.user.nome}`}
                      className="h-12 w-12 rounded-full border border-surface object-cover"
                    />
                    <div>
                      <p className="font-medium">{p.user.nome}</p>
                      <p className="text-xs text-muted">
                        {p.funcao ?? "função não informada"} · {p.user.telefone}
                      </p>
                      <p className="text-xs text-muted">
                        {p.horaEntrada && p.horaSaida
                          ? `Horário: ${formatarPeriodo(p.horaEntrada, p.horaSaida)}`
                          : "Horário trabalhado não informado"}
                        {presenca?.checkInEm ? ` · check-in ${formatarDataHora(presenca.checkInEm)}` : ""}
                      </p>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-1">
                    <Badge tone={TOM_STATUS[p.status]}>{INDICADOR_STATUS[p.status]}</Badge>
                    <p className="text-sm">
                      <strong>{formatarBRL(pago)}</strong> de {formatarBRL(devido)}
                      {restante > 0 && <span className="text-muted"> · falta {formatarBRL(restante)}</span>}
                    </p>
                    <p className="text-xs text-muted">
                      Forma: {p.forma ? ROTULOS_FORMA[p.forma as FormaPagamentoId] : "não definida"}
                    </p>
                    {emAberto && <Badge tone="danger">Contestação em aberto</Badge>}
                  </div>
                </div>

                {p.observacoes && <p className="text-sm text-muted">Observações: {p.observacoes}</p>}

                {/* Chave PIX (item 2) — visível sob permissão, com auditoria */}
                {podeVerPix && (
                  <div className="rounded-lg border border-surface p-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <p className="flex items-center gap-2 text-sm font-medium">
                        <KeyRound className="h-4 w-4" /> Chave PIX
                      </p>
                      {chavePix && pixSolicitado === p.user.id ? (
                        chavePix.ok ? (
                          <div className="flex flex-wrap items-center gap-2">
                            <code data-testid="chave-pix" className="rounded bg-slate-100 px-2 py-1 text-sm dark:bg-slate-800">
                              {chavePix.chave.formatado}
                            </code>
                            <CopiarPix chave={chavePix.chave.valor} nome={p.user.nome} />
                            <Link href={caminho} className="text-xs text-brand-600 hover:underline">Ocultar</Link>
                          </div>
                        ) : (
                          <p className="text-sm text-amber-700 dark:text-amber-300">{chavePix.mensagem}</p>
                        )
                      ) : p.user.pixTipo ? (
                        <Link href={`${caminho}?pix=${p.user.id}`} className="text-sm text-brand-600 hover:underline">
                          Ver chave PIX ({p.user.pixTipo})
                        </Link>
                      ) : (
                        <span className="text-sm text-muted">Trabalhador não cadastrou chave PIX</span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted">Cada visualização é registrada na trilha de auditoria.</p>
                  </div>
                )}

                {/* Ações financeiras */}
                {podeGerenciar && (
                  <div className="space-y-3 border-t border-surface pt-3">
                    <AjustarPagamentoForm
                      pagamentoId={p.id}
                      valorDevido={String(centavos(devido)).replace(".", ",")}
                      funcao={p.funcao ?? ""}
                      horaEntrada={p.horaEntrada ?? ""}
                      horaSaida={p.horaSaida ?? ""}
                      observacoes={p.observacoes ?? ""}
                    />

                    {fechamentoAberto ? (
                      <div className="rounded-lg bg-brand-50 p-3 dark:bg-brand-700/10">
                        <p className="mb-2 text-sm font-medium">
                          Fechamento de caixa {conferidos.has(p.id) ? "· conferido" : "· pendente de conferência"}
                        </p>
                        <ItemFechamentoForm
                          pagamentoId={p.id}
                          valorSugerido={String(centavos(restante)).replace(".", ",")}
                          formaAtual={(p.forma as FormaPagamentoId | null) ?? null}
                          nome={p.user.nome}
                        />
                      </div>
                    ) : (
                      restante > 0 && (
                        <RegistrarPagamentoForm
                          pagamentoId={p.id}
                          restante={String(centavos(restante)).replace(".", ",")}
                          formaAtual={(p.forma as FormaPagamentoId | null) ?? null}
                          nome={p.user.nome}
                        />
                      )
                    )}

                    <div className="flex flex-wrap items-center gap-2">
                      {pago > 0 && (
                        <form action={estornarPagamento}>
                          <input type="hidden" name="pagamentoId" value={p.id} />
                          <SubmitButton size="sm" variant="outline" pendingLabel="...">
                            Marcar como pendente
                          </SubmitButton>
                        </form>
                      )}
                      <form action={alterarFormaPagamento} className="flex items-center gap-2">
                        <input type="hidden" name="pagamentoId" value={p.id} />
                        <label className="text-xs text-muted" htmlFor={`forma-rapida-${p.id}`}>Trocar forma:</label>
                        <select
                          id={`forma-rapida-${p.id}`}
                          name="forma"
                          defaultValue={p.forma ?? "PIX"}
                          className="rounded-lg border border-surface bg-surface px-2 py-1 text-sm"
                        >
                          {(["PIX", "DINHEIRO", "CARTAO_CREDITO"] as FormaPagamentoId[]).map((f) => (
                            <option key={f} value={f}>{ROTULOS_FORMA[f]}</option>
                          ))}
                        </select>
                        <SubmitButton size="sm" variant="ghost" pendingLabel="...">Aplicar</SubmitButton>
                      </form>
                      <Link
                        href={`/empresa/eventos/${eventoId}/escalar`}
                        className="inline-flex items-center gap-1 text-sm text-brand-600 hover:underline"
                      >
                        <Star className="h-4 w-4" /> Avaliar na escala
                      </Link>
                    </div>
                  </div>
                )}

                {/* Relacionamento (itens 4 e 5) — a especificação pede estes controles nesta tela */}
                {podeRelacionamento && (
                  <div className="flex flex-wrap items-center gap-2 border-t border-surface pt-3">
                    <form action={favoritarTrabalhador}>
                      <input type="hidden" name="userId" value={p.user.id} />
                      <SubmitButton
                        size="sm"
                        variant={ehFavorito.has(p.user.id) ? "secondary" : "outline"}
                        pendingLabel="..."
                        aria-label={`${ehFavorito.has(p.user.id) ? "Remover" : "Adicionar"} ${p.user.nome} ${ehFavorito.has(p.user.id) ? "dos" : "aos"} favoritos`}
                      >
                        <Star className="h-4 w-4" /> {ehFavorito.has(p.user.id) ? "Favorito" : "Favoritar"}
                      </SubmitButton>
                    </form>
                    {ehBloqueado.has(p.user.id) ? (
                      <Badge tone="danger">Trabalhador bloqueado</Badge>
                    ) : (
                      <BloquearForm userId={p.user.id} nome={p.user.nome} />
                    )}
                    <Link href="/empresa/relacionamento" className="text-xs text-brand-600 hover:underline">
                      Ver favoritos e bloqueios →
                    </Link>
                  </div>
                )}

                {/* Histórico de lançamentos (item 10) */}
                {p.lancamentos.length > 0 && (
                  <details className="rounded-lg border border-surface p-3">
                    <summary className="cursor-pointer text-sm font-medium">
                      Histórico financeiro ({p.lancamentos.length} lançamento{p.lancamentos.length > 1 ? "s" : ""})
                    </summary>
                    <ul className="mt-2 space-y-1 text-sm">
                      {p.lancamentos.map((l) => (
                        <li key={l.id} className="flex flex-wrap justify-between gap-2 border-b border-surface pb-1 last:border-0">
                          <span>
                            {formatarBRL(Number(l.valor))} · {ROTULOS_FORMA[l.forma as FormaPagamentoId]}
                            {l.observacao ? ` · ${l.observacao}` : ""}
                          </span>
                          <span className="text-muted">{formatarDataHora(l.createdAt)}</span>
                        </li>
                      ))}
                    </ul>
                  </details>
                )}

                {/* Contestações do trabalhador (item 6) */}
                {contestacoesDoPagamento.map((c) => (
                  <div
                    key={c.id}
                    data-testid="contestacao"
                    className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm dark:border-amber-900/50 dark:bg-amber-900/20"
                  >
                    <p className="font-medium">
                      Contestação #{c.id} · {c.motivo}{" "}
                      <Badge tone={c.status === "RESOLVIDA" ? "success" : c.status === "REJEITADA" ? "neutral" : "warning"}>
                        {c.status}
                      </Badge>
                    </p>
                    <p className="mt-1">{c.descricao}</p>
                    <p className="mt-1 text-xs text-muted">
                      Aberta por {c.user.nome} em {formatarDataHora(c.createdAt)}
                    </p>
                    {c.resposta && (
                      <p className="mt-2 rounded bg-surface p-2">
                        <strong>Resposta:</strong> {c.resposta}
                        {c.respondidoEm ? ` (${formatarDataHora(c.respondidoEm)})` : ""}
                      </p>
                    )}
                    {podeGerenciar && (c.status === "ABERTA" || c.status === "EM_ANALISE") && (
                      <ResponderContestacaoForm contestacaoId={c.id} />
                    )}
                  </div>
                ))}
              </Card>
            );
          })}
        </section>
      )}

      <Card className="text-xs text-muted">
        Toda alteração financeira desta tela — ajuste de valor, pagamento, estorno, troca de forma, fechamento e
        visualização de chave PIX — é registrada na trilha de auditoria com o membro responsável.
      </Card>
    </div>
  );
}
