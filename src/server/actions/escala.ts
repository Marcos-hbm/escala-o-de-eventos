"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { erroDePermissao, requireEmpresa } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/audit";
import { notificarEmLote } from "@/lib/notifications";
import { escalarSchema } from "@/lib/validations";
import { type ActionState } from "@/lib/actions";
import { voltarComSucesso } from "@/server/actions/navegacao";
import { voltarParaOrigem } from "@/server/actions/navegacao";

/**
 * RF10 / RF11 — Escala e finalização.
 * A empresa marca, entre os inscritos, quem será escalado e finaliza o
 * evento. Os selecionados passam a ESCALADO; os demais inscritos viram
 * RECUSADO_EMPRESA. O evento vai para FINALIZADO e a lista (CSV) fica
 * disponível para download. Após finalizar, a lista não muda pelo sistema
 * (conforme regra da tela "Escalar e finalizar evento").
 */
export async function escalarEFinalizar(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const s = await requireEmpresa();
  const negado = erroDePermissao(s, "escala:gerenciar");
  if (negado) return { ok: false, message: negado };

  const parsed = escalarSchema.safeParse({
    eventoId: formData.get("eventoId"),
    userIds: formData.getAll("userIds"),
  });
  if (!parsed.success) {
    return { ok: false, message: "Selecione ao menos um trabalhador para escalar." };
  }
  const { eventoId, userIds } = parsed.data;
  const alvo = `/empresa/eventos/${eventoId}/escalar`;

  const evento = await prisma.evento.findUnique({ where: { id: eventoId } });
  if (!evento || evento.empresaId !== s.sub) {
    return { ok: false, message: "Evento não encontrado." };
  }
  if (evento.status === "FINALIZADO") {
    return { ok: false, message: "Evento já finalizado." };
  }

  // Garante que os userIds selecionados realmente têm inscrição neste evento.
  const inscricoesValidas = await prisma.inscricao.findMany({
    where: { eventoId, userId: { in: userIds }, status: { in: ["INSCRITO", "ESCALADO"] } },
    select: { userId: true },
  });
  const idsValidos = inscricoesValidas.map((i) => i.userId);
  if (idsValidos.length === 0) {
    return { ok: false, message: "Nenhum dos selecionados possui inscrição válida." };
  }

  await prisma.$transaction([
    // Escalados
    prisma.inscricao.updateMany({
      where: { eventoId, userId: { in: idsValidos } },
      data: { status: "ESCALADO" },
    }),
    // Demais inscritos → recusados pela empresa
    prisma.inscricao.updateMany({
      where: { eventoId, userId: { notIn: idsValidos }, status: "INSCRITO" },
      data: { status: "RECUSADO_EMPRESA" },
    }),
    prisma.evento.update({ where: { id: eventoId }, data: { status: "FINALIZADO" } }),
  ]);

  await notificarEmLote(idsValidos, {
    tipo: "ESCALADO",
    titulo: "Você foi escalado!",
    mensagem: `Você foi escalado para "${evento.nome}".`,
    link: `/trabalhador/historico`,
  });

  await registrarAuditoria({
    atorTipo: "EMPRESA",
    atorId: s.sub,
    acao: "ESCALA_FINALIZADA",
    entidade: "Evento",
    entidadeId: eventoId,
    detalhe: `${idsValidos.length} escalados`,
  });

  revalidatePath(alvo);
  revalidatePath("/empresa/eventos");
  return voltarComSucesso(alvo, `Escala finalizada com ${idsValidos.length} trabalhador(es).`);
}

/** Reabre um evento finalizado para nova escala (correção operacional). */
export async function reabrirEvento(formData: FormData) {
  const s = await requireEmpresa();
  if (erroDePermissao(s, "escala:gerenciar")) return;
  const eventoId = Number(formData.get("eventoId"));
  const evento = await prisma.evento.findUnique({ where: { id: eventoId } });
  if (!evento || evento.empresaId !== s.sub) return;
  await prisma.evento.update({ where: { id: eventoId }, data: { status: "PUBLICADO" } });
  await registrarAuditoria({
    atorTipo: "EMPRESA",
    atorId: s.sub,
    acao: "EVENTO_REABERTO",
    entidade: "Evento",
    entidadeId: eventoId,
  });
  revalidatePath(`/empresa/eventos/${eventoId}/escalar`);
  await voltarParaOrigem(`/empresa/eventos/${eventoId}/escalar`);
}
