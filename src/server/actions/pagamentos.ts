"use server";

import { prisma } from "@/lib/prisma";
import { erroDePermissao, requireEmpresa, requireTrabalhador } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/audit";
import { notificar, notificarEmLote, notificarResponsaveisFinanceiro } from "@/lib/notifications";
import {
  aplicarLancamento,
  centavos,
  formatarValor,
  statusDerivado,
  type FormaPagamentoId,
} from "@/lib/domain/pagamento";
import { formatarDataCivil, normalizarHora } from "@/lib/datetime";
import { voltarComErro, voltarComSucesso } from "@/server/actions/navegacao";
import {
  contestacaoSchema,
  itemFechamentoSchema,
  registrarPagamentoSchema,
  respostaContestacaoSchema,
  valorPagamentoSchema,
} from "@/lib/validations";
import { primeiroErroZod } from "@/lib/actions";

/**
 * v4 — Financeiro do evento.
 *
 * **Todas as actions daqui redirecionam** com o resultado na URL (sucesso ou recusa),
 * e os formulários são renderizados no servidor. Medição que levou a isso (ADR 0004):
 * formulário em client component com `useActionState` + redirect deixava a tela no
 * estado anterior em parte dos cliques (3 de 12 no loop dirigido, e a maioria dos
 * testes de pagamento na primeira versão desta tela); formulário no servidor +
 * aviso na URL, 12 de 12. Em dinheiro, "às vezes a tela não atualiza" é inaceitável.
 *
 * Consequência aceita: erro de validação também volta por aviso, então o
 * formulário é recarregado limpo. Os formulários financeiros são curtos (valor,
 * forma, observação), e a mensagem diz exatamente o que corrigir.
 *
 * Divisão de responsabilidade:
 * - **regra de dinheiro** (saldo, status, parcial) → `lib/domain/pagamento.ts`, puro
 *   e testado à exaustão;
 * - **aqui** → autorização, transação, auditoria e notificação.
 *
 * Toda alteração financeira grava `AuditLog` (item 13 da especificação): é dinheiro
 * de terceiros, e sem trilha não há como responder "quem marcou isso como pago".
 */

const CAMINHO_FALLBACK = "/empresa/eventos";

function caminhoPagamentos(eventoId: number): string {
  return `/empresa/eventos/${eventoId}/pagamentos`;
}

/** Status de inscrição que geram direito a pagamento. */
const STATUS_COM_DIREITO = ["ESCALADO", "PRESENTE", "FALTA"] as const;

/**
 * Garante uma linha de pagamento para cada trabalhador escalado, usando o cachê do
 * evento como valor devido inicial. Idempotente: rodar duas vezes não duplica nem
 * sobrescreve valor já ajustado.
 *
 * Chamado ao abrir a tela de pagamentos — assim a empresa nunca vê uma lista vazia
 * depois de escalar, e o valor combinado do evento já vem preenchido.
 */
export async function sincronizarPagamentosDoEvento(eventoId: number, empresaId: number): Promise<void> {
  const evento = await prisma.evento.findFirst({
    where: { id: eventoId, empresaId },
    select: { id: true, valorCache: true, funcoes: true, horaInicio: true },
  });
  if (!evento) return;

  const [inscricoes, existentes] = await Promise.all([
    prisma.inscricao.findMany({
      where: { eventoId, status: { in: [...STATUS_COM_DIREITO] } },
      select: { userId: true },
    }),
    prisma.pagamento.findMany({ where: { eventoId }, select: { userId: true } }),
  ]);

  const jaTem = new Set(existentes.map((p) => p.userId));
  const faltando = inscricoes.filter((i) => !jaTem.has(i.userId));
  if (faltando.length === 0) return;

  await prisma.pagamento.createMany({
    data: faltando.map((i) => ({
      eventoId,
      userId: i.userId,
      empresaId,
      valorDevido: evento.valorCache,
      horaEntrada: evento.horaInicio,
    })),
    skipDuplicates: true,
  });
}

/** Carrega o pagamento garantindo que pertence à empresa da sessão (anti-IDOR). */
async function pagamentoDaEmpresa(pagamentoId: number, empresaId: number) {
  return prisma.pagamento.findFirst({
    where: { id: pagamentoId, empresaId },
    include: { user: { select: { id: true, nome: true } }, evento: { select: { id: true, nome: true } } },
  });
}

