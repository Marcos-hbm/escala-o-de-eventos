import "server-only";
import { prisma } from "./prisma";
import {
  cabeMais,
  limitesDoPlano,
  mensagemLimite,
  mensagemRecurso,
  temRecurso,
  type PlanoId,
  type RecursoContavel,
  type RecursoPlano,
} from "./planos";

/**
 * v3 (SaaS) — leitura da assinatura e do consumo do tenant.
 *
 * Faz o I/O que `lib/planos.ts` (puro) não faz: descobre o plano da empresa e
 * conta o uso atual para comparar com os limites.
 */

export type StatusAssinaturaId = "TRIAL" | "ATIVA" | "INADIMPLENTE" | "CANCELADA";

export interface AssinaturaAtual {
  plano: PlanoId;
  status: StatusAssinaturaId;
  trialTerminaEm: Date | null;
}

/** Status de eventos que ocupam a cota de "eventos ativos". */
export const STATUS_EVENTO_ATIVO = ["RASCUNHO", "PUBLICADO", "ESCALADO"] as const;
/** Status de vínculo que ocupam a cota de "vínculos ativos". */
export const STATUS_VINCULO_OCUPADO = ["ATIVO", "PENDENTE"] as const;

/**
 * Assinatura da empresa. Empresas sem linha em `assinaturas` (cenário só
 * possível em dados criados fora do fluxo do app) são tratadas como STARTER em
 * TRIAL — o plano mais restrito, para não liberar recurso pago por omissão.
 */
export async function assinaturaDaEmpresa(empresaId: number): Promise<AssinaturaAtual> {
  const a = await prisma.assinatura.findUnique({
    where: { empresaId },
    select: { plano: true, status: true, trialTerminaEm: true },
  });
  if (!a) return { plano: "STARTER", status: "TRIAL", trialTerminaEm: null };
  return { plano: a.plano, status: a.status, trialTerminaEm: a.trialTerminaEm };
}

export interface UsoDaEmpresa {
  maxMembros: number; // membros ativos
  maxEventosAtivos: number; // eventos não encerrados
  maxVinculosAtivos: number; // vínculos ATIVO + PENDENTE
}

/** Consumo atual, com as mesmas chaves de `LimitesPlano` (facilita o pareamento). */
export async function usoDaEmpresa(empresaId: number): Promise<UsoDaEmpresa> {
  const [membros, eventosAtivos, vinculosAtivos] = await Promise.all([
    prisma.membro.count({ where: { empresaId, ativo: true } }),
    prisma.evento.count({ where: { empresaId, status: { in: [...STATUS_EVENTO_ATIVO] } } }),
    prisma.vinculo.count({ where: { empresaId, status: { in: [...STATUS_VINCULO_OCUPADO] } } }),
  ]);
  return { maxMembros: membros, maxEventosAtivos: eventosAtivos, maxVinculosAtivos: vinculosAtivos };
}

/**
 * Gating de limite para uso em server action: `null` = pode criar mais;
 * string = mensagem de bloqueio (com o caminho para resolver).
 */
export async function erroDeLimite(
  empresaId: number,
  recurso: RecursoContavel,
): Promise<string | null> {
  const { plano } = await assinaturaDaEmpresa(empresaId);
  const limite = limitesDoPlano(plano)[recurso];
  if (limite === null) return null;

  const uso = await usoDaEmpresa(empresaId);
  return cabeMais(uso[recurso], limite) ? null : mensagemLimite(recurso, plano);
}

/** Gating de recurso (feature flag) para server action. */
export async function erroDeRecurso(
  empresaId: number,
  recurso: RecursoPlano,
): Promise<string | null> {
  const { plano } = await assinaturaDaEmpresa(empresaId);
  return temRecurso(plano, recurso) ? null : mensagemRecurso(recurso, plano);
}

/** Leitura para as páginas: plano + recurso liberado. */
export async function recursoLiberado(empresaId: number, recurso: RecursoPlano): Promise<boolean> {
  const { plano } = await assinaturaDaEmpresa(empresaId);
  return temRecurso(plano, recurso);
}
