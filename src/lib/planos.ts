/**
 * v3 (SaaS) — Catálogo de planos e regras de limite.
 *
 * Funções PURAS, sem I/O: o que vem do banco (plano da assinatura + números de
 * uso) entra por parâmetro. Assim o gating é testável offline no Vitest, do
 * mesmo jeito que `lib/stats.ts`.
 *
 * Convenção: limite `null` = ilimitado (plano ENTERPRISE).
 */

/** Espelha o enum `Plano` do Prisma (mantido como literal para ficar sem I/O). */
export type PlanoId = "STARTER" | "PROFESSIONAL" | "ENTERPRISE";

/**
 * Recursos ligados/desligados por plano (feature flags).
 * Só entram aqui recursos que existem de fato no produto — a escalação
 * inteligente (score de reputação + presença, `lib/stats.ts`) é o extra de
 * produtividade da v2. Requisitos do TCC (RF01–RF15, incl. exportação da lista
 * em CSV) NÃO são gated: são função-base do sistema em qualquer plano.
 */
export type RecursoPlano = "escalacaoInteligente";

export interface LimitesPlano {
  /** Usuários da conta (linhas em `membros`), incluindo o PROPRIETARIO. */
  maxMembros: number | null;
  /** Eventos não encerrados (RASCUNHO/PUBLICADO/ESCALADO). */
  maxEventosAtivos: number | null;
  /** Vínculos ATIVO + PENDENTE com trabalhadores. */
  maxVinculosAtivos: number | null;
}

export interface DefinicaoPlano {
  id: PlanoId;
  rotulo: string;
  /** Em BRL/mês; `null` = sob consulta (ENTERPRISE). */
  precoMensal: number | null;
  limites: LimitesPlano;
  recursos: Record<RecursoPlano, boolean>;
  destaques: string[];
}

/** Recurso de uso medido contra um limite do plano. */
export type RecursoContavel = keyof LimitesPlano;

export const PLANOS: Record<PlanoId, DefinicaoPlano> = {
  STARTER: {
    id: "STARTER",
    rotulo: "Starter",
    precoMensal: 0,
    limites: { maxMembros: 2, maxEventosAtivos: 3, maxVinculosAtivos: 25 },
    recursos: { escalacaoInteligente: false },
    destaques: [
      "2 usuários na conta",
      "3 eventos ativos ao mesmo tempo",
      "25 vínculos com trabalhadores",
      "Escalação manual, presença e avaliações",
    ],
  },
  PROFESSIONAL: {
    id: "PROFESSIONAL",
    rotulo: "Professional",
    precoMensal: 149,
    limites: { maxMembros: 8, maxEventosAtivos: 25, maxVinculosAtivos: 200 },
    recursos: { escalacaoInteligente: true },
    destaques: [
      "8 usuários com papéis (RBAC)",
      "25 eventos ativos",
      "200 vínculos com trabalhadores",
      "Escalação inteligente (score de reputação + presença)",
    ],
  },
  ENTERPRISE: {
    id: "ENTERPRISE",
    rotulo: "Enterprise",
    precoMensal: null,
    limites: { maxMembros: null, maxEventosAtivos: null, maxVinculosAtivos: null },
    recursos: { escalacaoInteligente: true },
    destaques: [
      "Usuários, eventos e vínculos ilimitados",
      "Todos os recursos do Professional",
      "Suporte dedicado",
    ],
  },
};

/** Ordem de exibição/upgrade (do menor para o maior). */
export const ORDEM_PLANOS: PlanoId[] = ["STARTER", "PROFESSIONAL", "ENTERPRISE"];

export function definicaoDoPlano(plano: PlanoId): DefinicaoPlano {
  return PLANOS[plano];
}

export function limitesDoPlano(plano: PlanoId): LimitesPlano {
  return PLANOS[plano].limites;
}

export function rotuloPlano(plano: PlanoId): string {
  return PLANOS[plano].rotulo;
}

/** O plano libera o recurso? */
export function temRecurso(plano: PlanoId, recurso: RecursoPlano): boolean {
  return PLANOS[plano].recursos[recurso];
}

/** Cabe mais um? (`limite` null = ilimitado). */
export function cabeMais(usoAtual: number, limite: number | null): boolean {
  if (limite === null) return true;
  return usoAtual < limite;
}

/** Quantos ainda cabem; `null` quando ilimitado. */
export function restante(usoAtual: number, limite: number | null): number | null {
  if (limite === null) return null;
  return Math.max(0, limite - usoAtual);
}

/** Percentual de consumo do limite (0..100). Ilimitado → 0. */
export function pctUso(usoAtual: number, limite: number | null): number {
  if (limite === null || limite <= 0) return 0;
  return Math.min(100, Math.round((usoAtual / limite) * 100));
}

/** "Ilimitado" ou o número, para exibição. */
export function rotuloLimite(limite: number | null): string {
  return limite === null ? "Ilimitado" : String(limite);
}

const NOMES_RECURSO: Record<RecursoContavel, { plural: string; comoLiberar: string }> = {
  maxMembros: {
    plural: "usuários na conta",
    comoLiberar: "Desative um membro em Equipe ou faça upgrade de plano.",
  },
  maxEventosAtivos: {
    plural: "eventos ativos",
    comoLiberar: "Finalize ou cancele um evento, ou faça upgrade de plano.",
  },
  maxVinculosAtivos: {
    plural: "vínculos ativos ou pendentes",
    comoLiberar: "Desvincule um trabalhador ou faça upgrade de plano.",
  },
};

/**
 * Mensagem de bloqueio por limite — diz o limite, o plano atual e **como
 * resolver** (não só "negado").
 */
export function mensagemLimite(recurso: RecursoContavel, plano: PlanoId): string {
  const limite = limitesDoPlano(plano)[recurso];
  const info = NOMES_RECURSO[recurso];
  return `Limite do plano ${rotuloPlano(plano)} atingido: ${rotuloLimite(limite)} ${info.plural}. ${info.comoLiberar}`;
}

/** Mensagem de bloqueio por recurso indisponível no plano. */
export function mensagemRecurso(recurso: RecursoPlano, plano: PlanoId): string {
  const nomes: Record<RecursoPlano, string> = {
    escalacaoInteligente: "Escalação inteligente",
  };
  return `${nomes[recurso]} não está disponível no plano ${rotuloPlano(plano)}. Faça upgrade em Plano para habilitar.`;
}

/** O plano `destino` é um upgrade em relação a `atual`? */
export function ehUpgrade(atual: PlanoId, destino: PlanoId): boolean {
  return ORDEM_PLANOS.indexOf(destino) > ORDEM_PLANOS.indexOf(atual);
}