// --------------------------------------------------------------------------
// Ajustar o combinado (valor, função, horário trabalhado, observações)
// --------------------------------------------------------------------------
export async function ajustarPagamento(formData: FormData): Promise<void> {
  const s = await requireEmpresa();
  const negado = erroDePermissao(s, "financeiro:gerenciar");
  if (negado) return voltarComErro(CAMINHO_FALLBACK, negado);

  const parsed = valorPagamentoSchema.safeParse({
    pagamentoId: formData.get("pagamentoId"),
    valorDevido: formData.get("valorDevido"),
    funcao: formData.get("funcao"),
    horaEntrada: formData.get("horaEntrada"),
    horaSaida: formData.get("horaSaida"),
    observacoes: formData.get("observacoes"),
  });
  if (!parsed.success) return voltarComErro(CAMINHO_FALLBACK, primeiroErroZod(parsed.error));
  const d = parsed.data;

  const pagamento = await pagamentoDaEmpresa(d.pagamentoId, s.sub);
  if (!pagamento) return voltarComErro(CAMINHO_FALLBACK, "Pagamento não encontrado.");

  // O devido não pode ficar abaixo do que já foi pago: a constraint do banco
  // recusaria, e a mensagem do banco não ajudaria quem está na tela.
  const jaPago = Number(pagamento.valorPago);
  if (centavos(d.valorDevido) < centavos(jaPago)) {
    return voltarComErro(
      caminhoPagamentos(pagamento.evento.id),
      `Valor devido menor que o já pago (${formatarValor(jaPago)}). Estorne o pagamento antes de reduzir o combinado.`,
    );
  }

  const status = statusDerivado(d.valorDevido, jaPago);
  await prisma.pagamento.update({
    where: { id: pagamento.id },
    data: {
      valorDevido: d.valorDevido,
      funcao: d.funcao || null,
      horaEntrada: d.horaEntrada ? normalizarHora(d.horaEntrada) : null,
      horaSaida: d.horaSaida ? normalizarHora(d.horaSaida) : null,
      observacoes: d.observacoes || null,
      status: pagamento.status === "CANCELADO" ? "CANCELADO" : status,
      registradoPorMembroId: s.membroId ?? null,
    },
  });

  await registrarAuditoria({
    atorTipo: "EMPRESA",
    atorId: s.sub,
    acao: "PAGAMENTO_AJUSTADO",
    entidade: "Pagamento",
    entidadeId: pagamento.id,
    detalhe: `${pagamento.user.nome}: devido ${formatarValor(d.valorDevido)}${s.membroNome ? ` (por ${s.membroNome})` : ""}`,
  });

  return voltarComSucesso(
    caminhoPagamentos(pagamento.evento.id),
    `Combinado de ${pagamento.user.nome} atualizado.`,
  );
}

