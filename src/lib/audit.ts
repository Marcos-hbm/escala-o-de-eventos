import "server-only";
import { headers } from "next/headers";
import { prisma } from "./prisma";
import type { TipoAtor } from "@prisma/client";

/**
 * Registra um evento na trilha de auditoria (RNF07).
 * Nunca lança: uma falha de auditoria não deve derrubar a operação de
 * negócio, mas é logada no servidor.
 */
export async function registrarAuditoria(params: {
  atorTipo: TipoAtor;
  atorId?: number | null;
  acao: string;
  entidade?: string;
  entidadeId?: number | null;
  detalhe?: string;
}): Promise<void> {
  try {
    let ip: string | undefined;
    try {
      const h = await headers();
      ip =
        h.get("x-forwarded-for")?.split(",")[0]?.trim() ??
        h.get("x-real-ip") ??
        undefined;
    } catch {
      // fora de contexto de request
    }

    await prisma.auditLog.create({
      data: {
        atorTipo: params.atorTipo,
        atorId: params.atorId ?? null,
        acao: params.acao,
        entidade: params.entidade,
        entidadeId: params.entidadeId ?? null,
        detalhe: params.detalhe?.slice(0, 500),
        ip,
      },
    });
  } catch (e) {
    console.error("[auditoria] falha ao registrar:", e);
  }
}
