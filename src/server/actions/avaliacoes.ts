"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { erroDePermissao, requireEmpresa, requireTrabalhador } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/audit";
import { avaliacaoCriteriosSchema, avaliacaoSchema } from "@/lib/validations";
import { primeiroErroZod, type ActionState } from "@/lib/actions";
import { notasPreenchidas, validarAvaliacaoPorCriterios } from "@/lib/domain/avaliacao";
import { notificar } from "@/lib/notifications";
import { voltarComErro } from "@/server/actions/navegacao";
import { voltarComSucesso } from "@/server/actions/navegacao";

const STATUS_ESCALADO = ["ESCALADO", "PRESENTE", "FALTA"] as const;

// --------------------------------------------------------------------------
// v2 — Empresa avalia um trabalhador escalado (após evento finalizado)
// --------------------------------------------------------------------------
export async function avaliarTrabalhador(formData: FormData): Promise<void> {
  const s = await requireEmpresa();
  const negado = erroDePermissao(s, "avaliacao:registrar");
  if (negado) return voltarComErro("/empresa/eventos", negado);

  const parsed = avaliacaoCriteriosSchema.safeParse({
    eventoId: formData.get("eventoId"),
    userId: formData.get("userId"),
    pontualidade: formData.get("pontualidade"),
    comunicacao: formData.get("comunicacao"),
    trabalhoEquipe: formData.get("trabalhoEquipe"),
    qualidade: formData.get("qualidade"),
    comprometimento: formData.get("comprometimento"),
    comentario: formData.get("comentario"),
  });
  if (!parsed.success) return voltarComErro("/empresa/eventos", primeiroErroZod(parsed.error));
  const d = parsed.data;
  const alvo = `/empresa/eventos/${d.eventoId}/escalar`;

  // Regra pura: exige ao menos um critério e deriva a nota geral (média).
  const validacao = validarAvaliacaoPorCriterios(d);
  if (!validacao.ok) return voltarComErro(alvo, validacao.erro!);

  const evento = await prisma.evento.findFirst({ where: { id: d.eventoId, empresaId: s.sub } });
  if (!evento) return voltarComErro("/empresa/eventos", "Evento não encontrado.");
  if (evento.status !== "FINALIZADO") return voltarComErro(alvo, "Avalie apenas eventos finalizados.");

  const insc = await prisma.inscricao.findUnique({
    where: { eventoId_userId: { eventoId: d.eventoId, userId: d.userId } },
  });
  if (!insc || !STATUS_ESCALADO.includes(insc.status as (typeof STATUS_ESCALADO)[number])) {
    return voltarComErro(alvo, "Só é possível avaliar trabalhadores escalados.");
  }

  const dados = {
    nota: validacao.notaGeral!,
    notaPontualidade: d.pontualidade ?? null,
    notaComunicacao: d.comunicacao ?? null,
    notaTrabalhoEquipe: d.trabalhoEquipe ?? null,
    notaQualidade: d.qualidade ?? null,
    notaComprometimento: d.comprometimento ?? null,
    comentario: d.comentario || null,
  };

  await prisma.avaliacao.upsert({
    where: {
      eventoId_empresaId_userId_autor: {
        eventoId: d.eventoId,
        empresaId: s.sub,
        userId: d.userId,
        autor: "EMPRESA",
      },
    },
    create: { eventoId: d.eventoId, empresaId: s.sub, userId: d.userId, autor: "EMPRESA", ...dados },
    update: dados,
  });

  await registrarAuditoria({
    atorTipo: "EMPRESA",
    atorId: s.sub,
    acao: "AVALIACAO_TRABALHADOR",
    entidade: "User",
    entidadeId: d.userId,
    detalhe: `nota geral ${dados.nota} (${notasPreenchidas(d).length} critério(s))${s.membroNome ? ` por ${s.membroNome}` : ""}`,
  });

  // O trabalhador é avisado — a avaliação alimenta a reputação dele.
  await notificar({
    userId: d.userId,
    tipo: "AVALIACAO_RECEBIDA",
    titulo: "Você recebeu uma avaliação",
    mensagem: `${evento.nome}: nota geral ${dados.nota} de 5.`,
    link: "/trabalhador/perfil",
  });

  return voltarComSucesso(alvo, "Avaliação registrada.");
}

// --------------------------------------------------------------------------
// v2 — Trabalhador avalia a empresa (evento em que participou, finalizado)
// --------------------------------------------------------------------------
export async function avaliarEmpresa(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const s = await requireTrabalhador();
  const eventoId = Number(formData.get("eventoId"));
  const parsed = avaliacaoSchema.safeParse({
    nota: formData.get("nota"),
    comentario: formData.get("comentario"),
  });
  const alvoTrab = "/trabalhador/historico";
  if (!parsed.success) return { ok: false, message: "Nota inválida (use 1 a 5)." };

  const evento = await prisma.evento.findUnique({ where: { id: eventoId } });
  if (!evento) return { ok: false, message: "Evento não encontrado." };
  if (evento.status !== "FINALIZADO") return { ok: false, message: "Avalie apenas eventos finalizados." };

  const insc = await prisma.inscricao.findUnique({
    where: { eventoId_userId: { eventoId, userId: s.sub } },
  });
  if (!insc || !STATUS_ESCALADO.includes(insc.status as (typeof STATUS_ESCALADO)[number])) {
    return { ok: false, message: "Você não participou deste evento." };
  }

  await prisma.avaliacao.upsert({
    where: { eventoId_empresaId_userId_autor: { eventoId, empresaId: evento.empresaId, userId: s.sub, autor: "TRABALHADOR" } },
    create: { eventoId, empresaId: evento.empresaId, userId: s.sub, autor: "TRABALHADOR", nota: parsed.data.nota, comentario: parsed.data.comentario || null },
    update: { nota: parsed.data.nota, comentario: parsed.data.comentario || null },
  });

  await registrarAuditoria({ atorTipo: "TRABALHADOR", atorId: s.sub, acao: "AVALIACAO_EMPRESA", entidade: "Empresa", entidadeId: evento.empresaId });
  revalidatePath(alvoTrab);
  return voltarComSucesso(alvoTrab, "Avaliação registrada.");
}
