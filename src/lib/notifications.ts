import "server-only";
import { prisma } from "./prisma";
import type { TipoNotificacao } from "@prisma/client";

/**
 * Notificações internas (RF15). Nunca lançam: uma falha de notificação não deve
 * derrubar a operação de negócio (o pagamento foi registrado, o aviso é acessório).
 *
 * v4: o destinatário pode ser um trabalhador (`users`) ou um membro da empresa
 * (`membros`) — a notificação exige exatamente um dos dois (CHECK constraint).
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

/** Notifica um membro da empresa (coordenador/administrador) — v4. */
export async function notificarMembro(params: {
  membroId: number;
  tipo: TipoNotificacao;
  titulo: string;
  mensagem: string;
  link?: string;
}): Promise<void> {
  try {
    await prisma.notificacao.create({
      data: {
        membroId: params.membroId,
        tipo: params.tipo,
        titulo: params.titulo.slice(0, 160),
        mensagem: params.mensagem.slice(0, 500),
        link: params.link,
      },
    });
  } catch (e) {
    console.error("[notificacao] falha ao criar para membro:", e);
  }
}

/**
 * Notifica quem cuida do financeiro da empresa: PROPRIETARIO, ADMIN e
 * COORDENADOR com `autorizadoFinanceiro`. Usado por contestação de pagamento.
 *
 * A regra de quem tem acesso financeiro vive em `lib/rbac.ts`; aqui ela é
 * traduzida em consulta — se mudar lá, este filtro precisa acompanhar.
 */
export async function notificarResponsaveisFinanceiro(
  empresaId: number,
  base: { tipo: TipoNotificacao; titulo: string; mensagem: string; link?: string },
): Promise<void> {
  try {
    const membros = await prisma.membro.findMany({
      where: {
        empresaId,
        ativo: true,
        OR: [{ papel: { in: ["PROPRIETARIO", "ADMIN"] } }, { papel: "COORDENADOR", autorizadoFinanceiro: true }],
      },
      select: { id: true },
    });
    if (membros.length === 0) return;
    await prisma.notificacao.createMany({
      data: membros.map((m) => ({
        membroId: m.id,
        tipo: base.tipo,
        titulo: base.titulo.slice(0, 160),
        mensagem: base.mensagem.slice(0, 500),
        link: base.link,
      })),
    });
  } catch (e) {
    console.error("[notificacao] falha ao notificar responsáveis do financeiro:", e);
  }
}
