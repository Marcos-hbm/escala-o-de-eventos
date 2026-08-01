"use server";

import { prisma } from "@/lib/prisma";
import { erroDePermissao, requireEmpresa, requireTrabalhador } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/audit";
import { notificar, notificarEmLote, notificarMembro } from "@/lib/notifications";
import {
  definicaoTipo,
  estadoDoEvento,
  mensagemTransicaoInvalida,
  motivoCanalIndisponivel,
  ROTULOS_STATUS_SOLICITACAO,
  transicaoValida,
  type StatusSolicitacaoId,
  type TipoSolicitacaoId,
} from "@/lib/domain/comunicacao";
import { voltarComErro, voltarComSucesso } from "@/server/actions/navegacao";
import {
  mensagemCoordenacaoSchema,
  respostaSolicitacaoSchema,
  solicitacaoEventoSchema,
} from "@/lib/validations";
import { primeiroErroZod } from "@/lib/actions";

/**
 * v4 — Comunicação do evento (itens 7 e 8).
 *
 * Regras de janela e de transição vêm de `lib/domain/comunicacao.ts` (puro,
 * testado); aqui ficam autorização, escrita, auditoria e notificação.
 *
 * Como no resto da v4, tudo redireciona com o resultado na URL (ADR 0004) — em
 * comunicação durante evento ao vivo, tela que não atualiza é pior que lentidão.
 */

function caminhoPainel(eventoId: number): string {
  return `/empresa/eventos/${eventoId}/painel`;
}

function caminhoTrabalhador(eventoId: number): string {
  return `/trabalhador/eventos/${eventoId}`;
}

const STATUS_ESCALADO = ["ESCALADO", "PRESENTE", "FALTA"] as const;

// --------------------------------------------------------------------------
// Trabalhador abre solicitação
// --------------------------------------------------------------------------
export async function criarSolicitacao(formData: FormData): Promise<void> {
  const s = await requireTrabalhador();

  const parsed = solicitacaoEventoSchema.safeParse({
    eventoId: formData.get("eventoId"),
    tipo: formData.get("tipo"),
    mensagem: formData.get("mensagem"),
  });
  if (!parsed.success) return voltarComErro("/trabalhador/eventos", primeiroErroZod(parsed.error));
  const d = parsed.data;
  const alvo = caminhoTrabalhador(d.eventoId);

  const evento = await prisma.evento.findUnique({
    where: { id: d.eventoId },
    select: { id: true, nome: true, dataEvento: true, status: true, empresaId: true },
  });
  if (!evento) return voltarComErro("/trabalhador/eventos", "Evento não encontrado.");

  // Só quem está escalado fala com a coordenação daquele evento.
  const insc = await prisma.inscricao.findUnique({
    where: { eventoId_userId: { eventoId: d.eventoId, userId: s.sub } },
    select: { status: true },
  });
  if (!insc || !STATUS_ESCALADO.includes(insc.status as (typeof STATUS_ESCALADO)[number])) {
    return voltarComErro(alvo, "Só quem está escalado neste evento pode falar com a coordenação.");
  }

  // Janela: o canal existe apenas com o evento em andamento.
  const estado = estadoDoEvento(evento.dataEvento, evento.status);
  const fechado = motivoCanalIndisponivel(estado);
  if (fechado) return voltarComErro(alvo, fechado);

  const tipo = d.tipo as TipoSolicitacaoId;
  const def = definicaoTipo(tipo);

  // Uma solicitação aberta por tipo: repetir o mesmo pedido enquanto o primeiro não
  // foi respondido só polui a fila do coordenador.
  const jaAberta = await prisma.solicitacaoEvento.count({
    where: { eventoId: d.eventoId, userId: s.sub, tipo, status: { in: ["EM_ANALISE", "AGUARDANDO"] } },
  });
  if (jaAberta > 0) {
    return voltarComErro(
      alvo,
      `Você já tem um pedido de "${def.rotulo.toLowerCase()}" em aberto. Aguarde a resposta da coordenação.`,
    );
  }

  const solicitacao = await prisma.solicitacaoEvento.create({
    data: { eventoId: d.eventoId, userId: s.sub, tipo, mensagem: d.mensagem || null },
  });

  await registrarAuditoria({
    atorTipo: "TRABALHADOR",
    atorId: s.sub,
    acao: "SOLICITACAO_ABERTA",
    entidade: "Evento",
    entidadeId: evento.id,
    detalhe: `${def.rotulo}${d.mensagem ? `: ${d.mensagem}` : ""}`,
  });

  // Coordenação recebe o pedido (item 7: "o coordenador receberá em tempo real").
  const coordenadores = await prisma.membro.findMany({
    where: {
      empresaId: evento.empresaId,
      ativo: true,
      papel: { in: ["PROPRIETARIO", "ADMIN", "COORDENADOR"] },
    },
    select: { id: true },
  });
  for (const c of coordenadores) {
    await notificarMembro({
      membroId: c.id,
      tipo: "SOLICITACAO_RECEBIDA",
      titulo: def.urgente ? `⚠ ${def.rotulo}` : def.rotulo,
      mensagem: `${s.nome} em ${evento.nome}${d.mensagem ? `: ${d.mensagem}` : ""}`,
      link: caminhoPainel(evento.id),
    });
  }

  return voltarComSucesso(alvo, `Pedido enviado à coordenação: ${def.rotulo.toLowerCase()}.`);
}

