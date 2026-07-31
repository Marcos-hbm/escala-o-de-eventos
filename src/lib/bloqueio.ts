import "server-only";
import { prisma } from "./prisma";

/**
 * Bloqueio de trabalhador (v4, item 5) — consultas de gating.
 *
 * O bloqueio não é só um registro na tela: ele precisa valer nas **consultas**, ou o
 * trabalhador bloqueado continua vendo vagas e se candidatando por URL. Este módulo
 * concentra as três perguntas que o resto do sistema faz:
 *
 * 1. quais empresas bloquearam este trabalhador (filtro da descoberta de vagas);
 * 2. este trabalhador está bloqueado nesta empresa (candidatura e escala);
 * 3. quais trabalhadores esta empresa bloqueou (busca de candidatos).
 *
 * "Bloqueio vigente" = `removidoEm IS NULL` — as linhas removidas permanecem como
 * histórico (há índice parcial garantindo um vigente por par).
 */

/** Ids das empresas que bloquearam este trabalhador. */
export async function empresasQueBloquearam(userId: number): Promise<number[]> {
  const linhas = await prisma.trabalhadorBloqueio.findMany({
    where: { userId, removidoEm: null },
    select: { empresaId: true },
  });
  return linhas.map((l) => l.empresaId);
}

/** O trabalhador está bloqueado nesta empresa? */
export async function estaBloqueado(userId: number, empresaId: number): Promise<boolean> {
  const n = await prisma.trabalhadorBloqueio.count({
    where: { userId, empresaId, removidoEm: null },
  });
  return n > 0;
}

/** Ids dos trabalhadores bloqueados por esta empresa. */
export async function trabalhadoresBloqueados(empresaId: number): Promise<number[]> {
  const linhas = await prisma.trabalhadorBloqueio.findMany({
    where: { empresaId, removidoEm: null },
    select: { userId: true },
  });
  return linhas.map((l) => l.userId);
}

/** Motivo do bloqueio vigente (para explicar ao trabalhador o que aconteceu). */
export async function motivoDoBloqueio(userId: number, empresaId: number): Promise<string | null> {
  const b = await prisma.trabalhadorBloqueio.findFirst({
    where: { userId, empresaId, removidoEm: null },
    select: { motivo: true },
  });
  return b?.motivo ?? null;
}