// --------------------------------------------------------------------------
// Registrar pagamento (total ou parcial)
// --------------------------------------------------------------------------
export async function registrarPagamento(formData: FormData): Promise<void> {
  const s = await requireEmpresa();
  const negado = erroDePermissao(s, "financeiro:gerenciar");
  if (negado) return voltarComErro(CAMINHO_FALLBACK, negado);

  const parsed = registrarPagamentoSchema.safeParse({
    pagamentoId: formData.get("pagamentoId"),
    valor: formData.get("valor"),
    forma: formData.get("forma"),
    observacao: formData.get("observacao"),
  });
  if (!parsed.success) return voltarComErro(CAMINHO_FALLBACK, primeiroErroZod(parsed.error));
  const d = parsed.data;

  const pagamento = await pagamentoDaEmpresa(d.pagamentoId, s.sub);
  if (!pagamento) return voltarComErro(CAMINHO_FALLBACK, "Pagamento não encontrado.");

  // A regra de dinheiro é pura e testada; aqui só se confia nela.
  const resultado = aplicarLancamento({
    valorDevido: Number(pagamento.valorDevido),
    valorPagoAtual: Number(pagamento.valorPago),
    status: pagamento.status,
    valorLancamento: d.valor,
  });
  if (!resultado.ok) return voltarComErro(caminhoPagamentos(pagamento.evento.id), resultado.erro!);

  // Lançamento + saldo na MESMA transação: um sem o outro deixaria o histórico
  // financeiro mentindo sobre o saldo.
  await prisma.$transaction([
    prisma.pagamentoLancamento.create({
      data: {
        pagamentoId: pagamento.id,
        valor: d.valor,
        forma: d.forma as FormaPagamentoId,
        observacao: d.observacao || null,
        registradoPorMembroId: s.membroId ?? null,
      },
    }),
    prisma.pagamento.update({
      where: { id: pagamento.id },
      data: {
        valorPago: resultado.valorPago,
        status: resultado.status,
        forma: d.forma as FormaPagamentoId,
        quitadoEm: resultado.quitado ? new Date() : null,
        registradoPorMembroId: s.membroId ?? null,
      },
    }),
  ]);

  await registrarAuditoria({
    atorTipo: "EMPRESA",
    atorId: s.sub,
    acao: resultado.quitado ? "PAGAMENTO_QUITADO" : "PAGAMENTO_PARCIAL",
    entidade: "Pagamento",
    entidadeId: pagamento.id,
    detalhe: `${pagamento.user.nome}: ${formatarValor(d.valor)} via ${d.forma}${s.membroNome ? ` (por ${s.membroNome})` : ""}`,
  });

  // Item 6: o trabalhador é avisado quando o pagamento é registrado.
  await notificar({
    userId: pagamento.user.id,
    tipo: resultado.quitado ? "PAGAMENTO_REGISTRADO" : "PAGAMENTO_PARCIAL",
    titulo: resultado.quitado ? "Pagamento recebido" : "Pagamento parcial registrado",
    mensagem: resultado.quitado
      ? `${pagamento.evento.nome}: pagamento de ${formatarValor(Number(pagamento.valorDevido))} registrado como pago.`
      : `${pagamento.evento.nome}: ${formatarValor(d.valor)} registrados. Falta ${formatarValor(
          Number(pagamento.valorDevido) - resultado.valorPago!,
        )}.`,
    link: "/trabalhador/financeiro",
  });

  return voltarComSucesso(
    caminhoPagamentos(pagamento.evento.id),
    resultado.quitado
      ? `Pagamento de ${pagamento.user.nome} quitado.`
      : `${formatarValor(d.valor)} registrados para ${pagamento.user.nome}.`,
  );
}

// --------------------------------------------------------------------------
// Estornar (voltar para pendente)
// --------------------------------------------------------------------------
/**
 * Volta o pagamento para PENDENTE.
 *
 * Os lançamentos **não** são apagados: eles são o histórico do que aconteceu. O
 * estorno fica registrado na auditoria — apagar histórico financeiro para "arrumar"
 * a tela é justamente o que uma trilha de auditoria existe para impedir.
 */
export async function estornarPagamento(formData: FormData): Promise<void> {
  const s = await requireEmpresa();
  if (erroDePermissao(s, "financeiro:gerenciar")) return;

  const pagamentoId = Number(formData.get("pagamentoId"));
  const pagamento = await pagamentoDaEmpresa(pagamentoId, s.sub);
  if (!pagamento) return;

  const valorEstornado = Number(pagamento.valorPago);
  await prisma.pagamento.update({
    where: { id: pagamento.id },
    data: { valorPago: 0, status: "PENDENTE", quitadoEm: null, registradoPorMembroId: s.membroId ?? null },
  });

  await registrarAuditoria({
    atorTipo: "EMPRESA",
    atorId: s.sub,
    acao: "PAGAMENTO_ESTORNADO",
    entidade: "Pagamento",
    entidadeId: pagamento.id,
    detalhe: `${pagamento.user.nome}: estorno de ${formatarValor(valorEstornado)}${s.membroNome ? ` (por ${s.membroNome})` : ""}. Lançamentos preservados.`,
  });

  await voltarComSucesso(
    caminhoPagamentos(pagamento.evento.id),
    `Pagamento de ${pagamento.user.nome} voltou para pendente.`,
  );
}

// --------------------------------------------------------------------------
// Alterar forma de pagamento (sem mover valor)
// --------------------------------------------------------------------------
export async function alterarFormaPagamento(formData: FormData): Promise<void> {
  const s = await requireEmpresa();
  if (erroDePermissao(s, "financeiro:gerenciar")) return;

  const pagamentoId = Number(formData.get("pagamentoId"));
  const forma = String(formData.get("forma") ?? "");
  if (!["PIX", "DINHEIRO", "CARTAO_CREDITO"].includes(forma)) return;

  const pagamento = await pagamentoDaEmpresa(pagamentoId, s.sub);
  if (!pagamento) return;

  await prisma.pagamento.update({ where: { id: pagamento.id }, data: { forma: forma as FormaPagamentoId } });
  await registrarAuditoria({
    atorTipo: "EMPRESA",
    atorId: s.sub,
    acao: "PAGAMENTO_FORMA_ALTERADA",
    entidade: "Pagamento",
    entidadeId: pagamento.id,
    detalhe: `${pagamento.user.nome}: ${pagamento.forma ?? "—"} → ${forma}`,
  });

  await voltarComSucesso(caminhoPagamentos(pagamento.evento.id), "Forma de pagamento atualizada.");
}

