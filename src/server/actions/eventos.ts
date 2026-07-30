"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { erroDePermissao, requireEmpresa } from "@/lib/auth";
import { erroDeLimite } from "@/lib/assinatura";
import { registrarAuditoria } from "@/lib/audit";
import { notificarEmLote } from "@/lib/notifications";
import { eventoSchema } from "@/lib/validations";
import { type ActionState, zodToFieldErrors } from "@/lib/actions";

function lerEvento(formData: FormData) {
  return eventoSchema.safeParse({
    nome: formData.get("nome"),
    descricao: formData.get("descricao"),
    dataEvento: formData.get("dataEvento"),
    local: formData.get("local"),
    horaInicio: formData.get("horaInicio"),
    vagas: formData.get("vagas"),
    funcoes: formData.get("funcoes"),
    valorCache: formData.get("valorCache"),
    observacoes: formData.get("observacoes"),
  });
}

// --------------------------------------------------------------------------
// RF05 / RF08 — Criar evento (publicado; notifica vinculados ativos)
// --------------------------------------------------------------------------
export async function criarEvento(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const s = await requireEmpresa();
  // v3: papel do membro (RBAC) e cota de eventos ativos do plano.
  const negado = erroDePermissao(s, "evento:criar");
  if (negado) return { ok: false, message: negado };
  const limite = await erroDeLimite(s.sub, "maxEventosAtivos");
  if (limite) return { ok: false, message: limite };

  const parsed = lerEvento(formData);
  if (!parsed.success) {
    return { ok: false, fieldErrors: zodToFieldErrors(parsed.error.flatten()) };
  }
  const d = parsed.data;

  const evento = await prisma.evento.create({
    data: {
      empresaId: s.sub,
      nome: d.nome,
      descricao: d.descricao || null,
      dataEvento: d.dataEvento,
      local: d.local || null,
      horaInicio: d.horaInicio || null,
      vagas: d.vagas,
      funcoes: d.funcoes || null,
      valorCache: d.valorCache,
      observacoes: d.observacoes || null,
      status: "PUBLICADO",
    },
  });

  // RF15 — notifica trabalhadores vinculados ativos sobre o novo evento.
  const vinculados = await prisma.vinculo.findMany({
    where: { empresaId: s.sub, status: "ATIVO" },
    select: { userId: true },
  });
  await notificarEmLote(
    vinculados.map((v) => v.userId),
    {
      tipo: "NOVO_EVENTO",
      titulo: "Nova oportunidade de trabalho",
      mensagem: `${s.nome} publicou o evento "${d.nome}".`,
      link: `/trabalhador/eventos/${evento.id}`,
    },
  );

  await registrarAuditoria({
    atorTipo: "EMPRESA",
    atorId: s.sub,
    acao: "EVENTO_CRIADO",
    entidade: "Evento",
    entidadeId: evento.id,
    detalhe: d.nome,
  });

  revalidatePath("/empresa/eventos");
  redirect("/empresa/eventos");
}

// --------------------------------------------------------------------------
// RF05 — Editar evento
// --------------------------------------------------------------------------
export async function editarEvento(_prev: ActionState, formData: FormData): Promise<ActionState> {
  const s = await requireEmpresa();
  const negado = erroDePermissao(s, "evento:editar");
  if (negado) return { ok: false, message: negado };

  const eventoId = Number(formData.get("eventoId"));
  const evento = await prisma.evento.findUnique({ where: { id: eventoId } });
  if (!evento || evento.empresaId !== s.sub) {
    return { ok: false, message: "Evento não encontrado." };
  }
  if (evento.status === "FINALIZADO") {
    return { ok: false, message: "Evento finalizado não pode ser editado." };
  }

  const parsed = lerEvento(formData);
  if (!parsed.success) {
    return { ok: false, fieldErrors: zodToFieldErrors(parsed.error.flatten()) };
  }
  const d = parsed.data;

  await prisma.evento.update({
    where: { id: eventoId },
    data: {
      nome: d.nome,
      descricao: d.descricao || null,
      dataEvento: d.dataEvento,
      local: d.local || null,
      horaInicio: d.horaInicio || null,
      vagas: d.vagas,
      funcoes: d.funcoes || null,
      valorCache: d.valorCache,
      observacoes: d.observacoes || null,
    },
  });

  // Notifica inscritos sobre a atualização.
  const inscritos = await prisma.inscricao.findMany({
    where: { eventoId, status: { in: ["INSCRITO", "ESCALADO"] } },
    select: { userId: true },
  });
  await notificarEmLote(
    inscritos.map((i) => i.userId),
    {
      tipo: "EVENTO_ATUALIZADO",
      titulo: "Evento atualizado",
      mensagem: `O evento "${d.nome}" foi atualizado.`,
      link: `/trabalhador/eventos/${eventoId}`,
    },
  );

  await registrarAuditoria({
    atorTipo: "EMPRESA",
    atorId: s.sub,
    acao: "EVENTO_EDITADO",
    entidade: "Evento",
    entidadeId: eventoId,
  });

  revalidatePath("/empresa/eventos");
  redirect("/empresa/eventos");
}

// --------------------------------------------------------------------------
// RF05 — Excluir evento
// --------------------------------------------------------------------------
export async function excluirEvento(formData: FormData) {
  const s = await requireEmpresa();
  if (erroDePermissao(s, "evento:excluir")) return;

  const eventoId = Number(formData.get("eventoId"));
  const evento = await prisma.evento.findUnique({ where: { id: eventoId } });
  if (!evento || evento.empresaId !== s.sub) return;

  await prisma.evento.delete({ where: { id: eventoId } });
  await registrarAuditoria({
    atorTipo: "EMPRESA",
    atorId: s.sub,
    acao: "EVENTO_EXCLUIDO",
    entidade: "Evento",
    entidadeId: eventoId,
    detalhe: evento.nome,
  });
  revalidatePath("/empresa/eventos");
}