// --------------------------------------------------------------------------
// Coordenação responde
// --------------------------------------------------------------------------
export async function responderSolicitacao(formData: FormData): Promise<void> {
  const s = await requireEmpresa();
  const negado = erroDePermissao(s, "comunicacao:responder");
  if (negado) return voltarComErro("/empresa/eventos", negado);

  const parsed = respostaSolicitacaoSchema.safeParse({
    solicitacaoId: formData.get("solicitacaoId"),
    status: formData.get("status"),
    resposta: formData.get("resposta"),
  });
  if (!parsed.success) return voltarComErro("/empresa/eventos", primeiroErroZod(parsed.error));
  const d = parsed.data;

  const solicitacao = await prisma.solicitacaoEvento.findFirst({
    where: { id: d.solicitacaoId, evento: { empresaId: s.sub } },
    include: { evento: { select: { id: true, nome: true } }, user: { select: { id: true, nome: true } } },
  });
  if (!solicitacao) return voltarComErro("/empresa/eventos", "Solicitação não encontrada.");

  const alvo = caminhoPainel(solicitacao.evento.id);
  const de = solicitacao.status as StatusSolicitacaoId;
  const para = d.status as StatusSolicitacaoId;

  // Transição válida é regra de domínio (pura e testada) — evita histórico
  // incoerente, como "recusada" voltando para "aprovada".
  if (!transicaoValida(de, para)) {
    return voltarComErro(alvo, mensagemTransicaoInvalida(de, para));
  }

  await prisma.solicitacaoEvento.update({
    where: { id: solicitacao.id },
    data: {
      status: para,
      resposta: d.resposta || null,
      respondidoPorMembroId: s.membroId ?? null,
      respondidoEm: new Date(),
    },
  });

  await registrarAuditoria({
    atorTipo: "EMPRESA",
    atorId: s.sub,
    acao: "SOLICITACAO_RESPONDIDA",
    entidade: "SolicitacaoEvento",
    entidadeId: solicitacao.id,
    detalhe: `${solicitacao.user.nome}: ${de} → ${para}${s.membroNome ? ` (por ${s.membroNome})` : ""}`,
  });

  await notificar({
    userId: solicitacao.user.id,
    tipo: "SOLICITACAO_RESPONDIDA",
    titulo: `Pedido ${ROTULOS_STATUS_SOLICITACAO[para].toLowerCase()}`,
    mensagem: `${definicaoTipo(solicitacao.tipo as TipoSolicitacaoId).rotulo} em ${solicitacao.evento.nome}${
      d.resposta ? `: ${d.resposta}` : ""
    }`,
    link: caminhoTrabalhador(solicitacao.evento.id),
  });

  return voltarComSucesso(
    alvo,
    `Pedido de ${solicitacao.user.nome} marcado como ${ROTULOS_STATUS_SOLICITACAO[para].toLowerCase()}.`,
  );
}