// --------------------------------------------------------------------------
// Fechamento de caixa (item 9)
// --------------------------------------------------------------------------
export async function iniciarFechamentoCaixa(formData: FormData): Promise<void> {
  const s = await requireEmpresa();
  if (erroDePermissao(s, "financeiro:gerenciar")) return;

  const eventoId = Number(formData.get("eventoId"));
  const evento = await prisma.evento.findFirst({
    where: { id: eventoId, empresaId: s.sub },
    select: { id: true, nome: true, dataEvento: true },
  });
  if (!evento) return;

  await sincronizarPagamentosDoEvento(evento.id, s.sub);

  const fechamento = await prisma.fechamentoCaixa.upsert({
    where: { eventoId: evento.id },
    create: { eventoId: evento.id, empresaId: s.sub, iniciadoPorMembroId: s.membroId ?? null },
    update: { status: "EM_ANDAMENTO", concluidoEm: null },
  });

  // Item 9: "todos os trabalhadores receberão uma notificação informando que o
  // fechamento financeiro começou".
  const escalados = await prisma.inscricao.findMany({
    where: { eventoId: evento.id, status: { in: [...STATUS_COM_DIREITO] } },
    select: { userId: true },
  });
  await notificarEmLote(
    escalados.map((e) => e.userId),
    {
      tipo: "FECHAMENTO_INICIADO",
      titulo: "Fechamento financeiro iniciado",
      mensagem: `${evento.nome} (${formatarDataCivil(evento.dataEvento)}): a empresa começou o fechamento de caixa.`,
      link: "/trabalhador/financeiro",
    },
  );

  await registrarAuditoria({
    atorTipo: "EMPRESA",
    atorId: s.sub,
    acao: "FECHAMENTO_INICIADO",
    entidade: "FechamentoCaixa",
    entidadeId: fechamento.id,
    detalhe: `${evento.nome}${s.membroNome ? ` (por ${s.membroNome})` : ""} · ${escalados.length} trabalhador(es) avisados`,
  });

  await voltarComSucesso(
    caminhoPagamentos(evento.id),
    `Fechamento iniciado. ${escalados.length} trabalhador(es) notificados.`,
  );
}

