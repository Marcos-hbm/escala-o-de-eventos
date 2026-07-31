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
  | "conta:excluir"
  // v4 — financeiro e relacionamento
  | "financeiro:gerenciar"
  | "financeiro:ver"
  | "pix:ver"
  | "relacionamento:gerenciar"
  | "comunicacao:responder";

const OPERACAO: Permissao[] = [
  "evento:criar",
  "evento:editar",
  "escala:gerenciar",
  "presenca:marcar",
  "avaliacao:registrar",
  "vinculo:gerenciar",
  // Favoritar/bloquear trabalhador e responder solicitações do evento fazem parte
  // do dia a dia de quem coordena a operação.
  "relacionamento:gerenciar",
  "comunicacao:responder",
];

/**
 * Permissões financeiras (v4).
 *
 * A especificação diz "Empresa, Administradores e **coordenadores autorizados**".
 * Em vez de criar um quinto papel, PROPRIETARIO/ADMIN têm acesso pelo papel e o
 * COORDENADOR depende da flag `Membro.autorizadoFinanceiro` — ver `podeFinanceiro`.
 * VISUALIZADOR nunca tem, mesmo com a flag: é papel de leitura, e dado financeiro
 * com chave PIX é o mais sensível do sistema.
 */
const FINANCEIRO: Permissao[] = ["financeiro:gerenciar", "financeiro:ver", "pix:ver"];

/**
 * Matriz de permissões. Leitura não aparece aqui: todo membro ativo enxerga os
 * dados da própria empresa (o isolamento por tenant é o `empresa_id`); o que os
 * papéis restringem é a **escrita**.
 */
export const MATRIZ_PERMISSOES: Record<PapelId, Permissao[]> = {
  // Dono da conta: operação + financeiro + equipe + plano + exclusão da conta (LGPD).
  PROPRIETARIO: [
    ...OPERACAO,
    ...FINANCEIRO,
    "evento:excluir",
    "empresa:editar",
    "equipe:gerenciar",
    "plano:gerenciar",
    "conta:excluir",
  ],
  // Administra a operação, o financeiro e a equipe, mas não mexe em contrato/plano
  // nem exclui a conta.
  ADMIN: [...OPERACAO, ...FINANCEIRO, "evento:excluir", "empresa:editar", "equipe:gerenciar"],
  // Roda a operação do dia a dia. Financeiro só com autorização explícita
  // (ver `podeFinanceiro`), o que a matriz por papel não expressa sozinha.
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

/** Permissões financeiras são as únicas que dependem da flag do membro. */
export function ehPermissaoFinanceira(permissao: Permissao): boolean {
  return FINANCEIRO.includes(permissao);
}

/**
 * Regra completa do financeiro: papel **ou** coordenador explicitamente autorizado.
 *
 * `autorizadoFinanceiro` só promove COORDENADOR — dar a flag a um VISUALIZADOR não
 * o transforma em operador financeiro (seria contornar o papel por um checkbox).
 */
export function podeFinanceiro(
  papel: PapelId,
  permissao: Permissao,
  autorizadoFinanceiro: boolean,
): boolean {
  if (!ehPermissaoFinanceira(permissao)) return pode(papel, permissao);
  if (pode(papel, permissao)) return true;
  return papel === "COORDENADOR" && autorizadoFinanceiro;
}

/** Mensagem de negação específica do financeiro (diz como liberar). */
export function mensagemFinanceiro(papel: PapelId): string {
  if (papel === "COORDENADOR") {
    return "Seu papel (Coordenador) só acessa o financeiro com autorização explícita. Peça a um Proprietário ou Administrador para marcar “acesso financeiro” em Equipe.";
  }
  return `Seu papel (${rotuloPapel(papel)}) não tem acesso ao financeiro. Necessário: Proprietário, Administrador ou Coordenador autorizado.`;
}
