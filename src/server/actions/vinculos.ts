"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { erroDePermissao, requireEmpresa, requireTrabalhador } from "@/lib/auth";
import { erroDeLimite } from "@/lib/assinatura";
import { getSession } from "@/lib/session";
import { registrarAuditoria } from "@/lib/audit";
import { notificar } from "@/lib/notifications";

// --------------------------------------------------------------------------
// RF06 — Trabalhador solicita vínculo a uma empresa
// --------------------------------------------------------------------------
export async function solicitarVinculo(formData: FormData) {
  const s = await requireTrabalhador();
  const empresaId = Number(formData.get("empresaId"));
  if (!empresaId) return;

  const empresa = await prisma.empresa.findUnique({ where: { id: empresaId }, select: { id: true, ativo: true } });
  if (!empresa || !empresa.ativo) return;

  const existente = await prisma.vinculo.findUnique({
    where: { userId_empresaId: { userId: s.sub, empresaId } },
  });

  if (existente) {
    // Reativa vínculos recusados/desfeitos como novo pedido.
    if (["RECUSADO", "DESVINCULADO"].includes(existente.status)) {
      await prisma.vinculo.update({
        where: { id: existente.id },
        data: { status: "PENDENTE", solicitadoPor: "TRABALHADOR" },
      });
    }
  } else {
    await prisma.vinculo.create({
      data: { userId: s.sub, empresaId, status: "PENDENTE", solicitadoPor: "TRABALHADOR" },
    });
  }

  await registrarAuditoria({
    atorTipo: "TRABALHADOR",
    atorId: s.sub,
    acao: "VINCULO_SOLICITADO",
    entidade: "Empresa",
    entidadeId: empresaId,
  });
  revalidatePath("/trabalhador/vinculos");
}

// --------------------------------------------------------------------------
// RF06 — Empresa envia convite de vínculo a um trabalhador
// --------------------------------------------------------------------------
export async function convidarTrabalhador(formData: FormData) {
  const s = await requireEmpresa();
  if (erroDePermissao(s, "vinculo:gerenciar")) return;
  // Cota de vínculos do plano. Só as ações DA EMPRESA são barradas pelo limite —
  // um trabalhador nunca recebe erro por causa do plano da empresa (ver
  // solicitarVinculo). Em troca, pedidos recebidos podem levar a conta ao teto:
  // aí a empresa não convida/aceita mais ninguém até liberar espaço.
  if (await erroDeLimite(s.sub, "maxVinculosAtivos")) return;

  const userId = Number(formData.get("userId"));
  if (!userId) return;

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { id: true, ativo: true } });
  if (!user || !user.ativo) return;

  const existente = await prisma.vinculo.findUnique({
    where: { userId_empresaId: { userId, empresaId: s.sub } },
  });

  if (existente) {
    if (["RECUSADO", "DESVINCULADO"].includes(existente.status)) {
      await prisma.vinculo.update({
        where: { id: existente.id },
        data: { status: "PENDENTE", solicitadoPor: "EMPRESA" },
      });
    }
  } else {
    await prisma.vinculo.create({
      data: { userId, empresaId: s.sub, status: "PENDENTE", solicitadoPor: "EMPRESA" },
    });
  }

  await notificar({
    userId,
    tipo: "CONVITE_VINCULO",
    titulo: "Novo convite de vínculo",
    mensagem: `A empresa ${s.nome} convidou você para se vincular.`,
    link: "/trabalhador/vinculos",
  });
  await registrarAuditoria({
    atorTipo: "EMPRESA",
    atorId: s.sub,
    acao: "VINCULO_CONVITE",
    entidade: "User",
    entidadeId: userId,
  });
  revalidatePath("/empresa/vinculos");
}

