"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { erroDePermissao, requireEmpresa } from "@/lib/auth";
import { registrarAuditoria } from "@/lib/audit";
import { voltarParaOrigem } from "@/server/actions/navegacao";

/**
 * v2 — Controle de presença / check-in.
 * A empresa marca PRESENTE ou FALTA para um trabalhador escalado. Alimenta a
 * reputação e a ordenação inteligente da escala.
 */
export async function marcarPresenca(formData: FormData) {
  const s = await requireEmpresa();
  if (erroDePermissao(s, "presenca:marcar")) return;
  const inscricaoId = Number(formData.get("inscricaoId"));
  const presente = formData.get("presente") === "true";

  const insc = await prisma.inscricao.findUnique({
    where: { id: inscricaoId },
    include: { evento: { select: { empresaId: true, id: true } } },
  });
  if (!insc || insc.evento.empresaId !== s.sub) return;
  if (!["ESCALADO", "PRESENTE", "FALTA"].includes(insc.status)) return;

  await prisma.inscricao.update({
    where: { id: inscricaoId },
    data: { status: presente ? "PRESENTE" : "FALTA" },
  });

  await registrarAuditoria({
    atorTipo: "EMPRESA",
    atorId: s.sub,
    acao: presente ? "PRESENCA_CONFIRMADA" : "FALTA_REGISTRADA",
    entidade: "Inscricao",
    entidadeId: inscricaoId,
  });
  revalidatePath(`/empresa/eventos/${insc.evento.id}/escalar`);
  await voltarParaOrigem(`/empresa/eventos/${insc.evento.id}/escalar`);
}