// --------------------------------------------------------------------------
// Mensagem da coordenação (equipe ou individual)
// --------------------------------------------------------------------------
export async function enviarMensagemCoordenacao(formData: FormData): Promise<void> {
  const s = await requireEmpresa();
  const negado = erroDePermissao(s, "comunicacao:responder");
  if (negado) return voltarComErro("/empresa/eventos", negado);
  if (!s.membroId) {
    return voltarComErro("/empresa/eventos", "Sessão sem membro identificado. Entre novamente para enviar mensagens.");
  }

  const parsed = mensagemCoordenacaoSchema.safeParse({
    eventoId: formData.get("eventoId"),
    texto: formData.get("texto"),
    userId: formData.get("userId"),
  });
  if (!parsed.success) return voltarComErro("/empresa/eventos", primeiroErroZod(parsed.error));
  const d = parsed.data;
  const alvo = caminhoPainel(d.eventoId);

  const evento = await prisma.evento.findFirst({
    where: { id: d.eventoId, empresaId: s.sub },
    select: { id: true, nome: true },
  });
  if (!evento) return voltarComErro("/empresa/eventos", "Evento não encontrado.");

  const escalados = await prisma.inscricao.findMany({
    where: { eventoId: evento.id, status: { in: [...STATUS_ESCALADO] } },
    select: { userId: true },
  });
  const destinatarios = d.userId ? escalados.filter((e) => e.userId === d.userId) : escalados;
  if (destinatarios.length === 0) {
    return voltarComErro(alvo, "Nenhum trabalhador escalado para receber a mensagem.");
  }

  await prisma.mensagemCoordenador.create({
    data: { eventoId: evento.id, membroId: s.membroId, userId: d.userId ?? null, texto: d.texto },
  });

  await notificarEmLote(
    destinatarios.map((e) => e.userId),
    {
      tipo: "MENSAGEM_COORDENACAO",
      titulo: "Mensagem da coordenação",
      mensagem: `${evento.nome}: ${d.texto}`,
      link: caminhoTrabalhador(evento.id),
    },
  );

  await registrarAuditoria({
    atorTipo: "EMPRESA",
    atorId: s.sub,
    acao: "MENSAGEM_COORDENACAO",
    entidade: "Evento",
    entidadeId: evento.id,
    detalhe: `${destinatarios.length} destinatário(s)${s.membroNome ? ` · por ${s.membroNome}` : ""}`,
  });

  return voltarComSucesso(
    alvo,
    d.userId ? "Mensagem enviada ao trabalhador." : `Mensagem enviada a ${destinatarios.length} trabalhador(es).`,
  );
}

// --------------------------------------------------------------------------
// Check-in / check-out (item 8)
// --------------------------------------------------------------------------
/**
 * Registra entrada/saída com horário real.
 *
 * O `StatusInscricao` (PRESENTE) continua sendo o resumo usado pela reputação e pelo
 * score: o check-in marca presença, e o horário fica em `RegistroPresenca` para
 * alimentar o horário trabalhado do fechamento de caixa.
 */
export async function registrarCheckIn(formData: FormData): Promise<void> {
  return registrarPonto(formData, "ENTRADA");
}

export async function registrarCheckOut(formData: FormData): Promise<void> {
  return registrarPonto(formData, "SAIDA");
}

async function registrarPonto(formData: FormData, tipo: "ENTRADA" | "SAIDA"): Promise<void> {
  const s = await requireEmpresa();
  const negado = erroDePermissao(s, "presenca:marcar");
  if (negado) return voltarComErro("/empresa/eventos", negado);

  const inscricaoId = Number(formData.get("inscricaoId"));
  const insc = await prisma.inscricao.findFirst({
    where: { id: inscricaoId, evento: { empresaId: s.sub } },
    include: {
      evento: { select: { id: true, nome: true } },
      user: { select: { id: true, nome: true } },
      presenca: true,
    },
  });
  if (!insc) return voltarComErro("/empresa/eventos", "Escalação não encontrada.");
  const alvo = caminhoPainel(insc.evento.id);

  const agora = new Date();
  if (tipo === "ENTRADA") {
    if (insc.presenca?.checkInEm) {
      return voltarComErro(alvo, `${insc.user.nome} já tem check-in registrado.`);
    }
    await prisma.$transaction([
      prisma.registroPresenca.upsert({
        where: { inscricaoId: insc.id },
        create: { inscricaoId: insc.id, checkInEm: agora, registradoPorMembroId: s.membroId ?? null },
        update: { checkInEm: agora, registradoPorMembroId: s.membroId ?? null },
      }),
      // Check-in é a confirmação de presença — mantém o resumo coerente.
      prisma.inscricao.update({ where: { id: insc.id }, data: { status: "PRESENTE" } }),
    ]);
  } else {
    if (!insc.presenca?.checkInEm) {
      return voltarComErro(alvo, `Registre o check-in de ${insc.user.nome} antes do check-out.`);
    }
    if (insc.presenca.checkOutEm) {
      return voltarComErro(alvo, `${insc.user.nome} já tem check-out registrado.`);
    }
    await prisma.registroPresenca.update({
      where: { inscricaoId: insc.id },
      data: { checkOutEm: agora, registradoPorMembroId: s.membroId ?? null },
    });
  }

  await registrarAuditoria({
    atorTipo: "EMPRESA",
    atorId: s.sub,
    acao: tipo === "ENTRADA" ? "CHECKIN_REGISTRADO" : "CHECKOUT_REGISTRADO",
    entidade: "Inscricao",
    entidadeId: insc.id,
    detalhe: `${insc.user.nome} em ${insc.evento.nome}${s.membroNome ? ` (por ${s.membroNome})` : ""}`,
  });

  return voltarComSucesso(
    alvo,
    tipo === "ENTRADA" ? `Check-in de ${insc.user.nome} registrado.` : `Check-out de ${insc.user.nome} registrado.`,
  );
}