// --------------------------------------------------------------------------
// RF06 — Responder a um vínculo (aceitar/recusar). Só quem NÃO solicitou responde.
// --------------------------------------------------------------------------
export async function responderVinculo(formData: FormData) {
  const vinculoId = Number(formData.get("vinculoId"));
  const aceitar = formData.get("acao") === "aceitar";

  const bruta = await getSession();
  if (!bruta) return;
  // v3: para empresa, revalida membro e papel no banco (desativação e troca de
  // papel passam a valer na hora, sem esperar o JWT expirar).
  const sessao = bruta.tipo === "EMPRESA" ? await requireEmpresa() : bruta;

  const vinculo = await prisma.vinculo.findUnique({ where: { id: vinculoId } });
  if (!vinculo || vinculo.status !== "PENDENTE") return;

  // Autorização: o respondente deve ser a contraparte de quem solicitou.
  const ehTrabalhador = sessao.tipo === "TRABALHADOR";
  if (ehTrabalhador && (vinculo.userId !== sessao.sub || vinculo.solicitadoPor !== "EMPRESA")) return;
  if (!ehTrabalhador && (vinculo.empresaId !== sessao.sub || vinculo.solicitadoPor !== "TRABALHADOR")) return;
  // v3: do lado da empresa, responder a um pedido exige papel com permissão.
  if (!ehTrabalhador && erroDePermissao(sessao, "vinculo:gerenciar")) return;

  const novoStatus = aceitar ? "ATIVO" : "RECUSADO";
  await prisma.vinculo.update({ where: { id: vinculoId }, data: { status: novoStatus } });

  // Notifica o trabalhador quando a empresa responde ao pedido dele.
  if (!ehTrabalhador) {
    await notificar({
      userId: vinculo.userId,
      tipo: aceitar ? "VINCULO_ACEITO" : "VINCULO_RECUSADO",
      titulo: aceitar ? "Vínculo aceito" : "Vínculo recusado",
      mensagem: `Sua solicitação de vínculo com ${sessao.nome} foi ${aceitar ? "aceita" : "recusada"}.`,
      link: "/trabalhador/vinculos",
    });
  }

  await registrarAuditoria({
    atorTipo: sessao.tipo,
    atorId: sessao.sub,
    acao: aceitar ? "VINCULO_ACEITO" : "VINCULO_RECUSADO",
    entidade: "Vinculo",
    entidadeId: vinculoId,
  });

  revalidatePath("/trabalhador/vinculos");
  revalidatePath("/empresa/vinculos");
}

// --------------------------------------------------------------------------
// RF07 — Desvincular (qualquer uma das partes)
// --------------------------------------------------------------------------
export async function desvincular(formData: FormData) {
  const vinculoId = Number(formData.get("vinculoId"));
  const bruta = await getSession();
  if (!bruta) return;
  const sessao = bruta.tipo === "EMPRESA" ? await requireEmpresa() : bruta;

  const vinculo = await prisma.vinculo.findUnique({ where: { id: vinculoId } });
  if (!vinculo) return;
  const pertence =
    sessao.tipo === "TRABALHADOR" ? vinculo.userId === sessao.sub : vinculo.empresaId === sessao.sub;
  if (!pertence) return;
  if (sessao.tipo === "EMPRESA" && erroDePermissao(sessao, "vinculo:gerenciar")) return;

  await prisma.vinculo.update({ where: { id: vinculoId }, data: { status: "DESVINCULADO", favorito: false } });
  await registrarAuditoria({
    atorTipo: sessao.tipo,
    atorId: sessao.sub,
    acao: "VINCULO_DESFEITO",
    entidade: "Vinculo",
    entidadeId: vinculoId,
  });
  revalidatePath("/trabalhador/vinculos");
  revalidatePath("/empresa/vinculos");
}

// --------------------------------------------------------------------------
// Favoritar empresa (Tabela 04, campo favorito) — ação do trabalhador
// --------------------------------------------------------------------------
export async function alternarFavorito(formData: FormData) {
  const s = await requireTrabalhador();
  const vinculoId = Number(formData.get("vinculoId"));
  const vinculo = await prisma.vinculo.findUnique({ where: { id: vinculoId } });
  if (!vinculo || vinculo.userId !== s.sub) return;
  await prisma.vinculo.update({ where: { id: vinculoId }, data: { favorito: !vinculo.favorito } });
  revalidatePath("/trabalhador/vinculos");
}
