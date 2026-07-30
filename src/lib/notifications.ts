import "server-only";
import { prisma } from "./prisma";
import type { TipoNotificacao } from "@prisma/client";

/**
 * Notificações internas (RF15). Direcionadas sempre a um trabalhador
 * (destinatário com conta na tabela users). Não lança em caso de falha.
 */
export async function notificar(params: {
  userId: number;
  tipo: TipoNotificacao;
  titulo: string;
  mensagem: string;
  link?: string;
}): Promise<void> {
  try {
    await prisma.notificacao.create({
      data: {
        userId: params.userId,
        tipo: params.tipo,
        titulo: params.titulo.slice(0, 160),
        mensagem: params.mensagem.slice(0, 500),
        link: params.link,
      },
    });
  } catch (e) {
    console.error("[notificacao] falha ao criar:", e);
  }
}

/** Notifica em lote (ex.: novo evento para vários vinculados). */
export async function notificarEmLote(
  userIds: number[],
  base: { tipo: TipoNotificacao; titulo: string; mensagem: string; link?: string },
): Promise<void> {
  if (userIds.length === 0) return;
  try {
    await prisma.notificacao.createMany({
      data: userIds.map((userId) => ({
        userId,
        tipo: base.tipo,
        titulo: base.titulo.slice(0, 160),
        mensagem: base.mensagem.slice(0, 500),
        link: base.link,
      })),
    });
  } catch (e) {
    console.error("[notificacao] falha em lote:", e);
  }
}
