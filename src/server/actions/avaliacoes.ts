"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { erroDePermissao, requireEmpresa, requireTrabalhador } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/audit";
import { avaliacaoSchema } from "@/lib/validations";
import { type ActionState } from "@/lib/actions";
import { voltarComSucesso } from "@/server/actions/navegacao";

const STATUS_ESCALADO = ["ESCALADO", "PRESENTE", "FALTA"] as const;

// --------------------------------------------------------------------------
// v2 — Empresa avalia um trabalhador escalado (após evento finalizado)
// --------------------------------------------------------------------------
export async function avaliarTrabalhador(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const s = await requireEmpresa();
  const negado = erroDePermissao(s, "avaliacao:registrar");
  if (negado) return { ok: false, message: negado };

  const eventoId = Number(formData.get("eventoId"));
  const userId = Number(formData.get("userId"));
  const parsed = avaliacaoSchema.safeParse({
    nota: formData.get("nota"),
    comentario: formData.get("comentario"),
  });
  const alvo = `/empresa/eventos/${eventoId}/escalar`;
  if (!parsed.success) return { ok: false, message: "Nota inválida (use 1 a 5)." };

  const evento = await prisma.evento.findUnique({ where: { id: eventoId } });
  if (!evento || evento.empresaId !== s.sub) return { ok: false, message: "Evento não encontrado." };
  if (evento.status !== "FINALIZADO") return { ok: false, message: "Avalie apenas eventos finalizados." };

  const insc = await prisma.inscricao.findUnique({
    where: { eventoId_userId: { eventoId, userId } },
  });
  if (!insc || !STATUS_ESCALADO.includes(insc.status as (typeof STATUS_ESCALADO)[number])) {
    return { ok: false, message: "Só é possível avaliar trabalhadores escalados." };
  }

  await prisma.avaliacao.upsert({
    where: { eventoId_empresaId_userId_autor: { eventoId, empresaId: s.sub, userId, autor: "EMPRESA" } },
    create: { eventoId, empresaId: s.sub, userId, autor: "EMPRESA", nota: parsed.data.nota, comentario: parsed.data.comentario || null },
    update: { nota: parsed.data.nota, comentario: parsed.data.comentario || null },
  });

  await registrarAuditoria({ atorTipo: "EMPRESA", atorId: s.sub, acao: "AVALIACAO_TRABALHADOR", entidade: "User", entidadeId: userId });
  revalidatePath(alvo);
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