/** Conferência de um trabalhador dentro do fechamento (valor + forma + situação). */
export async function registrarItemFechamento(formData: FormData): Promise<void> {
  const s = await requireEmpresa();
  const negado = erroDePermissao(s, "financeiro:gerenciar");
  if (negado) return voltarComErro(CAMINHO_FALLBACK, negado);

  const parsed = itemFechamentoSchema.safeParse({
    pagamentoId: formData.get("pagamentoId"),
    valorPago: formData.get("valorPago"),
    forma: formData.get("forma"),
    observacao: formData.get("observacao"),
  });
  if (!parsed.success) return voltarComErro(CAMINHO_FALLBACK, primeiroErroZod(parsed.error));
  const d = parsed.data;

  const pagamento = await pagamentoDaEmpresa(d.pagamentoId, s.sub);
  if (!pagamento) return voltarComErro(CAMINHO_FALLBACK, "Pagamento não encontrado.");

  const fechamento = await prisma.fechamentoCaixa.findUnique({ where: { eventoId: pagamento.evento.id } });
  if (!fechamento || fechamento.status !== "EM_ANDAMENTO") {
    return voltarComErro(
      caminhoPagamentos(pagamento.evento.id),
      "Inicie o fechamento de caixa deste evento antes de conferir os pagamentos.",
    );
  }

  const devido = Number(pagamento.valorDevido);
  const pagoInformado = centavos(d.valorPago);
  if (pagoInformado > devido) {
    return voltarComErro(
      caminhoPagamentos(pagamento.evento.id),
      `Valor acima do devido (${formatarValor(devido)}). Ajuste o combinado antes de registrar.`,
    );
  }

  const status = statusDerivado(devido, pagoInformado);
  const jaPago = Number(pagamento.valorPago);
  const diferenca = centavos(pagoInformado - jaPago);

  await prisma.$transaction(async (tx) => {
    await tx.fechamentoCaixaItem.upsert({
      where: { fechamentoId_pagamentoId: { fechamentoId: fechamento.id, pagamentoId: pagamento.id } },
      create: {
        fechamentoId: fechamento.id,
        pagamentoId: pagamento.id,
        valorDevido: devido,
        valorPago: pagoInformado,
        forma: d.forma as FormaPagamentoId,
        status,
        observacao: d.observacao || null,
      },
      update: { valorPago: pagoInformado, forma: d.forma as FormaPagamentoId, status, observacao: d.observacao || null },
    });

    // Só gera lançamento pela DIFERENÇA: conferir duas vezes o mesmo valor não pode
    // inflar o histórico financeiro.
    if (diferenca > 0) {
      await tx.pagamentoLancamento.create({
        data: {
          pagamentoId: pagamento.id,
          valor: diferenca,
          forma: d.forma as FormaPagamentoId,
          observacao: "Fechamento de caixa",
          registradoPorMembroId: s.membroId ?? null,
        },
      });
    }

    await tx.pagamento.update({
      where: { id: pagamento.id },
      data: {
        valorPago: pagoInformado,
        status,
        forma: d.forma as FormaPagamentoId,
        quitadoEm: status === "PAGO" ? new Date() : null,
        registradoPorMembroId: s.membroId ?? null,
      },
    });
  });

  await registrarAuditoria({
    atorTipo: "EMPRESA",
    atorId: s.sub,
    acao: "FECHAMENTO_ITEM_REGISTRADO",
    entidade: "Pagamento",
    entidadeId: pagamento.id,
    detalhe: `${pagamento.user.nome}: ${formatarValor(pagoInformado)} de ${formatarValor(devido)} via ${d.forma} (${status})`,
  });

  if (diferenca > 0) {
    await notificar({
      userId: pagamento.user.id,
      tipo: status === "PAGO" ? "PAGAMENTO_REGISTRADO" : "PAGAMENTO_PARCIAL",
      titulo: status === "PAGO" ? "Pagamento recebido" : "Pagamento parcial registrado",
      mensagem: `${pagamento.evento.nome}: ${formatarValor(diferenca)} registrados no fechamento de caixa.`,
      link: "/trabalhador/financeiro",
    });
  }

  return voltarComSucesso(
    caminhoPagamentos(pagamento.evento.id),
    `${pagamento.user.nome}: ${formatarValor(pagoInformado)} conferidos (${status.toLowerCase()}).`,
  );
}

export async function concluirFechamentoCaixa(formData: FormData): Promise<void> {
  const s = await requireEmpresa();
  if (erroDePermissao(s, "financeiro:gerenciar")) return;

  const eventoId = Number(formData.get("eventoId"));
  const fechamento = await prisma.fechamentoCaixa.findFirst({
    where: { eventoId, empresaId: s.sub },
    include: { evento: { select: { id: true, nome: true } }, itens: true },
  });
  if (!fechamento) return;

  const pagamentos = await prisma.pagamento.count({ where: { eventoId, status: { not: "CANCELADO" } } });
  const conferidos = fechamento.itens.length;
  if (conferidos < pagamentos) {
    // Concluir com gente sem decisão registrada deixaria pendência invisível.
    await voltarComSucesso(caminhoPagamentos(eventoId), "");
    return;
  }

  await prisma.fechamentoCaixa.update({
    where: { id: fechamento.id },
    data: { status: "CONCLUIDO", concluidoEm: new Date() },
  });
  await registrarAuditoria({
    atorTipo: "EMPRESA",
    atorId: s.sub,
    acao: "FECHAMENTO_CONCLUIDO",
    entidade: "FechamentoCaixa",
    entidadeId: fechamento.id,
    detalhe: `${fechamento.evento.nome}: ${conferidos} trabalhador(es) conferidos${s.membroNome ? ` (por ${s.membroNome})` : ""}`,
  });

  await voltarComSucesso(caminhoPagamentos(eventoId), "Fechamento de caixa concluído.");
}

