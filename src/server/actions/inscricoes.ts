"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { estaBloqueado } from "@/lib/bloqueio";
import { requireTrabalhador } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/audit";

/**
 * Regra de negócio central (RF13): um trabalhador só pode se inscrever em
 * eventos de empresas às quais está vinculado (status ATIVO). Retorna o
 * vínculo ativo ou null.
 */
async function vinculoAtivo(userId: number, empresaId: number) {
  return prisma.vinculo.findFirst({
    where: { userId, empresaId, status: "ATIVO" },
    select: { id: true },
  });
}

// --------------------------------------------------------------------------
// RF09 — Inscrever-se em um evento (candidatura)
// --------------------------------------------------------------------------
export async function inscreverEvento(formData: FormData) {
  const s = await requireTrabalhador();
  const eventoId = Number(formData.get("eventoId"));

  const evento = await prisma.evento.findUnique({ where: { id: eventoId } });
  if (!evento || evento.status !== "PUBLICADO") return;

  // RF13 — precisa de vínculo ativo com a empresa organizadora.
  if (!(await vinculoAtivo(s.sub, evento.empresaId))) return;

  // v4 item 5: bloqueado não se candidata novamente. Verificação no servidor, não
  // só na tela — a action é o que precisa recusar, inclusive por requisição direta.
  if (await estaBloqueado(s.sub, evento.empresaId)) {
    await registrarAuditoria({
      atorTipo: "TRABALHADOR",
      atorId: s.sub,
      acao: "INSCRICAO_BLOQUEADA",
      entidade: "Evento",
      entidadeId: eventoId,
      detalhe: "tentativa de candidatura com bloqueio vigente",
    });
    return;
  }

  await prisma.inscricao.upsert({
    where: { eventoId_userId: { eventoId, userId: s.sub } },
    create: { eventoId, userId: s.sub, status: "INSCRITO" },
    update: { status: "INSCRITO" }, // permite reinscrição após cancelar
  });

  await registrarAuditoria({
    atorTipo: "TRABALHADOR",
    atorId: s.sub,
    acao: "INSCRICAO",
    entidade: "Evento",
    entidadeId: eventoId,
  });
  revalidatePath(`/trabalhador/eventos/${eventoId}`);
  revalidatePath("/trabalhador/eventos");
}

// --------------------------------------------------------------------------
// RF09 / RF14 — Recusar (cancelar) participação
// --------------------------------------------------------------------------
export async function recusarEvento(formData: FormData) {
  const s = await requireTrabalhador();
  const eventoId = Number(formData.get("eventoId"));

  const inscricao = await prisma.inscricao.findUnique({
    where: { eventoId_userId: { eventoId, userId: s.sub } },
  });

  if (inscricao) {
    // Não permite abandonar após já ter sido escalado e evento finalizado.
    const evento = await prisma.evento.findUnique({ where: { id: eventoId }, select: { status: true } });
    if (evento?.status === "FINALIZADO") return;
    await prisma.inscricao.update({
      where: { id: inscricao.id },
      data: { status: "CANCELADO_TRABALHADOR" },
    });
  } else {
    // "Recusar evento" mesmo sem inscrição prévia: registra a recusa.
    await prisma.inscricao.create({
      data: { eventoId, userId: s.sub, status: "CANCELADO_TRABALHADOR" },
    });
  }

  await registrarAuditoria({
    atorTipo: "TRABALHADOR",
    atorId: s.sub,
    acao: "INSCRICAO_CANCELADA",
    entidade: "Evento",
    entidadeId: eventoId,
  });
  revalidatePath(`/trabalhador/eventos/${eventoId}`);
  revalidatePath("/trabalhador/eventos");
}
