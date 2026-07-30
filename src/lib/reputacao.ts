import "server-only";
import { prisma } from "./prisma";

export interface Rep {
  media: number | null;
  qtd: number;
}

/** Reputação de vários trabalhadores (avaliações feitas por empresas). */
export async function reputacoesDeTrabalhadores(userIds: number[]): Promise<Map<number, Rep>> {
  const out = new Map<number, Rep>();
  if (!userIds.length) return out;
  const grupos = await prisma.avaliacao.groupBy({
    by: ["userId"],
    where: { autor: "EMPRESA", userId: { in: userIds } },
    _avg: { nota: true },
    _count: { _all: true },
  });
  for (const g of grupos) {
    out.set(g.userId, {
      media: g._avg.nota != null ? Math.round(g._avg.nota * 10) / 10 : null,
      qtd: g._count._all,
    });
  }
  return out;
}

/** Reputação de uma empresa (avaliações feitas por trabalhadores). */
export async function reputacaoDeEmpresa(empresaId: number): Promise<Rep> {
  const g = await prisma.avaliacao.aggregate({
    where: { autor: "TRABALHADOR", empresaId },
    _avg: { nota: true },
    _count: { _all: true },
  });
  return {
    media: g._avg.nota != null ? Math.round(g._avg.nota * 10) / 10 : null,
    qtd: g._count._all,
  };
}

export interface Presenca {
  presentes: number;
  faltas: number;
}

/** Presenças/faltas por trabalhador (para reputação e ordenação). */
export async function presencasDeTrabalhadores(userIds: number[]): Promise<Map<number, Presenca>> {
  const out = new Map<number, Presenca>();
  if (!userIds.length) return out;
  const grupos = await prisma.inscricao.groupBy({
    by: ["userId", "status"],
    where: { userId: { in: userIds }, status: { in: ["PRESENTE", "FALTA"] } },
    _count: { _all: true },
  });
  for (const g of grupos) {
    const cur = out.get(g.userId) ?? { presentes: 0, faltas: 0 };
    if (g.status === "PRESENTE") cur.presentes += g._count._all;
    else if (g.status === "FALTA") cur.faltas += g._count._all;
    out.set(g.userId, cur);
  }
  return out;
}

/**
 * Detecção de conflito de agenda: quais dos userIds já estão escalados
 * (ESCALADO/PRESENTE) em OUTRO evento na mesma data.
 */
export async function conflitosDeAgenda(
  userIds: number[],
  dataEvento: Date,
  exceptEventoId: number,
): Promise<Set<number>> {
  const conflitos = new Set<number>();
  if (!userIds.length) return conflitos;
  const inscricoes = await prisma.inscricao.findMany({
    where: {
      userId: { in: userIds },
      status: { in: ["ESCALADO", "PRESENTE"] },
      eventoId: { not: exceptEventoId },
      evento: { dataEvento },
    },
    select: { userId: true },
  });
  for (const i of inscricoes) conflitos.add(i.userId);
  return conflitos;
}