// --------------------------------------------------------------------------
// Contestação (item 6) — lado do trabalhador
// --------------------------------------------------------------------------
export async function contestarPagamento(formData: FormData): Promise<void> {
  const s = await requireTrabalhador();

  const parsed = contestacaoSchema.safeParse({
    pagamentoId: formData.get("pagamentoId"),
    motivo: formData.get("motivo"),
    descricao: formData.get("descricao"),
  });
  if (!parsed.success) return voltarComErro(CAMINHO_FALLBACK, primeiroErroZod(parsed.error));
  const d = parsed.data;

  const pagamento = await prisma.pagamento.findFirst({
    where: { id: d.pagamentoId, userId: s.sub },
    include: { evento: { select: { nome: true } }, empresa: { select: { id: true, nome: true } } },
  });
  if (!pagamento) return voltarComErro(CAMINHO_FALLBACK, "Pagamento não encontrado.");

  const emAberto = await prisma.contestacaoPagamento.count({
    where: { pagamentoId: pagamento.id, status: { in: ["ABERTA", "EM_ANALISE"] } },
  });
  if (emAberto > 0) {
    return voltarComErro(
      "/trabalhador/financeiro",
      "Você já tem uma contestação em aberto para este pagamento. Aguarde a resposta da empresa.",
    );
  }

  const contestacao = await prisma.contestacaoPagamento.create({
    data: { pagamentoId: pagamento.id, userId: s.sub, motivo: d.motivo, descricao: d.descricao },
  });

  await registrarAuditoria({
    atorTipo: "TRABALHADOR",
    atorId: s.sub,
    acao: "CONTESTACAO_ABERTA",
    entidade: "Pagamento",
    entidadeId: pagamento.id,
    detalhe: `${pagamento.evento.nome}: ${d.motivo}`,
  });

  await notificarResponsaveisFinanceiro(pagamento.empresa.id, {
    tipo: "CONTESTACAO_ABERTA",
    titulo: "Contestação de pagamento",
    mensagem: `${s.nome} contestou o pagamento de ${pagamento.evento.nome}: ${d.motivo}`,
    link: `/empresa/eventos/${pagamento.eventoId}/pagamentos`,
  });

  return voltarComSucesso(
    "/trabalhador/financeiro",
    `Contestação registrada (nº ${contestacao.id}). A empresa foi notificada.`,
  );
}

/** Resposta da empresa à contestação. */
export async function responderContestacao(formData: FormData): Promise<void> {
  const s = await requireEmpresa();
  const negado = erroDePermissao(s, "financeiro:gerenciar");
  if (negado) return voltarComErro(CAMINHO_FALLBACK, negado);

  const parsed = respostaContestacaoSchema.safeParse({
    contestacaoId: formData.get("contestacaoId"),
    resposta: formData.get("resposta"),
    status: formData.get("status"),
  });
  if (!parsed.success) return voltarComErro(CAMINHO_FALLBACK, primeiroErroZod(parsed.error));
  const d = parsed.data;

  const contestacao = await prisma.contestacaoPagamento.findFirst({
    where: { id: d.contestacaoId, pagamento: { empresaId: s.sub } },
    include: { pagamento: { include: { evento: { select: { id: true, nome: true } } } }, user: { select: { id: true } } },
  });
  if (!contestacao) return voltarComErro(CAMINHO_FALLBACK, "Contestação não encontrada.");

  await prisma.contestacaoPagamento.update({
    where: { id: contestacao.id },
    data: {
      resposta: d.resposta,
      status: d.status,
      respondidoPorMembroId: s.membroId ?? null,
      respondidoEm: new Date(),
    },
  });

  await registrarAuditoria({
    atorTipo: "EMPRESA",
    atorId: s.sub,
    acao: "CONTESTACAO_RESPONDIDA",
    entidade: "ContestacaoPagamento",
    entidadeId: contestacao.id,
    detalhe: `${d.status}${s.membroNome ? ` (por ${s.membroNome})` : ""}`,
  });

  await notificar({
    userId: contestacao.user.id,
    tipo: "CONTESTACAO_RESPONDIDA",
    titulo: d.status === "RESOLVIDA" ? "Contestação resolvida" : "Contestação respondida",
    mensagem: `${contestacao.pagamento.evento.nome}: ${d.resposta.slice(0, 300)}`,
    link: "/trabalhador/financeiro",
  });

  return voltarComSucesso(caminhoPagamentos(contestacao.pagamento.evento.id), "Contestação respondida.");
}
