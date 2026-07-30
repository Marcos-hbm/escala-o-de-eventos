/**
 * v3 (SaaS) — RBAC dentro da empresa (tenant).
 *
 * O controle por *tipo de conta* (TRABALHADOR × EMPRESA) continua no
 * `middleware.ts` e nos `require*` de `lib/auth.ts`. Aqui está a camada nova: o
 * que cada **papel** de membro pode fazer dentro da empresa.
 *
 * Funções puras (sem I/O) — testáveis no Vitest e usáveis também no edge
 * (middleware), já que o papel viaja no JWT de sessão.
 */

/** Espelha o enum `Papel` do Prisma. */
export type PapelId = "PROPRIETARIO" | "ADMIN" | "COORDENADOR" | "VISUALIZADOR";

export type Permissao =
  | "evento:criar"
  | "evento:editar"
  | "evento:excluir"
  | "escala:gerenciar"
  | "presenca:marcar"
  | "avaliacao:registrar"
  | "vinculo:gerenciar"
  | "empresa:editar"
  | "equipe:gerenciar"
  | "plano:gerenciar"
  | "conta:excluir";

const OPERACAO: Permissao[] = [
  "evento:criar",
  "evento:editar",
  "escala:gerenciar",
  "presenca:marcar",
  "avaliacao:registrar",
  "vinculo:gerenciar",
];

/**
 * Matriz de permissões. Leitura não aparece aqui: todo membro ativo enxerga os
 * dados da própria empresa (o isolamento por tenant é o `empresa_id`); o que os
 * papéis restringem é a **escrita**.
 */
export const MATRIZ_PERMISSOES: Record<PapelId, Permissao[]> = {
  // Dono da conta: operação + equipe + plano + exclusão da conta (LGPD).
  PROPRIETARIO: [...OPERACAO, "evento:excluir", "empresa:editar", "equipe:gerenciar", "plano:gerenciar", "conta:excluir"],
  // Administra a operação e a equipe, mas não mexe em contrato/plano nem exclui a conta.
  ADMIN: [...OPERACAO, "evento:excluir", "empresa:editar", "equipe:gerenciar"],
  // Roda a operação do dia a dia (eventos, escala, presença, vínculos).
  COORDENADOR: [...OPERACAO],
  // Somente leitura (ex.: cliente/financeiro acompanhando a operação).
  VISUALIZADOR: [],
};

export const ROTULOS_PAPEL: Record<PapelId, string> = {
  PROPRIETARIO: "Proprietário",
  ADMIN: "Administrador",
  COORDENADOR: "Coordenador",
  VISUALIZADOR: "Visualizador",
};

export const DESCRICOES_PAPEL: Record<PapelId, string> = {
  PROPRIETARIO: "Acesso total, incluindo equipe, plano e exclusão da conta.",
  ADMIN: "Gerencia eventos, escalas, vínculos e a equipe. Não altera o plano.",
  COORDENADOR: "Opera eventos, escalas, presença, avaliações e vínculos.",
  VISUALIZADOR: "Somente leitura: acompanha painéis, eventos e escalas.",
};

/** Ordem do mais privilegiado para o menos (exibição e comparação). */
export const ORDEM_PAPEIS: PapelId[] = ["PROPRIETARIO", "ADMIN", "COORDENADOR", "VISUALIZADOR"];

/** O papel tem a permissão? */
export function pode(papel: PapelId, permissao: Permissao): boolean {
  return MATRIZ_PERMISSOES[papel].includes(permissao);
}

export function rotuloPapel(papel: PapelId): string {
  return ROTULOS_PAPEL[papel];
}

/**
 * Papéis que `papel` pode atribuir a outro membro. Só o PROPRIETARIO cria
 * outro PROPRIETARIO (transferência de titularidade); ADMIN não promove
 * ninguém acima de si mesmo.
 */
export function papeisAtribuiveis(papel: PapelId): PapelId[] {
  if (!pode(papel, "equipe:gerenciar")) return [];
  if (papel === "PROPRIETARIO") return [...ORDEM_PAPEIS];
  return ORDEM_PAPEIS.filter((p) => p !== "PROPRIETARIO");
}

/** Mensagem de negação padrão — diz o papel atual e o que seria necessário. */
export function mensagemPermissao(papel: PapelId, permissao: Permissao): string {
  const papeisQuePodem = ORDEM_PAPEIS.filter((p) => pode(p, permissao)).map(rotuloPapel);
  return `Seu papel (${rotuloPapel(papel)}) não permite esta ação. Necessário: ${papeisQuePodem.join(" ou ")}.`;
}

/** `null` quando autorizado; mensagem pronta quando negado. */
export function checarPermissao(papel: PapelId, permissao: Permissao): string | null {
  return pode(papel, permissao) ? null : mensagemPermissao(papel, permissao);
}
